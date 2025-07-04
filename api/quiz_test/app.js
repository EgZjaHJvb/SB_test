import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser"; // Corrected
// import rateLimit from "express-rate-limit"; // Optional

const app = express();

// Middleware
const corsConfig = {
  origin: "http://localhost:8080", // <== React dev server origin
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsConfig));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser()); // Optional, if you're using cookies
app.use(morgan("dev"));

// Routes
import quizRouter from "./routes/quiz.router.js";
app.use("/api/v1/quiz", quizRouter);

export default app;
