import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "../controllers/notification.controller.js";

const router = Router();
router.use(verifyJWT);
router.get("/mine", getMyNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", markNotificationRead);

export default router;
