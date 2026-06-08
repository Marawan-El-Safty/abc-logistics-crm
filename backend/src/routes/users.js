const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.use(authenticate);

router.get('/', authorize('Admin', 'Sales Manager'), ctrl.getAll);
router.get('/roles', authorize('Admin'), ctrl.getRoles);
router.get('/:id', authorize('Admin', 'Sales Manager'), ctrl.getById);
router.post('/',
  authorize('Admin'),
  body('fullName').notEmpty(), body('email').isEmail(),
  body('password').isLength({ min: 8 }), body('roleId').isInt(),
  validate,
  ctrl.create
);
router.post('/me/change-password', ctrl.changePassword);
router.get('/me/notification-preferences', ctrl.getNotifPrefs);
router.put('/me/notification-preferences', ctrl.updateNotifPrefs);
router.put('/:id', authorize('Admin'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.delete);

module.exports = router;
