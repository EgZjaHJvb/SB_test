import mongoose from 'mongoose';
const { Schema } = mongoose;

const DocumentSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    filename: String,
    fileHash: String,
    fileType: String,
    cloudinaryUrl: { type: String, required: false },
    textContent: String,
    syllabus: { type: String, enum: ['JEE', 'NEET', 'KJSCE'] },
    subject: String,
    uploadDate: { type: Date, default: Date.now },
});

const Document = mongoose.model('Document', DocumentSchema);
export default Document;
