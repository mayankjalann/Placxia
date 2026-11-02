import express from "express"
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import authRouter from "../routes/auth.routes.js"
import jobRouter from "../routes/job.routes.js"
import offerRouter from "../routes/offer.routes.js"
import adminRouter from "../routes/admin.routes.js"

import applicationRouter from "../routes/application.routes.js"
import notificationRouter from "../routes/notification.routes.js";


const app=express();
app.set("trust proxy", 1);

const normalizeOrigin = (value) => {
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};
const allowedOrigins = new Set([
    "https://placxia-frontend.vercel.app",
    ...[process.env.CORS_ORIGIN, process.env.FRONTEND_URL]
        .filter(Boolean)
        .flatMap((value) => value.split(","))
        .map((value) => normalizeOrigin(value.trim()))
        .filter(Boolean),
]);
if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:5173");
    allowedOrigins.add("http://localhost:4173");
}

app.use((req, res, next) => {
    req.requestId = req.get("x-vercel-id") || randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
});

app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        return callback(null, allowedOrigins.has(normalizeOrigin(origin)));
      },
      credentials: true,
    })
  );

app.use(express.json({limit: "1mb"})); // Supports admin batch imports up to 500 student rows

app.use(express.urlencoded({ extended: true, limit: "16kb" })); // FOR DATA THAT COMES AS URL MAINLY IN FORM SUBMISION
// EXTENDED for nested data

app.use(express.static("public"));

app.use(cookieParser());

// SameSite=None is required for the separate Vercel frontend/API domains.
// Restrict cookie-authenticated mutations to the configured app origins.
app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const originHeader = req.get("origin");
    const hasCookieAuth = Boolean(req.cookies?.accessToken || req.cookies?.refreshToken);
    const origin = normalizeOrigin(originHeader || "");
    if ((originHeader && !allowedOrigins.has(origin)) || (hasCookieAuth && !originHeader)) {
        return res.status(403).json({ success: false, message: "Request origin is not allowed" });
    }
    return next();
});

app.get("/api/v1/health", (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    return res.status(databaseReady ? 200 : 503).json({
        success: databaseReady,
        status: databaseReady ? "healthy" : "unavailable",
    });
});

app.use("/api/v1/auth",authRouter);
app.use("/api/v1/job",jobRouter);
app.use("/api/v1/application",applicationRouter)
app.use("/api/v1/offer",offerRouter);
app.use("/api/v1/admin",adminRouter)
app.use("/api/v1/notifications", notificationRouter);

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "API route not found",
        requestId: req.requestId,
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const isMulterError = error.name === "MulterError";
    const isValidationError = error.name === "ValidationError" || error.name === "CastError";
    const isDuplicateError = error.code === 11000;
    const statusCode = isDuplicateError
        ? 409
        : isMulterError
            ? (error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
            : isValidationError
                ? 400
                : (error.statusCode || error.status || 500);

    console.error(`API request failed [${req.requestId}]:`, error);
    const message = isDuplicateError
        ? "A record with these details already exists"
        : isMulterError && error.code === "LIMIT_FILE_SIZE"
            ? "File is too large. Maximum size is 4 MB"
            : statusCode >= 500
                ? "Something went wrong. Please try again."
                : (error.message || "Request failed");

    return res.status(statusCode).json({
        success: false,
        message,
        errors: statusCode < 500 ? (error.errors || []) : [],
        requestId: req.requestId,
    });
});


export default app;
