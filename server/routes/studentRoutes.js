// src/routes/studentRouter.js
import express from 'express';
import { check, validationResult } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import Student from '../models/studentModel.js';
import StudentPlan from '../models/studentPlanModel.js';
import StudentAttribute from '../models/studentAttributeModel.js';
import { protect, teacher } from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   GET /api/students
// @desc    Get all students
// @access  Private/Teacher
router.get('/', protect, teacher, asyncHandler(async (req, res) => {
    const students = await Student.find({});
    res.json(students);
}));

// @route   GET /api/students/:id
// @desc    Get student by ID. Allows a student to get their own data.
// @access  Private/Teacher, Student
router.get('/:id', protect, asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const isTeacher = req.user.isTeacher || req.user.isAdmin;
    const isSelf = req.user.studentId === req.params.id;

    if (!isTeacher && !isSelf) {
        return res.status(403).json({ message: 'Not authorized to view this student.' });
    }

    let student = await Student.findOne({ id: req.params.id });

    if (!student && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(req.params.id);
    }

    if (student) {
        res.json(student);
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
}));

// @route   POST /api/students
// @desc    Create a new student
// @access  Private/Teacher
router.post('/', [
    protect,
    teacher,
    check('id', 'Registration number is required').not().isEmpty(),
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('overall', 'Overall score is required').isNumeric(),
    check('engagement', 'Engagement is required').not().isEmpty(),
    check('strength', 'Strength is required').not().isEmpty(),
    check('performance', 'Performance is required').not().isEmpty(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const studentExists = await Student.findOne({ id: req.body.id });
    if (studentExists) {
        res.status(400);
        throw new Error('Student already exists');
    }

    const { id, firstName, lastName, email, overall, engagement, strength, performance, courses, activePlan } = req.body;

    const student = await Student.create({
        id,
        firstName,
        lastName,
        email,
        overall,
        engagement,
        strength,
        performance,
        courses,
        activePlan
    });

    if (student) {
        res.status(201).json(student);
    } else {
        res.status(400);
        throw new Error('Invalid student data');
    }
}));

// @route   POST /api/students/bulk
// @desc    Create multiple students in bulk
// @access  Private/Teacher
router.post('/bulk', protect, teacher, asyncHandler(async (req, res) => {
    const studentsData = req.body;

    if (!Array.isArray(studentsData) || studentsData.length === 0) {
        return res.status(400).json({ message: 'Request body must be a non-empty array of student objects.' });
    }

    const results = { successes: [], failures: [] };

    for (const studentData of studentsData) {
        const studentIdExists = await Student.findOne({ id: studentData.id });
        const studentEmailExists = await Student.findOne({ email: studentData.email });

        if (studentIdExists || studentEmailExists) {
            let error = '';
            if (studentIdExists) error += `Student with ID '${studentData.id}' already exists. `;
            if (studentEmailExists) error += `Student with email '${studentData.email}' already exists.`;
            results.failures.push({ studentData, error: error.trim() });
            continue;
        }

        try {
            const student = await Student.create(studentData);
            results.successes.push(student);
        } catch (error) {
            results.failures.push({ studentData, error: error.message });
        }
    }

    if (results.successes.length > 0) {
        res.status(201).json({
            message: `Successfully created ${results.successes.length} students.`,
            ...results
        });
    } else {
        res.status(400).json({
            message: `Failed to create any students.`,
            ...results
        });
    }
}));

// @route   PUT /api/students/:id
// @desc    Update a student
// @access  Private/Teacher
router.put('/:id', protect, teacher, asyncHandler(async (req, res) => {
    let student = await Student.findOne({ id: req.params.id });

    if (!student && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(req.params.id);
    }

    if (student) {
        const {
            firstName, lastName, email, overall, engagement, strength, performance,
            courses, activePlan
        } = req.body;

        if (firstName !== undefined) student.firstName = firstName;
        if (lastName !== undefined) student.lastName = lastName;
        if (email !== undefined) student.email = email;
        if (overall !== undefined) student.overall = overall;
        if (engagement !== undefined) student.engagement = engagement;
        if (strength !== undefined) student.strength = strength;
        if (performance !== undefined) student.performance = performance;
        if (courses !== undefined) student.courses = courses;
        if (activePlan !== undefined) student.activePlan = activePlan;

        const updatedStudent = await student.save();
        res.json(updatedStudent);
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
}));

// @route   DELETE /api/students/:id
// @desc    Delete a student
// @access  Private/Teacher
router.delete('/:id', protect, teacher, asyncHandler(async (req, res) => {
    let student = await Student.findOne({ id: req.params.id });

    if (!student && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(req.params.id);
    }

    if (student) {
        await student.deleteOne();
        res.json({ message: 'Student removed' });
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
}));

// @route   GET /api/students/:id/development
// @desc    Get student's development data. Allows a student to get their own data.
// @access  Private/Teacher, Student
router.get('/:id/development', protect, asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    const isSelf = req.user.studentId === req.params.id;

    if (!isTeacher && !isSelf) {
        return res.status(403).json({ message: 'Not authorized to view this data.' });
    }

    let student = await Student.findOne({ id: req.params.id });

    if (!student && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(req.params.id);
    }

    if (student) {
        const studentPlans = await StudentPlan.find({ student: student._id }).populate('plan');
        const studentAttributes = await StudentAttribute.find({ student: student._id }).populate('attribute');

        res.json({
            student: student,
            developmentPlans: studentPlans,
            studentAttributes: studentAttributes
        });
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
}));

export default router;
