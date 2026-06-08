const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// SSE stream — EventSource can't send headers, so accept token via query param
const authenticateSse = async (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL`,
      [decoded.userId]
    );
    if (!result.rows.length) return res.status(401).end();
    req.user = result.rows[0];
    next();
  } catch { return res.status(401).end(); }
};

router.get('/stream', authenticateSse, ctrl.stream);

router.use(authenticate);
router.get('/', ctrl.getAll);
router.patch('/:id/read', ctrl.markRead);
router.post('/mark-all-read', ctrl.markAllRead);

module.exports = router;
