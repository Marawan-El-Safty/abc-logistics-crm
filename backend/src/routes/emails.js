const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/emailController');

router.use(authenticate);

router.get('/templates', ctrl.getTemplates);
router.get('/preview-template', ctrl.previewTemplate);
router.post('/send', ctrl.send);
router.get('/logs', ctrl.getLogs);

module.exports = router;
