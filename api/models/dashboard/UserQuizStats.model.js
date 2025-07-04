import mongoose from 'mongoose';

const UserQuizStatsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    totalQuizzesAttempted: { type: Number, default: 0 },
});

const UserQuizStats = mongoose.model('UserQuizStats', UserQuizStatsSchema);
export default UserQuizStats;
