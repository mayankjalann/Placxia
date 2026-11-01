import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";
import { approveCompany, addAllowedStudent, addAllowedStudentsBulk, getUnapprovedCompanies, getPlacementAnalytics } from "../controllers/admin.controller.js";


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

router.get("/getUnapprovedCompanies",
verifyJWT,
verifyRole("ADMIN"),
getUnapprovedCompanies);

router.get("/analytics", verifyJWT, verifyRole("ADMIN"), getPlacementAnalytics);
router.post("/bulk-allowed-students", verifyJWT, verifyRole("ADMIN"), addAllowedStudentsBulk);



export default router;
