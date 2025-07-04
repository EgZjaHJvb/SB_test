import express from 'express';
import auth from '../../middleware/auth.js';
import User from '../../models/auth/User.model.js';

const router = express.Router();

/**
 * Gets the user's current streak information.
 * @route GET /user/streak
 * @access Private
 */
router.get('/streak', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Return current streak, longest streak and last login date
        res.json({
            currentStreak: user.currentStreak || 0,
            longestStreak: user.longestStreak || 0,
            lastLoginDate: user.lastLoginDate,
        });
    } catch (err) {
        console.error('Error fetching streak:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
