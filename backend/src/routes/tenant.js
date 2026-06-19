const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/tenantController');

router.use(authenticate);
router.get('/plan', ctrl.getPlan);

module.exports = router;
