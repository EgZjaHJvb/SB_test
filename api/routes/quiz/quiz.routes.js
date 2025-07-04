import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import PDFParser from 'pdf2json';
import auth from '../../middleware/auth.js';
import crypto from 'crypto';
import Quiz from '../../models/quiz/Quiz.model.js';
import Question from '../../models/quiz/Questions.model.js';
import Document from '../../models/quiz/Document.model.js';
import redisClient from '../../db/redis.js';
import QuizAttempt from '../../models/quiz/QuizAttempt.model.js';
import User from '../../models/auth/User.model.js';
import LeaderboardSnapshot from '../../models/dashboard/LeaderboardSnapshot.model.js';
import textract from 'textract';
import Tesseract from 'tesseract.js';
import { checkQuizAccess } from '../../utils/checkQuizAccess.js';
import QuizLog from '../../models/quiz/QuizLog.model.js'; // Add this too
import { uploadToCloudinary } from '../../middleware/cloudinaryUpload.js';
import cloudinary from '../../utils/cloudinary.js';
import mongoose from 'mongoose';
import QuizScore from '../../models/quiz/quizScore.model.js';
import ChatHistory from '../../models/ChatHistory.model.js';

const router = express.Router();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MAX_DOCUMENTS_PER_USER = 5;

function debugUserId(userId, context = '') {
    console.log(`[DEBUG] User ID: ${userId} | Context: ${context}`);
}

// Utility function to clear Redis cache for a specific document
async function clearDocumentCache(documentHash) {
    try {
        const redisKey = `quiz:${documentHash}`;
        const exists = await redisClient.exists(redisKey);
        if (exists) {
            await redisClient.del(redisKey);
            console.log(`Cleared Redis cache for document hash: ${documentHash}`);
        }
    } catch (error) {
        console.error('Error clearing document cache:', error);
    }
}

// Utility function to clear all stale cache entries
async function clearStaleCache(documents) {
    try {
        const quizKeys = await redisClient.keys('quiz:*');

        for (const key of quizKeys) {
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                try {
                    const parsedData = JSON.parse(cachedData);
                    // Check if this cached quiz corresponds to any existing document
                    const hasMatchingDocument = documents.some((doc) => {
                        const docHash = doc.fileHash;
                        return key === `quiz:${docHash}`;
                    });

                    if (!hasMatchingDocument) {
                        console.log(`Clearing stale Redis cache entry: ${key}`);
                        await redisClient.del(key);
                    }
                } catch (parseError) {
                    console.error(`Error parsing cached data for key ${key}:`, parseError);
                    // Clear invalid cache entry
                    await redisClient.del(key);
                }
            }
        }
    } catch (error) {
        console.error('Error clearing stale cache:', error);
    }
}

// Function to extract text from PDF
async function extractTextFromPDF(buffer) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, 1);

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            try {
                let text = '';
                for (let page of pdfData.Pages) {
                    for (let textItem of page.Texts) {
                        text += decodeURIComponent(textItem.R[0].T) + ' ';
                    }
                    text += '\n';
                }
                resolve(text);
            } catch (error) {
                reject(error);
            }
        });

        pdfParser.on('pdfParser_dataError', (error) => {
            reject(error);
        });

        try {
            pdfParser.parseBuffer(buffer);
        } catch (error) {
            reject(error);
        }
    });
}

// Function to extract text from various file types (PDF, Word, PPT, text, images)
async function extractText(buffer, mimetype) {
    if (mimetype === 'application/pdf') {
        return extractTextFromPDF(buffer);
    }
    if (mimetype === 'text/plain') {
        return buffer.toString('utf-8');
    }
    if (mimetype.startsWith('image/')) {
        const {
            data: { text },
        } = await Tesseract.recognize(buffer, 'eng');
        return text;
    }
    return new Promise((resolve, reject) => {
        textract.fromBufferWithMime(
            mimetype,
            buffer,
            { preserveLineBreaks: true },
            (error, text) => {
                if (error) return reject(error);
                resolve(text);
            }
        );
    });
}

