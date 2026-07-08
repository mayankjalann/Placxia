import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(), 
    api_key: process.env.CLOUDIANRY_API_KEY?.trim(), 
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
}); 

async function run() {
    try {
        console.log("Creating dummy file...");
        fs.writeFileSync("dummy.txt", "hello world");
        
        console.log("Attempting to upload to Cloudinary...");
        const res = await cloudinary.uploader.upload("dummy.txt", {
            resource_type: "raw"
        });
        console.log("Upload Success:", res.url);
        
        fs.unlinkSync("dummy.txt");
    } catch(err) {
        console.log("UPLOAD ERROR:", err);
    }
}
run();
