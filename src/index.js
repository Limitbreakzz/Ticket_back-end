const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const socketService = require('./services/socket.service');

const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('./middlewares/auth.middleware');

const authRoute = require('./routes/auth.route');
const departmentRoute = require('./routes/department.route');
const notificationRoute = require('./routes/notification.route');
const ticketRoute = require('./routes/ticket.route');
const webhookRoute = require('./routes/webhook.route');
const adminRoute = require('./routes/admin.route');
const userRoute = require('./routes/user.route');
const uploadRoute = require('./routes/upload.route');

const app = express();
const server = http.createServer(app);
socketService.init(server);
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use('/images', express.static(path.join(__dirname, '../images'), {
  maxAge: '7d',
  immutable: true
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 15,                  
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'พยายามเข้าสู่ระบบเกินกำหนด กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง'
  },
  skipSuccessfulRequests: true, 
});

app.use(authMiddleware);


app.use('/api/auth', authRoute);
app.use('/api/departments', departmentRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/tickets', ticketRoute);
app.use('/api/webhooks', webhookRoute);
app.use('/api/admin', adminRoute);
app.use('/api/users', userRoute);
app.use('/api/upload', uploadRoute);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Ticket System API'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

const { startSLAScheduler } = require('./services/sla-scheduler.service');

server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  startSLAScheduler();
});
