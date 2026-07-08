import {Router} from "express"
import { applyForJob, getJobApplicants, updateApplicationStatus, getMyApplications } from "../controllers/application.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";

const router=Router();

router.post("/applyForJob/:jobId",
verifyJWT,
verifyRole("STUDENT"),
applyForJob)

router.get("/getMyApplications",
verifyJWT,
verifyRole("STUDENT"),
getMyApplications)

router.get("/getJobApplicants/:jobId",
verifyJWT,
verifyRole("COMPANY"),
getJobApplicants)

router.patch("/updateApplicationStatus/:applicationId",
 verifyJWT,
  verifyRole("COMPANY"), 
  updateApplicationStatus);

export default router;