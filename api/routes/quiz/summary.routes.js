import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import PDFParser from 'pdf2json';
import auth from '../../middleware/auth.js';
import textract from 'textract';
import Tesseract from 'tesseract.js';

const router = express.Router();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Function to extract text from PDF
/**
 * Extracts text content from a PDF buffer using pdf2json.
 * @param {Buffer} buffer - The PDF file buffer to extract text from.
 * @returns {Promise<string>} - The extracted text content from the PDF.
 */
async function extractTextFromPDF(buffer) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, 1);

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            try {
                console.log('PDF parsing successful, extracting text...');
                // Access the parsed data directly from pdfData
                let text = '';
                for (let page of pdfData.Pages) {
                    for (let textItem of page.Texts) {
                        // Decode the text content
                        text += decodeURIComponent(textItem.R[0].T) + ' ';
                    }
                    text += '\n';
                }
                console.log('Extracted text length:', text.length);
                resolve(text);
            } catch (error) {
                console.error('Error processing PDF content:', error);
                reject(error);
            }
        });

        pdfParser.on('pdfParser_dataError', (error) => {
            console.error('PDF parsing error:', error);
            reject(error);
        });

        try {
            console.log('Starting PDF parsing...');
            pdfParser.parseBuffer(buffer);
        } catch (error) {
            console.error('Error during parseBuffer:', error);
            reject(error);
        }
    });
}

/**
 * Extract text content from various file types (PDF, Word, PPT, text, images) using appropriate parsers or OCR.
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} Extracted text
 */
async function extractText(buffer, mimetype) {
    if (mimetype === 'application/pdf') {
        return extractTextFromPDF(buffer);
    }
    if (mimetype === 'text/plain') {
        return buffer.toString('utf-8');
    }
    if (mimetype.startsWith('image/')) {
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
        return text;
    }
    return new Promise((resolve, reject) => {
        textract.fromBufferWithMime(mimetype, buffer, { preserveLineBreaks: true }, (error, text) => {
            if (error) return reject(error);
            resolve(text);
        });
    });
}

// Endpoint to generate quizzes from a PDF
router.post('/generate', auth, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Extract text from uploaded file
        const mimetype = req.file.mimetype;
        let content;
        try {
            content = await extractText(req.file.buffer, mimetype);
        } catch (err) {
            return res.status(400).json({ error: `Failed to extract content: ${err.message}` });
        }
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'No extractable content' });
        }

        // Log extracted content for debugging
        console.log('Extracted content length:', content.length);

        // Prepare prompt
        const prompt = `Summarize the following content from a PDF and also create an outline of the main sections and key points. 
            Return your response as a JSON object with two fields: "summary" (a concise summary of the content) and "outline" (an array of main sections, each with a title and bullet points). The outline should be short

            Example format:
            {
            "summary": "A brief summary here.",
            "outline": [
                {
                "section": "Section Title",
                "points": [
                    "First key point",
                    "Second key point"
                ]
                },
                {
                "section": "Another Section",
                "points": [
                    "Key point A",
                    "Key point B"
                ]
                }
            ]
            }

            Content: ${content}`;

        // Generate quizzes using Gemini API
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
        });

        // Parse and return the quiz data
        try {
            let text = response.text.trim();
            // Remove code block markers and 'json' if present
            if (text.startsWith('```json')) {
                text = text.slice(7);
            } else if (text.startsWith('```')) {
                text = text.slice(3);
            }
            if (text.endsWith('```')) {
                text = text.slice(0, -3);
            }

            // Try to extract JSON substring if extra text is present
            let jsonStart = text.indexOf('{');
            let jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                text = text.substring(jsonStart, jsonEnd + 1);
            }

            // Validate that the text is likely JSON before parsing
            if (!text.startsWith('{') || !text.endsWith('}')) {
                throw new Error('Response does not contain valid JSON');
            }

            const SumOutData = JSON.parse(text);
            res.json({ summary: SumOutData });
        } catch (error) {
            console.error('Error parsing quiz data:', error);
            res.json({ summary: response.text, error: 'Could not parse summary/outline as JSON.' });
        }
    } catch (error) {
        console.error('Error generating summary:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

export default router;
