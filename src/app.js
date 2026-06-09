import express from "express"
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "../routes/auth.routes.js"
import jobRouter from "../routes/job.routes.js"
import offerRouter from "../routes/offer.routes.js"
import adminRouter from "../routes/admin.routes.js"

import applicationRouter from "../routes/application.routes.js"


const app=express();

app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );

app.use(express.json({limit: "16kb"})); // FOR DATA THAT COMES AS JSON

app.use(express.urlencoded({ extended: true, limit: "16kb" })); // FOR DATA THAT COMES AS URL MAINLY IN FORM SUBMISION
// EXTENDED for nested data

app.use(express.static("public"));

app.use(cookieParser());

app.use("/api/v1/auth",authRouter);
app.use("/api/v1/job",jobRouter);
app.use("/api/v1/application",applicationRouter)
app.use("/api/v1/offer",offerRouter);
app.use("/api/v1/admin",adminRouter)

export default app;