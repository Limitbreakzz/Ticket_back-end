const prisma = require('../prisma');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาแนบไฟล์อัปโหลด"
      });
    }

    let fileUrl = `/images/${req.file.filename}`;

    // Upload to Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'ticket_hub',
        resource_type: 'auto'
      });
      fileUrl = result.secure_url;

      // Delete local temp file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (err) {
        console.warn("Could not delete local temp file:", err);
      }
    }

    const user = req.user;

    // Save metadata to Attachment table
    const attachment = await prisma.attachment.create({
      data: {
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_url: fileUrl,
        user_id: user ? (user.user_id || user.id) : null
      }
    });

    res.json({
      status: "success",
      message: "File uploaded successfully",
      data: {
        id: attachment.attach_id,
        attach_id: attachment.attach_id,
        filename: req.file.filename,
        originalName: attachment.file_name,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (err) {
        // ignore
      }
    }
    res.status(500).json({
      status: "error",
      message: "Internal server error: " + (error.message || "Failed to upload file")
    });
  }
};

