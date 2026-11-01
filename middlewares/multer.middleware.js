import multer from "multer";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, tmpdir());
    },
    filename: function (_req, file, cb) {
      cb(null, randomUUID() + extname(file.originalname).toLowerCase());
    }
  });
  
export const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }
});
