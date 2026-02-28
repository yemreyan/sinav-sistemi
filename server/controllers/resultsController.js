const { db } = require('../config/firebase');

exports.getAllResults = async (req, res) => {
    try {
        const snapshot = await db.ref('results').once('value');
        const data = snapshot.val() || {};

        const resultsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        res.json({ success: true, data: resultsArray });
    } catch (error) {
        console.error('Fetch Results Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getStats = async (req, res) => {
    try {
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

        res.json({
            success: true,
            data: {
                totalExams: Object.keys(exams).length,
                activeExams: activeExams.length,
                activeExamName: activeExams.length > 0 ? activeExams[0].name : 'Yok',
                totalVideos: Object.keys(videos).length,
                totalReferees: Object.keys(referees).length,
                totalPodiums: Object.keys(podiums).length,
                activePodiums: activePodiums.length,
                totalResults: Object.keys(results).length
            }
        });
    } catch (error) {
        console.error('Fetch Stats Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