// Utility function to ensure quiz is stored in database
async function ensureQuizInDatabase(quizJson, docHash, req, savedDocuments, processedFiles) {
    try {
        console.log('Ensuring quiz is stored in database...');
        console.log('Input parameters:', {
            docHash,
            savedDocumentsCount: savedDocuments.length,
            processedFilesCount: processedFiles.length,
            quizJsonKeys: Object.keys(quizJson || {}),
            hasReqBody: !!req.body,
            reqBodyKeys: req.body ? Object.keys(req.body) : [],
        });

        // Validate quizJson
        if (!quizJson || typeof quizJson !== 'object') {
            throw new Error('Invalid quiz JSON data');
        }

        // Check if quiz already exists in database
        let existingQuiz = await Quiz.findOne({
            documentHash: docHash,
            owner: req.user.id,
        }).populate('questions');

        if (existingQuiz) {
            console.log('Quiz already exists in database, returning existing data');
            console.log('Existing quiz:', {
                id: existingQuiz._id,
                title: existingQuiz.title,
                questionCount: existingQuiz.questions ? existingQuiz.questions.length : 0,
            });
            return existingQuiz;
        }

        console.log('No existing quiz found, creating new quiz...');

        // Save questions to database first
        const questionIds = [];

        // Save MCQs
        if (quizJson.mcq && Array.isArray(quizJson.mcq)) {
            console.log('Saving MCQs to database...', quizJson.mcq.length, 'questions');
            for (const mcq of quizJson.mcq) {
                try {
                    if (!mcq.question || !mcq.options || mcq.correct === undefined) {
                        console.warn('Invalid MCQ data, skipping:', mcq);
                        continue;
                    }

                    const q = new Question({
                        questionText: mcq.question,
                        options: mcq.options,
                        correctAnswerIndex: mcq.correct,
                        correctAnswer: mcq.options[mcq.correct],
                        explanation: mcq.explanation || '',
                        type: 'mcq',
                        aiGenerated: true,
                    });

                    const savedQuestion = await q.save();
                    questionIds.push(savedQuestion._id);
                    console.log('Saved MCQ:', savedQuestion._id);
                } catch (questionError) {
                    console.error('Error saving MCQ:', questionError);
                    console.error('MCQ data:', mcq);
                }
            }
        }

        // Save Fill in the Blanks
        if (quizJson.fillInTheBlanks && Array.isArray(quizJson.fillInTheBlanks)) {
            console.log(
                'Saving Fill in the Blanks to database...',
                quizJson.fillInTheBlanks.length,
                'questions'
            );
            for (const fib of quizJson.fillInTheBlanks) {
                try {
                    if (!fib.question || !fib.answer) {
                        console.warn('Invalid FIB data, skipping:', fib);
                        continue;
                    }

                    const q = new Question({
                        questionText: fib.question,
                        options: [],
                        correctAnswerIndex: undefined,
                        correctAnswer: fib.answer,
                        explanation: '',
                        type: 'fillblank',
                        aiGenerated: true,
                    });

                    const savedQuestion = await q.save();
                    questionIds.push(savedQuestion._id);
                    console.log('Saved FIB:', savedQuestion._id);
                } catch (questionError) {
                    console.error('Error saving FIB:', questionError);
                    console.error('FIB data:', fib);
                }
            }
        }

        console.log(`Total questions saved: ${questionIds.length}`);

        if (questionIds.length === 0) {
            throw new Error('No valid questions were saved to the database');
        }

        // Validate syllabus
        const allowedSyllabus = ['JEE', 'NEET', 'KJSCE'];
        let syllabus = 'JEE'; // Default
        let subject = 'Mathematics'; // Default
        let chapterName = 'Chapter'; // Default

        // Try to get from req.body first
        if (req.body) {
            if (req.body.syllabus && allowedSyllabus.includes(req.body.syllabus)) {
                syllabus = req.body.syllabus;
            }
            if (req.body.subject) {
                subject = req.body.subject;
            }
            if (req.body.noteType) {
                chapterName = req.body.noteType;
            }
        }

        // If not in req.body, try to get from saved documents
        if (savedDocuments && savedDocuments.length > 0) {
            const doc = savedDocuments[0];
            if (doc.syllabus) {
                syllabus = doc.syllabus;
            }
            if (doc.subject) {
                subject = doc.subject;
            }
            if (doc.filename) {
                chapterName = doc.filename;
            }
        }

        console.log('Using quiz metadata:', { syllabus, subject, chapterName });

        // Create and save quiz
        const quizData = {
            owner: req.user.id,
            title: processedFiles.join(', '),
            syllabus,
            subject,
            chapterName,
            tags: [],
            difficulty: req.body?.difficulty || 'medium',
            isCustom: false,
            createdAt: new Date(),
            documentHash: docHash,
            questions: questionIds,
            sourceDocument: savedDocuments.length > 0 ? savedDocuments[0]._id : undefined,
        };

        console.log('Creating quiz with data:', quizData);

        const newQuiz = new Quiz(quizData);
        const savedQuiz = await newQuiz.save();
        console.log('Quiz saved to database with ID:', savedQuiz._id);

        // Update quizId in questions
        if (questionIds.length > 0) {
            console.log('Updating question references...');
            const updateResult = await Question.updateMany(
                { _id: { $in: questionIds } },
                { quizId: savedQuiz._id }
            );
            console.log('Updated questions:', updateResult.modifiedCount);
        }

        // Populate questions and return
        const populatedQuiz = await Quiz.findById(savedQuiz._id).populate('questions');
        console.log('Quiz creation completed successfully');
        console.log('Final quiz details:', {
            id: populatedQuiz._id,
            title: populatedQuiz.title,
            questionCount: populatedQuiz.questions ? populatedQuiz.questions.length : 0,
            documentHash: populatedQuiz.documentHash,
        });
        return populatedQuiz;
    } catch (error) {
        console.error('Error ensuring quiz in database:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

router.post('/generate', auth, upload.single('pdf'), async (req, res) => {
    try {
        debugUserId(req.user.id, 'Quiz generation start');

        // Step 1: Check if user can generate quiz
        const { allowed, planType, message } = await checkQuizAccess(req.user.id);
        if (!allowed) {
            console.warn(`User ${req.user.id} denied quiz generation access: ${message}`);
            return res.status(403).json({ error: message });
        }

        // Test DB connection
        console.log('Testing database connection...');
        try {
            await Quiz.findOne().limit(1);
            console.log('Database connection successful');
        } catch (dbTestError) {
            console.error('Database connection test failed:', dbTestError);
            return res.status(500).json({ error: 'Database connection failed' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`Processing file: ${req.file.originalname}...`);

        // Process the single file
        let allContent = '';
        const processedFileNames = [];
        const uploadedFileBuffers = []; // Store buffer for consistent processing and hashing

        const file = req.file;
        console.log(`Processing file: ${file.originalname}`);

        uploadedFileBuffers.push({
            originalname: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer,
        });

        let fileContent;
        try {
            fileContent = await extractText(file.buffer, file.mimetype);
        } catch (err) {
            console.error(`Failed to extract content from file ${file.originalname}:`, err);
            return res
                .status(400)
                .json({ error: `Failed to extract content from file ${file.originalname}` });
        }

        if (!fileContent || fileContent.trim() === '') {
            console.warn(`No content extracted from file ${file.originalname}`);
            return res
                .status(400)
                .json({ error: `No content could be extracted from file ${file.originalname}` });
        }

        allContent += `\n\n--- File: ${file.originalname} ---\n\n${fileContent}`;

        processedFileNames.push(file.originalname);

        if (!allContent.trim()) {
            return res
                .status(400)
                .json({ error: 'Failed to extract content from any uploaded files' });
        }

        console.log(`Successfully processed file: ${file.originalname}`);

        // Generate a hash for the combined content
        const docHash = crypto.createHash('sha256').update(allContent).digest('hex');
        const redisKey = `quiz:${docHash}`;

        // Step 2: Check for existing quiz in MongoDB (primary persistent storage)
        console.log('Checking MongoDB for existing quiz...');
        let quizDoc = await Quiz.findOne({ documentHash: docHash, owner: req.user.id }).populate(
            'questions'
        );

        if (quizDoc) {
            console.log('Found existing quiz in MongoDB, returning it.');
            // Ensure it's also cached in Redis for faster future access
            try {
                await redisClient.set(redisKey, JSON.stringify(quizDoc));
                console.log('Quiz cached in Redis after MongoDB lookup.');
            } catch (redisErr) {
                console.warn('Failed to cache quiz in Redis after MongoDB lookup:', redisErr);
            }
            try {
                await redisClient.set(redisKey, JSON.stringify(quizDoc));
                console.log('Quiz cached in Redis after MongoDB lookup.');
            } catch (redisErr) {
                console.warn('Failed to cache quiz in Redis after MongoDB lookup:', redisErr);
            }
            return res.json({ quiz: quizDoc, source: 'mongo' });
        }

        // Step 3: Check Redis cache if not found in MongoDB
        console.log('Checking Redis cache...');
        let quizData = await redisClient.get(redisKey);
        let quizJson;
        let fromCache = false;
        if (quizData) {
            console.log('Found quiz in Redis cache, attempting to parse...');
            try {
                quizJson = JSON.parse(quizData);
                fromCache = true;
                console.log('Using cached quiz data from Redis.');
            } catch (parseError) {
                console.error('Error parsing cached data from Redis:', parseError);
                // Invalidate bad cache entry
                await redisClient.del(redisKey);
                quizJson = null;
            }
        }

        // Step 4: Generate new quiz if not found in cache or database
        if (!quizJson) {
            console.log('No cached or existing quiz found, generating new quiz...');

            const prompt = `Generate a comprehensive quiz based on the following content.

IMPORTANT: Respond with ONLY valid JSON. Do not include any explanations or text outside the JSON structure.

Include exactly:
1. 5 multiple choice questions with 4 options each, each with an explanation for the correct answer.
2. 3 fill in the blank questions.
3. 5 flashcards with question on one side and answer on the other.

Make sure the questions test understanding rather than just recall.

Format the output as valid JSON with this exact structure:
{
  "mcq": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Explanation here"
    }
  ],
  "fillInTheBlanks": [
    {
      "question": "Question with _____ blank",
      "answer": "correct answer"
    }
  ],
  "flashcards": [
    {
      "front": "Question or concept",
      "back": "Answer or explanation"
    }
  ]
}

Content: ${allContent}`;

            console.log('Calling AI model...');
            let response;
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: prompt,
                });
                console.log('AI model call completed successfully');
            } catch (aiError) {
                console.error('AI model error:', aiError);
                return res
                    .status(500)
                    .json({ error: 'Failed to generate quiz content from AI model' });
            }

            console.log('AI response received, parsing...');
            try {
                let text = response.text.trim();
                console.log('Raw AI response length:', text.length);

                // Clean up the response text from potential markdown wrappers
                if (text.startsWith('```json')) {
                    text = text.slice(7);
                } else if (text.startsWith('```')) {
                    text = text.slice(3);
                }
                if (text.endsWith('```')) {
                    text = text.slice(0, -3);
                }

                // Remove any trailing commas and fix common JSON issues
                text = text.replace(/,(\s*[}\]])/g, '$1');

                try {
                    quizJson = JSON.parse(text);
                } catch (parseError) {
                    console.error('Initial JSON parse failed, trying to fix common issues...');

                    // Attempt to fix missing quotes around property names
                    let fixedText = text.replace(
                        /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
                        '$1"$2":'
                    );

                    try {
                        quizJson = JSON.parse(fixedText);
                        console.log('JSON parsed successfully after fixing common issues.');
                    } catch (secondParseError) {
                        console.error('Second parse attempt failed:', secondParseError);
                        console.error('Failed text (original):', text);
                        console.error('Failed text (fixed):', fixedText);

                        // Fallback to a minimal valid quiz structure
                        console.log(
                            'Creating fallback quiz structure due to persistent parsing issues.'
                        );
                        quizJson = {
                            mcq: [
                                {
                                    question: 'What is the primary topic of the document?',
                                    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                                    correct: 0,
                                    explanation:
                                        'This is a fallback question due to JSON parsing errors.',
                                },
                            ],
                            fillInTheBlanks: [
                                {
                                    question: 'The document mainly discusses _____.',
                                    answer: 'content',
                                },
                            ],
                            flashcards: [
                                {
                                    front: 'Key term',
                                    back: 'Definition from document',
                                },
                            ],
                        };
                    }
                }
                console.log('Quiz JSON structure:', {
                    mcq: quizJson.mcq ? quizJson.mcq.length : 0,
                    fillInTheBlanks: quizJson.fillInTheBlanks ? quizJson.fillInTheBlanks.length : 0,
                    flashcards: quizJson.flashcards ? quizJson.flashcards.length : 0,
                });
            } catch (error) {
                console.error('Critical JSON parsing or response handling error:', error);
                return res
                    .status(500)
                    .json({ error: 'Failed to process AI quiz response: ' + error.message });
            }
        }

        // Validate that we have valid quiz data before proceeding
        if (
            !quizJson ||
            typeof quizJson !== 'object' ||
            (!quizJson.mcq && !quizJson.fillInTheBlanks && !quizJson.flashcards)
        ) {
            console.error('No valid quiz data available after generation or parsing.');
            return res.status(500).json({ error: 'Failed to generate valid quiz data.' });
        }

        // Step 5: Save documents to Document model (if not already existing)
        const savedDocumentIds = [];
        for (const fileData of uploadedFileBuffers) {
            try {
                const fileContent = await extractText(fileData.buffer, fileData.mimetype);
                if (fileContent && fileContent.trim() !== '') {
                    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

                    // Check if document already exists for this user
                    let existingDoc = await Document.findOne({
                        fileHash: fileHash,
                        owner: req.user.id,
                    });

                    if (existingDoc) {
                        console.log(
                            `Document already exists for user ${req.user.id}: ${fileData.originalname}`
                        );
                        savedDocumentIds.push(existingDoc._id);
                    } else {
                        // **Upload to Cloudinary Here**
                        let cloudinaryUploadResult;
                        try {
                            const publicId = `documents/${req.user.id}/${fileData.originalname.replace(/\s+/g, '_').replace(/\.[^/.]+$/, '')}`; // Example public_id
                            cloudinaryUploadResult = await uploadToCloudinary(
                                fileData.buffer,
                                publicId,
                                fileData.mimetype
                            );
                            console.log(
                                `Uploaded ${fileData.originalname} to Cloudinary: ${cloudinaryUploadResult.url}`
                            );
                        } catch (cloudinaryErr) {
                            console.error(
                                `Failed to upload file to Cloudinary: ${fileData.originalname}`,
                                cloudinaryErr
                            );
                            // Decide whether to return an error or proceed without Cloudinary URL
                            // For now, we'll log and continue, but you might want to return an error.
                        }

                        const newDocument = new Document({
                            owner: req.user.id,
                            filename: fileData.originalname,
                            fileHash: fileHash,
                            fileType: fileData.mimetype,
                            cloudinaryUrl: cloudinaryUploadResult
                                ? cloudinaryUploadResult.url
                                : undefined, // Store the Cloudinary URL
                            textContent: fileContent,
                            // Assign subject and chapterName (syllabus is handled in newQuiz below)
                            subject: req.body.subject || undefined,
                            chapterName: req.body.chapterName || undefined, // Use chapterName directly
                        });
                        const savedDoc = await newDocument.save();
                        savedDocumentIds.push(savedDoc._id);
                        console.log(
                            `Saved new document: ${fileData.originalname} with ID: ${savedDoc._id}`
                        );
                    }
                } else {
                    console.warn(
                        `No content extracted or invalid content for file: ${fileData.originalname}, skipping document save.`
                    );
                }
            } catch (docError) {
                console.error(`Failed to save document ${fileData.originalname}:`, docError);
                console.error('Document save error details:', {
                    name: docError.name,
                    message: docError.message,
                    stack: docError.stack,
                });
            }
        }
        console.log(
            `Saved ${savedDocumentIds.length} unique documents or linked to existing ones.`
        );

        // Step 6: Save the generated quiz and its questions to MongoDB
        let databaseQuiz;
        try {
            // Check again for quiz existence to prevent duplicate saves if parallel requests happen or a previous check was slightly stale
            quizDoc = await Quiz.findOne({ documentHash: docHash, owner: req.user.id }).populate(
                'questions'
            );
            if (quizDoc) {
                console.log('Quiz found in database during final save check, avoiding re-save.');
                databaseQuiz = quizDoc;
            } else {
                console.log('Saving newly generated quiz to database...');
                const questionIds = [];

                // Save MCQs
                if (quizJson.mcq && Array.isArray(quizJson.mcq)) {
                    for (const mcq of quizJson.mcq) {
                        try {
                            const q = new Question({
                                questionText: mcq.question,
                                options: mcq.options,
                                correctAnswerIndex: mcq.correct,
                                correctAnswer: mcq.options[mcq.correct],
                                explanation: mcq.explanation || '',
                                type: 'mcq',
                                aiGenerated: true,
                            });
                            const savedQuestion = await q.save();
                            questionIds.push(savedQuestion._id);
                        } catch (questionError) {
                            console.error('Error saving MCQ:', questionError);
                        }
                    }
                }

                // Save Fill in the Blanks
                if (quizJson.fillInTheBlanks && Array.isArray(quizJson.fillInTheBlanks)) {
                    for (const fib of quizJson.fillInTheBlanks) {
                        try {
                            const q = new Question({
                                questionText: fib.question,
                                options: [], // FIBs don't have options
                                correctAnswer: fib.answer,
                                explanation: '', // FIBs might not have explanations by default from AI
                                type: 'fillblank',
                                aiGenerated: true,
                            });
                            const savedQuestion = await q.save();
                            questionIds.push(savedQuestion._id);
                        } catch (questionError) {
                            console.error('Error saving Fill in the Blank:', questionError);
                        }
                    }
                }

                // Save Flashcards (as a type of question for simplicity in a single model)
                if (quizJson.flashcards && Array.isArray(quizJson.flashcards)) {
                    for (const flashcard of quizJson.flashcards) {
                        try {
                            const q = new Question({
                                questionText: flashcard.front,
                                options: [],
                                correctAnswer: flashcard.back,
                                explanation: '', // Flashcards typically don't have separate explanations
                                type: 'flashcard',
                                aiGenerated: true,
                            });
                            const savedQuestion = await q.save();
                            questionIds.push(savedQuestion._id);
                        } catch (questionError) {
                            console.error('Error saving Flashcard:', questionError);
                        }
                    }
                }

                // Validate syllabus input
                const allowedSyllabus = ['JEE', 'NEET', 'KJSCE'];
                let syllabus = req.body.syllabus;
                if (syllabus && !allowedSyllabus.includes(syllabus)) {
                    console.warn(
                        `Invalid syllabus provided: ${req.body.syllabus}. Setting to undefined.`
                    );
                    syllabus = undefined;
                }

                // Create and save the new Quiz document
                const newQuiz = new Quiz({
                    owner: req.user.id,
                    title: processedFileNames.join(', ') || 'Generated Quiz', // Use processed filenames as title
                    syllabus: syllabus,
                    // Assign subject and chapterName here, using 'req.body.subject' and 'req.body.chapterName'
                    subject: req.body.subject || undefined,
                    chapterName: req.body.chapterName || undefined,
                    tags: [], // Assuming tags are not passed in req.body
                    difficulty: req.body.difficulty || 'medium',
                    isCustom: false,
                    documentHash: docHash,
                    questions: questionIds,
                    sourceDocument: savedDocumentIds.length > 0 ? savedDocumentIds[0] : undefined, // Link to the first saved document
                });

                databaseQuiz = await newQuiz.save();
                console.log('Quiz saved successfully with ID:', databaseQuiz._id);

                // Save quiz generation log
                try {
                    await QuizLog.create({ user: req.user.id });
                    console.log('Quiz generation logged in QuizLog');
                } catch (logErr) {
                    console.error('Failed to save quiz log:', logErr);
                }

                // Update quizId in associated questions
                if (questionIds.length > 0) {
                    await Question.updateMany(
                        { _id: { $in: questionIds } },
                        { quizId: databaseQuiz._id }
                    );
                    console.log(
                        `Updated ${questionIds.length} questions with quizId ${databaseQuiz._id}`
                    );
                }
            }
        } catch (dbError) {
            console.error('Failed to store quiz or questions in database:', dbError);
            return res
                .status(500)
                .json({ error: 'Failed to store quiz in database: ' + dbError.message });
        }

        // Step 7: Cache the newly generated/retrieved quiz in Redis
        try {
            console.log('Caching quiz in Redis...');
            await redisClient.set(redisKey, JSON.stringify(quizJson));
            console.log('Quiz cached in Redis successfully.');
        } catch (redisError) {
            console.error('Failed to cache quiz in Redis:', redisError);
            // Do not fail the request if Redis caching fails, as the quiz is in MongoDB
        }
        try {
            console.log('Caching quiz in Redis...');
            await redisClient.set(redisKey, JSON.stringify(quizJson));
            console.log('Quiz cached in Redis successfully.');
        } catch (redisError) {
            console.error('Failed to cache quiz in Redis:', redisError);
            // Do not fail the request if Redis caching fails, as the quiz is in MongoDB
        }

        console.log('Quiz generation process completed successfully.');
        res.json({
            quiz: quizJson,
            source: fromCache ? 'redis_cache' : 'generated', // Source indicates where the quiz JSON came from initially
            databaseQuiz: databaseQuiz, // Always return the fully populated database quiz
            message: 'Quiz generated and stored successfully',
        });
    } catch (error) {
        console.error('Unhandled error during quiz generation:', error);
        res.status(500).json({
            error: 'Failed to generate quizzes: An unexpected error occurred.',
        });
    }
});

