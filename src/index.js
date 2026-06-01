const express = require('express');
const cors = require('cors');
require('dotenv').config();

const path = require('path');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger-output.json');
const { authMiddleware } = require('./middlewares/auth.middleware');

// Import routes directly
const authRoute = require('./routes/auth.route');
const departmentRoute = require('./routes/department.route');
const notificationRoute = require('./routes/notification.route');
const ticketRoute = require('./routes/ticket.route');
const webhookRoute = require('./routes/webhook.route');
const adminRoute = require('./routes/admin.route');
const userRoute = require('./routes/user.route');
const uploadRoute = require('./routes/upload.route');

const app = express();
const PORT = process.env.PORT || 5000; // Default to port 5000

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use(authMiddleware);

// Swagger Documentation Page
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/auth', authRoute);
app.use('/api/departments', departmentRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/tickets', ticketRoute);
app.use('/api/webhooks', webhookRoute);
app.use('/api/admin', adminRoute);
app.use('/api/users', userRoute);
app.use('/api/upload', uploadRoute);

// Basic base route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Ticket System API',
    docs: `172.25.192.1:${PORT}/api-docs`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on 172.25.192.1:${PORT}`);
  console.log(`[Docs] Swagger UI ready at 172.25.192.1:${PORT}/api-docs`);
});
