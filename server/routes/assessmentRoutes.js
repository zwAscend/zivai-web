import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import Assessment from '../models/assessmentModel.js';
import Result from '../models/resultModel.js';
import Resource from '../models/resourceModel.js';
import Student from '../models/studentModel.js';
import { protect, teacher, admin } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `assessment-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  }
});

const assessmentAccess = asyncHandler(async (req, res, next) => {
  const { courseId } = req.query;
  const user = req.user; 

  if (user.isTeacher || user.isAdmin) {
    console.log(`Authorization success: User ID ${user._id} (Role: ${user.isTeacher || user.isAdmin}) granted access.`);
    return next();
  }

  if (user.role === 'student' && courseId) {
    try {
      const student = await Student.findOne({ id: user.studentId });

      if (student && student.courses.includes(courseId)) {
        console.log(`Authorization success: Student ID ${user.studentId} is enrolled in course ${courseId}.`);
        return next();
      } else {
        console.error(
          `Authorization failed: Student ID ${user.studentId} tried to access course ${courseId}, but is not enrolled. Student courses: [${student?.courses.join(', ')}]`
        );
      }
    } catch (error) {
      console.error(
        `Authorization failed due to database error: User ID ${user._id} attempting to access course ${courseId}. Error: ${error.message}`
      );
    }
  } else {
    let failureReason = '';
    if (user.role !== 'student') {
      failureReason = `Incorrect role (${user.role}).`;
    } else if (!courseId) {
      failureReason = 'Missing courseId query parameter.';
    }
    console.error(
      `Authorization failed: User ID ${user._id} (Role: ${user.role}) attempted unauthorized access. Reason: ${failureReason}`
    );
  }

  res.status(403);
  throw new Error('Not authorized to access assessments for this course');
});

const resultAccess = asyncHandler(async (req, res, next) => {
    const user = req.user;
    const studentIdQuery = req.query['student.id'];

    if (user.isTeacher || user.isAdmin) {
        return next();
    }

    if (user.role === 'student') {
        if (studentIdQuery) {
            const student = await Student.findOne({ id: studentIdQuery });

            if (student && student._id.toString() === user._id.toString()) {
                return next();
            } else {
                res.status(403);
                throw new Error('Not authorized to view other students\' results.');
            }
        }
        
        return next();
    }

    res.status(403);
    throw new Error('Not authorized to access results.');
});


// @route   GET /api/assessments
// @desc    Get all assessments
// @access  Private/Teacher/Admin
router.get('/', protect, assessmentAccess, asyncHandler(async (req, res) => {
  const { courseId } = req.query;

  const filter = courseId ? { courseId } : {};
  const assessments = await Assessment.find(filter);

  res.json(assessments);
}));

// @route   POST /api/assessments
// @desc    Create a new assessment
// @access  Private/Teacher
router.post('/', protect, teacher, upload.single('resource'), asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    type, 
    maxScore, 
    weight, 
    dueDate, 
    courseId,
    questions,
    isAIEnhanced = false,
    status = 'draft'
  } = req.body;

  if (!name || !description || !type || !maxScore || !weight || !dueDate || !courseId) {
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(console.error);
    }
    res.status(400);
    throw new Error('Missing required fields');
  }

  let parsedQuestions = [];
  if (questions) {
    try {
      parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
    } catch (error) {
      if (req.file) {
        await fs.promises.unlink(req.file.path).catch(console.error);
      }
      res.status(400);
      throw new Error('Invalid questions format');
    }
  }

  let resourceId = null;
  if (req.file) {
    try {
      const resource = await Resource.create({
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        key: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        uploadedBy: req.user._id,
        courseId
      });
      resourceId = resource._id;
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(console.error);
      throw error;
    }
  }

  const assessment = await Assessment.create({
    name,
    description,
    type,
    maxScore: Number(maxScore),
    weight: Number(weight),
    dueDate: new Date(dueDate),
    courseId,
    resource: resourceId,
    questions: parsedQuestions,
    isAIEnhanced: isAIEnhanced === 'true' || isAIEnhanced === true,
    status,
    createdBy: req.user._id,
    lastModifiedBy: req.user._id
  });

  if (assessment) {
    res.status(201).json(assessment);
  } else {
    if (resourceId) {
      await Resource.findByIdAndDelete(resourceId);
      await fs.promises.unlink(req.file.path).catch(console.error);
    }
    res.status(400);
    throw new Error('Invalid assessment data');
  }
}));

// @route   GET /api/assessments/:id
// @desc    Get assessment by ID
// @access  Private/Teacher/Admin
router.get('/:id', protect, teacher, asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  res.json(assessment);
}));

// @route   PUT /api/assessments/:id
// @desc    Update an assessment
// @access  Private/Teacher
router.put('/:id', protect, teacher, upload.single('resource'), asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(console.error);
    }
    res.status(404);
    throw new Error('Assessment not found');
  }

  let resourceId = assessment.resource;
  if (req.file) {
    try {
      if (assessment.resource) {
        const oldResource = await Resource.findById(assessment.resource);
        if (oldResource) {
          await fs.promises.unlink(path.join(process.cwd(), 'uploads', oldResource.key)).catch(console.error);
          await Resource.findByIdAndDelete(oldResource._id);
        }
      }

      const resource = await Resource.create({
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        key: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        uploadedBy: req.user._id,
        courseId: assessment.courseId
      });
      resourceId = resource._id;
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(console.error);
      throw error;
    }
  }

  if (req.body.questions) {
    try {
      assessment.questions = typeof req.body.questions === 'string' 
        ? JSON.parse(req.body.questions) 
        : req.body.questions;
    } catch (error) {
      res.status(400);
      throw new Error('Invalid questions format');
    }
  }

  assessment.name = req.body.name || assessment.name;
  assessment.description = req.body.description || assessment.description;
  assessment.type = req.body.type || assessment.type;
  assessment.maxScore = req.body.maxScore ? Number(req.body.maxScore) : assessment.maxScore;
  assessment.weight = req.body.weight ? Number(req.body.weight) : assessment.weight;
  assessment.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : assessment.dueDate;
  assessment.resource = resourceId;
  assessment.status = req.body.status || assessment.status;
  assessment.lastModifiedBy = req.user._id;
  assessment.updatedAt = new Date();

  if (req.body.isAIEnhanced !== undefined) {
    assessment.isAIEnhanced = req.body.isAIEnhanced === 'true' || req.body.isAIEnhanced === true;
  }

  const updatedAssessment = await assessment.save();
  res.json(updatedAssessment);
}));

// @route   DELETE /api/assessments/:id
// @desc    Delete an assessment
// @access  Private/Teacher/Admin
router.delete('/:id', protect, teacher, asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  // Check if the user has permission to delete this assessment
  if (!req.user.isAdmin && assessment.createdBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this assessment');
  }

  try {
    if (assessment.resource) {
      const resource = await Resource.findById(assessment.resource);
      if (resource) {
        const filePath = path.join(process.cwd(), 'uploads', resource.key);
        await fs.promises.unlink(filePath).catch(console.error);
        await Resource.findByIdAndDelete(resource._id);
      }
    }
    
    await Result.deleteMany({ assessment: assessment._id });
    
    await assessment.deleteOne();
    
    res.json({ message: 'Assessment removed' });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    res.status(500);
    throw new Error('Error deleting assessment');
  }
}));

// @route   GET /api/assessments/:id/results
// @desc    Get all results for an assessment, with student filtering
// @access  Private/Teacher/Admin/Student// @route   GET /api/assessments/:id/results
// @desc    Get all results for an assessment, with student filtering
// @access  Private/Teacher/Admin/Student
router.get('/:id/results', protect, resultAccess, asyncHandler(async (req, res) => {
  console.log('=== RESULTS ROUTE DEBUG ===');
  console.log('Assessment ID from params:', req.params.id);
  console.log('Query params:', req.query);
  console.log('User role:', req.user.role);
  console.log('User ID:', req.user._id);
  console.log('User studentId:', req.user.studentId); // Add this to see the studentId

  const assessment = await Assessment.findById(req.params.id);
  const studentIdQuery = req.query.studentId || req.query['student.id'];

  console.log('Assessment found:', !!assessment);
  console.log('Student ID query:', studentIdQuery);

  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  const filter = { assessment: req.params.id };
  console.log('Initial filter:', filter);

  if (req.user.role === 'student') {
    // FIX: For students, we need to find their Student document first
    // The user document has a studentId field that corresponds to the Student's public ID
    console.log('Finding student document for user with studentId:', req.user.studentId);
    
    const student = await Student.findOne({ id: req.user.studentId });
    console.log('Found student document:', student ? { _id: student._id, id: student.id } : 'Not found');
    
    if (!student) {
      res.status(404);
      throw new Error('Student record not found');
    }
    
    filter.student = student._id; // Use the Student document's _id, not the User's _id
    console.log('Student role - filtering by student._id:', student._id);
  } else if (studentIdQuery) {
    console.log('Searching for student with ID:', studentIdQuery);
    
    // Try different ways to find the student
    let student = null;
    
    // 1. Try by public ID (like "S000001")
    student = await Student.findOne({ id: studentIdQuery });
    console.log('Found by public ID:', !!student, student?._id);
    
    // 2. If not found, try by MongoDB _id
    if (!student) {
      try {
        student = await Student.findById(studentIdQuery);
        console.log('Found by MongoDB _id:', !!student, student?._id);
      } catch (error) {
        console.log('Error searching by MongoDB _id:', error.message);
      }
    }
    
    // 3. If still not found, try finding by the _id field in the user collection
    if (!student) {
      student = await Student.findOne({ _id: studentIdQuery });
      console.log('Found by _id field query:', !!student, student?._id);
    }
    
    if (!student) {
      console.log('❌ Student not found with any method');
      res.status(404);
      throw new Error('Student not found with provided ID');
    }
    
    console.log('✅ Found student:', {
      _id: student._id,
      id: student.id,
      name: `${student.firstName} ${student.lastName}`
    });
    
    filter.student = student._id;
  }

  console.log('Final filter:', filter);

  // First, let's see what results exist for this assessment (no student filter)
  const allResultsForAssessment = await Result.find({ assessment: req.params.id });
  console.log(`Total results for assessment ${req.params.id}:`, allResultsForAssessment.length);
  
  allResultsForAssessment.forEach((result, index) => {
    console.log(`Result ${index + 1}:`, {
      _id: result._id,
      student: result.student,
      assessment: result.assessment,
      actualMark: result.actualMark
    });
  });

  // Now apply the full filter
  const results = await Result.find(filter)
    .populate('student', 'id firstName lastName')
    .populate('assessment', 'name maxScore');

  console.log(`Found ${results.length} results with filter`);
  console.log('=== END DEBUG ===');
  
  res.json(results);
}));

// @route   POST /api/assessments/:id/results
// @desc    Add results for an assessment
// @access  Private/Teacher
// ... (all other imports and routes)

// @route   POST /api/assessments/:id/results
// @desc    Add results for an assessment
// @access  Private/Teacher
router.post('/:id/result', asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
      res.status(404);
      throw new Error('Assessment not found');
  }

  // The request body sends `student` with the public ID (e.g., "S000001").
  // We need to use this to find the student document and get its internal _id.
  const { student: studentPublicId, expectedMark, actualMark, feedback, externalAssessmentData } = req.body;

  // Use `Student.findOne({ id: studentPublicId })` to search by the public-facing ID.
  const student = await Student.findOne({ id: studentPublicId });
  
  // This check is the key part that was failing.
  if (!student) {
      res.status(404);
      throw new Error('Student not found');
  }

  let grade = 'F';
  if (actualMark >= 75) grade = 'A';
  else if (actualMark >= 65) grade = 'B';
  else if (actualMark >= 55) grade = 'C';
  else if (actualMark >= 45) grade = 'D';
  else if (actualMark >= 35) grade = 'E';

  // Use the found student's internal _id for the query.
  let result = await Result.findOne({
      student: student._id, // <<--- Use student._id here
      assessment: assessment._id
  });

  if (result) {
      // Update existing result
      result.expectedMark = expectedMark;
      result.actualMark = actualMark;
      result.grade = grade;
      result.feedback = feedback || result.feedback;
      result.externalAssessmentData = externalAssessmentData || result.externalAssessmentData;
      result = await result.save();
  } else {
      // Create new result
      result = await Result.create({
          student: student._id, // <<--- Use student._id here
          assessment: assessment._id,
          expectedMark,
          actualMark,
          grade,
          feedback: feedback || '',
          externalAssessmentData
      });
  }

  res.status(201).json(result);
}));

// @route   GET /api/assessments/student/:studentId
// @desc    Get all assessments and results for a specific student
// @access  Private/Teacher/Admin
router.get('/student/:studentId', asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const student = await Student.findOne({ id: studentId });

  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const studentResults = await Result.find({ student: student._id })
    .populate('assessment')
    .select('-student');

  const assessmentsWithResults = studentResults.map(result => ({
    assessment: result.assessment,
    result: {
      expectedMark: result.expectedMark,
      actualMark: result.actualMark,
      grade: result.grade,
      feedback: result.feedback,
      submittedDate: result.submittedDate,
      externalAssessmentData: result.externalAssessmentData
    }
  }));

  res.json(assessmentsWithResults);
}));

// @route   GET /api/assessments/course/:courseId
// @desc    Get all assessments for a course
// @access  Private/Teacher/Admin
router.get('/course/:courseId', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { courseId: req.params.courseId };
  
  if (status) {
    filter.status = status;
  }
  
  const assessments = await Assessment.find(filter)
    .sort({ dueDate: 1, createdAt: -1 })
    .populate('resource', 'name url mimeType size')
    .populate('createdBy', 'firstName lastName')
    .populate('lastModifiedBy', 'firstName lastName');
    
  res.json(assessments);
}));

// @route   GET /api/assessments/:id/with-questions
// @desc    Get an assessment with its questions
// @access  Private/Teacher/Admin
router.get('/:id/with-questions', protect, teacher, asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id)
    .populate('resource', 'name url mimeType size')
    .populate('questions.attributes', 'name description category');
    
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }
  
  res.json(assessment);
}));

export default router;