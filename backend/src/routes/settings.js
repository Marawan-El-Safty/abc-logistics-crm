const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/settingsController');

router.use(authenticate);

// Any signed-in user can read settings (forms, PDF footer, default currency)
router.get('/', ctrl.get);
// Only Admins can change them
router.put('/', authorize('Admin'), ctrl.update);

module.exports = router;
