import mongoose from 'mongoose';
const { Schema } = mongoose;

const QuizAttemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    score: [Number], // Array to store scores from multiple quiz attempts
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    timeTaken: { type: Number, required: true }, // Time in seconds
    answers: [
        {
            questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
            selected: { type: String, required: true }, // User's selected answer
            correct: { type: Boolean, required: true }, // Whether the answer was correct
            questionText: String, // Optional: store question text for reference
            correctAnswer: String, // Store the actual correct answer
        },
    ],
    attemptedAt: { type: Date, default: Date.now },
});

// Add index for better query performance
QuizAttemptSchema.index({ userId: 1, attemptedAt: -1 });

const QuizAttempt = mongoose.model('QuizAttempt', QuizAttemptSchema);
export default QuizAttempt;
