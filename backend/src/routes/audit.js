const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planGate');
const ctrl = require('../controllers/auditController');

router.use(authenticate);
router.use(authorize('Admin'));
router.use(requireFeature('audit_log'));

router.get('/', ctrl.getAll);
router.get('/trash', ctrl.getTrash);
router.post('/trash/:entity/:id/restore', ctrl.restore);

module.exports = router;
