import asyncHandler from '../utils/asyncHandler.js';
import Plan from '../models/planModel.js';
import CourseAttribute from '../models/courseAttributeModel.js';
import StudentAttribute from '../models/studentAttributeModel.js';
import StudentPlan from '../models/studentPlanModel.js';
import Course from '../models/courseModel.js'; // Ensure Course model is imported
import Student from '../models/studentModel.js';
import path from 'path';
import fs from 'fs';
 import { fileURLToPath } from 'url';import User from '../models/userModel.js'; // Assuming 'User' for teacher reference

// @desc    Create a new Course
// @route   POST /api/development/courses
// @access  Private/Teacher/Admin (adjust based on your auth)
export const createCourse = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;

  // Ensure the user is either an admin or a teacher
  if (!req.user?.isAdmin && !req.user?.isTeacher) {
    res.status(403);
    throw new Error('Only teachers or admins are allowed to create courses.');
  }

  // Basic field validation
  if (!name || !code || !description) {
    res.status(400);
    throw new Error('Please enter all required fields: name, code, and description.');
  }

  // Check for duplicate course code
  const courseExists = await Course.findOne({ code });
  if (courseExists) {
    res.status(400);
    throw new Error(`Course with code '${code}' already exists.`);
  }

  // Create the course with the logged-in user's ID as the teacher
  const course = await Course.create({
    name,
    code,
    description,
    teacher: req.user._id,
  });

  if (course) {
    res.status(201).json({
      _id: course._id,
      name: course.name,
      code: course.code,
      description: course.description,
      teacher: course.teacher,
      createdAt: course.createdAt,
    });
  } else {
    res.status(400);
    throw new Error('Invalid course data provided.');
  }
});


// Get course attributes
// @desc    Get course attributes
// @route   GET /api/development/attributes/course/:courseId
// @access  Private
export const getCourseAttributes = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    
    // Ensure the course exists before trying to fetch attributes for it
    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        res.status(404);
        throw new Error('Course not found');
    }

    const attributes = await CourseAttribute.find({ courseId })
        .sort('category name');
    
    res.json(attributes);
});

// Create course attribute
// @desc    Create course attribute
// @route   POST /api/development/attributes/course
// @access  Private/Teacher
export const createCourseAttribute = asyncHandler(async (req, res) => {
    const { name, description, category, courseId } = req.body;
    
    // Ensure the course exists before creating an attribute for it
    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        res.status(404);
        throw new Error('Course not found');
    }

    // Optional: Check for duplicate attribute name within the same course
    const existingAttribute = await CourseAttribute.findOne({ name, courseId });
    if (existingAttribute) {
        res.status(400);
        throw new Error(`Attribute with name '${name}' already exists for this course.`);
    }

    const attribute = await CourseAttribute.create({
        name,
        description,
        category,
        courseId
    });
    
    res.status(201).json(attribute);
});

// Get student attributes for a course
// @desc    Get student attributes for a course
// @route   GET /api/development/attributes/student/:studentId/course/:courseId
// @access  Private
export const getStudentAttributes = asyncHandler(async (req, res) => {
    const { studentId, courseId } = req.params;
    
    // Validate student and course existence
    const studentExists = await Student.findById(studentId);
    const courseExists = await Course.findById(courseId);
    if (!studentExists) {
        res.status(404);
        throw new Error('Student not found');
    }
    if (!courseExists) {
        res.status(404);
        throw new Error('Course not found');
    }

    // Find all CourseAttributes for the given courseId
    const courseAttributes = await CourseAttribute.find({ courseId }).select('_id');
    const courseAttributeIds = courseAttributes.map(attr => attr._id);

    // Find StudentAttributes where student matches and attribute ID is in the list of course attributes
    const attributes = await StudentAttribute.find({
        student: studentId,
        attribute: { $in: courseAttributeIds }
    }).populate('attribute'); // Populate the actual CourseAttribute details
    
    res.json(attributes);
});

