import asyncHandler from '../utils/asyncHandler.js';
import Course from '../models/courseModel.js';
import Student from '../models/studentModel.js';

// @desc    Get courses where user is a teacher
// @route   GET /api/courses/teaching
// @access  Private/Teacher
export const getTeachingCourses = asyncHandler(async (req, res) => {
    const courses = await Course.find({ teacher: req.user._id })
        .select('_id name code')
        .sort({ name: 1 });
    
    res.json(courses);
});

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
export const getCourses = asyncHandler(async (req, res) => {
    const courses = await Course.find()
        .select('_id name code teacher')
        .populate('teacher', 'name email')
        .sort({ name: 1 });
    
    res.json(courses);
});

// @desc    Get single course by ID
// @route   GET /api/courses/:id
// @access  Private
// @note    Students can only access if enrolled (via studentId), teachers if teaching the course
// @desc    Get single course by ID
// @route   GET /api/courses/:id
// @access  Private
export const getCourseById = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id)
        .populate('teacher', 'name email');

    if (!course) {
        res.status(404);
        throw new Error('Course not found');
    }

    const user = req.user;

    // ADMIN: Full access
    if (user.isAdmin) {
        return res.json(course);
    }

    // TEACHER: Must match course teacher
    const isTeacherMatch = user.isTeacher && course.teacher._id.toString() === user._id.toString();

    if (user.isTeacher) {
        if (isTeacherMatch) {
            return res.json(course);
        } 
    }

    // STUDENT: Must be enrolled
    if (user.role === 'student' && user.studentId) {
        // Find student by their ID (e.g., 'S000001')
        
        const student = await Student.findOne({ id: user.studentId });

        if (!student) {
            res.status(404);
            throw new Error('Student not found');
        }

        // Check if the student's _id exists in the course's students array
        const isEnrolled = course.students.some(enrolledStudentId => 
            enrolledStudentId.toString() === student._id.toString()
        );

        if (isEnrolled) {
            // First get the student to get their _id
            const student = await Student.findOne({ id: user.studentId });
            if (!student) {
                res.status(404);
                throw new Error('Student not found');
            }

            const courseWithStudent = await Course.findById(req.params.id)
                .populate('teacher', 'name email')
                .populate({
                    path: 'students',
                    match: { _id: student._id },
                    select: 'name email id'
                });
            return res.json(courseWithStudent);
        } 
    }

    // Default denial
    res.status(403);
    throw new Error('Not authorized to access this course');
});

