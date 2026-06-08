const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/bankAccountController');

router.use(authenticate);

// GET (list) — Admin + Finance can read
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// Create/update — Admin + Finance; Delete — Admin only
router.post('/',      authorize('Admin', 'Finance'), ctrl.create);
router.put('/:id',    authorize('Admin', 'Finance'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.delete);

module.exports = router;
