const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'jwt-secret-key';

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.cookies?.token;
  let token = null;
  if (authHeader && authHeader.startsWith && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateJWT; 