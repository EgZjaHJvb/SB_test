import mongoose from "mongoose";

const chatHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    messages: [
        {
            user: String,
            bot: String,
        }
    ],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const ChatHistory= mongoose.model('ChatHistory', chatHistorySchema);

export default ChatHistory;