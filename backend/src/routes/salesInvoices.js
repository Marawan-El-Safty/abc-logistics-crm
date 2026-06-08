const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/salesInvoiceController');

router.use(authenticate);
router.use(authorize('Admin', 'Sales Manager', 'Sales Rep'));

router.get('/',        ctrl.getAll);
router.post('/',       ctrl.create);
router.put('/:id',     ctrl.update);
router.delete('/:id',  ctrl.delete);
router.get('/:id/pdf', ctrl.generatePdf);

module.exports = router;
