import { Router } from "express";
import { 
    registerStudent, 
    loginUser,
    registerCompany,
    logoutUser,
    changePassword,
    updateStudentProfile,
    updateCompanyProfile,
    updateAdminProfile,
    getCurrentUser,
    refreshAccessToken
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
const router=Router();

router.post("/register/student",registerStudent);
router.post("/login",loginUser);
router.post("/register/company",registerCompany);

// Secured Routes
router.post("/logout", verifyJWT, logoutUser);
router.post("/change-password", verifyJWT, changePassword);
router.get("/current-user", verifyJWT, getCurrentUser);
router.post("/refresh-token", refreshAccessToken);

// Profile Updates with Multer Uploads
router.patch("/update-student", verifyJWT, upload.single("resume"), updateStudentProfile);
router.patch("/update-company", verifyJWT, upload.single("logo"), updateCompanyProfile);
router.patch("/update-admin", verifyJWT, updateAdminProfile);

export default router; 