// Update student attributes
// @desc    Update student attributes (current/potential scores)
// @route   PUT /api/development/attributes/student/:studentId
// @access  Private
export const updateStudentAttributes = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const updates = req.body; // Expects an array of { attributeId, current, potential }

    if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400);
        throw new Error('Invalid update data provided. Expected an array of attributes.');
    }

    const studentExists = await Student.findById(studentId);
    if (!studentExists) {
        res.status(404);
        throw new Error('Student not found');
    }
    
    const results = await Promise.all(
        updates.map(async ({ attributeId, current, potential, courseId }) => {
            // Validate attributeId exists
            const courseAttribute = await CourseAttribute.findById(attributeId);
            if (!courseAttribute) {
                // You might choose to throw an error or just skip this update
                console.warn(`Attribute ID ${attributeId} not found.`);
                return null; // Return null for invalid attributes
            }

            return StudentAttribute.findOneAndUpdate(
                { student: studentId, attribute: attributeId },
                { 
                    current: current, 
                    potential: potential, 
                    lastAssessed: Date.now(),
                    // Optionally store courseId here if student attributes are context-specific
                    // course: courseId // Assuming StudentAttribute model has a 'course' field
                },
                { new: true, upsert: true } // 'upsert: true' creates if not found
            ).populate('attribute');
        })
    );
    
    // Filter out any null results from invalid attributeIds
    res.json(results.filter(r => r !== null));
});

// Get course plans
// @desc    Get all plans for a specific course
// @route   GET /api/development/plans/course/:courseId
// @access  Private
export const getCoursePlans = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        res.status(404);
        throw new Error('Course not found');
    }
    
    const plans = await Plan.find({ courseId });
    
    res.json(plans);
});

// Create course plan
// @desc    Create a new plan for a course
// @route   POST /api/development/plans/course
// @access  Private/Teacher
export const createCoursePlan = asyncHandler(async (req, res) => {
    const { name, description, courseId, steps } = req.body;

    if (!name || !description || !courseId || !steps || !Array.isArray(steps)) {
        res.status(400);
        throw new Error('Missing required fields: name, description, courseId, and steps array.');
    }

    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        res.status(404);
        throw new Error('Course not found');
    }

    const plan = await Plan.create(req.body); // Directly use req.body if schema matches
    res.status(201).json(plan);
});

// @desc    Get active plan for a student in a specific course context
// @route   GET /api/development/plans/student/:studentId/course/:courseId
// @access  Private
export const getStudentPlan = asyncHandler(async (req, res) => {
  const { studentId, courseId } = req.params;

  // Validate student existence
  const studentExists = await Student.findById(studentId);
  if (!studentExists) {
    res.status(404);
    throw new Error('Student not found');
  }

  // Validate course existence
  const courseExists = await Course.findById(courseId);
  if (!courseExists) {
    res.status(404);
    throw new Error('Course not found');
  }

  // Find all active plans for the student and populate their plan references
  const activePlans = await StudentPlan.find({
    student: studentId,
    status: 'Active'
  }).populate('plan');

  // Filter to the plan that matches the courseId
  const studentPlan = activePlans.find(p => 
    p.plan && p.plan.courseId.toString() === courseId
  );

  if (!studentPlan) {
    res.status(404);
    throw new Error('No active plan found for this student in this course.');
  }

  // Return the matching active student plan
  res.json(studentPlan);
});

// @desc    Get all plans assigned to a student with optional filters
// @route   GET /api/development/plans/student/:studentId
// @access  Private
export const getAllPlansForStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { status, courseId, dateFrom, dateTo } = req.query;

  const studentExists = await Student.findById(studentId);
  if (!studentExists) {
    res.status(404);
    throw new Error('Student not found');
  }

  // Build filter
  const query = { student: studentId };
  if (status) query.status = status;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Join with plan to filter by courseId if needed
  let plans = await StudentPlan.find(query).populate('plan').sort({ createdAt: -1 });

  if (courseId) {
    plans = plans.filter((sp) => sp.plan && sp.plan.courseId.toString() === courseId);
  }

  res.json(plans);
});


// Assign plan to student
// @desc    Assign a plan to a student, deactivating previous one
// @route   POST /api/development/plans/student/:studentId/assign
// @access  Private/Teacher
export const assignPlanToStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { planId, courseId } = req.body; // planId and courseId are required

    if (!planId || !courseId) {
        res.status(400);
        throw new Error('Plan ID and Course ID are required.');
    }

    const studentExists = await Student.findById(studentId);
    const planExists = await Plan.findById(planId);
    if (!studentExists) {
        res.status(404);
        throw new Error('Student not found');
    }
    if (!planExists) {
        res.status(404);
        throw new Error('Plan not found');
    }
    
    // Deactivate current active plan for this student (if any)
    await StudentPlan.findOneAndUpdate(
        { student: studentId, status: 'Active' },
        { status: 'Completed', completionDate: Date.now() },
        { new: true } // Return the updated document if found
    );
    
    // Create new student-specific plan record
    const studentPlan = await StudentPlan.create({
        student: studentId,
        plan: planId, // Reference to the Plan document
        courseId: courseId, // Reference to the Course document
        startDate: Date.now(),
        status: 'Active'
    });
    
    // Update student's active plan reference
    await Student.findByIdAndUpdate(
        studentId, 
        { activePlan: studentPlan._id },
        { new: true }
    );
    
    await studentPlan.populate('plan'); // Populate the linked Plan document
    res.status(201).json(studentPlan);
});

