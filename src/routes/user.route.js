import { Router } from "express";
import {
    registerUser,
    login,
    logout,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
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

router.post("/changePassword", verifyJwt, changeCurrentPassword);

router.post("/updateDetails", updateAccountDetails);

router.patch("/updateAvatar");

router.get("", getCurrentUser);

router.get("/channelProfile", getChannelProfile);

export default router;
