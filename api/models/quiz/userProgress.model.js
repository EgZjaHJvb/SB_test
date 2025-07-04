// models/UserProgress.js
import mongoose from "mongoose";

const chapterProgressSchema = new mongoose.Schema({
    chapter_id: {
        type: String, // Or Number, depending on how your chapter_id is structured
        required: true,
    },
    currentLevel: {
        type: Number,
        required: true,
        default: 1, // Default to level 1 for a new chapter if not specified
    },
});

const userProgressSchema = new mongoose.Schema({
    userId: {
        type: String, // Or mongoose.Schema.Types.ObjectId if referencing a User model
        required: true,
        unique: true, // Each user has one progress document
    },
    subject: {
        type: String, // e.g., "Physics", "Chemistry"
        required: true,
    },
    chaptersProgress: [chapterProgressSchema], // Array of progress for each chapter
});

const UserProgress = mongoose.model('UserProgress', userProgressSchema);

export default UserProgress