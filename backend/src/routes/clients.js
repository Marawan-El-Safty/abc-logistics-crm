const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/clientController');
const contractCtrl = require('../controllers/contractController');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF and DOCX files are allowed'));
  },
});
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/',
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email'),
  validate,
  ctrl.create
);
router.post('/import-csv', csvUpload.single('file'), ctrl.importCsv);
router.get('/:id', ctrl.getById);
router.put('/:id',
  body('companyName').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email'),
  validate,
  ctrl.update
);
router.delete('/:id', ctrl.delete);

// Contacts
router.post('/:id/contacts', ctrl.addContact);
router.put('/:id/contacts/:contactId', ctrl.updateContact);
router.delete('/:id/contacts/:contactId', ctrl.deleteContact);

// Branches
router.post('/:id/branches', ctrl.addBranch);
router.delete('/:id/branches/:branchId', ctrl.deleteBranch);

// Contracts
router.get('/:clientId/contracts', contractCtrl.getByClient);
router.post('/:clientId/contracts', upload.single('file'), contractCtrl.upload);
router.delete('/:clientId/contracts/:contractId', contractCtrl.delete);

module.exports = router;
