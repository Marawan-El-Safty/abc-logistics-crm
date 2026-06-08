const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/taskController');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/calendar', ctrl.getCalendar);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);

module.exports = router;
