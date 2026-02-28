const { db } = require('../config/firebase');

exports.getSettings = async (req, res) => {
    try {
        const snapshot = await db.ref('settings/scoring').once('value');
        const data = snapshot.val() || {};

        // Provide defaults if not strictly present
        if (!data.diffPoints) {
            data.diffPoints = { 'A': 0.1, 'B': 0.2, 'C': 0.3, 'D': 0.4, 'E': 0.5, 'F': 0.6, 'G': 0.7, 'H': 0.8, 'I': 0.9, 'J': 1.0 };
        }
        if (!data.matrixOverrides) {
            data.matrixOverrides = {};
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch Settings Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateDiffPoints = async (req, res) => {
    try {
        const { diffPoints } = req.body;
        await db.ref('settings/scoring/diffPoints').set(diffPoints);
        res.json({ success: true, message: 'Diff points updated' });
    } catch (error) {
        console.error('Update Diff Points Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateMatrixOverrides = async (req, res) => {
    try {
        const { matrixOverrides } = req.body;
        await db.ref('settings/scoring/matrixOverrides').update(matrixOverrides);
        res.json({ success: true, message: 'Matrix overrides updated' });
    } catch (error) {
        console.error('Update Matrix Overrides Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
