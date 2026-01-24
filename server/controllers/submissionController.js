import asyncHandler from '../utils/asyncHandler.js';
import Submission from '../models/submissionModel.js';
import Assessment from '../models/assessmentModel.js';
import Student from '../models/studentModel.js';
import Result from '../models/resultModel.js';
import Notification from '../models/notificationModel.js';
import Course from '../models/courseModel.js';
import { gradeAssignmentWithAI } from '../services/gradingService.js';
import { extractTextFromDocument } from '../services/documentProcessor.js';
import path from 'path';
import fs from 'fs';

// @desc    Submit assignment for grading
// @route   POST /api/submissions
// @access  Private/Student
export const submitAssignment = asyncHandler(async (req, res) => {
  console.log('DEBUG: Received submission request:', {
    body: req.body,
    file: req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype } : null,
    user: req.user
  });

  const { assessmentId, studentId, submissionType, textContent, externalAssessmentData, result } = req.body;
  const file = req.file;

  // Validate required fields
  if (!assessmentId || !studentId || !submissionType) {
    res.status(400);
    throw new Error('Assessment ID, student ID, and submission type are required');
  }

  // Validate submission content
  if (submissionType === 'file' && !file) {
    res.status(400);
    throw new Error('File is required for file submissions');
  }

  if (submissionType === 'text' && !textContent?.trim()) {
    res.status(400);
    throw new Error('Text content is required for text submissions');
  }

  // Get assessment details
  const assessment = await Assessment.findById(assessmentId)
    .populate('courseId', 'name teacher');

  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  // Get student details - handle both ID formats
  let student;
  try {
    // Try finding by MongoDB _id first
    student = await Student.findById(studentId);
    if (!student) {
      // If not found, try finding by the custom 'id' field
      student = await Student.findOne({ id: studentId });
    }
  } catch (error) {
    // If studentId is not a valid ObjectId, try finding by custom 'id' field
    student = await Student.findOne({ id: studentId });
  }

  if (!student) {
    res.status(404);
    throw new Error(`Student not found with ID: ${studentId}`);
  }

  // Check if already submitted
  const existingSubmission = await Submission.findOne({
    student: student._id,
    assessment: assessmentId
  });

  if (existingSubmission) {
    res.status(400);
    throw new Error('Assignment already submitted');
  }

  // Prepare submission data
  let submissionContent = textContent || '';
  let originalFileName = '';
  let fileSize = 0;
  let mimeType = '';

  if (submissionType === 'file' && file) {
    // Save file and get path
    const uploadDir = path.join(process.cwd(), 'uploads', 'submissions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, fileName);
    
    fs.writeFileSync(filePath, file.buffer);
    
    submissionContent = filePath;
    originalFileName = file.originalname;
    fileSize = file.size;
    mimeType = file.mimetype;
  }

  // Parse externalAssessmentData if it exists
  let parsedExternalData = null;
  if (externalAssessmentData) {
    try {
      parsedExternalData = typeof externalAssessmentData === 'string' 
        ? JSON.parse(externalAssessmentData) 
        : externalAssessmentData;
    } catch (error) {
      console.error('Failed to parse externalAssessmentData JSON:', error);
      // Don't throw an error, just log it and proceed without the data
    }
  }

  try {
    // Create submission with all available data
    const submissionData = {
      student: student._id,
      assessment: assessmentId,
      submissionType,
      content: submissionContent,
      originalFileName,
      fileSize,
      mimeType,
      status: 'graded', // Set as graded since frontend handles grading
      externalAssessmentData: parsedExternalData
    };

    // Add result reference if provided
    if (result) {
      submissionData.result = result;
    }

    const submission = await Submission.create(submissionData);

    // If external assessment data exists, update submission with grading results
    if (parsedExternalData?.assessment) {
      const gradingResult = parsedExternalData.assessment;

      submission.autoGrading = {
        result: {
          totalScore: gradingResult.marks_achieved || 0,
          percentage: gradingResult.marks_percentage || 0,
          grade: gradingResult.grade || 'F',
          feedback: gradingResult.overall_feedback || 'No feedback provided',
          breakdown: gradingResult.assessment_details || {},
          confidence: gradingResult.confidence_assessment_score || 0,
          gradedAt: new Date()
        }
      };
      await submission.save();

      // Create notification for teacher
      try {
        await Notification.create({
          recipient: assessment.courseId.teacher,
          type: 'assignment_graded',
          title: 'Assignment Automatically Graded',
          message: `${student.firstName} ${student.lastName}'s submission for "${assessment.name}" has been automatically graded. Score: ${gradingResult.marks_achieved}/${assessment.maxScore} (${gradingResult.marks_percentage}%)`,
          data: {
            submissionId: submission._id,
            assessmentId,
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`,
            score: gradingResult.marks_achieved,
            maxScore: assessment.maxScore,
            percentage: gradingResult.marks_percentage,
            grade: gradingResult.grade,
            confidence: gradingResult.confidence_assessment_score
          },
          priority: 'medium'
        });
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
        // Don't fail the submission for notification errors
      }
    }

    res.status(201).json({
      message: 'Assignment submitted successfully',
      submission: {
        _id: submission._id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        autoGrading: submission.autoGrading || null
      }
    });

  } catch (error) {
    console.error('Database operation failed:', error);
    res.status(500);
    throw new Error(`Failed to save submission: ${error.message}`);
  }
});

// @desc    Get submission details for teacher review
// @route   GET /api/submissions/:id
// @access  Private/Teacher
export const getSubmissionDetails = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('student', 'id firstName lastName email')
    .populate('assessment', 'name description type maxScore weight dueDate')
    .populate('teacherReview.reviewedBy', 'firstName lastName');

  if (!submission) {
    res.status(404);
    throw new Error('Submission not found');
  }

  // Get submission content if it's a file
  let submissionContent = '';
  if (submission.submissionType === 'file') {
    try {
      if (submission.mimeType === 'text/plain') {
        submissionContent = fs.readFileSync(submission.content, 'utf8');
      } else {
        // For other file types, extract text
        submissionContent = await extractTextFromDocument({
          path: submission.content,
          mimeType: submission.mimeType,
          originalname: submission.originalFileName
        });
      }
    } catch (error) {
      console.error('Error reading submission content:', error);
      submissionContent = 'Error reading file content';
    }
  } else {
    submissionContent = submission.content;
  }
  
  // Conditionally add external assessment data if it exists
  let externalAssessmentData = null;
  if (submission.externalAssessmentData) {
      externalAssessmentData = submission.externalAssessmentData;
  }

  res.json({
    ...submission.toObject(),
    submissionContent,
    externalAssessmentData
  });
});

// @desc    Get all submissions for a specific student
// @route   GET /api/submissions/student/:studentId
// @access  Private
export const getStudentSubmissions = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  console.log('DEBUG: Fetching submissions for student ID:', studentId);
  console.log('DEBUG: Request user info:', {
    userId: req.user._id,
    userRole: req.user.role,
    isTeacher: req.user.isTeacher,
    isAdmin: req.user.isAdmin,
    studentId: req.user.studentId
  });

  try {
    // Find student by their public ID (e.g., "S000001")
    let student;
    try {
      // Try finding by MongoDB _id first
      student = await Student.findById(studentId);
      if (!student) {
        // If not found, try finding by the custom 'id' field
        student = await Student.findOne({ id: studentId });
      }
    } catch (error) {
      // If studentId is not a valid ObjectId, try finding by custom 'id' field
      student = await Student.findOne({ id: studentId });
    }

    if (!student) {
      console.log('DEBUG: Student not found with ID:', studentId);
      res.status(404);
      throw new Error(`Student not found with ID: ${studentId}`);
    }

    console.log('DEBUG: Found student:', {
      studentInternalId: student._id,
      studentPublicId: student.id,
      studentName: `${student.firstName} ${student.lastName}`
    });

    // Check authorization: students can only view their own submissions, teachers and admins can view any
    if (req.user.role === 'student') {
      // For students, check if they're trying to access their own submissions
      // Compare using both the MongoDB _id and the student's public ID
      const isOwnSubmission = req.user._id.toString() === student._id.toString() || 
                             req.user.studentId === studentId ||
                             req.user.id === studentId;
      
      if (!isOwnSubmission) {
        console.log('Authorization failed:', {
          userRole: req.user.role,
          userId: req.user._id.toString(),
          userStudentId: req.user.studentId,
          requestedStudentId: studentId,
          foundStudentId: student._id.toString()
        });
        res.status(403);
        throw new Error('Not authorized to view these submissions');
      }
    }
    // Teachers and admins can view any student's submissions (no additional check needed)

    // Fetch all submissions for this student
    const submissions = await Submission.find({ student: student._id })
      .populate('assessment', 'name description type maxScore weight dueDate courseId')
      .sort({ submittedAt: -1 }); // Sort by newest first

    console.log(`DEBUG: Found ${submissions.length} submissions for student ${studentId}`);

    // Transform the data to match what the frontend expects
    const transformedSubmissions = submissions.map(submission => ({
      _id: submission._id,
      assessment: submission.assessment?._id || submission.assessment,
      assessmentId: submission.assessment?._id || submission.assessment,
      student: submission.student,
      submissionType: submission.submissionType,
      submittedAt: submission.submittedAt,
      status: submission.status,
      originalFilename: submission.originalFileName,
      fileType: submission.mimeType,
      externalAssessmentData: submission.externalAssessmentData,
      result: submission.result || null,
      autoGrading: submission.autoGrading || null
    }));

    res.json(transformedSubmissions);

  } catch (error) {
    console.error('ERROR: Failed to fetch student submissions:', error);
    res.status(500);
    throw new Error(`Failed to fetch submissions: ${error.message}`);
  }
});

// @desc    Get pending submissions for teacher review
// @route   GET /api/submissions/teacher/pending
// @access  Private/Teacher
export const getPendingSubmissions = asyncHandler(async (req, res) => {
  const { courseId, status = 'all' } = req.query;
  
  try {
    // Build filter based on user role and parameters
    let filter = {};
    
    // If courseId is provided, filter by course
    if (courseId) {
      // First get assessments for this course
      const assessments = await Assessment.find({ courseId }).select('_id');
      const assessmentIds = assessments.map(a => a._id);
      filter.assessment = { $in: assessmentIds };
    }
    
    // Filter by status if specified
    if (status !== 'all') {
      filter.status = status;
    }

    const submissions = await Submission.find(filter)
      .populate({
        path: 'student',
        select: 'id firstName lastName email'
      })
      .populate({
        path: 'assessment',
        select: 'name type maxScore dueDate courseId',
        populate: {
          path: 'courseId',
          select: 'name'
        }
      })
      .sort({ submittedAt: -1 })
      .limit(100); // Limit to most recent 100 submissions

    // Transform data for frontend
    const transformedSubmissions = submissions.map(submission => ({
      _id: submission._id,
      student: {
        _id: submission.student._id,
        id: submission.student.id,
        firstName: submission.student.firstName,
        lastName: submission.student.lastName
      },
      assessment: {
        _id: submission.assessment._id,
        name: submission.assessment.name,
        type: submission.assessment.type,
        maxScore: submission.assessment.maxScore,
        dueDate: submission.assessment.dueDate
      },
      submittedAt: submission.submittedAt,
      status: submission.status,
      autoGrading: submission.autoGrading || {
        result: {
          totalScore: 0,
          percentage: 0,
          grade: 'N/A',
          confidence: 0
        }
      }
    }));

    res.json(transformedSubmissions);
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500);
    throw new Error('Failed to fetch pending submissions');
  }
});

// @desc    Get grading statistics
// @route   GET /api/submissions/stats
// @access  Private/Teacher
export const getGradingStats = asyncHandler(async (req, res) => {
  const { courseId, timeframe = '30d' } = req.query;
  
  try {
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30d':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90d':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      default:
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }

    // Build base filter
    let filter = {
      submittedAt: { $gte: startDate }
    };

    // Add course filter if specified
    if (courseId) {
      const assessments = await Assessment.find({ courseId }).select('_id');
      const assessmentIds = assessments.map(a => a._id);
      filter.assessment = { $in: assessmentIds };
    }

    // Get all submissions matching filter
    const submissions = await Submission.find(filter);

    // Calculate statistics
    const totalSubmissions = submissions.length;
    const autoGradedCount = submissions.filter(s => s.autoGrading?.result?.totalScore !== undefined).length;
    const teacherReviewedCount = submissions.filter(s => s.teacherReview?.reviewedAt).length;

    // Calculate average scores and confidence
    const gradedSubmissions = submissions.filter(s => s.autoGrading?.result?.totalScore !== undefined);
    
    let totalScore = 0;
    let totalConfidence = 0;
    let scoredSubmissions = 0;

    gradedSubmissions.forEach(submission => {
      if (submission.autoGrading?.result) {
        totalScore += submission.autoGrading.result.totalScore || 0;
        totalConfidence += submission.autoGrading.result.confidence || 0;
        scoredSubmissions++;
      }
    });

    const averageScore = scoredSubmissions > 0 ? totalScore / scoredSubmissions : 0;
    const averageConfidence = scoredSubmissions > 0 ? totalConfidence / scoredSubmissions : 0;

    const stats = {
      totalSubmissions,
      autoGradedCount,
      teacherReviewedCount,
      averageScore: Math.round(averageScore * 100) / 100,
      averageConfidence: Math.round(averageConfidence * 100) / 100
    };

    res.json(stats);
  } catch (error) {
    console.error('Error calculating grading stats:', error);
    res.status(500);
    throw new Error('Failed to calculate grading statistics');
  }
});

// @desc    Review and update submission
// @route   PUT /api/submissions/:id/review
// @access  Private/Teacher
export const reviewSubmission = asyncHandler(async (req, res) => {
  const { scoreAdjustment, feedbackAdjustment, finalScore, finalGrade } = req.body;
  
  const submission = await Submission.findById(req.params.id)
    .populate('student', 'id firstName lastName')
    .populate('assessment', 'name maxScore');

  if (!submission) {
    res.status(404);
    throw new Error('Submission not found');
  }

  // Update teacher review
  submission.teacherReview = {
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    scoreAdjustment: scoreAdjustment || 0,
    feedbackAdjustment: feedbackAdjustment || '',
    finalScore: finalScore || submission.autoGrading?.result?.totalScore || 0,
    finalGrade: finalGrade || submission.autoGrading?.result?.grade || 'F'
  };

  // Update status to reviewed
  submission.status = 'reviewed';

  await submission.save();

  res.json({
    message: 'Submission reviewed successfully',
    submission
  });
});