exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาแนบไฟล์อัปโหลด"
      });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/images/${req.file.filename}`;

    res.json({
      status: "success",
      message: "File uploaded successfully",
      data: {
        filename: req.file.filename,
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
