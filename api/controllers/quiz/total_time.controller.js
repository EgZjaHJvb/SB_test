import QuizScore from '../../models/quiz/quizScore.model.js';
import mongoose from 'mongoose';

export const getMonthlyStudyTime = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    // Start and end of the current month
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1); // First day of the next month

    const result = await QuizScore.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: start, $lt: end } // Filter scores within the current month
        }
      },
      {
        $addFields: {
          attemptDate: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } // Format date as "YYYY-MM-DD"
          }
        }
      },
      {
        $group: {
          _id: "$attemptDate",
          totalTime: { $sum: "$timeTaken" } // Sum the time taken (in seconds) for each date
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          time: { $round: [{ $divide: ["$totalTime", 60] }, 2] } // Convert seconds to minutes and round
        }
      },
      {
        $sort: { date: 1 } // Sort by date
      }
    ]);

    // Format result into an array of [time, date] pairs
    const formatted = result.map(entry => [entry.time, entry.date]);

    return res.status(200).json(formatted);

  } catch (err) {
    console.error("Error fetching study time data:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
