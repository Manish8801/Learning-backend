import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const res = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        return res;
    } catch (err) {
        console.log("Error in cloudinary upload", err.message); // removes locally saved file if upload fails
    } finally {
        fs.unlinkSync(localFilePath);
    }
};

export default uploadOnCloudinary;
