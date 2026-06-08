const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/quotationController');

router.use(authenticate);

const opt = { nullable: true, checkFalsy: true };
const createRules = [
  body('serviceType').trim().notEmpty().withMessage('Service type is required'),
  body('origin').trim().notEmpty().withMessage('Origin is required'),
  body('destination').trim().notEmpty().withMessage('Destination is required'),
  body('clientId').optional(opt).isUUID().withMessage('Invalid client'),
  body('leadId').optional(opt).isUUID().withMessage('Invalid lead'),
  body('charges').optional().isArray().withMessage('Charges must be a list'),
];
const updateRules = [
  body('clientId').optional(opt).isUUID().withMessage('Invalid client'),
  body('leadId').optional(opt).isUUID().withMessage('Invalid lead'),
  body('charges').optional().isArray().withMessage('Charges must be a list'),
];

router.get('/', ctrl.getAll);
router.post('/', createRules, validate, ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', updateRules, validate, ctrl.update);
router.patch('/:id/submit',  ctrl.submit);
router.patch('/:id/approve', authorize('Admin', 'Sales Manager'), ctrl.approve);
router.patch('/:id/return',  authorize('Admin', 'Sales Manager'), ctrl.returnForRevision);
router.patch('/:id/confirm', ctrl.confirm);
router.get('/:id/pdf', ctrl.generatePdf);
router.get('/:id/versions', ctrl.getVersions);
router.delete('/:id', ctrl.delete);

module.exports = router;
