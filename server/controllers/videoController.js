// videoController.js
const { db } = require('../config/firebase');
const { isAdminRequest } = require('../utils/adminAuth');
const { isVideoPublic } = require('../utils/examLinks');
const { invalidateCache } = require('./sharedCache');

exports.getAllVideos = async (req, res) => {
    try {
        const isAdmin = isAdminRequest(req);

        // Arşiv görünürlüğü sınavın durumuna da bağlı — yöneticiye hepsi, diğerlerine
        // yalnızca aktif bir sınavda kullanılan seriler döner.
        const [videosSnap, examsSnap] = await Promise.all([
            db.ref('videos').once('value'),
            isAdmin ? Promise.resolve(null) : db.ref('exams').once('value')
        ]);

        const data = videosSnap.val() || {};
        const examsById = examsSnap ? (examsSnap.val() || {}) : {};

        let videosArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        if (!isAdmin) {
            videosArray = videosArray.filter(video => isVideoPublic(video, examsById));
        }

        res.json({ success: true, data: videosArray });
    } catch (error) {
        console.error('Fetch Videos Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createVideo = async (req, res) => {
    try {
        const { title, examIds, discipline, apparatus, type, isZorunlu, expertD, expertE, expertDMoves, isArchived } = req.body;

        const newRef = db.ref('videos').push();
        await newRef.set({
            title,
            examIds: Array.isArray(examIds) ? examIds : [],
            discipline: discipline || 'WAG',
            apparatus: apparatus || 'Atlama Masası',
            type: type || 'D',
            isZorunlu: !!isZorunlu,
            isArchived: !!isArchived,
            expertD: expertD || 0,
            expertE: expertE || 0,
            expertDMoves: expertDMoves || {}, // Should contain d1...d11 if isZorunlu is true
            timestamp: Date.now()
        });

        res.json({ success: true, message: 'Video created', id: newRef.key });
    } catch (error) {
        console.error('Create Video Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        delete updates.id; // don't overwrite the key

        // Arşiv durumu elle değiştirildiyse sınav bağını kopar: elle arşivlenen seri
        // sınav geri alınınca kendiliğinden açılmamalı, elle açılan da yine kapanmamalı.
        if (Object.prototype.hasOwnProperty.call(updates, 'isArchived')) {
            updates.archivedByExam = null;
        }

        await db.ref(`videos/${id}`).update(updates);
        invalidateCache('videos', id);
        res.json({ success: true, message: 'Video updated' });
    } catch (error) {
        console.error('Update Video Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`videos/${id}`).remove();
        res.json({ success: true, message: 'Video deleted' });
    } catch (error) {
        console.error('Delete Video Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
