const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const ctrl = require('../controllers/adminController');

router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/tenants', ctrl.listTenants);
router.get('/tenants/:id', ctrl.getTenant);
router.patch('/tenants/:id', ctrl.patchTenant);
router.post('/tenants/:id/impersonate', ctrl.impersonate);

module.exports = router;
