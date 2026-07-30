const userService = require('../services/user.service');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({
      status: "success",
      message: "Users retrieved successfully",
      data: users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบผู้ใช้งานนี้"
      });
    }
    // Delete password for safety
    delete user.password;

    res.json({
      status: "success",
      message: "User retrieved successfully",
      data: user
    });
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
