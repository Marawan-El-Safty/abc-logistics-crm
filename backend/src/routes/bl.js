const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planGate');
const ctrl = require('../controllers/blController');

router.use(authenticate);
router.use(requireFeature('bl_documents'));

const canManageBl = authorize('Admin', 'Operation');

router.get('/shipment/:shipmentId', canManageBl, ctrl.getByShipment);
router.post('/', canManageBl, ctrl.create);
router.put('/:id', canManageBl, ctrl.update);
router.delete('/:id', canManageBl, ctrl.delete);
router.get('/:id/pdf', canManageBl, ctrl.generatePdf);

module.exports = router;
