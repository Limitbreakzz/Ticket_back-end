const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('../controllers/upload.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const app = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "images/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(
      null,
      file.fieldname +
      "-" +
      uniqueSuffix +
      ext
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf|docx|doc|xlsx|xls/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("รูปแบบไฟล์แนบไม่ถูกต้อง (อนุญาตเฉพาะรูปภาพ, PDF, Excel และ Word)"));
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

const uploadSingle = upload.single('file');

app.post('/',
  // #swagger.tags = ['upload']
  // #swagger.description = 'อัปโหลดไฟล์รูปภาพหรือไฟล์แนบ'
  requireAuth,
  (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: "error",
            message: "ขนาดไฟล์ต้องไม่เกิน 10MB"
          });
        }
        return res.status(400).json({
          status: "error",
          message: err.message
        });
      } else if (err) {
        return res.status(400).json({
          status: "error",
          message: err.message
        });
      }
      next();
    });
  },
  controller.uploadFile
);

module.exports = app;
