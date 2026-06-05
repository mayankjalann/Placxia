import mongoose from "mongoose";
import {DB_NAME} from "../src/constants.js"

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: DB_NAME,
        });

        console.log(`MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("ERROR:", error);
        process.exit(1);
    }
};

export default connectDB;