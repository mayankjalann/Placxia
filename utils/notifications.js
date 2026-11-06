import nodemailer from "nodemailer";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";

let transporter;
const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
};

export const notifyUser = async ({ userId, type, title, message, link = "/dashboard" }) => {
  try {
    const notification = await Notification.create({ recipient: userId, type, title, message, link });
    const mailer = getTransporter();
    if (mailer) {
      // Resolve the email recipient and send mail in the background. The in-app
      // notification is persisted before this function returns to the API.
      void User.findById(userId).select("email").lean()
        .then((user) => user?.email ? mailer.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: title,
          text: message,
        }) : null)
        .catch((error) => console.error("Email notification delivery failed:", error.message));
    }
    return notification;
  } catch (error) {
    console.error("Notification delivery failed:", error.message);
    return null;
  }
};
