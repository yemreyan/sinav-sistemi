// scoreController.js — Hakem Puanlama Endpointleri (v3 — Full Optimization)
// Shared cache + composite scoreIndex + paralel sorgular
const { db } = require('../config/firebase');
const { getCached, setCache } = require('./sharedCache');

// ===================== HELPERS =====================

async function findRefereeByEmail(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const cached = getCached('referees', normalizedEmail);
    if (cached) return cached;

    const snapshot = await db.ref('referees').orderByChild('email').equalTo(normalizedEmail).once('value');
    const data = snapshot.val();
    if (!data) return null;

    const refereeId = Object.keys(data)[0];
    const result = { id: refereeId, ...data[refereeId] };
    setCache('referees', normalizedEmail, result);
    return result;
}

async function getPodiumById(podiumId) {
    if (!podiumId) return null;
    const cached = getCached('podiums', podiumId);
    if (cached) return cached;

    const snap = await db.ref(`podiums/${podiumId}`).once('value');
    const data = snap.val();
    if (data) setCache('podiums', podiumId, data);
    return data;
}

async function getVideoById(videoId) {
    if (!videoId) return null;
    const cached = getCached('videos', videoId);
    if (cached) return cached;

    const snap = await db.ref(`videos/${videoId}`).once('value');
    const data = snap.val();
    if (data) setCache('videos', videoId, data);
    return data;
}

// ===================== ENDPOINTS =====================

/**
 * POST /api/scores/auth
 */
exports.authenticate = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'Email gerekli' });
        }

        const referee = await findRefereeByEmail(email);
        if (!referee) {
            return res.status(401).json({ success: false, message: 'Bu e-posta adresine ait hakem bulunamadı' });
        }

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
 * Full response cache — 100 hakem aynı podium'u sorarsa 1 kez Firebase'e gider
 */
