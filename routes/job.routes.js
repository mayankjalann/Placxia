import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";
import { createJob } from "../controllers/job.controller.js";
import { publishJob, updateJob, closeJob, getCompanyJobs ,getAllOpenJobs, getJobById, getSavedJobs, toggleSavedJob, getPublicStats} from "../controllers/job.controller.js";

const router= Router();

router.get("/public-stats", getPublicStats);
router.get("/saved", verifyJWT, verifyRole("STUDENT"), getSavedJobs);
router.patch("/save/:jobId", verifyJWT, verifyRole("STUDENT"), toggleSavedJob);

router.post("/create",verifyJWT,verifyRole("COMPANY"),createJob);

router.patch("/publish/:jobId",
verifyJWT,
verifyRole("COMPANY"),
publishJob
)

router.patch("/update/:jobId",
verifyJWT,
verifyRole("COMPANY"),
updateJob
)

router.patch("/close/:jobId",
verifyJWT,
verifyRole("COMPANY"),
closeJob
)

router.get("/getCompanyJobs",
verifyJWT,
verifyRole("COMPANY"),
getCompanyJobs);

router.get("/getAllOpenJobs",
verifyJWT,
verifyRole("ADMIN","STUDENT"),
getAllOpenJobs);

router.get("/getJobById/:jobId",
verifyJWT,
verifyRole("ADMIN","STUDENT"),
getJobById);



export default router;
