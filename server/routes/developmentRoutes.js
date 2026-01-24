import express from 'express';
import {
  // Add createCourse to the import list
  createCourse,
  getCourseAttributes,
  createCourseAttribute,
  getStudentAttributes,
  updateStudentAttributes,
  loadDevelopmentFixtures,
  getCoursePlans,
  createCoursePlan,
  getStudentPlan,
  assignPlanToStudent,
  updatePlanProgress,
  assignMultiplePlansToStudent,
  getAllPlansForStudent,
  updateStudentPlan,
} from '../controllers/developmentController.js'; // Corrected controller name if it was developmentRoutesController.js previously
import { protect, teacher } from '../middleware/authMiddleware.js';


const router = express.Router();

// -------------------------------------------------------------
// Course Management Routes
// -------------------------------------------------------------
// @route   POST /api/development/courses
// @desc    Create a new course
// @access  Private/Teacher
router.post('/courses', protect, teacher, createCourse);


// -------------------------------------------------------------
// Course Attributes Routes
// -------------------------------------------------------------
// @route   GET /api/development/attributes/course/:courseId
// @desc    Get attributes for a specific course
// @access  Private
router.get('/attributes/course/:courseId', protect, getCourseAttributes);

// @route   POST /api/development/attributes/course
// @desc    Create a new course attribute
// @access  Private/Teacher
router.post('/attributes/course', protect, teacher, createCourseAttribute);

// @route   GET /api/development/attributes/student/:studentId/course/:courseId
// @desc    Get student's attributes for a specific course
// @access  Private
router.get('/attributes/student/:studentId/course/:courseId', protect, getStudentAttributes);

// @route   PUT /api/development/attributes/student/:studentId
// @desc    Update a student's current and potential attribute scores
// @access  Private/Teacher
router.put('/attributes/student/:studentId', protect, teacher, updateStudentAttributes);


// -------------------------------------------------------------
// Learning Plans Routes
// -------------------------------------------------------------
// @route   GET /api/development/plans/course/:courseId
// @desc    Get all learning plans defined for a specific course
// @access  Private
router.get('/plans/course/:courseId', protect, getCoursePlans);

// @route   POST /api/development/plans/course
// @desc    Create a new learning plan for a course
// @access  Private/Teacher
router.post('/plans/course', protect, teacher, createCoursePlan);

// @route   GET /api/development/plans/student/:studentId/course/:courseId
// @desc    Get the active learning plan for a student in a specific course
// @access  Private
router.get('/plans/student/:studentId/course/:courseId', protect, getStudentPlan);

// @route   POST /api/development/plans/student/:studentId/assign
// @desc    Assign a learning plan to a student
// @access  Private/Teacher
router.post('/plans/student/:studentId/assign', protect, teacher, assignPlanToStudent);

// @route   POST /api/development/plans/student/:studentId/assign-multiple
// @desc    Assign multiple plans to a student
// @access  Private/Teacher
router.post('/plans/student/:studentId/assign-multiple', protect, teacher, assignMultiplePlansToStudent);

// @route   PUT /api/development/plans/student/:studentId/:planId/progress
// @desc    Update a student's progress on an assigned learning plan
// @access  Private/Teacher
router.put('/plans/student/:studentId/:planId/progress', protect, teacher, updatePlanProgress);

// @route   GET /api/development/plans/student/:studentId
// @desc    Get all plans assigned to a student
// @access  Private (Teacher/Admin)
router.get(
  '/plans/student/:studentId',
  protect,
  getAllPlansForStudent
);

// @route   PUT /api/development/plans/student/:studentId/:planId
// @desc    Update specific fields of a student's assigned plan (StudentPlan document)
// @access  Private/Teacher (only authenticated teachers can access)
router.put(
  '/plans/student/:studentId/:planId', // Endpoint to identify both the student and their specific plan
  protect,                              // Middleware to ensure the user is authenticated
  teacher,                              // Middleware to ensure the user has a teacher role
  updateStudentPlan                     // Controller function that handles the update logic
);


router.post('/plans/load-fixtures', protect, teacher, loadDevelopmentFixtures);

export default router;