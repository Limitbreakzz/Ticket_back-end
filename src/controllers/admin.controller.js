const departmentService = require('../services/department.service');
const userService = require('../services/user.service');
const ticketService = require('../services/ticket.service');
const { hashPassword } = require('../utils/password');

// Helper function to normalize department code
function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "_");
}

// ==========================================
// 1. DEPARTMENTS MANAGEMENT
// ==========================================

exports.getDepartments = async (req, res) => {
  try {
    const departments = await departmentService.getAllDepartmentsWithCounts();
    res.json({
      status: "success",
      message: "Departments retrieved successfully",
      data: departments
    });
  } catch (error) {
    console.error("Error fetching departments for admin:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, isActive } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const normalized = typeof code === "string" ? normalizeCode(code) : "";

    if (!trimmedName || !normalized) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกชื่อและรหัสแผนกให้ครบถ้วน"
      });
    }

    const existing = await departmentService.findDuplicateDepartment(trimmedName, normalized);
    if (existing) {
      return res.status(409).json({
        status: "error",
        message: "ชื่อแผนกหรือรหัสแผนกนี้ถูกใช้งานแล้ว"
      });
    }

    const department = await departmentService.createDepartment({
      name: trimmedName,
      code: normalized,
      isActive: isActive === false ? false : true,
    });

    res.status(201).json({
      status: "success",
      message: "Department created successfully",
      data: department
    });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, isActive } = req.body;

    const existing = await departmentService.findDepartmentById(id);
    if (!existing) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบแผนกนี้"
      });
    }

    const trimmedName = typeof name === "string" ? name.trim() : existing.name;
    const normalized = typeof code === "string" ? normalizeCode(code) : existing.code;
    const activeState = typeof isActive === "boolean" ? isActive : existing.isActive;

    if (!trimmedName || !normalized) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกชื่อและรหัสแผนกให้ครบถ้วน"
      });
    }

    const duplicate = await departmentService.findDuplicateDepartment(trimmedName, normalized, id);
    if (duplicate) {
      return res.status(409).json({
        status: "error",
        message: "ชื่อแผนกหรือรหัสแผนกนี้ถูกใช้งานแล้ว"
      });
    }

    const department = await departmentService.updateDepartment(id, {
      name: trimmedName,
      code: normalized,
      isActive: activeState
    });

    res.json({
      status: "success",
      message: "Department updated successfully",
      data: department
    });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await departmentService.findDepartmentById(id);
    if (!existing) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบแผนกนี้"
      });
    }

    await departmentService.deleteDepartment(id);
    res.json({
      status: "success",
      message: "Department deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// ==========================================
// 2. USERS MANAGEMENT
// ==========================================

exports.getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsersForAdmin();
    res.json({
      status: "success",
      message: "Users retrieved successfully",
      data: users
    });
  } catch (error) {
    console.error("Error fetching users for admin:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, departmentId } = req.body;

    if (!name || !email || !password || !role || !departmentId) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อมูลให้ครบถ้วน"
      });
    }

    if (role === "ADMIN") {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถสร้างบัญชีผู้ดูแลระบบ (Admin) ผ่านหน้าระบบได้ (ต้องจัดการผ่านฐานข้อมูลเท่านั้น)"
      });
    }

    if (role !== "USER" && role !== "MANAGER") {
      return res.status(400).json({
        status: "error",
        message: "Role ไม่ถูกต้อง"
      });
    }

    if (departmentId) {
      const department = await departmentService.findDepartmentById(departmentId);
      if (!department) {
        return res.status(404).json({
          status: "error",
          message: "ไม่พบแผนกที่เลือก"
        });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await userService.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        status: "error",
        message: "อีเมลนี้ถูกใช้งานแล้ว"
      });
    }

    const hashed = await hashPassword(password);
    const user = await userService.createUser({
      name,
      email: normalizedEmail,
      password: hashed,
      role,
      departmentId: departmentId || null,
    });

    res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: user
    });
  } catch (error) {
    console.error("Error creating user by admin:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, password, departmentId } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (role) {
      if (role === "ADMIN") {
        const existingUser = await userService.getUserById(id);
        if (!existingUser || existingUser.role !== "ADMIN") {
          return res.status(400).json({
            status: "error",
            message: "ไม่สามารถเปลี่ยนสิทธิ์ผู้ใช้เป็น Admin ได้ (ต้องจัดการผ่านฐานข้อมูลเท่านั้น)"
          });
        }
      } else if (role !== "USER" && role !== "MANAGER") {
        return res.status(400).json({
          status: "error",
          message: "Role ไม่ถูกต้อง"
        });
      }
      updateData.role = role;
    }
    if (password) updateData.password = await hashPassword(password);
    
    if (departmentId !== undefined) {
      if (departmentId) {
        const department = await departmentService.findDepartmentById(departmentId);
        if (!department) {
          return res.status(404).json({
            status: "error",
            message: "ไม่พบแผนกที่เลือก"
          });
        }
        updateData.departmentId = departmentId;
      } else {
        updateData.departmentId = null;
      }
    }

    const updated = await userService.updateUser(id, updateData);
    res.json({
      status: "success",
      message: "User updated successfully",
      data: updated
    });
  } catch (error) {
    console.error("Error updating user by admin:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถลบบัญชีตัวเองได้"
      });
    }

    await userService.deleteUserWithTransaction(id);
    res.json({
      status: "success",
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user by admin:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// ==========================================
// 3. ANALYTICS
// ==========================================

exports.getAnalytics = async (req, res) => {
  try {
    const summary = await ticketService.getAnalyticsSummary();
    const { statusCounts, priorityCounts, categoryCounts, deptCounts } = await ticketService.getAnalyticsGroupedData();

    const departments = await departmentService.getActiveDepartments();
    const deptMap = {};
    departments.forEach(d => {
      deptMap[d.id] = d.name;
    });

    const statusData = statusCounts.map(item => ({
      status: item.status,
      count: item._count.id
    }));

    const priorityData = priorityCounts.map(item => ({
      priority: item.priority,
      count: item._count.id
    }));

    const categoryData = categoryCounts.map(item => ({
      category: item.category,
      count: item._count.id
    }));

    const departmentData = deptCounts.map(item => ({
      departmentId: item.targetDepartmentId,
      departmentName: item.targetDepartmentId ? (deptMap[item.targetDepartmentId] || "ไม่ทราบแผนก") : "แผนกไอทีส่วนกลาง",
      count: item._count.id
    }));

    res.json({
      status: "success",
      message: "Analytics retrieved successfully",
      data: {
        summary,
        statusData,
        priorityData,
        categoryData,
        departmentData
      }
    });
  } catch (error) {
    console.error("Error fetching admin analytics:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
