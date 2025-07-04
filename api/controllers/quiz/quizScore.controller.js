import QuizScore from '../../models/quiz/quizScore.model.js';
import User from '../../models/auth/User.model.js';
import UserQuizStats from '../../models/dashboard/UserQuizStats.model.js';

export const saveQuizScore = async (req, res) => {
    try {
        const {
            userId,
            subject,
            chapterId,
            subtopicId,
            correctAnswers,
            wrongAnswers,
            skippedAnswers,
            correctAnswerCount,
            wrongAnswerCount,
            xp,
            timeTaken,
        } = req.body;

        if (!userId || !subject || !chapterId || !subtopicId) {
            return res.status(400).json({
                message: 'Missing required fields (userId, subject, chapterId, subtopicId).',
            });
        }

        if (
            !Array.isArray(correctAnswers) ||
            !Array.isArray(wrongAnswers) ||
            !Array.isArray(skippedAnswers)
        ) {
            return res.status(400).json({
                message: 'Correct answers, wrong answers, and skipped answers must be arrays.',
            });
        }

        if (typeof timeTaken !== 'number' || timeTaken < 0) {
            return res
                .status(400)
                .json({ message: 'Invalid timeTaken value. Must be a positive number.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Add the new xp to the user's current xp
        user.xp += xp;

        // Save the updated user
        await user.save();

        const userQuizStats = await UserQuizStats.findOneAndUpdate(
            { userId },
            { $inc: { totalQuizzesAttempted: 1 } },
            { upsert: true, new: true }
        );
        // Create a new QuizScore object
        const newQuizScore = new QuizScore({
            userId,
            subject,
            chapterId,
            subtopicId,
            correctAnswers,
            wrongAnswers,
            skippedAnswers,
            correctAnswerCount,
            wrongAnswerCount,
            xp,
            timeTaken,
        });

        // Save the quiz score to the database
        await newQuizScore.save();

        // Respond with a success message
        res.status(201).json({
            message: 'Quiz score saved and XP updated successfully.',
            quizScore: newQuizScore,
            updatedXp: user.xp, // Include the updated XP in the response
            totalQuizzesAttempted: userQuizStats.totalQuizzesAttempted,
        });
    } catch (error) {
        // Catch any errors and respond with a failure message
        console.error(error);
        res.status(500).json({
            message: 'Failed to save quiz score and update XP due to an internal server error.',
        });
    }
};

export const getUserQuizScore = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate userId
        if (!id) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        // Check if the user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Fetch quiz scores for the user
        const quizScores = await QuizScore.find({ userId: id }).sort({ createdAt: -1 });

        // If no scores found
        if (!quizScores || quizScores.length === 0) {
            return res.status(404).json({ message: 'No quiz scores found for this user.' });
        }

        // Return the scores
        res.status(200).json({
            message: 'Quiz scores retrieved successfully.',
            quizScores,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Failed to retrieve quiz scores due to an internal server error.',
        });
    }
};

export const getUserQuizMeta = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const quizMeta = await QuizScore.find({ userId: id })
            .select('userId chapterId subtopicId')
            .sort({ createdAt: -1 });

        if (!quizMeta || quizMeta.length === 0) {
            return res.status(404).json({ message: 'No quiz metadata found for this user.' });
        }

        res.status(200).json({
            message: 'Quiz metadata retrieved successfully.',
            quizMeta,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve quiz metadata.' });
    }
};

export const getUserQuizAnswerStats = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const answerStats = await QuizScore.find({ userId: id })
            .select('userId chapterId subtopicId correctAnswers wrongAnswers skippedAnswers')
            .sort({ createdAt: -1 });

        if (!answerStats || answerStats.length === 0) {
            return res.status(404).json({ message: 'No quiz answer stats found for this user.' });
        }

        res.status(200).json({
            message: 'Quiz answer stats retrieved successfully.',
            answerStats,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve quiz answer stats.' });
    }
};
