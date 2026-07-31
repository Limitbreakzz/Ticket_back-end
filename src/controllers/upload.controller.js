const prisma = require('../prisma');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาแนบไฟล์อัปโหลด"
      });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ticket_hub',
      resource_type: 'auto'
    });

    // Delete local temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.warn("Could not delete local temp file:", err);
    }

    const fileUrl = result.secure_url;
    const user = req.user;

    // Save metadata to Attachment table
    const attachment = await prisma.attachment.create({
      data: {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileUrl: fileUrl,
        userId: user ? user.id : null
      }
    });

    res.json({
      status: "success",
      message: "File uploaded successfully",
      data: {
        id: attachment.id,
        filename: req.file.filename,
        originalName: attachment.fileName,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    // Cleanup temp file in case of error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        // ignore
      }
    }
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
