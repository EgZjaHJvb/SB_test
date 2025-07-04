import mongoose from 'mongoose';
const { Schema } = mongoose;

const LeaderboardSnapshotSchema = new mongoose.Schema({
    syllabus: { type: String, enum: ['JEE', 'NEET', 'KJSCE'] },
    subject: { type: String, required: true },
    date: { type: Date, default: Date.now },
    users: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            xp: Number,
            rank: Number,
        },
    ],
});

const LeaderboardSnapshot = mongoose.model('LeaderboardSnapshot', LeaderboardSnapshotSchema);
export default LeaderboardSnapshot;
