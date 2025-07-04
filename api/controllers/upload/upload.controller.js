import { uploadToCloudinary } from "../../middleware/cloudinaryUpload.js";
import { TestPodcast } from "../../models/material/TestPodcast.model.js";

export const uploadPodcasts = async (req, res) => {
  try {
    const { subject } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded.' });
    }

    // Validate subject
    if (!subject || !['Physics', 'Chemistry', 'Biology'].includes(subject)) {
      return res.status(400).json({ message: 'Invalid or missing subject.' });
    }

    const uploadedPodcasts = [];

    for (const file of req.files) {
      const { buffer, originalname, mimetype } = file;

      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(buffer, originalname, mimetype);

      // Parse filename: e.g., "1.2.mp3"
      const nameWithoutExt = originalname.replace(/\.[^/.]+$/, ""); // removes .mp3
      const [chapterPart] = nameWithoutExt.split('.'); // "1.2" => "1"
      const chapter = chapterPart || "Uncategorized";
      const subtopic = nameWithoutExt; // full "1.2"

      // Save to Database
      const newPodcast = await TestPodcast.create({
        subject,
        title: originalname,
        chapter,
        subtopic,
        public_id: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url,
      });

      uploadedPodcasts.push(newPodcast);
    }

    res.status(200).json({
      message: 'Podcasts uploaded successfully.',
      podcasts: uploadedPodcasts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload podcasts.', error });
  }
};



export const getPodcastsBySubject = async (req, res) => {
  try {
    const podcasts = await TestPodcast.find().sort({ createdAt: -1 });

    const grouped = {
      Physics: {},
      Chemistry: {},
      Biology: {},
    };

    podcasts.forEach(podcast => {
      const subject = podcast.subject;
      const chapter = podcast.chapter || "Uncategorized";

      if (!grouped[subject]) return;

      if (!grouped[subject][chapter]) {
        grouped[subject][chapter] = [];
      }

      grouped[subject][chapter].push(podcast);
    });

    res.status(200).json(grouped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch podcasts.', error });
  }
};
