// scoreController.js — Hakem Puanlama Endpointleri
// 100+ hakemin eşzamanlı puan göndermesini destekler (Firebase push() ile çakışma yok)
const { db } = require('../config/firebase');

/**
 * POST /api/scores/auth
 * Token ile hakem doğrulama
 */
exports.authenticate = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'Email gerekli' });
        }

        const snapshot = await db.ref('referees').orderByChild('email').equalTo(email.trim().toLowerCase()).once('value');
        const data = snapshot.val();

        if (!data) {
            return res.status(401).json({ success: false, message: 'Bu e-posta adresine ait hakem bulunamadı' });
        }

        const refereeId = Object.keys(data)[0];
        const referee = { id: refereeId, ...data[refereeId] };

        res.json({
            success: true,
            data: {
                id: referee.id,
                name: referee.name,
                firstName: referee.firstName,
                lastName: referee.lastName,
                discipline: referee.discipline,
                podiumId: referee.podiumId,
                examType: referee.examType
            }
        });
    } catch (error) {
        console.error('Score Auth Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/**
 * GET /api/scores/podium-state/:podiumId
 * Podium durumu + aktif video detayları
 */
exports.getPodiumState = async (req, res) => {
    try {
        const { podiumId } = req.params;
        const podiumSnap = await db.ref(`podiums/${podiumId}`).once('value');
        const podium = podiumSnap.val();

        if (!podium) {
            return res.status(404).json({ success: false, message: 'Podyum bulunamadı' });
        }

        let activeVideo = null;
        if (podium.state?.activeVideoId) {
            const videoSnap = await db.ref(`videos/${podium.state.activeVideoId}`).once('value');
            const vData = videoSnap.val();
            if (vData) {
                activeVideo = {
                    id: podium.state.activeVideoId,
                    title: vData.title,
                    apparatus: vData.apparatus,
                    type: vData.type || 'D',
                    isZorunlu: !!vData.isZorunlu,
                    expertD: vData.expertD || 0,
                    expertE: vData.expertE || 0,
                    expertDMoves: vData.expertDMoves || null
                };
            }
        }

        let examName = '';
        if (podium.examId) {
            const examSnap = await db.ref(`exams/${podium.examId}`).once('value');
            const examData = examSnap.val();
            if (examData) examName = examData.name;
        }

        res.json({
            success: true,
            data: {
                podiumName: podium.name,
                examId: podium.examId || '',
                examName,
                status: podium.state?.status || 'IDLE',
                activeVideo
            }
        });
    } catch (error) {
        console.error('Podium State Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/**
 * POST /api/scores/submit
 * Hakem puanını kaydet/güncelle
 * Firebase push() ile concurrent write desteği
 */
exports.submitScore = async (req, res) => {
    try {
        const { email, videoId, d, e, deductions, zorunluDMoves } = req.body;

        if (!email || !videoId) {
            return res.status(400).json({ success: false, message: 'Email ve videoId gerekli' });
        }

        // 1. Email ile referee bul
        const refSnap = await db.ref('referees').orderByChild('email').equalTo(email.trim().toLowerCase()).once('value');
        const refData = refSnap.val();
        if (!refData) {
            return res.status(401).json({ success: false, message: 'Yetkisiz erişim: Email bulunamadı' });
        }
        const refereeId = Object.keys(refData)[0];
        const referee = refData[refereeId];

        // 2. Video bilgisini çek
        const videoSnap = await db.ref(`videos/${videoId}`).once('value');
        const video = videoSnap.val();
        if (!video) {
            return res.status(404).json({ success: false, message: 'Video bulunamadı' });
        }

        // 3. Sapma ve puan hesapla
        const dValue = parseFloat(d) || 0;
        const eValue = parseFloat(e) || 10;
        const deductionsValue = parseFloat(deductions) || 0;

        let dev = 0;
        let points = 0;

        if (video.type === 'E') {
            // E değerlendirmesi: deductions farkı
            const expertDeductions = 10 - (video.expertE || 0);
            dev = Math.abs(deductionsValue - expertDeductions);
            // Puan hesaplama (tolerans bazlı)
            if (dev <= 0.1) points = 1;
            else if (dev <= 0.2) points = 0.8;
            else if (dev <= 0.3) points = 0.6;
            else if (dev <= 0.4) points = 0.4;
            else if (dev <= 0.5) points = 0.2;
            else points = 0;
        } else {
            // D değerlendirmesi: D puanı farkı
            dev = Math.abs(dValue - (video.expertD || 0));
            if (dev === 0) points = 1;
            else if (dev <= 0.1) points = 0.8;
            else if (dev <= 0.2) points = 0.6;
            else if (dev <= 0.3) points = 0.4;
            else if (dev <= 0.5) points = 0.2;
            else points = 0;
        }

        const scoreData = {
            refereeId,
            refereeName: referee.name,
            videoId,
            videoTitle: video.title,
            examId: video.examId || '',
            d: dValue,
            e: eValue,
            deductions: deductionsValue,
            dev,
            points,
            btrs: 0,
            cr: 0,
            cv: 0,
            timestamp: Date.now(),
            zorunluDeduction: 0,
            zorunluDMoves: zorunluDMoves || false
        };

        // 4. Aynı referee + video için mevcut sonuç var mı?
        const existingSnap = await db.ref('results')
            .orderByChild('refereeId')
            .equalTo(refereeId)
            .once('value');

        let existingKey = null;
        let existingData = null;

        if (existingSnap.val()) {
            for (const [key, val] of Object.entries(existingSnap.val())) {
                if (val.videoId === videoId) {
                    existingKey = key;
                    existingData = val;
                    break;
                }
            }
        }

        if (existingKey) {
            // Güncelle — mevcut puanı history'ye ekle
            const history = existingData.history || [];
            history.push({
                d: existingData.d,
                e: existingData.e,
                deductions: existingData.deductions,
                points: existingData.points,
                timestamp: existingData.timestamp
            });
            await db.ref(`results/${existingKey}`).update({
                ...scoreData,
                history
            });
            res.json({ success: true, message: 'Puan güncellendi', updated: true, id: existingKey });
        } else {
            // Yeni kayıt — push() ile benzersiz ID (concurrent-safe)
            const newRef = db.ref('results').push();
            await newRef.set(scoreData);
            res.json({ success: true, message: 'Puan kaydedildi', updated: false, id: newRef.key });
        }

    } catch (error) {
        console.error('Submit Score Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};
