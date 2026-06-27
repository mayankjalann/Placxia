import "dotenv/config";
import mongoose from "mongoose";
import { AllowedStudent } from "./models/AllowedStudent.model.js";
import { College } from "./models/college.model.js";

const seedStudent = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB...");

        // 1. Get the first college in the DB
        const college = await College.findOne({});
        if (!college) {
            console.log("No colleges found! Cannot seed student.");
            process.exit(1);
        }

        // 2. Add an allowed student
        const email = "teststudent@placxia.com";
        const existing = await AllowedStudent.findOne({ email });
        
        if (existing) {
            console.log("Student already in Allowed list!");
        } else {
            await AllowedStudent.create({
                college: college._id,
                email: email,
                rollNo: "CS2026-001",
                branch: "Computer Science",
                batch: "2026",
                isRegistered: false
            });
            console.log(`Successfully added ${email} to AllowedStudents for college ${college.name}!`);
        }

        process.exit(0);
    } catch (error) {
        console.error("Error seeding student:", error);
        process.exit(1);
    }
};

seedStudent();
