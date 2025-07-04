import mongoose from "mongoose";

const aiquizScoreSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: false
    },
    correctAnswers: {
        type: [String],
        default: []
    },
    wrongAnswers: {
        type: [String],
        default: []
    },
    skippedAnswers: {
        type: [String],
        default: []
    },
    correctAnswerCount: {
        type: Number,
        default: 0
    },
    wrongAnswerCount: {
        type: Number,
        default: 0
    },
    xp: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const AIQuizScore = mongoose.model('aiQuizScore', aiquizScoreSchema);

export default AIQuizScore;
