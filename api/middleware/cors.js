import cors from 'cors';

export const corsConfig = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Alternative dev server
      'https://deploying-quizitt.vercel.app',
      'https://deploying-quizitt.onrender.com',
      'http://localhost:8000/',  // Production frontend // Vercel preview deployments
    ];
    
    // Check if origin is in allowed list or is a Vercel preview deployment
    if (allowedOrigins.includes(origin) || (origin && origin.includes('deploying-quizitt') && origin.includes('vercel.app'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  optionsSuccessStatus: 200 // For legacy browser support
});