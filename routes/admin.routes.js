import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";
import { approveCompany, addAllowedStudent } from "../controllers/admin.controller.js";

const router=Router();

router.patch("/approveCompany/:companyId",
verifyJWT,
verifyRole("ADMIN"),
approveCompany
)

router.post("/addAllowedStudent",
verifyJWT,
verifyRole("ADMIN"),
addAllowedStudent);



export default router;