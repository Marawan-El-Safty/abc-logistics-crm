const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planGate');
const ctrl = require('../controllers/reportController');

router.use(authenticate);

router.get('/exchange-rate', ctrl.getExchangeRate);
router.get('/dashboard', ctrl.getDashboard);
router.get('/finance-dashboard', authorize('Admin', 'Finance'), ctrl.getFinanceDashboard);
router.get('/performance', authorize('Admin', 'Sales Manager'), ctrl.getPerformance);
router.get('/full', authorize('Admin', 'Sales Manager'), ctrl.getFullReport);
router.get('/pipeline', authorize('Admin', 'Sales Manager'), ctrl.getPipeline);
router.get('/export/performance',  authorize('Admin', 'Sales Manager'), requireFeature('reports_export'), ctrl.exportPerformance);
router.get('/export/shipments',   authorize('Admin', 'Sales Manager', 'Operation'), requireFeature('reports_export'), ctrl.exportShipments);
router.get('/export/invoices',    authorize('Admin', 'Finance'), requireFeature('reports_export'), ctrl.exportInvoices);
router.get('/export/quotations',  authorize('Admin', 'Sales Manager'), requireFeature('reports_export'), ctrl.exportQuotations);

module.exports = router;
