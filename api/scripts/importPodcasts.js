import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { uploadToCloudinary } from '../middleware/cloudinaryUpload.js';
import { TestPodcast } from '../models/material/TestPodcast.model.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const baseDir = path.join(__dirname, '../PCB Podcast/PCB Podcast');
const subjects = ['Physics', 'Chemistry', 'Biology'];


function renameFiles() {
  for (const subject of subjects) {
    const subjectDir = path.join(baseDir, subject);

    if (!fs.existsSync(subjectDir)) {
      console.warn(`❌ Subject folder not found: ${subjectDir}`);
      continue;
    }

    const files = fs.readdirSync(subjectDir).filter(f => f.endsWith('.mp3'));

    for (const oldName of files) {
      const oldPath = path.join(subjectDir, oldName);

      // Skip if already renamed (starts with subject-)
      if (oldName.startsWith(subject + '-')) continue;

      const baseName = path.parse(oldName).name;
      const ext = path.extname(oldName);

      const newName = `${subject}-${baseName}${ext}`;
      const newPath = path.join(subjectDir, newName);

      fs.renameSync(oldPath, newPath);
      console.log(`✅ Renamed: ${oldName} → ${newName}`);
    }
  }
}

renameFiles();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
await TestPodcast.deleteMany({});
console.log('🧹 All previous podcast entries deleted from DB.');

function loadSubjectData(subject) {
  const jsonMap = {
    Physics: '1. JEE PHY.json',
    Chemistry: '1. JEE CHEM.json',
    Biology: '1. NEET BIO.json',
  };

  const jsonFileName = jsonMap[subject];
  if (!jsonFileName) {
    console.warn(`⚠️ No JSON mapping defined for subject "${subject}"`);
    return null;
  }

  const jsonPath = path.join(baseDir, subject, jsonFileName);
  if (!fs.existsSync(jsonPath)) {
    console.warn(`⚠️ JSON file for subject "${subject}" not found at ${jsonPath}`);
    return null;
  }

  const jsonRaw = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(jsonRaw);
}

function extractSubtopicCode(filename) {
  // For files named like: Physics-1.1.mp3 or just 1.1.mp3
  const name = path.parse(filename).name.trim();
  const match = name.match(/(\d+\.\d+)/); // extracts "1.1", "2.3", etc.
  return match ? match[1] : null;
}

function findChapterAndSubtopic(subtopicCode, subjectData) {
  for (const chapterObj of subjectData.Chapters) {
    for (const subtopic of chapterObj.Subtopics) {
      if (
        subtopic.startsWith(subtopicCode + ' ') ||
        subtopic.startsWith(subtopicCode + '.') ||
        subtopic.startsWith(subtopicCode + '-')
      ) {
        return { chapter: chapterObj.Chapter, subtopic };
      }
    }
  }
  return { chapter: 'Uncategorized', subtopic: 'General' };
}

async function importPodcasts() {
  try {
    for (const subject of subjects) {
      const subjectDir = path.join(baseDir, subject);
      if (!fs.existsSync(subjectDir)) {
        console.warn(`⚠️ Directory not found: ${subjectDir}`);
        continue;
      }

      const subjectData = loadSubjectData(subject);
      if (!subjectData) {
        console.warn(`⛔ Skipping subject ${subject} due to missing JSON`);
        continue;
      }

      const files = fs.readdirSync(subjectDir).filter(f => f.endsWith('.mp3'));

      for (const file of files) {
        const subtopicCode = extractSubtopicCode(file);

        if (!subtopicCode) {
          console.warn(`⚠️ Skipping ${file}: No valid subtopic code found.`);
          continue;
        }

        const { chapter, subtopic } = findChapterAndSubtopic(subtopicCode, subjectData);
        const title = file;

        const exists = await TestPodcast.findOne({ title, subject });
        if (exists) continue;

        const filePath = path.join(subjectDir, file);
        const buffer = fs.readFileSync(filePath);

        const uploadResult = await uploadToCloudinary(buffer, title, 'audio/mpeg');

        await TestPodcast.create({
          subject,
          title,
          chapter,
          subtopic,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });

        console.log(`✅ Uploaded: [${subject}] ${chapter} → ${subtopic} (${file})`);
      }
    }
  } catch (error) {
    console.error('❌ Error importing podcasts:', error);
  } finally {
    await mongoose.disconnect();
  }
}

importPodcasts();
