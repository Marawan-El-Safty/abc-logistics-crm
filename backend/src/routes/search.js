const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/searchController');

router.use(authenticate);
router.get('/', ctrl.search);

module.exports = router;
