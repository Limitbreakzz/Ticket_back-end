const prisma = require('../prisma');

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาแนบไฟล์อัปโหลด"
      });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/images/${req.file.filename}`;
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
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
