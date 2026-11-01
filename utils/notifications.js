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
    const [notification, user] = await Promise.all([
      Notification.create({ recipient: userId, type, title, message, link }),
      User.findById(userId).select("email"),
    ]);

    const mailer = getTransporter();
    if (mailer && user?.email) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: title,
        text: message,
      });
    }
    return notification;
  } catch (error) {
    console.error("Notification delivery failed:", error.message);
    return null;
  }
};
