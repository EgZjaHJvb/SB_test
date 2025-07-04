import AIQuizScore from '../../models/quiz/aiQuizScore.model.js';
import User from '../../models/auth/User.model.js';

export const saveAIQuizScore = async (req, res) => {
    try {
        const {
            userId,
            subject,
            correctAnswers,
            wrongAnswers,
            skippedAnswers,
            correctAnswerCount,
            wrongAnswerCount,
            xp
        } = req.body;

        // Validate the incoming data
        if (!userId || !subject) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields (userId, subject).' 
            });
        }

        // Ensure correctAnswers, wrongAnswers, and skippedAnswers are arrays
        if (!Array.isArray(correctAnswers) || !Array.isArray(wrongAnswers) || !Array.isArray(skippedAnswers)) {
            return res.status(400).json({ 
                success: false,
                message: 'Correct answers, wrong answers, and skipped answers must be arrays.' 
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found.' 
            });
        }

        // Calculate XP if not provided
        const calculatedXp = xp || (correctAnswerCount * 10);

        // Add the new xp to the user's current xp
        user.xp += calculatedXp;
        await user.save();

        // Create a new AIQuizScore object
        const newAIQuizScore = new AIQuizScore({
            userId,
            subject,
            correctAnswers,
            wrongAnswers,
            skippedAnswers,
            correctAnswerCount: correctAnswerCount || correctAnswers.length,
            wrongAnswerCount: wrongAnswerCount || wrongAnswers.length,
            xp: calculatedXp
        });

        // Save the quiz score to the database
        await newAIQuizScore.save();

        // Respond with a success message
        res.status(201).json({
            success: true,
            message: 'AI Quiz score saved and XP updated successfully.',
            data: {
                quizScore: newAIQuizScore,
                updatedUserXp: user.xp,
                scoreDetails: {
                    correct: newAIQuizScore.correctAnswerCount,
                    wrong: newAIQuizScore.wrongAnswerCount,
                    skipped: newAIQuizScore.skippedAnswers.length,
                    total: newAIQuizScore.correctAnswerCount + newAIQuizScore.wrongAnswerCount + newAIQuizScore.skippedAnswers.length,
                    xpEarned: calculatedXp
                }
            }
        });

    } catch (error) {
        console.error('Error saving AI quiz score:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to save AI quiz score due to an internal server error.',
            error: error.message
        });
    }
};

export const getAIQuizScores = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate userId
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                message: 'User ID is required.' 
            });
        }

        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found.' 
            });
        }

        // Fetch AI quiz scores for the user
        const aiQuizScores = await AIQuizScore.find({ userId })
            .sort({ createdAt: -1 })
            .populate('userId', 'username email');

        // If no scores found
        if (!aiQuizScores || aiQuizScores.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'No AI quiz scores found for this user.' 
            });
        }

        // Calculate summary statistics
        const totalScores = aiQuizScores.length;
        const totalCorrect = aiQuizScores.reduce((sum, score) => sum + score.correctAnswerCount, 0);
        const totalWrong = aiQuizScores.reduce((sum, score) => sum + score.wrongAnswerCount, 0);
        const totalSkipped = aiQuizScores.reduce((sum, score) => sum + score.skippedAnswers.length, 0);
        const totalXp = aiQuizScores.reduce((sum, score) => sum + score.xp, 0);

        // Return the scores with summary
        res.status(200).json({
            success: true,
            message: 'AI Quiz scores retrieved successfully.',
            data: {
                scores: aiQuizScores,
                summary: {
                    totalQuizzes: totalScores,
                    totalCorrect: totalCorrect,
                    totalWrong: totalWrong,
                    totalSkipped: totalSkipped,
                    totalXp: totalXp,
                    averageCorrect: totalScores > 0 ? (totalCorrect / totalScores).toFixed(2) : 0,
                    accuracy: (totalCorrect + totalWrong) > 0 ? ((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(2) : 0
                }
            }
        });

    } catch (error) {
        console.error('Error retrieving AI quiz scores:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to retrieve AI quiz scores due to an internal server error.',
            error: error.message
        });
    }
};

export const getAIQuizScoreById = async (req, res) => {
    try {
        const { scoreId } = req.params;

        if (!scoreId) {
            return res.status(400).json({ 
                success: false,
                message: 'Score ID is required.' 
            });
        }

        const aiQuizScore = await AIQuizScore.findById(scoreId)
            .populate('userId', 'username email');

        if (!aiQuizScore) {
            return res.status(404).json({ 
                success: false,
                message: 'AI Quiz score not found.' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'AI Quiz score retrieved successfully.',
            data: aiQuizScore
        });

    } catch (error) {
        console.error('Error retrieving AI quiz score:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to retrieve AI quiz score due to an internal server error.',
            error: error.message
        });
    }
};

export const deleteAIQuizScore = async (req, res) => {
    try {
        const { scoreId } = req.params;

        if (!scoreId) {
            return res.status(400).json({ 
                success: false,
                message: 'Score ID is required.' 
            });
        }

        const aiQuizScore = await AIQuizScore.findById(scoreId);
        if (!aiQuizScore) {
            return res.status(404).json({ 
                success: false,
                message: 'AI Quiz score not found.' 
            });
        }

        // Remove XP from user
        const user = await User.findById(aiQuizScore.userId);
        if (user) {
            user.xp -= aiQuizScore.xp;
            await user.save();
        }

        // Delete the score
        await AIQuizScore.findByIdAndDelete(scoreId);

        res.status(200).json({
            success: true,
            message: 'AI Quiz score deleted successfully.',
            data: {
                deletedScore: aiQuizScore,
                updatedUserXp: user ? user.xp : 0
            }
        });

    } catch (error) {
        console.error('Error deleting AI quiz score:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to delete AI quiz score due to an internal server error.',
            error: error.message
        });
    }
}; 