router.get('/status', auth, async (req, res) => {
    try {
        const quizCount = await QuizLog.countDocuments({ user: req.user.id });

        const user = await User.findById(req.user.id).populate('currentSubscription');
        const subscription = user?.currentSubscription
            ? {
                  type: user.currentSubscription.type,
                  status: user.currentSubscription.status,
              }
            : { type: 'free', status: 'inactive' };

        res.json({ quizCount, subscription });
    } catch (err) {
        console.error('Error getting quiz status:', err);
        res.status(500).json({ error: 'Failed to get quiz status' });
    }
});

// In your routes/quiz/quiz.routes.js or similar file

router.get('/cloud-documents/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params; // Get userId from URL parameters

        // IMPORTANT: The security check 'if (req.user.id !== userId)' is removed
        // because req.user will no longer be available without the 'auth' middleware.
        // This means ANYONE can request documents for ANY userId if they know it.

        // Find documents belonging to the specified user ID
        const documents = await Document.find({ owner: userId }).sort({ uploadDate: -1 });

        if (!documents || documents.length === 0) {
            return res.status(404).json({ message: 'No documents found for this user.' });
        }

        res.status(200).json({ documents }); // Wrap documents in an object as the frontend expects
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents.' });
    }
});

router.post('/generate-through-text', auth, async (req, res) => {
    try {
        debugUserId(req.user.id, 'Text-based quiz generation start');

        // Step 1: Check if user can generate quiz
        const { allowed, planType, message } = await checkQuizAccess(req.user.id);
        if (!allowed) {
            console.warn(`User ${req.user.id} denied quiz generation access: ${message}`);
            return res.status(403).json({ error: message });
        }

        // Test DB connection
        console.log('Testing database connection...');
        try {
            await Quiz.findOne().limit(1);
            console.log('Database connection successful');
        } catch (dbTestError) {
            console.error('Database connection test failed:', dbTestError);
            return res.status(500).json({ error: 'Database connection failed' });
        }

        const { text, difficulty, subject, noteType } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text content provided' });
        }

        if (text.trim().length < 50) {
            return res.status(400).json({
                error: 'Text content is too short. Please provide at least 50 characters.',
            });
        }

        console.log(`Processing text content with ${text.length} characters...`);

        // Generate a hash for the text content with a prefix to distinguish from file-based content
        const docHash = crypto
            .createHash('sha256')
            .update(`TEXT_INPUT:${text.trim()}`)
            .digest('hex');
        const redisKey = `quiz:${docHash}`;

        // Step 2: Check for existing quiz in MongoDB (primary persistent storage)
        console.log('Checking MongoDB for existing quiz...');
        let quizDoc = await Quiz.findOne({ documentHash: docHash, owner: req.user.id }).populate(
            'questions'
        );

        if (quizDoc) {
            console.log('Found existing quiz in MongoDB, returning it.');
            // Ensure it's also cached in Redis for faster future access
            try {
                await redisClient.set(redisKey, JSON.stringify(quizDoc));
                console.log('Quiz cached in Redis after MongoDB lookup.');
            } catch (redisErr) {
                console.warn('Failed to cache quiz in Redis after MongoDB lookup:', redisErr);
            }
            try {
                await redisClient.set(redisKey, JSON.stringify(quizDoc));
                console.log('Quiz cached in Redis after MongoDB lookup.');
            } catch (redisErr) {
                console.warn('Failed to cache quiz in Redis after MongoDB lookup:', redisErr);
            }
            return res.json({ quiz: quizDoc, source: 'mongo' });
        }

        // Step 3: Check Redis cache if not found in MongoDB
        console.log('Checking Redis cache...');
        let quizData = await redisClient.get(redisKey);
        let quizJson;
        let fromCache = false;
        if (quizData) {
            console.log('Found quiz in Redis cache, attempting to parse...');
            try {
                quizJson = JSON.parse(quizData);
                fromCache = true;
                console.log('Using cached quiz data from Redis.');
            } catch (parseError) {
                console.error('Error parsing cached data from Redis:', parseError);
                // Invalidate bad cache entry
                await redisClient.del(redisKey);
                quizJson = null;
            }
        }

        // Step 4: Generate new quiz if not found in cache or database
        if (!quizJson) {
            console.log('No cached or existing quiz found, generating new quiz...');

            const prompt = `Generate a comprehensive quiz based on the following content.

IMPORTANT: Respond with ONLY valid JSON. Do not include any explanations or text outside the JSON structure.

Include exactly:
1. 5 multiple choice questions with 4 options each, each with an explanation for the correct answer.
2. 3 fill in the blank questions.
3. 5 flashcards with question on one side and answer on the other.

Make sure the questions test understanding rather than just recall.

Format the output as valid JSON with this exact structure:
{
  "mcq": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Explanation here"
    }
  ],
  "fillInTheBlanks": [
    {
      "question": "Question with _____ blank",
      "answer": "correct answer"
    }
  ],
  "flashcards": [
    {
      "front": "Question or concept",
      "back": "Answer or explanation"
    }
  ]
}

Content: ${text}`;

            console.log('Calling AI model...');
            let response;
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: prompt,
                });
                console.log('AI model call completed successfully');
            } catch (aiError) {
                console.error('AI model error:', aiError);
                return res
                    .status(500)
                    .json({ error: 'Failed to generate quiz content from AI model' });
            }

            console.log('AI response received, parsing...');
            try {
                let aiText = response.text.trim();
                console.log('Raw AI response length:', aiText.length);

                // Clean up the response text from potential markdown wrappers
                if (aiText.startsWith('```json')) {
                    aiText = aiText.slice(7);
                } else if (aiText.startsWith('```')) {
                    aiText = aiText.slice(3);
                }
                if (aiText.endsWith('```')) {
                    aiText = aiText.slice(0, -3);
                }

                // Remove any trailing commas and fix common JSON issues
                aiText = aiText.replace(/,(\s*[}\]])/g, '$1');

                try {
                    quizJson = JSON.parse(aiText);
                } catch (parseError) {
                    console.error('Initial JSON parse failed, trying to fix common issues...');

                    // Attempt to fix missing quotes around property names
                    let fixedText = aiText.replace(
                        /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
                        '$1"$2":'
                    );

                    try {
                        quizJson = JSON.parse(fixedText);
                        console.log('JSON parsed successfully after fixing common issues.');
                    } catch (secondParseError) {
                        console.error('Second parse attempt failed:', secondParseError);
                        console.error('Failed text (original):', aiText);
                        console.error('Failed text (fixed):', fixedText);

                        // Fallback to a minimal valid quiz structure
                        console.log(
                            'Creating fallback quiz structure due to persistent parsing issues.'
                        );
                        quizJson = {
                            mcq: [
                                {
                                    question: 'What is the primary topic of the provided content?',
                                    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                                    correct: 0,
                                    explanation:
                                        'This is a fallback question due to JSON parsing errors.',
                                },
                            ],
                            fillInTheBlanks: [
                                {
                                    question: 'The content mainly discusses _____.',
                                    answer: 'content',
                                },
                            ],
                            flashcards: [
                                {
                                    front: 'Key concept from the text',
                                    back: 'Definition from content',
                                },
                            ],
                        };
                    }
                }
                console.log('Quiz JSON structure:', {
                    mcq: quizJson.mcq ? quizJson.mcq.length : 0,
                    fillInTheBlanks: quizJson.fillInTheBlanks ? quizJson.fillInTheBlanks.length : 0,
                    flashcards: quizJson.flashcards ? quizJson.flashcards.length : 0,
                });
            } catch (error) {
                console.error('Critical JSON parsing or response handling error:', error);
                return res
                    .status(500)
                    .json({ error: 'Failed to process AI quiz response: ' + error.message });
            }
        }

        // Validate that we have valid quiz data before proceeding
        if (
            !quizJson ||
            typeof quizJson !== 'object' ||
            (!quizJson.mcq && !quizJson.fillInTheBlanks && !quizJson.flashcards)
        ) {
            console.error('No valid quiz data available after generation or parsing.');
            return res.status(500).json({ error: 'Failed to generate valid quiz data.' });
        }

        // Step 5: Save text as a document to Document model (if not already existing)
        let savedDocumentId = null;
        try {
            const textHash = crypto
                .createHash('sha256')
                .update(`TEXT_INPUT:${text.trim()}`)
                .digest('hex');

            // Check if document already exists for this user
            let existingDoc = await Document.findOne({
                fileHash: textHash,
                owner: req.user.id,
            });

            if (existingDoc) {
                console.log(`Text document already exists for user ${req.user.id}`);
                savedDocumentId = existingDoc._id;
            } else {
                const newDocument = new Document({
                    owner: req.user.id,
                    filename: noteType || 'Text Input',
                    fileHash: textHash,
                    fileType: 'text/plain',
                    textContent: text.trim(),
                    isTextBased: true, // Flag to identify text-based documents
                    syllabus: req.body.syllabus || undefined,
                    subject: subject || undefined,
                });
                const savedDoc = await newDocument.save();
                savedDocumentId = savedDoc._id;
                console.log(`Saved new text document with ID: ${savedDoc._id}`);
            }
        } catch (docError) {
            console.error(`Failed to save text as document:`, docError);
        }

        // Step 6: Save the generated quiz and its questions to MongoDB
        let databaseQuiz;
        try {
            // Check again for quiz existence to prevent duplicate saves
            quizDoc = await Quiz.findOne({ documentHash: docHash, owner: req.user.id }).populate(
                'questions'
            );
            if (quizDoc) {
                console.log('Quiz found in database during final save check, avoiding re-save.');
                databaseQuiz = quizDoc;
            } else {
                console.log('Saving newly generated quiz to database...');
                const questionIds = [];

                // Save MCQs
                if (quizJson.mcq && Array.isArray(quizJson.mcq)) {
                    for (const mcq of quizJson.mcq) {
                        try {
                            const q = new Question({
                                questionText: mcq.question,
                                options: mcq.options,
                                correctAnswerIndex: mcq.correct,
                                correctAnswer: mcq.options[mcq.correct],
                                explanation: mcq.explanation || '',
                                type: 'mcq',
                                aiGenerated: true,
                            });
                            const savedQuestion = await q.save();
                            questionIds.push(savedQuestion._id);
                        } catch (questionError) {
                            console.error('Error saving MCQ:', questionError);
                        }
                    }
                }

                // Save Fill in the Blanks
                if (quizJson.fillInTheBlanks && Array.isArray(quizJson.fillInTheBlanks)) {
                    for (const fib of quizJson.fillInTheBlanks) {
                        try {
                            const q = new Question({
                                questionText: fib.question,
                                options: [],
                                correctAnswer: fib.answer,
                                explanation: '',
                                type: 'fillblank',
                                aiGenerated: true,
                            });
                            const savedQuestion = await q.save();
                            questionIds.push(savedQuestion._id);
                        } catch (questionError) {
                            console.error('Error saving Fill in the Blank:', questionError);
                        }
                    }
                }

                // Save Flashcards
                if (quizJson.flashcards && Array.isArray(quizJson.flashcards)) {
                    for (const flashcard of quizJson.flashcards) {
                        try {
                            const q = new Question({
                                questionText: flashcard.front,
                                options: [],
                                correctAnswer: flashcard.back,
                                explanation: '',
                                type: 'flashcard',
                                aiGenerated: true,
                            });
                            const savedQuestion = await q.save();
                            questionIds.push(savedQuestion._id);
                        } catch (questionError) {
                            console.error('Error saving Flashcard:', questionError);
                        }
                    }
                }

                // Validate syllabus input
                const allowedSyllabus = ['JEE', 'NEET', 'KJSCE'];
                let syllabus = req.body.syllabus;
                if (syllabus && !allowedSyllabus.includes(syllabus)) {
                    console.warn(
                        `Invalid syllabus provided: ${req.body.syllabus}. Setting to undefined.`
                    );
                    syllabus = undefined;
                }

                // Create and save the new Quiz document
                const newQuiz = new Quiz({
                    owner: req.user.id,
                    title: noteType || 'Text-based Quiz',
                    syllabus: syllabus,
                    subject: subject || undefined,
                    chapterName: noteType || undefined,
                    tags: [],
                    difficulty: difficulty || 'medium',
                    isCustom: false,
                    documentHash: docHash,
                    questions: questionIds,
                    sourceDocument: savedDocumentId,
                });

                databaseQuiz = await newQuiz.save();
                console.log('Quiz saved successfully with ID:', databaseQuiz._id);

                // Update quizId in associated questions
                if (questionIds.length > 0) {
                    await Question.updateMany(
                        { _id: { $in: questionIds } },
                        { quizId: databaseQuiz._id }
                    );
                    console.log(
                        `Updated ${questionIds.length} questions with quizId ${databaseQuiz._id}`
                    );
                }
            }
        } catch (dbError) {
            console.error('Failed to store quiz or questions in database:', dbError);
            return res
                .status(500)
                .json({ error: 'Failed to store quiz in database: ' + dbError.message });
        }

        // Step 7: Cache the newly generated/retrieved quiz in Redis
        try {
            console.log('Caching quiz in Redis...');
            await redisClient.set(redisKey, JSON.stringify(quizJson));
            console.log('Quiz cached in Redis successfully.');
        } catch (redisError) {
            console.error('Failed to cache quiz in Redis:', redisError);
            // Do not fail the request if Redis caching fails, as the quiz is in MongoDB
        }
        try {
            console.log('Caching quiz in Redis...');
            await redisClient.set(redisKey, JSON.stringify(quizJson));
            console.log('Quiz cached in Redis successfully.');
        } catch (redisError) {
            console.error('Failed to cache quiz in Redis:', redisError);
            // Do not fail the request if Redis caching fails, as the quiz is in MongoDB
        }

        console.log('Text-based quiz generation process completed successfully.');
        res.json({
            quiz: quizJson,
            source: fromCache ? 'redis_cache' : 'generated',
            databaseQuiz: databaseQuiz,
            message: 'Quiz generated from text and stored successfully',
        });
    } catch (error) {
        console.error('Unhandled error during text-based quiz generation:', error);
        res.status(500).json({
            error: 'Failed to generate quiz from text: An unexpected error occurred.',
        });
    }
});

