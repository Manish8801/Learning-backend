import User from "../models/user.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import asyncHandler from "./../utils/async-handler.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
            $unset: {
                refreshToken: 1,
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

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;
    try {
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decoded = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decoded?._id);

        if (!user) throw new ApiError(401, "Invalid refresh token");

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true,
        };

        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken)
            .cookie("refreshToken", newRefreshToken)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        throw new ApiError(
            400,
            "New password and confirm password do not match"
        );
    }

    const userId = req.user?._id;
    const user = await User.findById(userId);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) throw new ApiError(400, "Invalid old password");

    user.password = newPassword;
    await user.save();

    return res.status(200).json(new ApiResponse(200, null, "Password changed"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, req.user, "User found"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const updates = ["username", "fullName", "email"].reduce((acc, field) => {
        if (field in req.body) {
            acc = acc = {
                ...acc,
                [field]: req.body[field],
            };
        }
        return acc;
    }, {});

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, user, "Account updated"));
});

const updateAvatar = asyncHandler(async (req, res) => {
    let avatarLocalPath = req.file.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { avatar: avatar.url } },
        { new: true }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Avatar updated"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
    console.log(req);
    let coverImageLocalPath = req.file.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on cover image");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Cover image updated"));
});

const getChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscriberCounts: { $size: "$subscribers" },
                channelSubscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCounts: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "User channel fetched successfully"
            )
        );
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "Users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner",
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(200, user[0]?.watchHistory, "Watch history fetched")
        );
});

export {
    registerUser,
    login,
    logout,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
    getChannelProfile,
    getWatchHistory,
};
