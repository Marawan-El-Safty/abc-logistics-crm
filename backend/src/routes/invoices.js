const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/invoiceController');

router.use(authenticate);
router.use(authorize('Admin', 'Finance'));

const opt = { nullable: true, checkFalsy: true };
const createRules = [
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('dueDate').notEmpty().isISO8601().withMessage('A valid due date is required'),
  body('clientId').optional(opt).isUUID().withMessage('Invalid client'),
  body('quotationId').optional(opt).isUUID().withMessage('Invalid quotation'),
  body('charges').optional().isArray().withMessage('Charges must be a list'),
];
const updateRules = [
  body('amount').optional(opt).isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('dueDate').optional(opt).isISO8601().withMessage('Invalid due date'),
  body('charges').optional().isArray().withMessage('Charges must be a list'),
];

router.get('/',         ctrl.getAll);
router.post('/',        createRules, validate, ctrl.create);
router.get('/:id',      ctrl.getById);
router.get('/:id/pdf',  ctrl.generatePdf);
router.put('/:id',      updateRules, validate, ctrl.update);
router.delete('/:id',   ctrl.delete);

module.exports = router;
