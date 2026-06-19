const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.use(authenticate);

router.get('/', authorize('Admin', 'Sales Manager'), ctrl.getAll);
router.get('/roles', authorize('Admin'), ctrl.getRoles);
router.get('/seats', ctrl.getSeats);
router.get('/me/notification-preferences', ctrl.getNotifPrefs);
router.put('/me/notification-preferences', ctrl.updateNotifPrefs);
router.post('/me/change-password', ctrl.changePassword);
router.get('/:id', authorize('Admin', 'Sales Manager'), ctrl.getById);
router.post('/',
  authorize('Admin'),
  body('fullName').notEmpty(), body('email').isEmail(),
  body('password').isLength({ min: 8 }), body('roleId').isInt(),
  validate,
  ctrl.create
);
router.post('/invite',
  authorize('Admin'),
  body('email').isEmail(),
  body('roleId').notEmpty(),
  validate,
  ctrl.inviteUser
);
router.put('/:id', authorize('Admin'), ctrl.update);
router.delete('/:id/seat', authorize('Admin'), ctrl.freeUserSeat);
router.delete('/:id', authorize('Admin'), ctrl.delete);

module.exports = router;