exports.getPodiumState = async (req, res) => {
    try {
        const { podiumId } = req.params;

        // Full response cache
        const cachedResponse = getCached('podiumState', podiumId);
        if (cachedResponse) {
            return res.json(cachedResponse);
        }

        const podium = await getPodiumById(podiumId);
        if (!podium) {
            return res.status(404).json({ success: false, message: 'Podyum bulunamadı' });
        }

        // Paralel: Video + Exam
        const [activeVideo, examName] = await Promise.all([
            (async () => {
                if (!podium.state?.activeVideoId) return null;
                const vData = await getVideoById(podium.state.activeVideoId);
                if (!vData) return null;
                return {
                    id: podium.state.activeVideoId,
                    title: vData.title,
                    apparatus: vData.apparatus,
                    type: vData.type || 'D',
                    isZorunlu: !!vData.isZorunlu,
                    expertD: vData.expertD || 0,
                    expertE: vData.expertE || 0,
                    expertDMoves: vData.expertDMoves || null
                };
            })(),
            (async () => {
                if (!podium.examId) return '';
                const cached = getCached('videos', `exam_${podium.examId}`);
                if (cached) return cached;
                const examSnap = await db.ref(`exams/${podium.examId}`).once('value');
                const name = examSnap.val()?.name || '';
                setCache('videos', `exam_${podium.examId}`, name);
                return name;
            })()
        ]);

        const responseData = {
            success: true,
            data: {
                podiumName: podium.name,
                examId: podium.examId || '',
                examName,
                status: podium.state?.status || 'IDLE',
                activeVideo
            }
        };

        setCache('podiumState', podiumId, responseData);
        res.json(responseData);
    } catch (error) {
        console.error('Podium State Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/**
 * POST /api/scores/submit
 * v3: scoreIndex composite key ile O(1) mevcut skor kontrolü
 */
exports.submitScore = async (req, res) => {
    const startTime = Date.now();
    try {
        const { email, videoId, d, e, deductions, zorunluDMoves } = req.body;

        if (!email || !videoId) {
            return res.status(400).json({ success: false, message: 'Email ve videoId gerekli' });
        }

        // STEP 1: Paralel — referee + video (cache hit = 0ms)
        const [referee, video] = await Promise.all([
            findRefereeByEmail(email),
            getVideoById(videoId)
        ]);

        if (!referee) {
            return res.status(401).json({ success: false, message: 'Yetkisiz erişim: Email bulunamadı' });
        }
        if (!video) {
            return res.status(404).json({ success: false, message: 'Video bulunamadı' });
        }

        // Podium — cache'den gelir
        let currentExamId = '';
        if (referee.podiumId) {
            const podium = await getPodiumById(referee.podiumId);
            if (podium?.examId) currentExamId = podium.examId;
        }

        // STEP 2: Puan hesapla
        const dValue = parseFloat(d) || 0;
        const eValue = parseFloat(e) || 10;
        const deductionsValue = parseFloat(deductions) || 0;

        let dev = 0;
        let points = 0;

        if (video.type === 'E') {
            const expertDeductions = 10 - (video.expertE || 0);
            dev = Math.abs(deductionsValue - expertDeductions);
            if (dev <= 0.1) points = 1;
            else if (dev <= 0.2) points = 0.8;
            else if (dev <= 0.3) points = 0.6;
            else if (dev <= 0.4) points = 0.4;
            else if (dev <= 0.5) points = 0.2;
            else points = 0;
        } else {
            dev = Math.abs(dValue - (video.expertD || 0));
            if (dev === 0) points = 1;
            else if (dev <= 0.1) points = 0.8;
            else if (dev <= 0.2) points = 0.6;
            else if (dev <= 0.3) points = 0.4;
            else if (dev <= 0.5) points = 0.2;
            else points = 0;
        }

        const scoreData = {
            refereeId: referee.id,
            refereeName: referee.name,
            videoId,
            videoTitle: video.title,
            examId: currentExamId || video.examId || '',
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

        // STEP 3: Composite key ile O(1) mevcut skor kontrolü
        const compositeKey = `${referee.id}_${videoId}`;
        const indexSnap = await db.ref(`scoreIndex/${compositeKey}`).once('value');
        const existingResultKey = indexSnap.val();

        if (existingResultKey) {
            const existingSnap = await db.ref(`results/${existingResultKey}`).once('value');
            const existingData = existingSnap.val();

            if (existingData) {
                const history = existingData.history || [];
                history.push({
                    d: existingData.d,
                    e: existingData.e,
                    deductions: existingData.deductions,
                    points: existingData.points,
                    timestamp: existingData.timestamp
                });
                await db.ref(`results/${existingResultKey}`).update({
                    ...scoreData,
                    history
                });
                const elapsed = Date.now() - startTime;
                console.log(`[PERF] submitScore UPDATE: ${elapsed}ms (referee: ${referee.id})`);
                return res.json({ success: true, message: 'Puan güncellendi', updated: true, id: existingResultKey });
            }
        }

        // Yeni kayıt — atomic multi-path update
        const newRef = db.ref('results').push();
        const updates = {};
        updates[`results/${newRef.key}`] = scoreData;
        updates[`scoreIndex/${compositeKey}`] = newRef.key;
        await db.ref().update(updates);

        const elapsed = Date.now() - startTime;
        console.log(`[PERF] submitScore CREATE: ${elapsed}ms (referee: ${referee.id})`);
        res.json({ success: true, message: 'Puan kaydedildi', updated: false, id: newRef.key });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[PERF] submitScore ERROR: ${elapsed}ms`, error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/**
 * GET /api/scores/existing?email=X&videoId=Y
 * Hakemin daha önce bu video için gönderdiği puanı getir
 * Video tekrar açıldığında önceki seçimlerini göstermek için kullanılır
 */
exports.getExistingScore = async (req, res) => {
    try {
        const { email, videoId } = req.query;
        if (!email || !videoId) {
            return res.json({ success: true, data: null });
        }

        const referee = await findRefereeByEmail(email);
        if (!referee) {
            return res.json({ success: true, data: null });
        }

        // Composite key ile O(1) lookup
        const compositeKey = `${referee.id}_${videoId}`;
        const indexSnap = await db.ref(`scoreIndex/${compositeKey}`).once('value');
        const resultKey = indexSnap.val();

        if (!resultKey) {
            return res.json({ success: true, data: null });
        }

        const resultSnap = await db.ref(`results/${resultKey}`).once('value');
        const resultData = resultSnap.val();

        if (!resultData) {
            return res.json({ success: true, data: null });
        }

        res.json({
            success: true,
            data: {
                id: resultKey,
                d: resultData.d,
                e: resultData.e,
                deductions: resultData.deductions,
                zorunluDMoves: resultData.zorunluDMoves || null,
                timestamp: resultData.timestamp
            }
        });
    } catch (error) {
        console.error('Get Existing Score Error:', error);
        res.json({ success: true, data: null }); // Hata olsa bile formu engellemiyoruz
    }
};
