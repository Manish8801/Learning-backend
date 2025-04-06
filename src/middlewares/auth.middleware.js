import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import asyncHandler from "../utils/async-handler.js";
import ApiError from "../utils/api-error.js";

const verifyJwt = asyncHandler(async (req, _, next) => {
    try {
        const accessToken =
            req.cookies?.accessToken ||
            req.header("Authorization")?.split(" ")[1];

        if (!accessToken) throw new ApiError(401, "Unauthorized request");

        const decoded = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
        );

        const user = await User.findById(decoded?._id).select(
            "-password -refreshToken"
        );

        if (!user) throw new ApiError(401, "Invalid access token");

        req.user = user;
        next();
    } catch (err) {
        throw new ApiError(401, err?.message || "Invalid access token");
    }
});

export default verifyJwt;
