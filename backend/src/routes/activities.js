const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/activityController');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/follow-ups/today', ctrl.getTodayFollowUps);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/done', ctrl.markDone);
router.delete('/:id', ctrl.delete);

module.exports = router;
