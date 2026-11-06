import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import {User} from "../models/user.model.js"

export const verifyJWT=asyncHandler(async(req,res,next)=>{
    const requestedRole = req.get("x-auth-role")?.toUpperCase();
    const roleSuffix = { STUDENT: "student", ADMIN: "admin", COMPANY: "company" };
    let decodedToken;
    const bearerToken = req.header("Authorization")?.replace("Bearer ", "");
    const preferredCookie = roleSuffix[requestedRole]
        ? req.cookies?.[`accessToken_${roleSuffix[requestedRole]}`]
        : null;
    const selectedToken = bearerToken || preferredCookie;

    if (selectedToken) {
        try {
            decodedToken = jwt.verify(selectedToken, process.env.ACCESS_TOKEN_SECRET);
        } catch (error) {
            throw new ApiError(401, error?.message || "Invalid access token");
        }
    } else if (!requestedRole) {
        // A new tab has no per-tab role yet. Restore the most recently issued
        // valid role cookie instead of always preferring one account type.
        const candidates = Object.values(roleSuffix)
            .map((suffix) => req.cookies?.[`accessToken_${suffix}`])
            .filter(Boolean)
            .map((token) => {
                try { return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); }
                catch { return null; }
            })
            .filter(Boolean)
            .sort((left, right) => (right.iat || 0) - (left.iat || 0));
        decodedToken = candidates[0];
    }

    if (!decodedToken) {
        throw new ApiError(401, "Unauthorized request");
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
