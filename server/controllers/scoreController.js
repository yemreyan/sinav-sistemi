// scoreController.js — Hakem Puanlama Endpointleri (v3 — Full Optimization)
// Shared cache + composite scoreIndex + paralel sorgular
const { db } = require('../config/firebase');
const { getCached, setCache, invalidateCache } = require('./sharedCache');
const { ePuani } = require('../utils/scoringMatrix');

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

// Bir hakemin belirli bir soruda izleyeceği videoyu ve o videonun uzman değerlerini döner.
// Atama yoksa havuzun ilk videosu kullanılır (tek videolu sorular ve göç öncesi kayıtlar böyle).
async function getRefereeVideo(questionId, refereeId) {
    const [aSnap, vSnap] = await Promise.all([
        db.ref(`assignments/${questionId}/${refereeId}`).once('value'),
        db.ref(`questionVideos/${questionId}`).once('value')
    ]);

    const havuz = vSnap.val() || {};
    const sirali = Object.entries(havuz).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
    if (!sirali.length) return null;

    const atanan = aSnap.val();
    const [vid, veri] = (atanan && havuz[atanan]) ? [atanan, havuz[atanan]] : sirali[0];

    return { videoId: vid, ...veri, havuzBoyu: sirali.length };
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
        // Geçmiş yarışmaların hakemleri arşivlidir: kayıtları durur, ama yeni bir
        // sınava giremezler. Yeniden katılacaklarsa panelden arşivden çıkarılır.
        if (referee.isArchived) {
            return res.status(403).json({
                success: false,
                message: 'Bu hakem kaydı geçmiş bir yarışmaya ait. Güncel sınava katılacaksanız kurul ile görüşün.'
            });
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
 * GET /api/scores/my-video?email=X&questionId=Y
 * Hakem ekranı: bu soruda bana hangi video düştü, bağlantısı ne?
 * Uzman değerleri DÖNMEZ — hakem onları görmemeli.
 */
exports.getMyVideo = async (req, res) => {
    try {
        const { email, questionId } = req.query;
        if (!email || !questionId) {
            return res.status(400).json({ success: false, message: 'email ve questionId gerekli' });
        }

        const referee = await findRefereeByEmail(email);
        if (!referee) return res.status(401).json({ success: false, message: 'Hakem bulunamadı' });

        const kendi = await getRefereeVideo(questionId, referee.id);
        if (!kendi) return res.json({ success: true, data: null });

        const [qSnap, wSnap] = await Promise.all([
            db.ref(`questions/${questionId}`).once('value'),
            db.ref(`watched/${referee.id}/${questionId}`).once('value')
        ]);
        const soru = qSnap.val() || {};
        const izleme = wSnap.val();

        res.json({
            success: true,
            data: {
                questionId,
                title: soru.title || '',
                apparatus: soru.apparatus || '',
                type: soru.type || 'D',
                isZorunlu: !!soru.isZorunlu,
                moveCount: soru.moveCount || 0,
                // hakemin göreceği tek şey: kendi videosu
                videoId: kendi.videoId,
                videoUrl: kendi.url || '',
                havuzSirasi: Number(String(kendi.videoId).replace('v', '')) || 1,
                havuzBoyu: kendi.havuzBoyu,
                izlendi: Boolean(izleme),
                izlenmeZamani: izleme?.at || null,
                // zorunlu hareket seçenekleri uzman değerini ele vermez, formda gerekli
                moveOptions: kendi.expertDMoves
                    ? Object.fromEntries(Object.entries(kendi.expertDMoves).map(
                        ([k, v]) => [k, (v && typeof v === 'object' && Array.isArray(v.options)) ? v.options : []]))
                    : null
            }
        });
    } catch (error) {
        console.error('Get My Video Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/**
 * POST /api/scores/watched  { email, questionId }
 * Video izlenmeye başlandığında işaretlenir. Hakem ekranı yenilese de video
 * bir daha açılmaz; puanlama formuna döner. İşaret sunucuda tutulur çünkü
 * tarayıcı hafızası temizlenebilir.
 */
exports.markWatched = async (req, res) => {
    try {
        const { email, questionId } = req.body || {};
        if (!email || !questionId) {
            return res.status(400).json({ success: false, message: 'email ve questionId gerekli' });
        }

        const referee = await findRefereeByEmail(email);
        if (!referee) return res.status(401).json({ success: false, message: 'Hakem bulunamadı' });

        const yol = `watched/${referee.id}/${questionId}`;
        const mevcut = (await db.ref(yol).once('value')).val();

        // İlk izleme zamanı korunur; ikinci istek onu değiştirmez
        if (!mevcut) await db.ref(yol).set({ at: Date.now() });

        res.json({ success: true, data: { watchedAt: mevcut?.at || Date.now(), ilkIzleme: !mevcut } });
    } catch (error) {
        console.error('Mark Watched Error:', error);
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

        const isArchived = Boolean(podium.archivedByExam);

        const responseData = {
            success: true,
            data: {
                podiumName: podium.name,
                examId: podium.examId || '',
                examName,
                status: isArchived ? 'ARCHIVED' : (podium.state?.status || 'IDLE'),
                isArchived,
                // Arşivlenmiş yarışmada hakeme seri gösterilmez
                activeVideo: isArchived ? null : activeVideo
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
        // Arşivli hakem yeni puan gönderemez — eski kayıtları olduğu gibi durur
        if (referee.isArchived) {
            return res.status(403).json({
                success: false,
                message: 'Bu hakem kaydı geçmiş bir yarışmaya ait, puan girişi kapalı'
            });
        }
        if (!video) {
            return res.status(404).json({ success: false, message: 'Video bulunamadı' });
        }

        // Podium — cache'den gelir
        let currentExamId = '';
        if (referee.podiumId) {
            const podium = await getPodiumById(referee.podiumId);

            // Yarışma arşivlendiyse podyum kapalıdır — yeni puan kabul edilmez
            if (podium?.archivedByExam) {
                return res.status(403).json({
                    success: false,
                    message: 'Bu yarışma sona erdi, puan girişi kapalı'
                });
            }

            if (podium?.examId) currentExamId = podium.examId;
        }

        // STEP 2: Puan hesapla
        const dValue = parseFloat(d) || 0;
        const eValue = parseFloat(e) || 10;
        const deductionsValue = parseFloat(deductions) || 0;

        // Havuzlu soruda hakemin izlediği videonun uzman değeri kullanılır;
        // atama yoksa havuzun ilk videosu, o da yoksa eski kayıttaki değerler.
        const kendiVideo = await getRefereeVideo(videoId, referee.id);
        const uzman = kendiVideo || video;
        const poolVideoId = kendiVideo ? kendiVideo.videoId : null;

        let dev = 0;
        let points = 0;
        let dogruHareket = 0;   // D: uzmanla birebir tutan hareket sayısı
        let toplamHareket = 0;

        if (video.type === 'E') {
            // Sistemin sapma tablosu: uzman kesintisi × sapma (scoring_matrix.json + Sistem Ayarları override'ları)
            const expertDeductions = Math.round((10 - (uzman.expertE || 0)) * 10) / 10;
            dev = Math.round(Math.abs(deductionsValue - expertDeductions) * 10) / 10;
            points = await ePuani(expertDeductions, dev);
        } else {
            // D puanı hareket eşleşmesiyle hesaplanır: hakemin seçtiği her hareket
            // uzmanınkiyle birebir tutmalı, tolerans yok. Boş bırakılan hareket 0 sayılır.
            // puan = doğru hareket / toplam hareket.
            const uzmanMoves = uzman.expertDMoves;
            const anahtarlar = (uzmanMoves && typeof uzmanMoves === 'object')
                ? Object.keys(uzmanMoves).sort((a, b) => (+a.slice(1) || 0) - (+b.slice(1) || 0))
                : [];

            // Sapma bilgi amaçlı korunur (raporlarda toplam D farkı olarak kullanılıyor)
            dev = Math.round(Math.abs(dValue - (uzman.expertD || 0)) * 10) / 10;

            if (anahtarlar.length > 0) {
                const hakemSecim = (zorunluDMoves && typeof zorunluDMoves === 'object') ? zorunluDMoves : {};
                for (const k of anahtarlar) {
                    const ham = uzmanMoves[k];
                    const uzmanDeger = (ham && typeof ham === 'object' && !Array.isArray(ham))
                        ? Number(ham.expert)
                        : Number(ham);
                    if (Number.isNaN(uzmanDeger)) continue;
                    if (Math.abs(Number(hakemSecim[k] ?? 0) - uzmanDeger) < 1e-9) dogruHareket++;
                }
                toplamHareket = anahtarlar.length;
                points = toplamHareket > 0 ? dogruHareket / toplamHareket : 0;
            } else {
                // Hareket listesi olmayan seri: toplam D birebir tutarsa tam puan
                toplamHareket = 1;
                dogruHareket = dev === 0 ? 1 : 0;
                points = dogruHareket;
            }
        }

        const scoreData = {
            refereeId: referee.id,
            refereeName: referee.name,
            videoId,
            poolVideoId,
            videoTitle: video.title,
            examId: currentExamId || video.examId || '',
            d: dValue,
            e: eValue,
            deductions: deductionsValue,
            dev,
            points,
            correctMoves: dogruHareket,
            totalMoves: toplamHareket,
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
                await db.ref(`makeup/${referee.id}/${videoId}`).remove();
                invalidateCache('coverage');

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

        // Telafi izniyle girildiyse izni düşür — hakem normal akışa dönsün
        await db.ref(`makeup/${referee.id}/${videoId}`).remove();
        invalidateCache('coverage');

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

/**
 * GET /api/scores/submission-status/:podiumId
 * Canlı gönderim takibi — aktif seri için kim gönderdi, kim göndermedi.
 * scoreIndex tek sorguda çekilir (anahtar: <refereeId>_<videoId>), sonuçlar
 * yalnızca gönderen hakemler için okunur. Yanıt kısa süre cache'lenir çünkü
 * ekran saniyede bir değil, birkaç saniyede bir yoklar.
 */
exports.getSubmissionStatus = async (req, res) => {
    try {
        const { podiumId } = req.params;
        // Yalnızca belirli bir hakem listesini izlemek için: ?group=ADANA-2026
        const grup = (req.query.group || '').trim();
        const cacheKey = grup ? `${podiumId}::${grup}` : podiumId;

        const cached = getCached('submissionStatus', cacheKey);
        if (cached) return res.json(cached);

        const podium = await getPodiumById(podiumId);
        if (!podium) {
            return res.status(404).json({ success: false, message: 'Podyum bulunamadı' });
        }

        const activeVideoId = podium.state?.activeVideoId || null;

        // Bu podyuma bağlı hakemler
        const refSnap = await db.ref('referees').once('value');
        const refereeler = Object.entries(refSnap.val() || {})
            .filter(([, r]) => !r.isArchived)
            .filter(([, r]) => r.podiumId === podiumId)
            .filter(([, r]) => !grup || r.group === grup)
            .map(([id, r]) => ({ id, name: r.name || '', email: r.email || '', group: r.group || '' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        if (!activeVideoId) {
            const bos = {
                success: true,
                data: {
                    video: null,
                    podiumName: podium.name || '',
                    status: podium.state?.status || 'IDLE',
                    grup: grup || null,
                    toplam: refereeler.length,
                    gonderen: [],
                    gondermeyen: refereeler
                }
            };
            setCache('submissionStatus', cacheKey, bos);
            return res.json(bos);
        }

        const [videoData, indexSnap] = await Promise.all([
            getVideoById(activeVideoId),
            db.ref('scoreIndex').once('value')
        ]);

        // scoreIndex anahtarı <refereeId>_<videoId> — aktif seriye ait olanları ayıkla
        const index = indexSnap.val() || {};
        const sonek = `_${activeVideoId}`;
        const resultKeyByReferee = {};
        for (const [key, resultKey] of Object.entries(index)) {
            if (key.endsWith(sonek)) {
                resultKeyByReferee[key.slice(0, -sonek.length)] = resultKey;
            }
        }

        // Yalnızca gönderenlerin puanlarını oku
        const gonderenIds = refereeler.map(r => r.id).filter(id => resultKeyByReferee[id]);
        const sonuclar = await Promise.all(
            gonderenIds.map(async id => {
                const snap = await db.ref(`results/${resultKeyByReferee[id]}`).once('value');
                return [id, snap.val()];
            })
        );
        const sonucByReferee = Object.fromEntries(sonuclar);

        const gonderen = [];
        const gondermeyen = [];
        for (const r of refereeler) {
            const s = sonucByReferee[r.id];
            if (s) {
                gonderen.push({
                    ...r,
                    d: s.d ?? null,
                    e: s.e ?? null,
                    deductions: s.deductions ?? null,
                    dev: s.dev ?? null,
                    points: s.points ?? null,
                    timestamp: s.timestamp || null,
                    guncellendi: Array.isArray(s.history) && s.history.length > 0
                });
            } else {
                gondermeyen.push(r);
            }
        }

        gonderen.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const responseData = {
            success: true,
            data: {
                video: videoData ? {
                    id: activeVideoId,
                    title: videoData.title,
                    apparatus: videoData.apparatus,
                    type: videoData.type || 'D',
                    isZorunlu: !!videoData.isZorunlu,
                    expertD: videoData.expertD || 0,
                    expertE: videoData.expertE || 0
                } : { id: activeVideoId, title: '(seri bulunamadı)' },
                podiumName: podium.name || '',
                status: podium.state?.status || 'IDLE',
                grup: grup || null,
                toplam: refereeler.length,
                gonderen,
                gondermeyen
            }
        };

        setCache('submissionStatus', cacheKey, responseData);
        res.json(responseData);
    } catch (error) {
        console.error('Submission Status Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/**
 * GET /api/scores/coverage/:podiumId?group=X&apparatus=Y
 * Alet bazında kapsama — seçilen aletin tüm serilerinde kim eksik bıraktı.
 * Aktif seriye değil, yarışmanın o aletteki bütün serilerine bakar.
 */
exports.getCoverage = async (req, res) => {
    try {
        const { podiumId } = req.params;
        const grup = (req.query.group || '').trim();
        const alet = (req.query.apparatus || '').trim();

        // Henüz hiç kimsenin girmediği seriler büyük olasılıkla daha yayınlanmadı;
        // varsayılan olarak bunlar "eksik" sayılmaz.
        const sadeceBaslamis = req.query.onlyStarted !== 'false';
        const cacheKey = `${podiumId}::${grup}::${alet}::${sadeceBaslamis}`;
        const cached = getCached('coverage', cacheKey);
        if (cached) return res.json(cached);

        const podium = await getPodiumById(podiumId);
        if (!podium) {
            return res.status(404).json({ success: false, message: 'Podyum bulunamadı' });
        }

        const [videosSnap, refSnap, indexSnap] = await Promise.all([
            db.ref('videos').once('value'),
            db.ref('referees').once('value'),
            db.ref('scoreIndex').once('value')
        ]);

        // Podyumun yarışmasına bağlı, arşivlenmemiş seriler
        const examId = podium.examId || '';
        const tumVideolar = Object.entries(videosSnap.val() || {})
            .map(([id, v]) => ({ id, ...v }))
            .filter(v => !v.isArchived)
            .filter(v => {
                if (!examId) return true;
                const bagli = Array.isArray(v.examIds) ? v.examIds : (v.examId ? [v.examId] : []);
                return bagli.includes(examId);
            });

        const aletler = [...new Set(tumVideolar.map(v => v.apparatus))].sort();

        const aletSerileri = (alet ? tumVideolar.filter(v => v.apparatus === alet) : tumVideolar)
            .sort((a, b) => String(a.title).localeCompare(String(b.title), 'tr'));

        const refereeler = Object.entries(refSnap.val() || {})
            .filter(([, r]) => !r.isArchived)
            .filter(([, r]) => r.podiumId === podiumId)
            .filter(([, r]) => !grup || r.group === grup)
            .map(([id, r]) => ({ id, name: r.name || '', email: r.email || '' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        const index = indexSnap.val() || {};
        const girilmis = new Set(Object.keys(index)); // "<refereeId>_<videoId>"

        // Seri bazında kaç kişi girdi — başlamış/başlamamış ayrımı buradan çıkıyor
        const tumSeriDurumu = aletSerileri.map(v => {
            const giren = refereeler.filter(r => girilmis.has(`${r.id}_${v.id}`)).length;
            return {
                id: v.id,
                title: v.title,
                apparatus: v.apparatus,
                type: v.type || 'D',
                giren,
                girmeyen: refereeler.length - giren,
                baslamis: giren > 0
            };
        });

        const seriler = sadeceBaslamis
            ? aletSerileri.filter(v => tumSeriDurumu.find(s => s.id === v.id)?.baslamis)
            : aletSerileri;

        const hakemler = refereeler.map(r => {
            const eksik = seriler.filter(v => !girilmis.has(`${r.id}_${v.id}`));
            return {
                ...r,
                toplamSeri: seriler.length,
                girilen: seriler.length - eksik.length,
                eksikSayi: eksik.length,
                eksik: eksik.map(v => ({ id: v.id, title: v.title, apparatus: v.apparatus }))
            };
        });

        const responseData = {
            success: true,
            data: {
                podiumName: podium.name || '',
                grup: grup || null,
                apparatus: alet || null,
                aletler,
                sadeceBaslamis,
                seriSayisi: seriler.length,
                toplamSeriSayisi: aletSerileri.length,
                baslamamisSeri: aletSerileri.length - seriler.length,
                toplamHakem: refereeler.length,
                tamGiren: hakemler.filter(h => h.eksikSayi === 0).length,
                eksigiOlan: hakemler.filter(h => h.eksikSayi > 0).length,
                hicGirmeyen: hakemler.filter(h => h.girilen === 0).length,
                hakemler,
                seriDurumu: tumSeriDurumu
            }
        };

        setCache('coverage', cacheKey, responseData);
        res.json(responseData);
    } catch (error) {
        console.error('Coverage Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

// ===================== TELAFİ (MAKEUP) =====================
// Yönetici, puan göndermemiş bir hakeme belirli bir seri için tek seferlik giriş
// izni verir. İzin varken hakem ekranı yalnızca telafi serilerini gösterir; hakem
// puanı gönderince izin kendiliğinden düşer ve hakem normal canlı akışa döner.
// Firebase düğümü: makeup/<refereeId>/<videoId> = { videoId, grantedAt }

/** POST /api/scores/makeup  { refereeIds: [], videoId }  — yönetici */
exports.grantMakeup = async (req, res) => {
    try {
        const { refereeIds, videoId } = req.body || {};
        if (!Array.isArray(refereeIds) || refereeIds.length === 0 || !videoId) {
            return res.status(400).json({ success: false, message: 'refereeIds ve videoId gerekli' });
        }

        const video = await getVideoById(videoId);
        if (!video) {
            return res.status(404).json({ success: false, message: 'Seri bulunamadı' });
        }

        const updates = {};
        const now = Date.now();
        for (const refereeId of refereeIds) {
            updates[`${refereeId}/${videoId}`] = { videoId, grantedAt: now };
        }
        await db.ref('makeup').update(updates);

        invalidateCache('coverage');
        console.log(`[MAKEUP] ${refereeIds.length} hakeme "${video.title}" için telafi izni verildi`);
        res.json({ success: true, message: 'Telafi izni verildi', data: { count: refereeIds.length } });
    } catch (error) {
        console.error('Grant Makeup Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/** DELETE /api/scores/makeup  { refereeIds: [], videoId }  — yönetici */
exports.revokeMakeup = async (req, res) => {
    try {
        const { refereeIds, videoId } = req.body || {};
        if (!Array.isArray(refereeIds) || refereeIds.length === 0 || !videoId) {
            return res.status(400).json({ success: false, message: 'refereeIds ve videoId gerekli' });
        }

        const updates = {};
        for (const refereeId of refereeIds) {
            updates[`${refereeId}/${videoId}`] = null;
        }
        await db.ref('makeup').update(updates);

        invalidateCache('coverage');
        res.json({ success: true, message: 'Telafi izni kaldırıldı', data: { count: refereeIds.length } });
    } catch (error) {
        console.error('Revoke Makeup Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/** GET /api/scores/makeup?email=X — hakem ekranı için; açık telafi serilerini döner */
exports.getMakeupForReferee = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.json({ success: true, data: [] });

        const referee = await findRefereeByEmail(email);
        if (!referee) return res.json({ success: true, data: [] });

        const snap = await db.ref(`makeup/${referee.id}`).once('value');
        const izinler = snap.val() || {};

        const seriler = await Promise.all(
            Object.keys(izinler).map(async videoId => {
                const v = await getVideoById(videoId);
                if (!v) return null;
                return {
                    id: videoId,
                    title: v.title,
                    apparatus: v.apparatus,
                    type: v.type || 'D',
                    isZorunlu: !!v.isZorunlu,
                    expertD: v.expertD || 0,
                    expertE: v.expertE || 0,
                    expertDMoves: v.expertDMoves || null,
                    grantedAt: izinler[videoId]?.grantedAt || null
                };
            })
        );

        res.json({ success: true, data: seriler.filter(Boolean).sort((a, b) => (a.grantedAt || 0) - (b.grantedAt || 0)) });
    } catch (error) {
        console.error('Get Makeup Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

/** GET /api/scores/makeup-list/:videoId — yönetici; bu seri için kimlerde izin açık */
exports.getMakeupByVideo = async (req, res) => {
    try {
        const { videoId } = req.params;
        const snap = await db.ref('makeup').once('value');
        const hepsi = snap.val() || {};

        const refereeIds = Object.entries(hepsi)
            .filter(([, izinler]) => izinler && izinler[videoId])
            .map(([refereeId]) => refereeId);

        res.json({ success: true, data: refereeIds });
    } catch (error) {
        console.error('Get Makeup By Video Error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};
