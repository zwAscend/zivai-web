import express from 'express';
import { check, validationResult } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import Student from '../models/studentModel.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  // 1. Try to find regular user
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    return res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin,
      isTeacher: user.isTeacher,
      avatar: user.avatar,
      token: generateToken(user._id, user.role, user.studentId),
      role: user.role,
      studentId: user.studentId
    });
  }

  // 2. Try student fallback login
  const student = await Student.findOne({ email });

  if (student) {
    // Allow students to login using their student id as the password (common fallback)
    if (password === student.id) {
      let newStudentUser = await User.findOne({ email });

      if (!newStudentUser) {
        // Auto-register student
        newStudentUser = await User.create({
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          password: password,
          role: 'student',
          studentId: student.id,
        });
      }

      return res.json({
        _id: newStudentUser._id,
        firstName: newStudentUser.firstName,
        lastName: newStudentUser.lastName,
        email: newStudentUser.email,
        role: 'student',
        studentId: student.id,
        token: generateToken(newStudentUser._id, 'student', student.id),
      });
    } else {
      res.status(401);
      throw new Error('Invalid student ID (password)');
    }
  }

  // Final fail
  res.status(401);
  throw new Error('Invalid email or password');
}));


// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  check('firstName', 'First name is required').not().isEmpty(),
  check('lastName', 'Last name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, email, password, studentId } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // If studentId provided, validate and link to existing Student record
  let linkedStudent = null;
  if (studentId) {
    linkedStudent = await Student.findOne({ id: studentId });
    if (!linkedStudent) {
      res.status(400);
      throw new Error('Student ID not found');
    }
    // If student record has an email, ensure it matches the registration email
    if (linkedStudent.email && linkedStudent.email !== email) {
      res.status(400);
      throw new Error('Provided email does not match the student record');
    }
  }

  // Create new user; if linkedStudent exists attach studentId and set role to student
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: linkedStudent ? 'student' : 'student', // keep default 'student' for now
    studentId: linkedStudent ? linkedStudent.id : undefined,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin,
      isTeacher: user.isTeacher,
      role: user.role,
      studentId: user.studentId,
      token: generateToken(user._id, user.role, user.studentId)
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
}));

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (user) {
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin,
      isTeacher: user.isTeacher,
      avatar: user.avatar,
      role: user.role,
      studentId: user.studentId,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}));

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (user) {
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.email = req.body.email || user.email;
    user.avatar = req.body.avatar || user.avatar;
    
    if (req.body.password) {
      user.password = req.body.password;
    }
    
    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      isTeacher: updatedUser.isTeacher,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      studentId: updatedUser.studentId,
      token: generateToken(updatedUser._id, updatedUser.role, updatedUser.studentId)
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}));

// @route   GET /api/auth/users
// @desc    Get all users
// @access  Private/Admin
router.get('/users', protect, admin, asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json(users);
}));

export default router;