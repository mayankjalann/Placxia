import "dotenv/config";
import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";
import { College } from "../models/college.model.js";
import { Admin } from "../models/admin.model.js";
import mongoose from "mongoose";

const email = "ua24csb0b04@student.nitw.ac.in";
const adminName = "CCPD";
const employeeId = process.env.NITW_ADMIN_EMPLOYEE_ID?.trim() || "NITW-CCPD-001";
const collegeId = "6a22bd65883b40d4cf9ebe1a";
const password = process.env.NITW_ADMIN_PASSWORD;

const seedNitwAdmin = async () => {
    try {
        if (!mongoose.isValidObjectId(collegeId)) {
            throw new Error("The configured NITW college ObjectId is invalid.");
        }
        if (!password || password.trim().length < 12) {
            throw new Error("Set NITW_ADMIN_PASSWORD to a new password of at least 12 characters.");
        }

        await connectDB();
        const college = await College.findById(collegeId);
        if (!college) throw new Error("No college record exists with the configured NITW ObjectId.");
        if (college.code !== "NITW") {
            throw new Error(`The supplied college ID belongs to ${college.name} (${college.code}), not NITW.`);
        }

        let user = await User.findOne({ email });
        let createdUser = false;
        if (user) {
            if (user.role !== "ADMIN") {
                throw new Error("This email already belongs to a non-admin account; it was not changed.");
            }
            const existingAdmin = await Admin.findOne({ user: user._id });
            if (user.college?.toString() !== college._id.toString() ||
                (existingAdmin && existingAdmin.college.toString() !== college._id.toString())) {
                throw new Error("This admin account is already assigned to a different college.");
            }
            if (existingAdmin) {
                console.log(`NITW admin already exists for ${email}; no account data was changed.`);
                return;
            }
        } else {
            user = await User.create({
                email,
                password,
                role: "ADMIN",
                college: college._id,
                isVerified: true,
                isActive: true,
            });
            createdUser = true;
        }

        try {
            await Admin.create({
                user: user._id,
                college: college._id,
                name: adminName,
                employeeId,
                designation: process.env.NITW_ADMIN_DESIGNATION?.trim() || "Placement Coordinator",
                department: process.env.NITW_ADMIN_DEPARTMENT?.trim() || "Training & Placement Cell",
            });
        } catch (error) {
            if (createdUser) await User.deleteOne({ _id: user._id }).catch(() => {});
            throw error;
        }

        console.log(`NITW admin seeded successfully for ${email}.`);
    } catch (error) {
        console.error("Could not seed the NITW admin:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

await seedNitwAdmin();
