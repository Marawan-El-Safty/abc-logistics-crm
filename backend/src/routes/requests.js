const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl    = require('../controllers/requestController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.png', '.jpg', '.jpeg'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

router.use(authenticate);

router.get('/',                                              ctrl.getAll);
router.post('/', upload.array('attachments', 10),           ctrl.create);
router.get('/:id',                                          ctrl.getById);
router.put('/:id',                                          ctrl.update);
router.post('/:id/replies',                                 ctrl.addReply);
router.post('/:id/archive',   authorize('Admin', 'Sales Manager'), ctrl.archive);
router.post('/:id/unarchive', authorize('Admin', 'Sales Manager'), ctrl.unarchive);
router.delete('/:id',         authorize('Admin', 'Sales Manager'), ctrl.delete);

module.exports = router;
