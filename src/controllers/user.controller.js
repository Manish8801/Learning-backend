import User from "../models/user.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import asyncHandler from "./../utils/async-handler.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        const [accessToken, refreshToken] = await Promise.all([
            user.generateAccessToken(),
            user.generateRefreshToken(),
        ]);

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (err) {
        throw new ApiError(500, "Error occurred refresh and access token");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    // get user details
    const { fullName, username, email, password } = req.body;

    // check if all required fields are present
    const missingFields = [fullName, username, email, password].filter(
        (field) => {
            console.log(field);
            !field || field.trim() === "";
        }
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
    let avatarLocalPath;
    let coverImageLocalPath;

    if (req.files) {
        if (Array.isArray(req.files.avatar)) {
            avatarLocalPath = req.files.avatar[0].path;
        }
        if (Array.isArray(req.files.coverImage)) {
            coverImageLocalPath = req.files.coverImage[0].path;
        }
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Missing fields required", {
            missingField: "avatar",
        });
    }

    // upload theme to cloudinary, get avatar url if uploaded
    let avatar, coverImage;

    if (coverImageLocalPath) {
        [avatar, coverImage] = await Promise.all([
            uploadOnCloudinary(avatarLocalPath),
            uploadOnCloudinary(coverImageLocalPath),
        ]);
    } else {
        avatar = await uploadOnCloudinary(avatarLocalPath);
    }

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

const login = asyncHandler(async (req, res) => {
    // get the login details
    const { username, email, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Missing fields required");
    }

    const user = await User.findOne({ $or: [{ username }, { email }] });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordCorrect = user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully"
            )
        );
});

const logout = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: "",
            },
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .json(new ApiResponse(200, {}, "User logged out"));

    // remove refresh token from db
});

export { registerUser, login, logout };
