import mongoose from "mongoose";

const quizScoreSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    chapterId: {
        type: Number,
        required: true
    },
    subtopicId: {
        type: Number,
        required: true
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
    timeTaken:{
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const QuizScore = mongoose.model('QuizScore', quizScoreSchema);

export default QuizScore;
