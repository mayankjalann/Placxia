import dotenv from "dotenv"
import connectDB from "../db/index.js"
import { User } from "../models/user.model.js"
import { College } from "../models/college.model.js"
import { Admin } from "../models/admin.model.js"

dotenv.config();

const seedDatabase=async ()=>{
    try{
        await connectDB();

        const college = await College.create({
            name: "Placxiaa University",
            code: "PX01", // ADD THIS LINE!
            address: "Tech Park, City",
            website: "www.placxia.com"
        });

        console.log("College created!");

        const user=await User.create({
            email: "admin@placxia.com",
            password: process.env.DEFAULT_ADMIN_PASSWORD,
            role: "ADMIN",
            college: college._id,
            isVerified: true
        });

        console.log("Admin User created!");

        await Admin.create({
            user: user._id,
            college: college._id,
            name: "Super Admin",
            employeeId: "EMP001",
            designation: "Head of Placements"
        });

        console.log("Admin User created!");

        console.log("Database seeded successfully! You can log in");
        process.exit(0);

        
    }
    catch(error){
        console.error("Error seeding database:",error);
        process.exit(1);
    }
};

seedDatabase();