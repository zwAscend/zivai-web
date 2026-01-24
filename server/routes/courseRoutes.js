import express from 'express';
import { getTeachingCourses, getCourses, getCourseById } from '../controllers/courseController.js';
import { protect, teacher } from '../middleware/authMiddleware.js';

const router = express.Router();

// Routes for courses
router.get('/teaching', protect, teacher, getTeachingCourses);
router.get('/', protect, getCourses);
router.get('/:id', protect, getCourseById);


export default router;