// @desc    Update any field in a student's assigned plan
// @route   PUT /api/development/plans/student/:studentId/:planId
// @access  Private/Teacher
export const updateStudentPlan = asyncHandler(async (req, res) => {
  const { studentId, planId } = req.params;
  const updates = req.body;

  if (!updates || Object.keys(updates).length === 0) {
    res.status(400);
    throw new Error('No update data provided.');
  }

  const allowedFields = ['status', 'currentProgress', 'skillProgress', 'startDate', 'completionDate', 'feedback']; // Extend as needed

  // Sanitize updates: only allow permitted fields
  const sanitizedUpdates = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    res.status(400);
    throw new Error('No valid fields provided for update.');
  }

  const updatedPlan = await StudentPlan.findOneAndUpdate(
    { _id: planId, student: studentId },
    sanitizedUpdates,
    { new: true }
  ).populate('plan');

  if (!updatedPlan) {
    res.status(404);
    throw new Error('Student plan not found');
  }

  res.status(200).json({
    message: 'Student plan updated successfully.',
    updatedPlan,
  });
});


// @desc    Assign multiple plans to a student
// @route   POST /api/development/plans/student/:studentId/assign-multiple
// @access  Private/Teacher
export const assignMultiplePlansToStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { planIds } = req.body; // expects an array of plan _id strings

  if (!Array.isArray(planIds) || planIds.length === 0) {
    res.status(400);
    throw new Error('An array of planIds is required.');
  }

  // Verify student exists
  const student = await Student.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found.');
  }

  // Verify all plans exist
  const plans = await Plan.find({ _id: { $in: planIds } });
  if (plans.length !== planIds.length) {
    res.status(400);
    throw new Error('One or more plans not found.');
  }

  // Assign plans: only create if not already assigned
  const assignedPlans = [];
  for (const planId of planIds) {
    let studentPlan = await StudentPlan.findOne({ student: studentId, plan: planId });
    if (!studentPlan) {
      studentPlan = await StudentPlan.create({
        student: studentId,
        plan: planId,
        status: 'On Hold',  // default status
        startDate: null      // not started yet
      });
    }
    assignedPlans.push(studentPlan);
  }

  res.status(201).json({
    message: `Assigned ${assignedPlans.length} plans to student ${studentId}`,
    assignedPlans,
  });
});



// Update student plan progress
// @desc    Update progress of a student's active plan
// @route   PUT /api/development/plans/student/:studentId/:planId/progress
// @access  Private
export const updatePlanProgress = asyncHandler(async (req, res) => {
    const { studentId, planId } = req.params; // planId here refers to the StudentPlan's _id
    const { currentProgress, skillProgress } = req.body;

    if (currentProgress === undefined && skillProgress === undefined) {
        res.status(400);
        throw new Error('No progress data provided.');
    }
    
    const studentPlan = await StudentPlan.findOneAndUpdate(
        { _id: planId, student: studentId, status: 'Active' }, // Find by StudentPlan's _id and student
        {
            currentProgress,
            skillProgress,
            ...(currentProgress === 100 ? { 
                status: 'Completed', // Mark as completed if progress is 100
                completionDate: Date.now()
            } : {})
        },
        { new: true } // Return the updated document
    ).populate('plan'); // Populate the linked Plan document
    
    if (!studentPlan) {
        res.status(404);
        throw new Error('Student plan not found or not active');
    }
    
    res.json(studentPlan);
});

// POST /api/development/plans/load-fixtures
// @desc Load plan fixtures from JSON file into DB
// @access Private/Teacher
export const loadDevelopmentFixtures = asyncHandler(async (req, res) => {
  // Only allow teacher/admin
  if (!req.user?.isTeacher && !req.user?.isAdmin) {
    res.status(403);
    throw new Error('Access denied. Only teachers or admins can load fixtures.');
  }
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, '../data/plans.json');


  // Read and parse JSON file
  const fileData = fs.readFileSync(filePath, 'utf-8');
  const plans = JSON.parse(fileData);

  if (!Array.isArray(plans)) {
    res.status(400);
    throw new Error('Invalid plans.json file: must be an array of plan objects.');
  }

  // Optionally, you can clear existing plans before loading
  // await Plan.deleteMany({});

  // Insert plans into DB
  const insertedPlans = await Plan.insertMany(plans);

  res.status(201).json({
    message: `Successfully inserted ${insertedPlans.length} development plans.`,
    insertedPlans
  });
});
