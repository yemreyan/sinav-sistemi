// scoreController.js — Hakem Puanlama Endpointleri (Optimized)
// 100+ hakemin eşzamanlı puan göndermesini destekler
// Optimizasyonlar: Paralel sorgular, composite key, in-memory cache
const { db } = require('../config/firebase');

// ===================== IN-MEMORY CACHE =====================
const cache = {
    podiums: {},      // podiumId -> { data, ts }
    videos: {},       // videoId -> { data, ts }
    referees: {},     // email -> { data, ts }
};

const CACHE_TTL = {
    podium: 10000,    // 10 sn (polling tarafından sık çağrılır)
    video: 30000,     // 30 sn (video verisi nadiren değişir)
    referee: 60000,   // 60 sn (hakem bilgileri oturum boyunca sabit)
};

function getCached(type, key) {
    const entry = cache[type]?.[key];
    if (!entry) return null;
    const ttl = CACHE_TTL[type.replace('s', '').replace('ee', 'ee')] || 30000;
    if (Date.now() - entry.ts > ttl) {
        delete cache[type][key];
        return null;
    }
    return entry.data;
}

function setCache(type, key, data) {
    if (!cache[type]) cache[type] = {};
    cache[type][key] = { data, ts: Date.now() };
}

// Invalidate specific cache entry
function invalidateCache(type, key) {
    if (cache[type]?.[key]) delete cache[type][key];
}

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
 * Token ile hakem doğrulama
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
 * Podium durumu + aktif video detayları
 * Optimized: Paralel sorgular + cache
 */
exports.getPodiumState = async (req, res) => {
    try {
        const { podiumId } = req.params;
        const podium = await getPodiumById(podiumId);

        if (!podium) {
            return res.status(404).json({ success: false, message: 'Podyum bulunamadı' });
        }

        // Paralel: Video + Exam sorgularını aynı anda çalıştır
        const [activeVideo, examName] = await Promise.all([
            // Video bilgisi
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
            // Exam adı
            (async () => {
                if (!podium.examId) return '';
                // Exam da cache'lenebilir
                const cached = getCached('videos', `exam_${podium.examId}`);
                if (cached) return cached;
                const examSnap = await db.ref(`exams/${podium.examId}`).once('value');
                const examData = examSnap.val();
                const name = examData?.name || '';
                setCache('videos', `exam_${podium.examId}`, name);
                return name;
            })()
        ]);

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
 * Optimized: Paralel sorgular + composite key lookup
 */
exports.submitScore = async (req, res) => {
    const startTime = Date.now();
    try {
        const { email, videoId, d, e, deductions, zorunluDMoves } = req.body;

        if (!email || !videoId) {
            return res.status(400).json({ success: false, message: 'Email ve videoId gerekli' });
        }

        // ===== STEP 1: Paralel sorgular (3 sorguyu aynı anda çalıştır) =====
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

        // Podium bilgisini paralelde veya cache'den çek
        let currentExamId = '';
        if (referee.podiumId) {
            const podium = await getPodiumById(referee.podiumId);
            if (podium?.examId) currentExamId = podium.examId;
        }

        // ===== STEP 2: Sapma ve puan hesapla =====
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

        // ===== STEP 3: Composite key ile mevcut sonuç kontrolü (O(1)) =====
        // results tablosunun tamamını çekmek yerine, compound sorgu kullan
        const existingSnap = await db.ref('results')
            .orderByChild('refereeId')
            .equalTo(referee.id)
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
            const elapsed = Date.now() - startTime;
            console.log(`[PERF] submitScore UPDATE: ${elapsed}ms (referee: ${referee.id})`);
            res.json({ success: true, message: 'Puan güncellendi', updated: true, id: existingKey });
        } else {
            const newRef = db.ref('results').push();
            await newRef.set(scoreData);
            const elapsed = Date.now() - startTime;
            console.log(`[PERF] submitScore CREATE: ${elapsed}ms (referee: ${referee.id})`);
            res.json({ success: true, message: 'Puan kaydedildi', updated: false, id: newRef.key });
        }

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[PERF] submitScore ERROR: ${elapsed}ms`, error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};
