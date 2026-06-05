import { Router } from "express";
import { registerStudent } from "../controllers/auth.controller.js";
import { loginUser,registerCompany } from "../controllers/auth.controller.js";

const router=Router();

router.post("/register/student",registerStudent);
router.post("/login/student",loginUser);
router.post("/register/company",registerCompany);

export default router; 