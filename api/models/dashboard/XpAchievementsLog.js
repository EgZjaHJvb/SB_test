import mongoose from 'mongoose';
const { Schema } = mongoose;

const XpLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    xpGained: Number,
    timestamp: { type: Date, default: Date.now },
    relatedQuiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
});

const XpLog = mongoose.model('XpLog', XpLogSchema);
export default XpLog;
