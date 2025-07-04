// userPathway.model.js
import mongoose from 'mongoose';

const userPathwaySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    documents: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Document',
            required: true,
        },
    ],
    access: {
        type: String,
        enum: ['private', 'public'],
        default: 'private',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update `updatedAt` on save
userPathwaySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const UserPathway = mongoose.model('UserPathway', userPathwaySchema);

export default UserPathway;