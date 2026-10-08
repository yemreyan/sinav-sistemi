const express = require('express');
const router = express.Router();

// Middleware
const requireAdmin = require('../middleware/requireAdmin');

// Controllers
const adminController = require('../controllers/adminController');
const examController = require('../controllers/examController');
const podiumController = require('../controllers/podiumController');
const videoController = require('../controllers/videoController');
const refereeController = require('../controllers/refereeController');
const settingsController = require('../controllers/settingsController');
const resultsController = require('../controllers/resultsController');
const scoreController = require('../controllers/scoreController');
const questionController = require('../controllers/questionController');

// 1. Auth / Admin Routes
router.post('/admin/login', adminController.login);

// NOT: Okuma (GET) uçları hakem ekranı ve canlı sonuç sayfaları için açık; arşivlenmiş
// içerik bu yanıtlardan süzülür. Hakem listesi istisnadır — kişisel veri taşıdığı için
// okuması da yönetici girişine bağlıdır. Veriyi değiştiren tüm uçlar requireAdmin ile korunur.

// 2. Exam Routes
router.get('/exams', examController.getAllExams);
router.get('/exams/:id/archive-impact', requireAdmin, examController.getArchiveImpact);
router.post('/exams', requireAdmin, examController.createExam);
router.put('/exams/:id/archive', requireAdmin, examController.archiveExam);
router.put('/exams/:id/restore', requireAdmin, examController.restoreExam);
router.delete('/exams/:id', requireAdmin, examController.deleteExam);

// 3. Podium Routes
router.get('/podiums', podiumController.getAllPodiums);
router.post('/podiums', requireAdmin, podiumController.createPodium);
router.put('/podiums/:id/state', requireAdmin, podiumController.updatePodiumState);
router.put('/podiums/:id', requireAdmin, podiumController.updatePodium);
router.delete('/podiums/:id', requireAdmin, podiumController.deletePodium);

// 4. Video / Series Routes
router.get('/videos', videoController.getAllVideos);
router.post('/videos', requireAdmin, videoController.createVideo);
router.put('/videos/:id', requireAdmin, videoController.updateVideo);
router.delete('/videos/:id', requireAdmin, videoController.deleteVideo);

// 5. Referee Routes
// Hakem listesi kişisel veri (ad + e-posta) taşır — okuması da yönetici girişine bağlı.
// Hakemlerin kendi girişi /scores/auth üzerinden yapılır, bu uca ihtiyaç duymaz.
router.get('/referees', requireAdmin, refereeController.getAllReferees);
router.get('/referee-groups', requireAdmin, refereeController.getGroups);
router.post('/referees', requireAdmin, refereeController.createReferee);
router.put('/referees/:id', requireAdmin, refereeController.updateReferee);
router.delete('/referees/:id', requireAdmin, refereeController.deleteReferee);

// 6. Settings Routes
router.get('/settings', settingsController.getSettings);
router.put('/settings/diff', requireAdmin, settingsController.updateDiffPoints);
router.put('/settings/matrix', requireAdmin, settingsController.updateMatrixOverrides);
router.put('/settings/thresholds', requireAdmin, settingsController.updateThresholds);

// 6b. Soru Havuzu ve Dağıtım
// Soru havuzu uzman değerlerini taşır ve yalnızca panelde kullanılır.
// Hakem ekranı kendi videosunu /scores/my-video üzerinden alır.
router.get('/questions', requireAdmin, questionController.getAll);
router.post('/questions', requireAdmin, questionController.create);
router.put('/questions/:id', requireAdmin, questionController.update);
router.delete('/questions/:id', requireAdmin, questionController.remove);
router.post('/questions/:id/videos', requireAdmin, questionController.addVideo);
router.put('/questions/:id/videos/:vid', requireAdmin, questionController.updateVideo);
router.delete('/questions/:id/videos/:vid', requireAdmin, questionController.removeVideo);
router.post('/questions/:id/distribute', requireAdmin, questionController.distribute);
router.get('/questions/:id/assignments', requireAdmin, questionController.getAssignments);
router.delete('/questions/:id/assignments', requireAdmin, questionController.clearAssignments);

// 7. Results & Stats Routes
router.get('/results', resultsController.getAllResults);
router.get('/stats', resultsController.getStats);

// 8. Score Routes (Hakem Puanlama — concurrent-safe, admin girişi gerektirmez)
router.post('/scores/auth', scoreController.authenticate);
router.get('/scores/podium-state/:podiumId', scoreController.getPodiumState);
router.post('/scores/submit', scoreController.submitScore);
router.get('/scores/existing', scoreController.getExistingScore);
router.get('/scores/my-video', scoreController.getMyVideo);
router.post('/scores/watched', scoreController.markWatched);

// Canlı gönderim takibi — yalnızca yönetici (hakem adı/e-postası döner)
router.get('/scores/submission-status/:podiumId', requireAdmin, scoreController.getSubmissionStatus);
router.get('/scores/coverage/:podiumId', requireAdmin, scoreController.getCoverage);

// Telafi izinleri — verme/kaldırma yönetici, okuma hakem ekranı için açık
router.post('/scores/makeup', requireAdmin, scoreController.grantMakeup);
router.delete('/scores/makeup', requireAdmin, scoreController.revokeMakeup);
router.get('/scores/makeup', scoreController.getMakeupForReferee);
router.get('/scores/makeup-list/:videoId', requireAdmin, scoreController.getMakeupByVideo);

module.exports = router;
