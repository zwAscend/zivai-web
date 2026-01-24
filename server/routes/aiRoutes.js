import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { protect, teacher } from '../middleware/authMiddleware.js';
import CourseAttribute from '../models/courseAttributeModel.js';
import Resource from '../models/resourceModel.js';
import { extractTextFromDocument } from '../services/documentProcessor.js';
import { generateQuestionsWithAI } from '../services/aiService.js';

const router = express.Router();

/**
 * @route   POST /api/ai/generate-questions
 * @desc    Generate assessment questions using AI based on selected attributes and optional document
 * @access  Private/Teacher
 */
router.post('/generate-questions', protect, teacher, asyncHandler(async (req, res) => {
  const { 
    courseId, 
    attributes,  // Array of attribute IDs
    documentId,  // Optional: ID of uploaded document
    questionCount = 5,  // Default to 5 questions
    questionTypes = ['multiple_choice', 'short_answer'],  // Default question types
    difficulty = 'medium'  // Difficulty level
  } = req.body;

  // Validate input
  if (!courseId || !attributes || !Array.isArray(attributes) || attributes.length === 0) {
    res.status(400);
    throw new Error('Course ID and at least one attribute are required');
  }

  // Get attribute details
  const attributeDetails = await CourseAttribute.find({
    _id: { $in: attributes },
    courseId
  });

  if (attributeDetails.length === 0) {
    res.status(404);
    throw new Error('No valid attributes found for the specified course');
  }

  // Extract document text if documentId is provided
  let documentText = '';
  if (documentId) {
    const resource = await Resource.findById(documentId);
    if (!resource) {
      res.status(404);
      throw new Error('Document not found');
    }
    
    // Extract text from document (PDF, DOCX, etc.)
    documentText = await extractTextFromDocument(resource);
  }

  // Prepare prompt for AI
  const prompt = {
    courseId,
    attributes: attributeDetails.map(attr => ({
      name: attr.name,
      description: attr.description,
      category: attr.category
    })),
    documentText,
    questionCount,
    questionTypes,
    difficulty
  };

  // Generate questions using AI
  const questions = await generateQuestionsWithAI(prompt);

  res.json({
    success: true,
    count: questions.length,
    questions
  });
}));

/**
 * @route   POST /api/ai/regenerate-questions
 * @desc    Regenerate questions based on feedback or different parameters
 * @access  Private/Teacher
 */
router.post('/regenerate-questions', protect, teacher, asyncHandler(async (req, res) => {
  const { 
    prompt,  // The original prompt used
    feedback,  // User feedback on previous questions
    questionsToKeep = [],  // Questions to keep (don't regenerate)
    questionCount = 5,  // Number of new questions to generate
    difficulty  // Optional: adjust difficulty
  } = req.body;

  if (!prompt) {
    res.status(400);
    throw new Error('Original prompt is required for regeneration');
  }

  // Update prompt with feedback and other parameters
  const updatedPrompt = {
    ...prompt,
    feedback,
    questionCount,
    ...(difficulty && { difficulty })
  };

  // Generate new questions using AI
  const newQuestions = await generateQuestionsWithAI(updatedPrompt);

  // Combine kept questions with new ones
  const allQuestions = [...questionsToKeep, ...newQuestions];

  res.json({
    success: true,
    count: allQuestions.length,
    questions: allQuestions
  });
}));

export default router;
