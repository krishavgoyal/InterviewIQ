import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/connectDb.js"
import cookieParser from "cookie-parser"
dotenv.config()
import cors from "cors"
import authRouter from "./routes/auth.route.js"
import userRouter from "./routes/user.route.js"
import interviewRouter from "./routes/interview.route.js"
import paymentRouter from "./routes/payment.route.js"
import avatarRouter from "./routes/avatar.route.js"
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express()
const allowedOrigins = (process.env.CLIENT_URLS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production") {
  const required = ["MONGODB_URL", "JWT_SECRET", "CLIENT_URLS", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  const paymentMode = process.env.PAYMENT_MODE || "demo";
  if (!["demo", "razorpay"].includes(paymentMode)) throw new Error("PAYMENT_MODE must be either demo or razorpay.");
  if (paymentMode === "demo" && process.env.ALLOW_DEMO_PAYMENTS !== "true") {
    throw new Error("Set ALLOW_DEMO_PAYMENTS=true to explicitly enable simulated payments in production.");
  }
  if (paymentMode === "razorpay" && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
    throw new Error("Razorpay mode requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
}

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true
}));

app.use(express.json({ limit: "2mb" }))
app.use(cookieParser())

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 45, standardHeaders: "draft-8", legacyHeaders: false, skip: (req) => req.path === "/proctor-check", message: { message: "Too many AI requests. Please try again shortly." } });
const proctorLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 75, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Too many visual integrity checks. Please try again shortly." } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/interview/proctor-check", proctorLimiter);
app.use("/api/interview", aiLimiter);

app.use("/api/auth" , authRouter)
app.use("/api/user", userRouter)
app.use("/api/interview" , interviewRouter)
app.use("/api/payment" , paymentRouter)
app.use("/api/avatar", avatarRouter)

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error.message);
  if (error.name === "MulterError") return res.status(400).json({ message: "Upload failed. Files must be PDFs smaller than 5 MB." });
  if (error.message === "Only PDF files up to 5 MB are allowed.") return res.status(400).json({ message: error.message });
  return res.status(500).json({ message: "Unexpected server error." });
});

const PORT = process.env.PORT || 6000;

const startServer = async () => {
  await connectDb();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch((error) => {
  console.error("Server could not start:", error.message);
  process.exit(1);
});
