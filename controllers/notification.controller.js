import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
  return res.status(200).json(new ApiResponse(200, { notifications, unreadCount }, "Notifications fetched"));
});

const markNotificationRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.notificationId)) throw new ApiError(404, "Notification not found");
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw new ApiError(404, "Notification not found or already read");
  return res.status(200).json(new ApiResponse(200, notification, "Notification marked as read"));
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  return res.status(200).json(new ApiResponse(200, {}, "All notifications marked as read"));
});

export { getMyNotifications, markNotificationRead, markAllNotificationsRead };
