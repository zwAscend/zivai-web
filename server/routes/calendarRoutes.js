import express from 'express';
import {
  getEvents,
  getCourseEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  bulkCreateEvents,
  getCalendarStats
} from '../controllers/calendarController.js';
import { protect, teacher } from '../middleware/authMiddleware.js';

const router = express.Router();

// Event routes
router.get('/events', protect, getEvents);
router.get('/events/upcoming', protect, getUpcomingEvents);
router.get('/events/course/:courseId', protect, getCourseEvents);
router.post('/events', protect, createEvent);
router.post('/events/bulk', protect, teacher, bulkCreateEvents);
router.put('/events/:id', protect, updateEvent);
router.delete('/events/:id', protect, deleteEvent);

// Statistics
router.get('/stats', protect, getCalendarStats);

export default router;