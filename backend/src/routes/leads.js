const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const ctrl = require('../controllers/leadController');

// Public inbound webhook from website
router.post('/inbound', ctrl.createInbound);

router.use(authenticate);

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', ctrl.getAll);
router.post('/',
  body('contactName').trim().notEmpty().withMessage('Contact name is required'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email'),
  validate,
  ctrl.create
);
router.post('/import-csv', csvUpload.single('file'), ctrl.importCsv);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.patch('/:id/stage', ctrl.updateStage);
router.delete('/:id', ctrl.delete);

module.exports = router;
