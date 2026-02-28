// videoController.js
const { db } = require('../config/firebase');

exports.getAllVideos = async (req, res) => {
    try {
        const snapshot = await db.ref('videos').once('value');
        const data = snapshot.val() || {};

        const videosArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

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
        await db.ref(`videos/${id}`).update(updates);
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
