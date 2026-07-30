const departmentService = require('../services/department.service');

exports.getDepartments = async (req, res) => {
  try {
    let accessToken = req.accessToken;
    let departments = [];

    // If no accessToken is provided (e.g. local user logged in), we fetch a system token
    if (!accessToken) {
      try {
        const hrBaseUrl = process.env.HR_BASE_URL || 'https://demo-hr.v2.api.organicsos.ai';
        const loginResponse = await fetch(`${hrBaseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'tn0003-ns62061',
            password: '123456789'
          })
        });
        if (loginResponse.ok) {
          const loginResult = await loginResponse.json();
          if (loginResult && loginResult.accessToken) {
            accessToken = loginResult.accessToken;
          }
        }
      } catch (loginErr) {
        console.error("Failed to login to HR API for system token:", loginErr);
      }
    }

    if (accessToken) {
      try {
        const hrBaseUrl = process.env.HR_BASE_URL || 'https://demo-hr.v2.api.organicsos.ai';
        const response = await fetch(`${hrBaseUrl}/api/v1/departments`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.items) {
            const prisma = require('../prisma');
            departments = [];
            for (const item of result.items) {
              const name = item.nameTh || item.nameEn;
              const code = item.code || item.id.substring(0, 10);
              
              let dept = await prisma.department.findFirst({
                where: { OR: [{ name }, { code }] }
              });

              if (dept) {
                dept = await prisma.department.update({
                  where: { id: dept.id },
                  data: { name, code }
                });
              } else {
                dept = await prisma.department.create({
                  data: { name, code }
                });
              }
              departments.push(dept);
            }
          }
        }
      } catch (hrError) {
        console.error("Error fetching departments from HR API:", hrError);
      }
    }

    // Always fetch from local database to include any manually created departments
    departments = await departmentService.getActiveDepartments();

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

exports.getDepartmentById = async (req, res) => {
  try {
    const department = await departmentService.findDepartmentById(req.params.id);
    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบแผนกนี้"
      });
    }
    res.json({
      status: "success",
      message: "Department retrieved successfully",
      data: department
    });
  } catch (error) {
    console.error("Error fetching department by ID:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
