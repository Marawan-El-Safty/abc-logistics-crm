const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceLimit } = require('../middleware/planGate');
const ctrl = require('../controllers/shipmentController');

router.use(authenticate);

const canView = authorize('Admin', 'Sales Manager', 'Operation');

const opt = { nullable: true, checkFalsy: true };
const shipmentRules = [
  body('direction').optional(opt).isIn(['Import', 'Export', 'Domestic']).withMessage('Direction must be Import, Export or Domestic'),
  body('clientId').optional(opt).isUUID().withMessage('Invalid client'),
  body('quotationId').optional(opt).isUUID().withMessage('Invalid quotation'),
];

router.get('/',        canView, ctrl.getAll);
router.post('/',       canView, enforceLimit('shipments_per_month'), shipmentRules, validate, ctrl.create);
router.post('/import', canView, body('shipments').isArray({ min: 1 }).withMessage('No rows to import'), validate, ctrl.importRows);
router.put('/:id',         canView, shipmentRules, validate, ctrl.update);
router.put('/:id/archive', canView, ctrl.archive);
router.delete('/:id',      authorize('Admin', 'Sales Manager', 'Operation'), ctrl.delete);

module.exports = router;
