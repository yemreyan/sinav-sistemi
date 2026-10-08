const { db } = require('../config/firebase');
const { getCached, setCache } = require('./sharedCache');
const { isAdminRequest } = require('../utils/adminAuth');

// Arşivlenmiş sınavların id kümesi — sonuçları dışarıya kapatmak için
async function getArchivedExamIds() {
    const snapshot = await db.ref('exams').once('value');
    const exams = snapshot.val() || {};
    return new Set(
        Object.keys(exams).filter(id => exams[id]?.status === 'archived')
    );
}

exports.getAllResults = async (req, res) => {
    try {
        const isAdmin = isAdminRequest(req);

        const [snapshot, archivedExamIds] = await Promise.all([
            db.ref('results').once('value'),
            isAdmin ? Promise.resolve(new Set()) : getArchivedExamIds()
        ]);

        const data = snapshot.val() || {};

        let resultsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        // Arşivlenmiş sınavların sonuçları yalnızca yöneticiye görünür
        if (!isAdmin && archivedExamIds.size > 0) {
            resultsArray = resultsArray.filter(result => !archivedExamIds.has(result.examId));
        }

        res.json({ success: true, data: resultsArray });
    } catch (error) {
        console.error('Fetch Results Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const isAdmin = isAdminRequest(req);

        // Dashboard bunu düzenli aralıkla çağırıyor ve sorgu tüm results'ı okuyor.
        // Yönetici ve ziyaretçi farklı sayılar gördüğü için anahtar role göre ayrı.
        const cacheKey = isAdmin ? 'admin' : 'public';
        const onbellek = getCached('stats', cacheKey);
        if (onbellek) return res.json(onbellek);

        const [examsSnap, videosSnap, refereesSnap, podiumsSnap, resultsSnap] = await Promise.all([
            db.ref('exams').once('value'),
            db.ref('videos').once('value'),
            db.ref('referees').once('value'),
            db.ref('podiums').once('value'),
            db.ref('results').once('value')
        ]);

        const exams = examsSnap.val() || {};
        const videos = videosSnap.val() || {};
        const referees = refereesSnap.val() || {};
        const podiums = podiumsSnap.val() || {};
        const results = resultsSnap.val() || {};

        const activeExams = Object.values(exams).filter(e => e.status === 'active');
        const activePodiums = Object.values(podiums).filter(p => p.state?.status === 'SCORING');

        const archivedExamIds = new Set(
            Object.keys(exams).filter(id => exams[id]?.status === 'archived')
        );

        // Yönetici dışındaki istekler arşivlenmiş sınavların hiçbir sayısını görmez
        const visibleExamCount = isAdmin ? Object.keys(exams).length : activeExams.length;

        const visibleVideos = isAdmin
            ? Object.values(videos)
            : Object.values(videos).filter(v => !v.isArchived);

        const visibleResults = isAdmin
            ? Object.values(results)
            : Object.values(results).filter(r => !archivedExamIds.has(r.examId));

        const yanit = {
            success: true,
            data: {
                totalExams: visibleExamCount,
                activeExams: activeExams.length,
                activeExamName: activeExams.length > 0 ? activeExams[0].name : 'Yok',
                archivedExams: isAdmin ? archivedExamIds.size : 0,
                totalVideos: visibleVideos.length,
                archivedVideos: isAdmin ? Object.values(videos).filter(v => v.isArchived).length : 0,
                totalReferees: Object.values(referees).filter(r => !r.isArchived).length,
                archivedReferees: isAdmin ? Object.values(referees).filter(r => r.isArchived).length : 0,
                totalPodiums: Object.keys(podiums).length,
                activePodiums: activePodiums.length,
                totalResults: visibleResults.length
            }
        };

        setCache('stats', cacheKey, yanit);
        res.json(yanit);
    } catch (error) {
        console.error('Fetch Stats Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
