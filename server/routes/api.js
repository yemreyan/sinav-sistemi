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

// 1. Auth / Admin Routes
router.post('/admin/login', adminController.login);

// NOT: Okuma (GET) uçları açık — hakem ekranı ve canlı sonuç sayfaları bunlara
// giriş yapmadan erişiyor. Veriyi değiştiren tüm uçlar requireAdmin ile korunur.

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
router.get('/referees', refereeController.getAllReferees);
router.post('/referees', requireAdmin, refereeController.createReferee);
router.put('/referees/:id', requireAdmin, refereeController.updateReferee);
router.delete('/referees/:id', requireAdmin, refereeController.deleteReferee);

// 6. Settings Routes
router.get('/settings', settingsController.getSettings);
router.put('/settings/diff', requireAdmin, settingsController.updateDiffPoints);
router.put('/settings/matrix', requireAdmin, settingsController.updateMatrixOverrides);

// 7. Results & Stats Routes
router.get('/results', resultsController.getAllResults);
router.get('/stats', resultsController.getStats);

// 8. Score Routes (Hakem Puanlama — concurrent-safe, admin girişi gerektirmez)
router.post('/scores/auth', scoreController.authenticate);
router.get('/scores/podium-state/:podiumId', scoreController.getPodiumState);
router.post('/scores/submit', scoreController.submitScore);
router.get('/scores/existing', scoreController.getExistingScore);

module.exports = router;
