// middleware/authFullUser.js
import jwt from 'jsonwebtoken';
import User from '../models/auth/User.model.js';

export default async function authFullUser(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('currentSubscription');
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = user;

    // Alias subscription info for easy access in other middleware
    req.user.subscription = {
      plan: user.currentSubscription?.plan?.toLowerCase() || 'free',
      status: user.currentSubscription?.status || 'inactive',
      planEnd: user.currentSubscription?.planEnd,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Token is not valid.' });
  }
}
