const express = require('express');
const router = express.Router();

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

// 2. Exam Routes
router.get('/exams', examController.getAllExams);
router.post('/exams', examController.createExam);
router.put('/exams/:id/archive', examController.archiveExam);
router.put('/exams/:id/restore', examController.restoreExam);
router.delete('/exams/:id', examController.deleteExam);

// 3. Podium Routes
router.get('/podiums', podiumController.getAllPodiums);
router.post('/podiums', podiumController.createPodium);
router.put('/podiums/:id/state', podiumController.updatePodiumState);
router.put('/podiums/:id', podiumController.updatePodium);
router.delete('/podiums/:id', podiumController.deletePodium);

// 4. Video / Series Routes
router.get('/videos', videoController.getAllVideos);
router.post('/videos', videoController.createVideo);
router.put('/videos/:id', videoController.updateVideo);
router.delete('/videos/:id', videoController.deleteVideo);

// 5. Referee Routes
router.get('/referees', refereeController.getAllReferees);
router.post('/referees', refereeController.createReferee);
router.put('/referees/:id', refereeController.updateReferee);
router.delete('/referees/:id', refereeController.deleteReferee);

// 6. Settings Routes
router.get('/settings', settingsController.getSettings);
router.put('/settings/diff', settingsController.updateDiffPoints);
router.put('/settings/matrix', settingsController.updateMatrixOverrides);

// 7. Results & Stats Routes
router.get('/results', resultsController.getAllResults);
router.get('/stats', resultsController.getStats);

// 8. Score Routes (Hakem Puanlama — concurrent-safe)
router.post('/scores/auth', scoreController.authenticate);
router.get('/scores/podium-state/:podiumId', scoreController.getPodiumState);
router.post('/scores/submit', scoreController.submitScore);

module.exports = router;