// Endpoint to record quiz attempt and update leaderboard
router.post('/attempt', auth, async (req, res) => {
    try {
        const { quizId, score, totalQuestions, correctAnswers, timeTaken, subject } = req.body;

        const currentUser = await User.findById(req.user.id).select('syllabus');
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!subject) {
            return res.status(400).json({ error: 'Subject is required for leaderboard.' });
        }

        const attempt = new QuizAttempt({
            userId: currentUser._id,
            quizId,
            score,
            totalQuestions,
            correctAnswers,
            timeTaken,
            answers: [],
        });
        await attempt.save();

        // Update user's xp
        await User.findByIdAndUpdate(currentUser._id, { $inc: { xp: score } });

        // Determine today's leaderboard snapshot
        const syllabus = currentUser.syllabus;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        let snapshot = await LeaderboardSnapshot.findOne({
            syllabus,
            subject,
            date: { $gte: start, $lte: end },
        })
            .populate('users.userId', 'username avatarUrl xp currentStreak longestStreak')
            .lean();
        if (!snapshot) snapshot = new LeaderboardSnapshot({ syllabus, subject, users: [] });

        const entry = snapshot.users.find((u) => u.userId.equals(currentUser._id));
        if (entry) {
            entry.xp += score;
        } else {
            snapshot.users.push({ userId: currentUser._id, xp: score, rank: 0 });
        }

        // Sort and assign ranks
        snapshot.users.sort((a, b) => b.xp - a.xp);
        snapshot.users.forEach((u, index) => {
            u.rank = index + 1;
        });

        await snapshot.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to record quiz attempt' });
    }
});

