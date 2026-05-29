const express = require('express');
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/upload.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const app = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
      "-" +
      uniqueSuffix +
      "." +
      file.originalname.split(".").pop()
    );
  },
});

const upload = multer({ storage: storage });

app.post('/',
  // #swagger.tags = ['upload']
  // #swagger.description = 'อัปโหลดไฟล์รูปภาพหรือไฟล์แนบ'
  requireAuth,
  upload.single('file'),
  controller.uploadFile
);

module.exports = app;
