import {Router} from "express"
import { applyForJob, getJobApplicants, getApplicantResume, updateApplicationStatus, upsertInterviewRound, recordInterviewRoundResult, getMyApplications } from "../controllers/application.controller.js";
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

router.get("/resume/:studentId",
verifyJWT,
verifyRole("COMPANY"),
getApplicantResume)

router.patch("/updateApplicationStatus/:applicationId",
 verifyJWT,
  verifyRole("COMPANY"), 
  updateApplicationStatus);

router.patch("/:applicationId/rounds", verifyJWT, verifyRole("COMPANY"), upsertInterviewRound);
router.patch("/:applicationId/rounds/:roundNo/result", verifyJWT, verifyRole("COMPANY"), recordInterviewRoundResult);

export default router;
