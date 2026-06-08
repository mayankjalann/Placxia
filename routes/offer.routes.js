import { createOffer } from "../controllers/offer.controller.js";
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";
import { respondToOffer, getStudentOffers, getCompanyOffers} from "../controllers/offer.controller.js";

const router=Router();

router.post("/createOffer/:applicationId",
verifyJWT,
verifyRole("COMPANY"),
createOffer
)

router.patch("/respondToOffer/:offerId",
verifyJWT,
verifyRole("STUDENT"),
respondToOffer
)

router.get("/getStudentOffers",
verifyJWT,
verifyRole("STUDENT"),
getStudentOffers);

router.get("/getCompanyOffers",
verifyJWT,
verifyRole("COMPANY"),
getCompanyOffers);


export default router;