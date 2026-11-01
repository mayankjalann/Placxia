import "dotenv/config";
import app from "./app.js";
import connectDB from "../db/index.js";

let connectionPromise;

const ensureDatabaseConnection = () => {
    if (!connectionPromise) {
        connectionPromise = connectDB().catch((error) => {
            connectionPromise = null;
            throw error;
        });
    }
    return connectionPromise;
};

if (process.env.NODE_ENV !== "production") {
    ensureDatabaseConnection()
        .then(() => {
            const port = process.env.PORT || 8000;
            app.listen(port, () => console.log(`Server running on ${port}`));
        })
        .catch((error) => console.error(error.message));
}

const handler = async (req, res) => {
    try {
        if (req.method !== "OPTIONS") {
            await ensureDatabaseConnection();
        }
        return await new Promise((resolve) => {
            res.once("finish", resolve);
            res.once("close", resolve);
            app(req, res);
        });
    } catch (error) {
        console.error("Request could not connect to MongoDB:", error.message);
        if (!res.headersSent) {
            return res.status(503).json({
                success: false,
                message: "The service is temporarily unavailable. Please try again."
            });
        }
    }
};

export default handler;
