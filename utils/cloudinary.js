import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),   // ✅ fixed typo
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
});

const uploadOnCloudinary = async (localFilePath, resourceType = "auto") => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType
        });
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        console.error("CLOUDINARY UPLOAD ERROR:", error);
        fs.unlinkSync(localFilePath);
        return null;
    }
};

const deleteFromCloudinary = async (publicId, resourceType = "raw") => { // ✅ added resourceType
    try {
        if (!publicId) return null;
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType  // ✅ required for non-image deletions
        });
        return response;
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        return null;
    }
};

const getSignedCloudinaryUrl = (publicId, resourceType = "raw", format = "pdf") => { // ✅ fixed default
    try {
        return cloudinary.url(publicId, {
            sign_url: true,
            resource_type: resourceType,
            format: format,
            secure: true
        });
    } catch (error) {
        console.error("Error signing URL:", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary, getSignedCloudinaryUrl };