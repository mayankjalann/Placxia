import express from "express"
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "../routes/auth.routes.js"
import jobRouter from "../routes/job.routes.js"
import offerRouter from "../routes/offer.routes.js"
import adminRouter from "../routes/admin.routes.js"

import applicationRouter from "../routes/application.routes.js"
import notificationRouter from "../routes/notification.routes.js";


const app=express();
app.set("trust proxy", 1);

app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );

app.use(express.json({limit: "1mb"})); // Supports admin batch imports up to 500 student rows

app.use(express.urlencoded({ extended: true, limit: "16kb" })); // FOR DATA THAT COMES AS URL MAINLY IN FORM SUBMISION
// EXTENDED for nested data

app.use(express.static("public"));

app.use(cookieParser());

app.use("/api/v1/auth",authRouter);
app.use("/api/v1/job",jobRouter);
app.use("/api/v1/application",applicationRouter)
app.use("/api/v1/offer",offerRouter);
app.use("/api/v1/admin",adminRouter)
app.use("/api/v1/notifications", notificationRouter);

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "API route not found"
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

    console.error("API request failed:", error);
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
        errors: statusCode < 500 ? (error.errors || []) : []
    });
});


export default app;