router.get('/statusd', auth, async (req, res) => {
    // Assuming 'auth' middleware is used here as well
    try {
        console.log('[STATUSD] Endpoint hit');
        const userId = req.user.id; // User ID from your authentication middleware
        console.log(`[STATUSD] userId: ${userId}`);

        const user = await User.findById(userId);
        if (!user) {
            console.error(`[STATUSD] User not found for id: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`[STATUSD] User found: ${user.username} (${user._id})`);

        // Calculate quiz count (example - adjust based on your actual quiz tracking)
        const quizCount = user.quizCount || 0; // Assuming 'quizCount' is on the User model
        console.log(`[STATUSD] quizCount: ${quizCount}`);

        // NEW: Count documents for the current user
        const documentCount = await Document.countDocuments({ owner: userId });
        console.log(`[STATUSD] documentCount: ${documentCount}`);

        // Subscription logic
        let subscriptionType = 'free';
        if (user.currentSubscription) {
            // You would typically populate the subscription to get its type
            // For simplicity, let's assume 'pro' for any existing subscription object
            const subscription = await mongoose
                .model('Subscription')
                .findById(user.currentSubscription);
            if (subscription) {
                subscriptionType = subscription.type; // Assuming subscription model has a 'type' field ('free', 'pro')
            }
        }

        res.json({
            quizCount: quizCount,
            subscription: { type: subscriptionType, status: 'active' },
            documentCount: documentCount,
        });
        console.log('[STATUSD] Response sent successfully');
    } catch (error) {
        console.error('[STATUSD] Failed to fetch user status:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// --- Modified /api/v1/quiz/add-document route ---
router.post('/add-document', auth, upload.single('file'), async (req, res) => {
    try {
        const { syllabus, subject } = req.body;
        const ownerId = req.user.id; // Get user ID from authenticated request

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Check current document count for the user
        const currentDocumentCount = await Document.countDocuments({ owner: ownerId });

        if (currentDocumentCount >= MAX_DOCUMENTS_PER_USER) {
            // If limit reached, prevent upload
            return res.status(403).json({
                error: `You have reached your maximum limit of ${MAX_DOCUMENTS_PER_USER} documents. Please delete existing documents to upload new ones or upgrade your plan.`,
            });
        }

        // Extract file details
        const { originalname: filename, mimetype: fileType, buffer } = req.file;

        // Generate file hash
        const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // Convert file buffer to text content if needed (be cautious with large files)
        // This might be better handled by a dedicated service or after initial upload
        const textContent = buffer.toString('utf-8'); // This might not be suitable for all file types (e.g., images)
        // You might need a more robust file-to-text extraction library
        // depending on fileType (pdf, docx etc.)

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // Create a new document entry
        const newDocument = new Document({
            owner: ownerId, // Use the authenticated user's ID
            filename,
            fileHash,
            fileType,
            fileUrl: uploadResult.secure_url,
            textContent, // Only if you successfully extract text
            syllabus,
            subject,
        });

        await newDocument.save();

        // Increment document count on the user or fetch again to reflect changes
        // For simplicity, the frontend will re-fetch status, but you could also
        // return the updated count here and update frontend state directly.
        const updatedDocumentCount = currentDocumentCount + 1;

        res.status(201).json({
            message: 'Document uploaded successfully',
            document: newDocument,
            documentCount: updatedDocumentCount, // Optionally send updated count
        });
    } catch (error) {
        console.error('[DOCUMENT UPLOAD ERROR]', error.message);
        // Specific error for Cloudinary upload issues
        if (error.http_code === 400 || error.http_code === 401 || error.http_code === 403) {
            return res
                .status(error.http_code)
                .json({ error: `Cloudinary upload failed: ${error.message}` });
        }
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// Endpoint to get all-time leaderboard for the user's syllabus and subject
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id).select('syllabus');
        if (!currentUser) {
            return res.status(404).json({ users: [] });
        }

        // Accept syllabus from query or fallback to user's own
        const syllabus = req.query.syllabus || currentUser.syllabus;
        const subject = req.query.subject;
        if (!subject) {
            return res.status(400).json({ users: [], error: 'Subject is required.' });
        }

        // Aggregate all-time XP for each user for the given syllabus and subject
        const pipeline = [
            {
                $match: {
                    subject: subject,
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $match: {
                    'user.syllabus': syllabus,
                },
            },
            {
                $group: {
                    _id: '$userId',
                    xp: { $sum: '$xp' },
                    user: { $first: '$user' },
                },
            },
            { $sort: { xp: -1 } },
            { $limit: 100 }, // Limit to top 100
        ];

        const leaderboard = await QuizScore.aggregate(pipeline);
        const userIds = leaderboard.map((entry) => entry._id);

        // Get number of questions solved for each user
        const attempts = await QuizAttempt.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $unwind: '$answers' },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
        ]);
        const attemptsMap = Object.fromEntries(attempts.map((a) => [a._id.toString(), a.count]));

        const usersArr = leaderboard.map((entry, idx) => ({
            userId: entry._id,
            username: entry.user.username,
            avatarUrl: entry.user.avatarUrl || '',
            xp: entry.xp,
            currentStreak: entry.user.currentStreak || 0,
            quizzesAttempted: attemptsMap[entry._id.toString()] || 0, // now number of questions solved
            rank: idx + 1,
        }));

        return res.json({ users: usersArr, currentUserId: req.user.id });
    } catch (error) {
        console.error('All-time leaderboard error:', error);
        res.status(500).json({ users: [] });
    }
});

router.get('/documents', auth, async (req, res) => {
    try {
        const documents = await Document.find({ owner: req.user.id });

        // Clean up any stale Redis cache entries for documents that no longer exist
        await clearStaleCache(documents);
        

        res.status(200).json({ documents });
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

router.get('/documents/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Find documents where the 'owner' field matches the provided userId
        const documents = await Document.find({ owner: userId });

        // You might want to add similar cache cleanup logic here if applicable
        await clearStaleCache(documents);
        

        if (documents.length === 0) {
            return res.status(404).json({ message: 'No documents found for this user ID.' });
        }

        res.status(200).json({ documents });
    } catch (err) {
        console.error(`Error fetching documents for user ID ${req.params.userId}:`, err);
        res.status(500).json({ error: 'Failed to fetch documents for the specified user ID.' });
    }
});

// Endpoint to get quiz by document title and owner
router.get('/by-document', auth, async (req, res) => {
    try {
        const { documentTitle, ownerId } = req.query;

        if (!documentTitle || !ownerId) {
            return res.status(400).json({ error: 'Document title and owner ID are required' });
        }

        console.log(`Fetching quiz for document: "${documentTitle}", owner: ${ownerId}`);

        // Find the document by title and owner
        const document = await Document.findOne({
            filename: documentTitle,
            owner: ownerId,
        });

        if (!document) {
            console.log(`Document not found: "${documentTitle}"`);
            return res.status(404).json({ error: 'Document not found' });
        }

        console.log(`Document found: "${document.filename}" with hash: ${document.fileHash}`);

        // Find quiz by document hash or source document
        let quiz = await Quiz.findOne({
            $or: [{ documentHash: document.fileHash }, { sourceDocument: document._id }],
            owner: ownerId,
        }).populate('questions');

        if (!quiz) {
            console.log('No quiz found for this document');
            return res.status(404).json({ error: 'No quiz found for this document' });
        }

        console.log(`Quiz found with ${quiz.questions ? quiz.questions.length : 0} questions`);

        // Check if we have valid questions
        if (!quiz.questions || quiz.questions.length === 0) {
            console.log('Quiz found but has no questions');
            return res.status(404).json({ error: 'Quiz exists but has no questions' });
        }

        // Convert quiz data to the expected format
        const quizData = {
            mcq: [],
            fillInTheBlanks: [],
            flashcards: [],
        };

        // Process questions based on their type
        if (quiz.questions && Array.isArray(quiz.questions)) {
            quiz.questions.forEach((question) => {
                if (question.type === 'mcq') {
                    quizData.mcq.push({
                        _id: question._id,
                        question: question.questionText,
                        options: question.options,
                        correct: question.correctAnswerIndex,
                        explanation: question.explanation,
                    });
                } else if (question.type === 'fillblank') {
                    quizData.fillInTheBlanks.push({
                        _id: question._id,
                        question: question.questionText,
                        answer: question.correctAnswer,
                    });
                }
            });
        }

        // For flashcards, we might need to generate them or store them separately
        // For now, we'll create simple flashcards from MCQs
        quizData.flashcards = quizData.mcq.slice(0, 3).map((mcq) => ({
            front: mcq.question,
            back: mcq.explanation || mcq.options[mcq.correct],
        }));

        console.log('Quiz data prepared:', {
            mcq: quizData.mcq.length,
            fillInTheBlanks: quizData.fillInTheBlanks.length,
            flashcards: quizData.flashcards.length,
        });

        res.json({ quiz: quizData, source: 'database' });
    } catch (err) {
        console.error('Error fetching quiz by document:', err);
        res.status(500).json({ error: 'Failed to fetch quiz data' });
    }
});

// Endpoint to invalidate cache for a specific document
router.delete('/cache/:documentHash', auth, async (req, res) => {
    try {
        const { documentHash } = req.params;

        if (!documentHash) {
            return res.status(400).json({ error: 'Document hash is required' });
        }

        await clearDocumentCache(documentHash);
        await clearDocumentCache(documentHash);

        res.json({ message: 'Cache cleared successfully' });
    } catch (err) {
        console.error('Error clearing cache:', err);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Endpoint to clear all stale cache entries
router.delete('/cache', auth, async (req, res) => {
    try {
        const documents = await Document.find({ owner: req.user.id });
        await clearStaleCache(documents);
      
        res.json({ message: 'Stale cache cleared successfully' });
    } catch (err) {
        console.error('Error clearing stale cache:', err);
        res.status(500).json({ error: 'Failed to clear stale cache' });
    }
});

// Debug endpoint to check user's documents and quizzes
router.get('/debug/user-data', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const documents = await Document.find({ owner: userId });
        const quizzes = await Quiz.find({ owner: userId }).populate('questions');

        const debugData = {
            userId,
            documents: documents.map((doc) => ({
                id: doc._id,
                filename: doc.filename,
                fileHash: doc.fileHash,
                subject: doc.subject,
                syllabus: doc.syllabus,
            })),
            quizzes: quizzes.map((quiz) => ({
                id: quiz._id,
                title: quiz.title,
                documentHash: quiz.documentHash,
                sourceDocument: quiz.sourceDocument,
                questionCount: quiz.questions ? quiz.questions.length : 0,
                questions: quiz.questions
                    ? quiz.questions.map((q) => ({
                          id: q._id,
                          type: q.type,
                          questionText: q.questionText
                              ? q.questionText.substring(0, 50) + '...'
                              : 'No text',
                      }))
                    : [],
            })),
        };

        res.json(debugData);
    } catch (err) {
        console.error('Error in debug endpoint:', err);
        res.status(500).json({ error: 'Failed to get debug data' });
    }
});

// Simple test endpoint to get all quizzes for a user
router.get('/test-quizzes', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const quizzes = await Quiz.find({ owner: userId }).populate('questions');

        const quizData = quizzes.map((quiz) => ({
            id: quiz._id,
            title: quiz.title,
            documentHash: quiz.documentHash,
            sourceDocument: quiz.sourceDocument,
            questionCount: quiz.questions ? quiz.questions.length : 0,
            questions: quiz.questions
                ? quiz.questions.map((q) => ({
                      id: q._id,
                      type: q.type,
                      questionText: q.questionText
                          ? q.questionText.substring(0, 50) + '...'
                          : 'No text',
                      options: q.options,
                      correctAnswer: q.correctAnswer,
                  }))
                : [],
        }));

        res.json({
            userId,
            quizCount: quizData.length,
            quizzes: quizData,
        });
    } catch (err) {
        console.error('Error in test-quizzes endpoint:', err);
        res.status(500).json({ error: 'Failed to get test quiz data' });
    }
});

// Comprehensive debugging endpoint to check all aspects of quiz generation
router.get('/debug/quiz-generation', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[DEBUG] Comprehensive quiz generation debug for user: ${userId}`);

        // 1. Check user authentication
        const user = await User.findById(userId);
        console.log(`[DEBUG] User found: ${!!user}, User ID: ${userId}`);

        // 2. Check all documents for this user
        const documents = await Document.find({ owner: userId });
        console.log(`[DEBUG] User has ${documents.length} documents:`);
        documents.forEach((doc, index) => {
            console.log(
                `[DEBUG] Document ${index + 1}: ${doc.filename} (ID: ${doc._id}, Hash: ${doc.fileHash})`
            );
        });

        // 3. Check all quizzes for this user
        const quizzes = await Quiz.find({ owner: userId }).populate('questions');
        console.log(`[DEBUG] User has ${quizzes.length} quizzes:`);
        quizzes.forEach((quiz, index) => {
            console.log(`[DEBUG] Quiz ${index + 1}: ${quiz.title} (ID: ${quiz._id})`);
            console.log(`[DEBUG]   - Document Hash: ${quiz.documentHash}`);
            console.log(`[DEBUG]   - Source Document: ${quiz.sourceDocument}`);
            console.log(`[DEBUG]   - Questions: ${quiz.questions ? quiz.questions.length : 0}`);
            console.log(`[DEBUG]   - Subject: ${quiz.subject}`);
            console.log(`[DEBUG]   - Chapter: ${quiz.chapterName}`);
        });

        // 4. Check all questions for this user
        const questions = await Question.find({ quizId: { $in: quizzes.map((q) => q._id) } });
        console.log(`[DEBUG] Total questions found: ${questions.length}`);

        // 5. Check Redis cache
        const redisKeys = await redisClient.keys('quiz:*');
        console.log(`[DEBUG] Redis cache keys: ${redisKeys.length}`);
        redisKeys.forEach((key) => {
            console.log(`[DEBUG] Redis key: ${key}`);
        });

        // 6. Check for any orphaned questions (questions without quizId)
        const orphanedQuestions = await Question.find({ quizId: { $exists: false } });
        console.log(`[DEBUG] Orphaned questions (no quizId): ${orphanedQuestions.length}`);

        // 7. Check for any questions with this user's quizzes
        const userQuizIds = quizzes.map((q) => q._id);
        const userQuestions = await Question.find({ quizId: { $in: userQuizIds } });
        console.log(`[DEBUG] Questions linked to user's quizzes: ${userQuestions.length}`);

        // 8. Check document-quiz relationships
        const documentQuizMap = [];
        for (const doc of documents) {
            const relatedQuizzes = quizzes.filter(
                (q) =>
                    q.documentHash === doc.fileHash ||
                    q.sourceDocument?.toString() === doc._id.toString()
            );
            documentQuizMap.push({
                document: doc.filename,
                documentId: doc._id,
                documentHash: doc.fileHash,
                relatedQuizzes: relatedQuizzes.length,
                quizIds: relatedQuizzes.map((q) => q._id),
            });
        }

        const debugData = {
            userId,
            userFound: !!user,
            documentsCount: documents.length,
            documents: documents.map((doc) => ({
                id: doc._id,
                filename: doc.filename,
                fileHash: doc.fileHash,
                subject: doc.subject,
            })),
            quizzesCount: quizzes.length,
            quizzes: quizzes.map((quiz) => ({
                id: quiz._id,
                title: quiz.title,
                documentHash: quiz.documentHash,
                sourceDocument: quiz.sourceDocument,
                questionCount: quiz.questions ? quiz.questions.length : 0,
                subject: quiz.subject,
                chapterName: quiz.chapterName,
            })),
            totalQuestions: questions.length,
            orphanedQuestions: orphanedQuestions.length,
            userQuestions: userQuestions.length,
            redisKeysCount: redisKeys.length,
            documentQuizMap,
            potentialIssues: [],
        };

        // Identify potential issues
        if (documents.length > 0 && quizzes.length === 0) {
            debugData.potentialIssues.push(
                'User has documents but no quizzes - quiz generation may have failed'
            );
        }

        if (documents.length > 0 && quizzes.length > 0) {
            const docsWithoutQuizzes = documents.filter(
                (doc) =>
                    !quizzes.some(
                        (q) =>
                            q.documentHash === doc.fileHash ||
                            q.sourceDocument?.toString() === doc._id.toString()
                    )
            );
            if (docsWithoutQuizzes.length > 0) {
                debugData.potentialIssues.push(
                    `Some documents don't have associated quizzes: ${docsWithoutQuizzes.map((d) => d.filename).join(', ')}`
                );
            }
        }

        if (quizzes.length > 0) {
            const quizzesWithoutQuestions = quizzes.filter(
                (q) => !q.questions || q.questions.length === 0
            );
            if (quizzesWithoutQuestions.length > 0) {
                debugData.potentialIssues.push(
                    `Some quizzes have no questions: ${quizzesWithoutQuestions.map((q) => q.title).join(', ')}`
                );
            }
        }

        console.log(
            `[DEBUG] Debug data prepared with ${debugData.potentialIssues.length} potential issues`
        );

        res.json(debugData);
    } catch (err) {
        console.error('[DEBUG] Error in comprehensive debug endpoint:', err);
        res.status(500).json({
            error: 'Failed to get comprehensive debug data',
            details: err.message,
        });
    }
});

// Simple test endpoint to get all documents for a user
router.get('/test-documents', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const documents = await Document.find({ owner: userId });

        const documentData = documents.map((doc) => ({
            id: doc._id,
            filename: doc.filename,
            fileHash: doc.fileHash,
            subject: doc.subject,
            syllabus: doc.syllabus,
            uploadDate: doc.uploadDate,
            hasContent: !!doc.textContent && doc.textContent.length > 0,
        }));

        res.json({
            userId,
            documentCount: documentData.length,
            documents: documentData,
        });
    } catch (err) {
        console.error('Error in test-documents endpoint:', err);
        res.status(500).json({ error: 'Failed to get test document data' });
    }
});

router.get('/quizzes', async (req, res) => {
    try {
        const { syllabus, subject } = req.query; // optional filters
        const query = {};
        if (syllabus) query.syllabus = syllabus;
        if (subject) query.subject = subject;

        const quizzes = await Quiz.find(query).populate('questions');
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
});

// Save a full chat (array of messages)
router.post('/chat-history', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, messages } = req.body;
        if (!title || !messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'title and messages array are required.' });
        }
        await ChatHistory.create({ userId, title, messages });
        res.status(201).json({ message: 'Chat saved.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save chat.' });
    }
});

// Get all chat histories for the user (titles and ids)
router.get('/chat-history', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const chats = await ChatHistory.find({ userId }).sort({ timestamp: -1 });
        res.json({
            chats: chats.map((chat) => ({
                _id: chat._id,
                title: chat.title,
                timestamp: chat.timestamp,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
});

// Get a specific chat by id
router.get('/chat-history/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const chat = await ChatHistory.findOne({ _id: req.params.id, userId });
        if (!chat) return res.status(404).json({ error: 'Chat not found.' });
        res.json({ chat });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chat.' });
    }
});

export default router;
