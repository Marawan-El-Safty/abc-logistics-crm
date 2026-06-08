const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/shippingRateController');

router.use(authenticate);

router.get('/',         ctrl.getAll);
router.get('/suggest',  ctrl.suggest);   // before /:id to avoid route conflict
router.post('/',        ctrl.create);
router.put('/:id',   ctrl.update);
router.delete('/:id', authorize('Admin', 'Sales Manager'), ctrl.delete);

module.exports = router;
