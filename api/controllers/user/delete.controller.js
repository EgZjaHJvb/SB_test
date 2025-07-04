import mongoose from 'mongoose';
import User from '../../models/auth/User.model.js';

export const deleteUserById = async (req, res) => {
    const { id } = req.params; // 'id' is already a string from the URL parameter

    // It's good practice to ensure the ID is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID format' }); // More specific message
    }

    try {
        // Correct way to use findByIdAndDelete:
        // You can directly pass the string ID, Mongoose will often convert it
        // Or explicitly create a new ObjectId instance
        const deletedUser = await User.findByIdAndDelete(id); // Option 1: Pass string ID
        // OR
        // const deletedUser = await User.findByIdAndDelete(new mongoose.Types.ObjectId(id)); // Option 2: Pass ObjectId instance

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // IMPORTANT: Also delete the associated token or invalidate session if you have one.
        // This controller is just for deleting the user record.
        // Your authentication middleware might need to be adjusted or handle token invalidation
        // if the user is currently logged in.

        return res.status(200).json({
            message: 'User deleted successfully',
            deletedUser: { id: deletedUser._id, username: deletedUser.username, email: deletedUser.email }, // Return minimal info
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        // Distinguish between database errors and other potential issues if possible
        if (error.name === 'CastError') { // Mongoose can throw CastError if ID format is wrong despite initial check
             return res.status(400).json({ message: 'Invalid ID provided.' });
        }
        return res.status(500).json({ message: 'Server error while deleting user' }); // More specific server error message
    }
};