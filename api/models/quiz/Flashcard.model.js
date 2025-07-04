import mongoose from 'mongoose';
const { Schema } = mongoose;

const FlashcardSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    syllabus: { type: String, enum: ['JEE', 'NEET', 'KJSCE'] },
    subject: String,
    question: String,
    answer: String,
    tags: [String],
    isAIgenerated: Boolean,
    createdAt: { type: Date, default: Date.now },
});

const Flashcard = mongoose.model('Flashcard', FlashcardSchema);
export default Flashcard;
