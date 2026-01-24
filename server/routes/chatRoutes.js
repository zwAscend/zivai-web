import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function to generate a unique chat ID between teacher and student
const generateChatId = (teacherId, studentId) => {
  return `chat_${teacherId}_${studentId}`;
};

// @route   GET /api/chat/messages/:studentId
// @desc    Get messages between teacher and student
// @access  Private
router.get('/messages/:studentId', protect, asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const student = await Student.findOne({ id: req.params.studentId });
  
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  
  const chatId = generateChatId(teacherId, student.id);
  
  const messages = await Message.find({ chat: chatId })
    .sort({ timestamp: 1 })
    .populate('sender', 'firstName lastName');
  
  res.json(messages);
}));

// @route   POST /api/chat/messages/:studentId
// @desc    Send message to student
// @access  Private
router.post('/messages/:studentId', protect, asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const student = await Student.findOne({ id: req.params.studentId });
  
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  
  const chatId = generateChatId(teacherId, student.id);
  const { content } = req.body;
  
  const message = await Message.create({
    chat: chatId,
    sender: teacherId,
    content,
  });
  
  // Populate sender info
  await message.populate('sender', 'firstName lastName');
  
  res.status(201).json(message);
}));

// @route   PUT /api/chat/read/:studentId
// @desc    Mark all messages as read
// @access  Private
router.put('/read/:studentId', protect, asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const student = await Student.findOne({ id: req.params.studentId });
  
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  
  const chatId = generateChatId(teacherId, student.id);
  
  // Mark all messages from student as read
  await Message.updateMany(
    { chat: chatId, sender: { $ne: teacherId }, read: false },
    { read: true }
  );
  
  res.json({ message: 'Messages marked as read' });
}));

// @route   GET /api/chat/unread
// @desc    Get count of unread messages for teacher
// @access  Private
router.get('/unread', protect, asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  
  // Get all students
  const students = await Student.find();
  
  // Create an array of chat IDs
  const chatIds = students.map(student => generateChatId(teacherId, student.id));
  
  // Count unread messages for each chat
  const unreadCounts = await Promise.all(
    chatIds.map(async (chatId, index) => {
      const count = await Message.countDocuments({
        chat: chatId,
        sender: { $ne: teacherId },
        read: false
      });
      
      return {
        studentId: students[index].id,
        studentName: `${students[index].firstName} ${students[index].lastName}`,
        unreadCount: count
      };
    })
  );
  
  // Filter out students with no unread messages
  const filteredCounts = unreadCounts.filter(item => item.unreadCount > 0);
  
  res.json(filteredCounts);
}));

export default router;