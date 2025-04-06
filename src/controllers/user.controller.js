import upload from "../middlewares/multer.middleware.js";
import User from "../models/user.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import asyncHandler from "./../utils/async-handler.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details
    const { fullName, username, email, password } = req.body;

    // check if all required fields are present
    const missingFields = [fullName, username, email, password].filter(
        (field) => !field || field.trim() === ""
    );

    if (missingFields.length > 0) {
        throw new ApiError(400, "Missing fields required", { missingFields });
    }

    // check if already exists : username , email
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });

    if (existingUser) {
        throw new ApiError(409, "User already exists", {
            conflictingFields: { username, email },
        });
    }

    // check for images and avatars(compulsory)
    // here we get files object because of multer middleware
    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Missing fields required", {
            missingField: "avatar",
        });
    }

    // upload theme to cloudinary, get avatar url if uploaded
    const [avatar, coverImage] = await Promise.all([
        upload(avatarLocalPath),
        upload(coverImageLocalPath),
    ]);

    if (!avatar) {
        throw new ApiError(500, "Failed to upload avatar", {
            reason: "Service not reachable",
        });
    }

    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username,
    });

    // check user creation - if user created
    // remove password and refresh token
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "An error occurred while creating user", {
            reason: "Unable to write to the database",
        });
    }
    return res
        .status(201)
        .json(
            new ApiResponse(200, createdUser, "User registered successfully")
        );
});

export { registerUser };
