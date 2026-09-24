// examController.js
const { db } = require('../config/firebase');
const { isAdminRequest } = require('../utils/adminAuth');
const { invalidateCache, invalidatePodium } = require('./sharedCache');
const {
    archiveVideosOfExam,
    restoreVideosOfExam,
    countVideosAffectedByArchive,
    archivePodiumsOfExam,
    restorePodiumsOfExam,
    countPodiumsAffectedByArchive
} = require('../utils/examLinks');

exports.getAllExams = async (req, res) => {
    try {
        const snapshot = await db.ref('exams').once('value');
        const data = snapshot.val() || {};

        // Convert Firebase object to array
        let examsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        // Arşivlenmiş sınavlar yalnızca yöneticiye görünür
        if (!isAdminRequest(req)) {
            examsArray = examsArray.filter(exam => exam.status !== 'archived');
        }

        res.json({ success: true, data: examsArray });
    } catch (error) {
        console.error('Fetch Exams Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createExam = async (req, res) => {
    try {
        const { name, discipline } = req.body;
        if (!name || !discipline) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const newExamRef = db.ref('exams').push();
        await newExamRef.set({
            name,
            discipline,
            status: 'active',
            createdAt: Date.now()
        });

        res.json({ success: true, message: 'Exam created', id: newExamRef.key });
    } catch (error) {
        console.error('Create Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Bir sınav arşivlenirse kaç serinin birlikte arşivleneceğini söyler (onay ekranı için)
exports.getArchiveImpact = async (req, res) => {
    try {
        const { id } = req.params;
        const [videoCount, podiumCount] = await Promise.all([
            countVideosAffectedByArchive(id),
            countPodiumsAffectedByArchive(id)
        ]);
        res.json({ success: true, data: { videoCount, podiumCount } });
    } catch (error) {
        console.error('Archive Impact Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.archiveExam = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`exams/${id}`).update({ status: 'archived', archivedAt: Date.now() });

        // Sınavla birlikte, başka aktif sınavda kullanılmayan serileri de arşivle
        const archivedVideos = await archiveVideosOfExam(id);
        invalidateCache('videos');

        // Podyumları kapat — hakem ekranı yarışmanın bittiğini görsün
        const archivedPodiums = await archivePodiumsOfExam(id);
        archivedPodiums.forEach(invalidatePodium);

        console.log(`[ARCHIVE] Sınav ${id} arşivlendi — ${archivedVideos} seri, ${archivedPodiums.length} podyum kapatıldı`);
        res.json({
            success: true,
            message: 'Exam archived',
            data: { archivedVideos, archivedPodiums: archivedPodiums.length }
        });
    } catch (error) {
        console.error('Archive Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.restoreExam = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`exams/${id}`).update({ status: 'active', archivedAt: null });

        // Yalnızca bu sınavla birlikte arşivlenmiş serileri geri aç
        const restoredVideos = await restoreVideosOfExam(id);
        invalidateCache('videos');

        // Podyumlar IDLE'a döner — puanlamayı yönetici elle başlatır
        const restoredPodiums = await restorePodiumsOfExam(id);
        restoredPodiums.forEach(invalidatePodium);

        console.log(`[RESTORE] Sınav ${id} geri alındı — ${restoredVideos} seri, ${restoredPodiums.length} podyum açıldı`);
        res.json({
            success: true,
            message: 'Exam restored',
            data: { restoredVideos, restoredPodiums: restoredPodiums.length }
        });
    } catch (error) {
        console.error('Restore Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`exams/${id}`).remove();
        res.json({ success: true, message: 'Exam deleted' });
    } catch (error) {
        console.error('Delete Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
