const userService = require('../services/user.service');

exports.createUser = async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required"
      });
    }
    const user = await userService.createUser({ email, name, role });
    res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: user
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

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
        message: "User not found"
      });
    }
    res.json({
      status: "success",
      message: "User retrieved successfully",
      data: user
    });
  } catch (error) {
    console.error("Error fetching user by id:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
