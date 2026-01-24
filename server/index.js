import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import studentRoutes from './routes/studentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import developmentRoutes from './routes/developmentRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import resourceRoutes from './routes/resourceRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import cron from 'node-cron'; // Import node-cron
import syncResourcesJob from './jobs/syncResourcesJob.js'; // Import the job


// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);

// Set up Socket.io with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// --- Schedule the resource synchronization job ---
// This job will run every day at 3:00 AM.
// You can adjust the cron schedule string as needed.
// Cron string format: second minute hour day-of-month month day-of-week (for 6-field cron)
// or minute hour day-of-month month day-of-week (for 5-field cron, which node-cron defaults to)
//
// Examples:
// '0 0 * * *'    : Run once a day at midnight (00:00)
// '0 3 * * *'    : Run once a day at 3:00 AM
// '0 */6 * * *'  : Run every 6 hours (at minute 0)
// '* * * * *'    : Run every minute (for testing, but be careful in production!)

// If you want it to run every minute, use '* * * * *'
cron.schedule('* * * * *', () => { // <--- CORRECTED CRON EXPRESSION HERE
  syncResourcesJob();
}, {
  scheduled: true, // Schedule immediately
  timezone: "Africa/Harare" // Set your local timezone (important for accurate scheduling)
});

console.log('Resource synchronization job scheduled to run daily at every minute (Harare Time).'); // Update console log if you change the schedule

// Serve static files from uploads directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/students', studentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/development', developmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/notifications', notificationRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error middleware
app.use(errorHandler);

// Set up socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room for private messaging
  socket.on('join_chat', (data) => {
    socket.join(data.chatId);
    console.log(`User ${socket.id} joined chat: ${data.chatId}`);
  });

  // Handle new messages
  socket.on('send_message', (data) => {
    socket.to(data.chatId).emit('receive_message', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});