import express from 'express';
import multer from 'multer';
import {
  submitAssignment,
  getSubmissionDetails,
  getStudentSubmissions,
  getPendingSubmissions,
  getGradingStats,
  reviewSubmission
} from '../controllers/submissionController.js';
import { protect, teacher } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  }
});

// Student routes
router.post('/', protect, upload.single('file'), submitAssignment);
router.get('/student/:studentId', protect, getStudentSubmissions);

// Teacher routes - Order matters! More specific routes should come before generic ones
router.get('/teacher/pending', protect, teacher, getPendingSubmissions);
router.get('/stats', protect, teacher, getGradingStats);
router.get('/:id', protect, teacher, getSubmissionDetails);
router.put('/:id/review', protect, teacher, reviewSubmission);

export default router;