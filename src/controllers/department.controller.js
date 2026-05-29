const departmentService = require('../services/department.service');

exports.getDepartments = async (req, res) => {
  try {
    const departments = await departmentService.getActiveDepartments();
    res.json({
      status: "success",
      message: "Departments retrieved successfully",
      data: departments
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
