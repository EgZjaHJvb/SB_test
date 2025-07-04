import mongoose from 'mongoose';

const FriendSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'blocked'],
        default: 'pending',
    },
    requestedAt: {
        type: Date,
        default: Date.now,
    },
    respondedAt: {
        type: Date,
    },
    message: {
        type: String,
        maxlength: 200,
    },
});
const Friend = mongoose.model('Friend', FriendSchema);
export default Friend;
