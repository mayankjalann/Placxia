import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import {User} from "../models/user.model.js"

export const verifyJWT=asyncHandler(async(req,res,next)=>{
    const requestedRole = req.get("x-auth-role")?.toUpperCase();
    const roleSuffix = { STUDENT: "student", ADMIN: "admin", COMPANY: "company" };
    const token = (requestedRole && req.cookies?.[`accessToken_${roleSuffix[requestedRole]}`]) ||
        req.header("Authorization")?.replace("Bearer ","") ||
        req.cookies?.accessToken_student || req.cookies?.accessToken_admin || req.cookies?.accessToken_company;

    if(!token){
        throw new ApiError(401,"Unauthorized request");
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }

    // Keep sessions selected until they are checked, then strip them before
    // exposing the user to route handlers.
    const user=await User.findById(decodedToken?._id).select("-password");
    if(!user){
        throw new ApiError(401,"Invalid Access Token");
    }
    if (!user.isActive) throw new ApiError(403, "Account is disabled. Contact admin");
    if (requestedRole && requestedRole !== user.role) throw new ApiError(401, "No active session for this account type");
    if (!decodedToken.sid || !user.refreshSessions.some((session) => session.sessionId === decodedToken.sid)) {
        throw new ApiError(401, "Session has been revoked");
    }

    const safeUser = user.toObject();
    delete safeUser.refreshSessions;
    req.user=safeUser;
    req.authSessionId = decodedToken.sid;
    next();
});
