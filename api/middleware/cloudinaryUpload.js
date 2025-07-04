import cloudinary from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
dotenv.config();


/**
 * Configure Cloudinary using environment variables.
 */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Added for HTTPS URLs
});


console.log('Cloudinary config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'set' : 'NOT SET',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'NOT SET',
});

/**
 * Upload a file buffer to Cloudinary.
 * Determines resource_type based on mimetype.
 *
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} fileName - The file name (without extension) to use in Cloudinary. This will be the public_id within the specified folder.
 * @param {string} mimetype - The mimetype of the file (e.g., "video/mp4", "application/pdf").
 * @returns {Promise<object>} - Resolves with Cloudinary upload result. The `result.url` will be the direct link to the uploaded asset in its original format.
 */
export async function uploadToCloudinary(buffer, fileName, mimetype) {
  return new Promise((resolve, reject) => {
    // Determine Cloudinary resource type
    let resourceType = 'auto'; // default fallback

    if (mimetype) {
      if (mimetype === 'application/pdf') {
        resourceType = 'image'; // Treat PDFs as images for direct viewing and transformations
      } else if (
        mimetype === 'application/octet-stream' ||
        mimetype === 'application/msword' ||
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/vnd.ms-powerpoint' || // Added for PowerPoint
        mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || // Added for PPTX
        mimetype === 'text/plain'
      ) {
        resourceType = 'raw'; // treat other docs, txt, ppt, pptx as raw files
      } else if (mimetype.startsWith('image/')) {
        resourceType = 'image';
      } else if (mimetype.startsWith('video/')) {
        resourceType = 'video';
      } else if (mimetype.startsWith('audio/')) {
        resourceType = 'video'; // Cloudinary uses video resource type for audio files too
      }
    }

    const uploadStream = cloudinary.v2.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: fileName, // The fileName parameter will be used as the public ID
        folder: 'community_notes', // Your designated Cloudinary folder
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}