const { query } = require('../config/db');

// In-memory map of userId → Set of SSE response objects
const sseClients = new Map();

exports.addSseClient = (userId, res) => {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
};

exports.removeSseClient = (userId, res) => {
  const set = sseClients.get(userId);
  if (set) { set.delete(res); if (!set.size) sseClients.delete(userId); }
};

exports.pushToUser = (userId, event, data) => {
  const set = sseClients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch (_) {}
  }
};


exports.stream = (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const userId = req.user.id;
  exports.addSseClient(userId, res);

  // Send current unread count immediately
  query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', [userId])
    .then(r => res.write(`event: init\ndata: ${JSON.stringify({ unreadCount: parseInt(r.rows[0].count) })}\n\n`))
    .catch(() => {});

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    exports.removeSseClient(userId, res);
  });
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unreadCount = result.rows.filter(n => !n.is_read).length;
    res.json({ data: result.rows, unreadCount });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

// Insert a notification row and immediately push it via SSE to the user
exports.createAndPush = async (userId, type, title, body, link = null, metadata = {}) => {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, body, link, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, type, title, body, link, JSON.stringify(metadata)]
    );
    exports.pushToUser(userId, 'notification', result.rows[0]);
  } catch (err) {
    console.error('[notification] createAndPush failed:', err.message);
  }
};
