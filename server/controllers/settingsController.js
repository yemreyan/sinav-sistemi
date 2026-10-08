const { db } = require('../config/firebase');
const { invalidateCache } = require('./sharedCache');

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
        // Başarı eşikleri: D ve E ayrı ayrı geçer, genel ortalama da tutmalı.
        // kritikBant: eşiğin bu kadar altı/üstü "sınırda" sayılır ve ayrı renkte gösterilir.
        if (!data.thresholds) {
            data.thresholds = { d: 70, e: 60, average: 65, criticalBand: 5 };
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

exports.updateThresholds = async (req, res) => {
    try {
        const { thresholds } = req.body || {};
        const sayi = (v, varsayilan) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 && n <= 100 ? n : varsayilan;
        };
        const temiz = {
            d: sayi(thresholds?.d, 70),
            e: sayi(thresholds?.e, 60),
            average: sayi(thresholds?.average, 65),
            criticalBand: sayi(thresholds?.criticalBand, 5)
        };
        await db.ref('settings/scoring/thresholds').set(temiz);
        invalidateCache('settings');
        res.json({ success: true, data: temiz, message: 'Başarı eşikleri güncellendi' });
    } catch (error) {
        console.error('Update Thresholds Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
