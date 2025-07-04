import mongoose from 'mongoose';


const testPodcastSchema = new mongoose.Schema({
  subject: String,
  title: String,        // e.g., 1.2.mp3
  chapter: String,      // e.g., "1.Physics and Measurements"
  subtopic: String,     // e.g., "1.2 Dimensions of physical quantities..."
  url: String,          // Cloudinary URL
  public_id: String,    // Cloudinary public_id
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const TestPodcast = mongoose.model('TestPodcast', testPodcastSchema);
