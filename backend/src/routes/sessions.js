const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/sessionController');

router.use(authenticate);
router.post('/ping', ctrl.ping);
router.get('/user-time', authorize('Admin', 'Sales Manager'), ctrl.getUserTime);
router.get('/user-time/:id/breakdown', authorize('Admin', 'Sales Manager'), ctrl.getUserBreakdown);

module.exports = router;
