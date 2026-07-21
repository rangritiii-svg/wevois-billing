const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'wevois-local-dev-secret-change-in-production';

module.exports = function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated — please sign in' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please sign in again' });
  }
};

module.exports.JWT_SECRET = JWT_SECRET;
