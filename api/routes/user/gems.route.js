import express from 'express';
import authFullUser from '../../middleware/authFullUser.js';

const router = express.Router();

router.patch('/update', authFullUser, async (req, res) => {
  try {
    const user = req.user;
    user.gems += 20;
    await user.save();

    res.status(200).json({ gems: user.gems });
  } catch (error) {
    console.error('Error updating user XP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;