// questionController.js — Soru havuzu ve video dağıtımı
//
// Soru, puanlanacak seriyi tanımlar (alet, D/E, hareket sayısı).
// Havuzdaki her video aynı sorunun farklı bir çekimidir ve KENDİ uzman değerini taşır;
// hakemin sapması izlediği videonun değerine göre hesaplanır.
//
// Firebase düğümleri:
//   questions/<qid>                 soru tanımı
//   questionVideos/<qid>/<vid>      havuz: url + uzman değerleri
//   assignments/<qid>/<refereeId>   hangi hakem hangi videoyu izliyor
const { db } = require('../config/firebase');
const { invalidateCache } = require('./sharedCache');

const diziye = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

/** GET /api/questions — soru havuzu (videolarıyla birlikte) */
exports.getAll = async (req, res) => {
    try {
        const [qSnap, vSnap, aSnap] = await Promise.all([
            db.ref('questions').once('value'),
            db.ref('questionVideos').once('value'),
            db.ref('assignments').once('value')
        ]);

        const havuz = vSnap.val() || {};
        const atamalar = aSnap.val() || {};

        const sorular = diziye(qSnap.val()).map(q => {
            const videolar = diziye(havuz[q.id]).sort((a, b) => (a.order || 0) - (b.order || 0));
            const atama = atamalar[q.id] || {};

            // Her videonun kaç hakeme düştüğü
            const dagilim = {};
            for (const vid of Object.values(atama)) dagilim[vid] = (dagilim[vid] || 0) + 1;

            return {
                ...q,
                videos: videolar.map(v => ({ ...v, atananHakem: dagilim[v.id] || 0 })),
                videoSayisi: videolar.length,
                baglantisiEksik: videolar.filter(v => !v.url).length,
                dagitildi: Object.keys(atama).length > 0
            };
        });

        res.json({ success: true, data: sorular });
    } catch (error) {
        console.error('Fetch Questions Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** POST /api/questions — yeni soru */
exports.create = async (req, res) => {
    try {
        const { title, apparatus, type, isZorunlu, examIds, moveCount, videoCount } = req.body || {};
        if (!title || !apparatus) {
            return res.status(400).json({ success: false, message: 'Soru adı ve alet gerekli' });
        }

        const ref = db.ref('questions').push();
        await ref.set({
            title,
            apparatus,
            type: type === 'E' ? 'E' : 'D',
            isZorunlu: !!isZorunlu,
            examIds: Array.isArray(examIds) ? examIds : [],
            moveCount: Number(moveCount) || 0,
            isArchived: false,
            createdAt: Date.now()
        });

        // İstenen sayıda boş video satırı aç — bağlantı ve uzman değeri sonra girilir
        const adet = Math.max(1, Math.min(10, Number(videoCount) || 1));
        const havuz = {};
        for (let i = 1; i <= adet; i++) {
            havuz['v' + i] = { url: '', expertD: 0, expertE: 0, expertDMoves: null, order: i, createdAt: Date.now() };
        }
        await db.ref(`questionVideos/${ref.key}`).set(havuz);

        res.json({ success: true, message: 'Soru oluşturuldu', id: ref.key, videoCount: adet });
    } catch (error) {
        console.error('Create Question Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** PUT /api/questions/:id */
exports.update = async (req, res) => {
    try {
        const updates = { ...req.body };
        delete updates.id; delete updates.videos;
        await db.ref(`questions/${req.params.id}`).update(updates);
        invalidateCache('videos');
        res.json({ success: true, message: 'Soru güncellendi' });
    } catch (error) {
        console.error('Update Question Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** DELETE /api/questions/:id — soru, havuzu ve atamaları birlikte gider */
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        await Promise.all([
            db.ref(`questions/${id}`).remove(),
            db.ref(`questionVideos/${id}`).remove(),
            db.ref(`assignments/${id}`).remove()
        ]);
        invalidateCache('videos');
        res.json({ success: true, message: 'Soru silindi' });
    } catch (error) {
        console.error('Delete Question Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** POST /api/questions/:id/videos — havuza video ekle */
exports.addVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { url, expertD, expertE, expertDMoves } = req.body || {};

        const snap = await db.ref(`questionVideos/${id}`).once('value');
        const mevcut = snap.val() || {};
        const sira = Object.keys(mevcut).length + 1;

        await db.ref(`questionVideos/${id}/v${sira}`).set({
            url: url || '',
            expertD: Number(expertD) || 0,
            expertE: Number(expertE) || 0,
            expertDMoves: expertDMoves || null,
            order: sira,
            createdAt: Date.now()
        });

        invalidateCache('videos');
        res.json({ success: true, message: 'Video eklendi', videoId: 'v' + sira });
    } catch (error) {
        console.error('Add Video Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** PUT /api/questions/:id/videos/:vid — bağlantı ve uzman değeri */
exports.updateVideo = async (req, res) => {
    try {
        const { id, vid } = req.params;
        const updates = {};
        for (const alan of ['url', 'expertD', 'expertE', 'expertDMoves']) {
            if (req.body[alan] !== undefined) {
                updates[alan] = (alan === 'expertD' || alan === 'expertE')
                    ? (Number(req.body[alan]) || 0)
                    : req.body[alan];
            }
        }
        await db.ref(`questionVideos/${id}/${vid}`).update(updates);
        invalidateCache('videos');
        res.json({ success: true, message: 'Video güncellendi' });
    } catch (error) {
        console.error('Update Video Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** DELETE /api/questions/:id/videos/:vid */
exports.removeVideo = async (req, res) => {
    try {
        const { id, vid } = req.params;
        const aSnap = await db.ref(`assignments/${id}`).once('value');
        const atama = aSnap.val() || {};
        const kullanan = Object.values(atama).filter(v => v === vid).length;
        if (kullanan > 0) {
            return res.status(409).json({
                success: false,
                message: `Bu video ${kullanan} hakeme atanmış. Önce dağıtımı kaldırın.`
            });
        }
        await db.ref(`questionVideos/${id}/${vid}`).remove();
        invalidateCache('videos');
        res.json({ success: true, message: 'Video silindi' });
    } catch (error) {
        console.error('Remove Video Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = exports;

// ===================== DAĞITIM =====================
const { dagit, dengeli } = require('../utils/distribution');

/** POST /api/questions/:id/distribute  { examId, force }  — havuzu hakemlere böl */
exports.distribute = async (req, res) => {
    try {
        const { id } = req.params;
        const { examId, force } = req.body || {};

        const [qSnap, vSnap, aSnap, rSnap, pSnap] = await Promise.all([
            db.ref(`questions/${id}`).once('value'),
            db.ref(`questionVideos/${id}`).once('value'),
            db.ref(`assignments/${id}`).once('value'),
            db.ref('referees').once('value'),
            db.ref('podiums').once('value')
        ]);

        const soru = qSnap.val();
        if (!soru) return res.status(404).json({ success: false, message: 'Soru bulunamadı' });

        const havuz = vSnap.val() || {};
        const videolar = Object.entries(havuz)
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

        const baglantisiz = videolar.filter(([, v]) => !v.url).map(([vid]) => vid);
        if (baglantisiz.length) {
            return res.status(400).json({
                success: false,
                message: `${baglantisiz.length} videonun bağlantısı girilmemiş — dağıtım yapılamaz`,
                data: { baglantisiz }
            });
        }
        if (!videolar.length) {
            return res.status(400).json({ success: false, message: 'Havuzda video yok' });
        }

        const mevcutAtama = aSnap.val() || {};
        if (Object.keys(mevcutAtama).length && !force) {
            return res.status(409).json({
                success: false,
                message: 'Bu soru zaten dağıtılmış. Yeniden dağıtmak gönderilmiş puanları geçersiz kılar.',
                data: { atananHakem: Object.keys(mevcutAtama).length }
            });
        }

        // Hakem → yarışma bağı podyum üzerinden kurulur: podiums/<pid>/examId
        const hedefExam = examId || (Array.isArray(soru.examIds) ? soru.examIds[0] : null);
        const podyumlar = pSnap.val() || {};
        const hedefPodyumlar = new Set(
            Object.entries(podyumlar)
                .filter(([, p]) => !hedefExam || p.examId === hedefExam)
                .filter(([, p]) => !p.archivedByExam)
                .map(([pid]) => pid)
        );

        // İsteğe bağlı liste etiketi: yalnızca o gruptaki hakemlere dağıt
        const grup = (req.body.group || '').trim();

        const hakemler = Object.entries(rSnap.val() || {})
            .filter(([, r]) => !r.isArchived)
            .filter(([, r]) => r.podiumId && hedefPodyumlar.has(r.podiumId))
            .filter(([, r]) => !grup || r.group === grup)
            .sort((a, b) => String(a[1].name || '').localeCompare(String(b[1].name || ''), 'tr'))
            .map(([rid]) => rid);

        if (!hakemler.length) {
            return res.status(400).json({
                success: false,
                message: hedefExam
                    ? 'Bu yarışmanın podyumlarına bağlı hakem bulunamadı'
                    : 'Hakem bulunamadı'
            });
        }

        const { atama, dagilim } = dagit(hakemler, videolar.map(([vid]) => vid), Date.now());

        await db.ref(`assignments/${id}`).set(atama);
        await db.ref(`questions/${id}`).update({ distributedAt: Date.now() });
        invalidateCache('videos');

        console.log(`[DAĞITIM] ${soru.title}${grup ? ' (' + grup + ')' : ''}: ${hakemler.length} hakem → ${videolar.length} video`,
            JSON.stringify(dagilim));

        res.json({
            success: true,
            message: 'Dağıtım yapıldı',
            data: { hakemSayisi: hakemler.length, dagilim, dengeli: dengeli(dagilim) }
        });
    } catch (error) {
        console.error('Distribute Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * GET /api/questions/:id/assignments
 * Kim hangi videoyu aldı, izledi mi, puan gönderdi mi — video bazında özetiyle.
 */
exports.getAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        const [aSnap, rSnap, qSnap, vSnap, wSnap, iSnap] = await Promise.all([
            db.ref(`assignments/${id}`).once('value'),
            db.ref('referees').once('value'),
            db.ref(`questions/${id}`).once('value'),
            db.ref(`questionVideos/${id}`).once('value'),
            db.ref('watched').once('value'),
            db.ref('scoreIndex').once('value')
        ]);

        const atama = aSnap.val() || {};
        const hakemler = rSnap.val() || {};
        const soru = qSnap.val() || {};
        const havuz = vSnap.val() || {};
        const izlemeler = wSnap.val() || {};
        const indeks = iSnap.val() || {};

        // Yalnızca bu soruya puan göndermiş hakemlerin sonucunu oku
        const sonucAnahtarlari = {};
        for (const refId of Object.keys(atama)) {
            const k = indeks[`${refId}_${id}`];
            if (k) sonucAnahtarlari[refId] = k;
        }
        const sonuclar = Object.fromEntries(await Promise.all(
            Object.entries(sonucAnahtarlari).map(async ([refId, key]) => {
                const snap = await db.ref(`results/${key}`).once('value');
                return [refId, snap.val()];
            })
        ));

        const liste = Object.entries(atama).map(([refId, vid]) => {
            const r = sonuclar[refId];
            return {
                refereeId: refId,
                videoId: vid,
                name: hakemler[refId]?.name || '(silinmiş hakem)',
                email: hakemler[refId]?.email || '',
                izledi: Boolean(izlemeler[refId]?.[id]),
                gonderdi: Boolean(r),
                d: r?.d ?? null,
                deductions: r?.deductions ?? null,
                dev: r?.dev ?? null,
                points: r?.points ?? null,
                correctMoves: r?.correctMoves ?? null,
                totalMoves: r?.totalMoves ?? null,
                timestamp: r?.timestamp ?? null
            };
        }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        // Video bazında özet
        const videolar = Object.entries(havuz)
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
            .map(([vid, v]) => {
                const grup = liste.filter(x => x.videoId === vid);
                const gonderen = grup.filter(x => x.gonderdi);
                const puanlar = gonderen.map(x => x.points).filter(p => p !== null);
                return {
                    videoId: vid,
                    url: v.url || '',
                    expertD: v.expertD ?? null,
                    expertE: v.expertE ?? null,
                    uzmanKesinti: soru.type === 'E' ? Math.round((10 - (v.expertE || 0)) * 10) / 10 : null,
                    atanan: grup.length,
                    izleyen: grup.filter(x => x.izledi).length,
                    gonderen: gonderen.length,
                    ortalamaPuan: puanlar.length
                        ? Math.round((puanlar.reduce((t, p) => t + p, 0) / puanlar.length) * 1000) / 1000
                        : null
                };
            });

        res.json({
            success: true,
            data: {
                soru: { id, title: soru.title || '', apparatus: soru.apparatus || '', type: soru.type || 'D' },
                liste,
                videolar,
                toplam: liste.length,
                izleyen: liste.filter(x => x.izledi).length,
                gonderen: liste.filter(x => x.gonderdi).length
            }
        });
    } catch (error) {
        console.error('Get Assignments Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** DELETE /api/questions/:id/assignments — dağıtımı kaldır */
exports.clearAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`assignments/${id}`).remove();
        await db.ref(`questions/${id}/distributedAt`).remove();
        invalidateCache('videos');
        res.json({ success: true, message: 'Dağıtım kaldırıldı' });
    } catch (error) {
        console.error('Clear Assignments Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
