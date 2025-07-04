// controllers/userProgressController.js
import UserProgress from "../../models/quiz/userProgress.model.js";

// @desc    Get user's progress for a specific subject
// @route   GET /api/progress/:userId/:subject
// @access  Private (You'll need middleware for authentication)
const getUserProgress = async (req, res) => {
    try {
        const { userId, subject } = req.params;

        const userProgress = await UserProgress.findOne({ userId, subject });

        if (!userProgress) {
            // If no progress found, return an empty array for chapters or default structure
            return res.status(200).json({
                userId,
                subject,
                chaptersProgress: [],
            });
        }

        res.status(200).json(userProgress);
    } catch (error) {
        console.error('Error fetching user progress:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update a user's progress for a specific chapter within a subject
// @route   PUT /api/progress
// @access  Private
const updateUserProgress = async (req, res) => {
    try {
        const { userId, subject, chapterId, newLevel } = req.body;

        if (!userId || !subject || !chapterId || !newLevel) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        let userProgress = await UserProgress.findOne({ userId, subject });

        if (!userProgress) {
            // If user progress document for this subject doesn't exist, create it
            userProgress = new UserProgress({
                userId,
                subject,
                chaptersProgress: [],
            });
        }

        // Find the chapter progress within the array
        const chapterIndex = userProgress.chaptersProgress.findIndex(
            (cp) => cp.chapter_id === chapterId
        );

        if (chapterIndex > -1) {
            // Update existing chapter progress
            userProgress.chaptersProgress[chapterIndex].currentLevel = newLevel;
        } else {
            // Add new chapter progress
            userProgress.chaptersProgress.push({
                chapter_id: chapterId,
                currentLevel: newLevel,
            });
        }

        await userProgress.save();
        res.status(200).json(userProgress);
    } catch (error) {
        console.error('Error updating user progress:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Exporting the functions correctly
export { getUserProgress, updateUserProgress };
