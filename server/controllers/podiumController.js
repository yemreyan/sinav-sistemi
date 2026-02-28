// podiumController.js
const { db } = require('../config/firebase');

exports.getAllPodiums = async (req, res) => {
    try {
        const snapshot = await db.ref('podiums').once('value');
        const data = snapshot.val() || {};

        const podiumsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        res.json({ success: true, data: podiumsArray });
    } catch (error) {
        console.error('Fetch Podiums Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createPodium = async (req, res) => {
    try {
        const { name } = req.body;

        const newRef = db.ref('podiums').push();
        await newRef.set({
            name: name || `Podyum ${Date.now()}`,
            state: { status: 'IDLE', mode: 'video', activeVideoId: null },
            examId: '',
            createdAt: Date.now()
        });

        res.json({ success: true, message: 'Podium created', id: newRef.key });
    } catch (error) {
        console.error('Create Podium Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updatePodiumState = async (req, res) => {
    try {
        const { id } = req.params;
        const { state } = req.body;

        await db.ref(`podiums/${id}/state`).update(state);
        res.json({ success: true, message: 'Podium state updated' });
    } catch (error) {
        console.error('Update Podium State Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updatePodium = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        await db.ref(`podiums/${id}`).update(updates);
        res.json({ success: true, message: 'Podium updated' });
    } catch (error) {
        console.error('Update Podium Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deletePodium = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`podiums/${id}`).remove();
        res.json({ success: true, message: 'Podium deleted' });
    } catch (error) {
        console.error('Delete Podium Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
