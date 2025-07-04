import mongoose from 'mongoose';
const { Schema } = mongoose;

const CommunityPostSchema = new mongoose.Schema({
    type: { type: String, enum: ['note', 'doubt'] },
    title: String,
    description: String,
    syllabus: { type: String, enum: ['JEE', 'NEET', 'KJSCE'] },
    subject: String,
    tags: [String],
    attachments: [
        {
            type: { type: String, enum: ['pdf', 'image', 'link'] },
            url: String,
        },
    ],
    doubtResolved: { type: Boolean, default: false },
    comments: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            text: String,
            timestamp: { type: Date, default: Date.now },
        },
    ],
    createdAt: { type: Date, default: Date.now },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const CommunityPost = mongoose.model('CommunityPost', CommunityPostSchema);
export default CommunityPost;
