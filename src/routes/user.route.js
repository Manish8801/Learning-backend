import { Router } from "express";
import {
    registerUser,
    login,
    logout,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateCoverImage,
    updateAvatar,
    getChannelProfile,
    getWatchHistory,
} from "../controllers/user.controller.js";
import upload from "../middlewares/multer.middleware.js";
import verifyJwt from "../middlewares/auth.middleware.js";

const router = Router();

router.post(
    "/register",
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1,
        },
    ]),
    registerUser
);

router.post("/login", login);

// secured route
router.post("/logout", verifyJwt, logout);

router.post("/refresh-token", refreshAccessToken);

router.post("/change-password", verifyJwt, changeCurrentPassword);

router.get("/current-user", verifyJwt, getCurrentUser);

router.patch("/update-details", verifyJwt, updateAccountDetails);

router.post("/update-avatar", verifyJwt, upload.single("avatar"), updateAvatar);

router.post("/update-cover-image", verifyJwt, upload.single("coverImage"), updateCoverImage);

router.get("/channel-profile/:username", verifyJwt, getChannelProfile);

router.get("/history", verifyJwt, getWatchHistory);

export default router;
