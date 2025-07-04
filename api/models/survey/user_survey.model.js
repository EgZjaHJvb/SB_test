import mongoose from 'mongoose';

const SOURCES = [
    'instagram', 'facebook', 'friend', 'school',
    'youtube', 'google', 'other', 'tv', 'news'
];

const TIME_COMMITMENTS = [
    '30-60 mins', '1-3 hours', '3-5 hours', '>5 hours'
];

const userSurveySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    source: {
        type: String,
        enum: SOURCES,
        required: true,
    },
    dailyTimeCommitment: {
        type: String,
        enum: TIME_COMMITMENTS,
        required: true,
    },
    knowledgeLevel: {
        type: Number,
        min: 1,
        max: 10,
        required: true,
    },
}, { timestamps: true });


// Create and export the UserSurvey model
const UserSurvey = mongoose.model('UserSurvey', userSurveySchema);

export default UserSurvey;
