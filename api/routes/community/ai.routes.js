/**
 * @file ai.routes.js
 * @description Express router for AI chat endpoints using Google Gemini API.
 * @module routes/ai.routes
 *
 * @requires express
 * @requires @google/genai
 * @requires ../middleware/auth.js
 */

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import auth from '../../middleware/auth.js';

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * POST /chat
 * @summary AI Chat endpoint using Google Gemini API
 * @description Generates a response from Gemini AI model based on user message.
 * @security BearerAuth
 * @param {string} req.body.message - The message to send to the AI model.
 * @returns {Object} 200 - Success response - application/json
 * @returns {string} 200.response - The AI-generated response text
 * @returns {Object} 400 - Bad request if message is missing
 * @returns {Object} 500 - Internal server error if AI fails
 */
router.post('/chat', auth, async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: message,
        });
        res.json({ response: response.text });
    } catch (err) {
        console.error('AI chat error:', err);
        res.status(500).json({ error: 'AI chat error', details: err.message });
    }
});

export default router;
