const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const { hashPassword, verifyPassword } = require('../utils/password');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

exports.login = async (req, res) => {
  const { username, password } = req.body;
  let normalizedUsername = username ? username.trim().toLowerCase() : 'unknown';

  try {
    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"
      });
    }

    let user = null;
    let hrSuccess = false;
    let accessTokenVal = null;

    // 1. Try logging in via external HR API
    try {
      const hrBaseUrl = process.env.HR_BASE_URL || 'https://demo-hr.v2.api.organicsos.ai';
      const response = await fetch(`${hrBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password
        })
      });

      if (response.ok) {
        const hrData = await response.json();
        if (hrData && hrData.user) {
          const hrUser = hrData.user;
          accessTokenVal = hrData.accessToken;
          
          // Map HR role to local role
          let localRole = "USER";
          const roles = hrUser.roles || [];
          const lowercaseRoles = roles.map(r => r.toLowerCase());
          if (lowercaseRoles.some(r => r.includes('admin') || r.includes('ผู้ดูแลระบบ'))) {
            localRole = "ADMIN";
          } else if (lowercaseRoles.some(r => r.includes('manager') || r.includes('หัวหน้าแผนก') || r.includes('หัวหน้างาน'))) {
            localRole = "MANAGER";
          }

          const name = hrUser.displayName || `${hrUser.firstName || ''} ${hrUser.lastName || ''}`.trim() || hrUser.email || username.trim();

          const hrDeptName = hrUser.departmentName 
            || (typeof hrUser.department === 'string' ? hrUser.department : hrUser.department?.name)
            || hrUser.department_name 
            || hrUser.deptName 
            || hrUser.departmentCode;

          // Upsert the external user into local DB (preserve original casing)
          user = await authService.upsertExternalUser(
            username.trim(),
            hrUser.email,
            name,
            localRole,
            hrDeptName
          );
          hrSuccess = true;
        }
      }
    } catch (hrError) {
      console.error("External HR authentication error:", hrError);
    }

    // 2. Fallback to local DB check if external login didn't succeed
    if (!hrSuccess) {
      user = await authService.findUserByUsername(username.trim());
      if (!user) {
        const remaining = req.rateLimit ? req.rateLimit.remaining : 14;
        return res.status(401).json({
          status: "error",
          message: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ลองใหม่ได้อีก ${remaining} ครั้ง)`
        });
      }

      if (!user.password) {
        const remaining = req.rateLimit ? req.rateLimit.remaining : 14;
        return res.status(401).json({
          status: "error",
          message: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ลองใหม่ได้อีก ${remaining} ครั้ง)`
        });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        const remaining = req.rateLimit ? req.rateLimit.remaining : 14;
        return res.status(401).json({
          status: "error",
          message: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ลองใหม่ได้อีก ${remaining} ครั้ง)`
        });
      }
    }

    const tokenPayload = { userId: user.id, role: user.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const responseData = {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        department: user.department ? {
          id: user.department.id,
          name: user.department.name,
          code: user.department.code
        } : null
      }
    };

    res.status(201).json({
      status: "success",
      message: "Logged in successfully",
      data: responseData
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.logout = async (req, res) => {
  res.json({
    status: "success",
    message: "Logged out successfully"
  });
};

exports.me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "ไม่ได้เข้าสู่ระบบ"
      });
    }
    res.json({
      status: "success",
      message: "Profile retrieved successfully",
      data: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        name: req.user.name,
        role: req.user.role,
        avatarUrl: req.user.avatarUrl,
        department: req.user.department
      }
    });
  } catch (error) {
    console.error("Error fetching current user profile:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const user = req.user;
    const { name, avatarUrl } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาระบุชื่อ-นามสกุล"
      });
    }

    const updateData = { name, avatarUrl };

    const updatedUser = await userService.updateUser(user.id, updateData);

    res.json({
      status: "success",
      message: "อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว",
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        department: updatedUser.department
      }
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

