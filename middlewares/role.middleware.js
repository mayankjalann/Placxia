import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyRole = (...allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    
    // req.user is added by verifyJWT middleware
    const userRole = req.user?.role;

    // 1. Check if user exists
    if (!req.user) {
      throw new ApiError(401, "Unauthorized request");
    }

    // 2. Check role existence
    if (!userRole) {
      throw new ApiError(401, "User role not found");
    }

    // 3. Check permission
    if (!allowedRoles.includes(userRole)) {
      throw new ApiError(403, `Access denied for role: ${userRole}`);
    }

    next();
  });
};