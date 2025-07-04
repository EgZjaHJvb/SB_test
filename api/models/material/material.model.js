import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  category: { type: String, enum: ['video', 'podcast', 'notes'], required: true },
  subject: { type: String, enum: ['Maths', 'Physics', 'Chemistry', 'Biology', "PYQ's"], required: true },
  syllabus: { type: String, enum: ['JEE', 'NEET'], required: true },
  fileUrl: { type: String, required: true },
  thumbnailUrl: String,
  tags: [String],
  isPublic: { type: Boolean, default: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadDate: { type: Date, default: Date.now },
});

export default mongoose.model('Material', materialSchema);
