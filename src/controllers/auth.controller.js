const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const { hashPassword, verifyPassword } = require('../utils/password');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อมูลให้ครบถ้วน"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await authService.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        status: "error",
        message: "อีเมลนี้ถูกใช้งานแล้ว"
      });
    }

    const hashed = await hashPassword(password);
    const user = await authService.createUser({
      name,
      email: normalizedEmail,
      password: hashed,
      role: "USER"
    });

    res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกอีเมลและรหัสผ่าน"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await authService.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    // Set cookie
    const sessionData = { id: user.id, email: user.email, name: user.name, role: user.role };
    res.cookie('session_user', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    });

    res.json({
      status: "success",
      message: "Logged in successfully",
      data: sessionData
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
  try {
    res.clearCookie('session_user', { path: '/' });
    res.json({
      status: "success",
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
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
        name: req.user.name,
        role: req.user.role,
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
    const { name, avatarUrl, currentPassword, newPassword } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาระบุชื่อ-นามสกุล"
      });
    }

    const updateData = { name, avatarUrl };

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          status: "error",
          message: "กรุณาระบุรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่านใหม่"
        });
      }
      
      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({
          status: "error",
          message: "รหัสผ่านปัจจุบันไม่ถูกต้อง"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          status: "error",
          message: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร"
        });
      }

      updateData.password = await hashPassword(newPassword);
    }

    const updatedUser = await userService.updateUser(user.id, updateData);

    // Update the session cookie
    const sessionData = { 
      id: updatedUser.id, 
      email: updatedUser.email, 
      name: updatedUser.name, 
      role: updatedUser.role 
    };
    res.cookie('session_user', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    });

    res.json({
      status: "success",
      message: "อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว",
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
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
