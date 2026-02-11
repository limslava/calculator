const jwt = require('jsonwebtoken');

function createAuthMiddleware(jwtSecret) {
  function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Недействительный токен' });
      }
      req.user = user;
      next();
    });
  }

  function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  }

  return {
    authenticateToken,
    requireAdmin
  };
}

module.exports = {
  createAuthMiddleware
};
