import mongoose from 'mongoose';
const { Schema } = mongoose;

const QuestionSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    questionText: String,
    options: [String],
    correctAnswerIndex: { type: Number },
    correctAnswer: { type: String },
    explanation: String,
    imageUrl: String,
    type: { type: String, enum: ['mcq', 'truefalse', 'fillblank'] },
    aiGenerated: Boolean,
});

const Question = mongoose.model('Question', QuestionSchema);
export default Question;
