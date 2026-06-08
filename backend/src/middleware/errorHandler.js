const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry', detail: err.detail });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found', detail: err.detail });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid value format', detail: err.message });
  }

  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  // Deliberate client errors (4xx with a status set upstream) keep their message.
  // Unexpected 5xx errors are masked in production so internal details / stack
  // traces never reach the client; the full error is still logged above.
  const expose = status < 500;
  res.status(status).json({
    error: (expose || !isProd) ? (err.message || 'Internal server error') : 'Internal server error',
    ...(!isProd && { stack: err.stack }),
  });
};

module.exports = errorHandler;
