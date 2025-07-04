import jwt from 'jsonwebtoken';

/**
 * Express middleware to authenticate requests using JWT.
 * Adds the decoded user to req.user if valid.
 */
export default function auth(req, res, next) {
  // Check token in cookies or Authorization header
  let token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid.' });
  }
}
