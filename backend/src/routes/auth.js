const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController');

router.post('/login',
  body('email').isEmail(), body('password').notEmpty(), validate,
  ctrl.login
);
router.post('/register-company',
  body('company_name').notEmpty(),
  body('slug').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').notEmpty(),
  validate,
  ctrl.registerCompany
);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.patch('/profile', authenticate, ctrl.updateProfile);
router.post('/change-password',
  authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  ctrl.changePassword
);
router.post('/invite/accept/:token',
  body('password').isLength({ min: 8 }),
  validate,
  userCtrl.acceptInvite
);

module.exports = router;
