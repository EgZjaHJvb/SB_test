import QuizScore from '../../models/quiz/quizScore.model.js';
import mongoose from 'mongoose';

export const getMonthlyAverageStudyTime = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId format.' });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const start = new Date(year, month, 1); // First day of the month
    const end = new Date(year, month + 1, 1); // First day of the next month

    console.log(`Calculating average study time for userId: ${userId}, Date Range: ${start} - ${end}`);

    const result = await QuizScore.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: start, $lt: end } // Filter for the current month
        }
      },
      {
        $group: {
          _id: null,
          totalTime: { $sum: "$timeTaken" }, // Total time taken in seconds
          uniqueDates: { 
            $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } 
          } // Unique dates
        }
      },
      {
        $project: {
          _id: 0,
          averageTime: {
            $cond: [
              { $gt: [{ $size: "$uniqueDates" }, 0] }, // Check if uniqueDates array has elements
              { 
                $round: [
                  { 
                    $divide: ["$totalTime", { $multiply: [{ $size: "$uniqueDates" }, 60] }] // Convert to minutes
                  }, 2 
                ] 
              }, // Calculate average time in minutes per day
              0 // Default to 0 if no dates
            ]
          }
        }
      }
    ]);

    console.log("Aggregation result:", result);

    // Format response as: [averageTime in minutes]
    const formatted = result.length > 0
      ? [result[0].averageTime] // Average time in minutes
      : [0];

    return res.status(200).json(formatted);

  } catch (err) {
    console.error("Error fetching monthly average study time:", err.message);
    console.error(err.stack); // Log the full error stack for debugging
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
