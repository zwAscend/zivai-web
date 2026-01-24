// resourceRoutes.js

import express from 'express';
import multer from 'multer';
import {
  getCourseResources,
  uploadResource,
  getDownloadUrl,
  updateResourceOrder,
  deleteResource,
  getResourceCounts,
  getRecentUploads // Import the new function
} from '../controllers/resourceController.js';
import { protect, teacher } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Routes
router.get('/counts', protect, getResourceCounts);
router.get('/course/:courseId', protect, getCourseResources);
router.post('/upload', protect, teacher, upload.single('file'), uploadResource);
router.get('/download/:id', protect, getDownloadUrl);
router.put('/order', protect, teacher, updateResourceOrder);
router.delete('/:id', protect, teacher, deleteResource);

// New route for recent uploads
router.get('/recent', protect, getRecentUploads); // <-- Add this line

export default router;