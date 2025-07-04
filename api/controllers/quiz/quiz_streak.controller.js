import QuizScore from '../../models/quiz/quizScore.model.js';

export const getQuizStreak = async (req, res) => {
    try {
        const { userId } = req.params;

        const scores = await QuizScore.find({ userId }).sort({ createdAt: -1 }).select('createdAt');

        if (!scores.length) {
            return res.status(200).json({ streak: 0, streakDates: [] });
        }

        const uniqueDates = Array.from(
            new Set(scores.map((score) => new Date(score.createdAt).toISOString().split('T')[0]))
        );

        let streak = 0;
        // Use UTC for current date to match MongoDB's createdAt
        let currentDate = new Date();
        currentDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
        const streakDates = [];

        for (let dateStr of uniqueDates) {
            // Compare using UTC date
            const dateToCompare = new Date(dateStr + 'T00:00:00.000Z');
            if (isSameDayUTC(currentDate, dateToCompare)) {
                streak++;
                streakDates.push(dateStr);
                // Move to previous UTC day
                currentDate.setUTCDate(currentDate.getUTCDate() - 1);
            } else {
                break;
            }
        }

        return res.status(200).json({ streak, streakDates });
    } catch (error) {
        console.error('Error calculating quiz streak:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Compare two dates in UTC (year, month, day)
function isSameDayUTC(d1, d2) {
    return (
        d1.getUTCFullYear() === d2.getUTCFullYear() &&
        d1.getUTCMonth() === d2.getUTCMonth() &&
        d1.getUTCDate() === d2.getUTCDate()
    );
}
