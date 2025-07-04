import UserQuizStats from '../../models/dashboard/UserQuizStats.model.js';
import mongoose from 'mongoose';

export const getTotalQuizAttempts = async (req, res) => {
  try {
    const { userId } = req.params;

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const stats = await UserQuizStats.findOne({ userId: userObjectId });

    const total = stats?.totalQuizzesAttempted || 0;

    return res.status(200).json({ totalQuizzesAttempted: total });
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};
