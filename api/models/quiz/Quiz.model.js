import mongoose from 'mongoose';
const { Schema } = mongoose;

const QuizSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    syllabus: { type: String, enum: ['JEE', 'NEET', 'KJSCE'] },
    tags: [String],
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    isCustom: Boolean,
    createdAt: { type: Date, default: Date.now },
    sourceDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    documentHash: String,
});

const Quiz = mongoose.model('Quiz', QuizSchema);
export default Quiz;