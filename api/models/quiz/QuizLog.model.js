import mongoose from 'mongoose';

const quizLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true } // Optional but useful
);

const QuizLog = mongoose.model('QuizLog', quizLogSchema);
export default QuizLog;
