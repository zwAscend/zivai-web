import { GoogleGenerativeAI } from '@google/generative-ai';
import Course from '../models/courseModel.js';
import CourseAttribute from '../models/courseAttributeModel.js';

// Initialize Google's Generative AI with API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate assessment questions using OpenAI's API
 * @param {Object} params - Parameters for question generation
 * @returns {Promise<Array>} - Array of generated questions
 */
export const generateQuestionsWithAI = async (params) => {
  try {
    // Get course and attribute details for better context
    const course = await Course.findById(params.courseId).select('name description').lean();
    
    // Extract attribute IDs, handling both object and string/ID cases
    const attributeIds = params.attributes.map(attr => 
      typeof attr === 'object' && attr !== null ? (attr._id || attr) : attr
    );
    
    const attributes = await CourseAttribute.find({
      _id: { $in: attributeIds }
    }).lean();

    // Prepare the prompt for the AI
    const prompt = buildAIPrompt(params);

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    try {
      // Generate content
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{
              text: `You are an expert educational content creator that generates high-quality assessment questions. ${prompt}`
            }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
        },
      });

      // Get the response
      const response = await result.response;
      const responseText = response.text();
      
      // Parse the response
      let questions;
      try {
        // Extract JSON from markdown code block if present
        const jsonMatch = responseText.match(/```(?:json)?\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : responseText;
        questions = JSON.parse(jsonString);
      } catch (error) {
        console.error('Error parsing AI response:', error);
        throw new Error('Failed to parse AI response');
      }

      // Validate and transform the questions
      return validateAndTransformQuestions(questions);
    } catch (error) {
      console.error('Error generating questions with AI:', error);
      throw new Error(`AI service error: ${error.message}`);
    }
  } catch (error) {
    console.error('Error generating questions with AI:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
};

/**
 * Build the prompt for the AI based on the provided parameters
 * @param {Object} params - Parameters for the prompt
 * @returns {string} - The constructed prompt
 */
const buildAIPrompt = (params) => {
  const { 
    course, 
    attributes, 
    documentText, 
    questionCount = 5, 
    questionTypes = ['multiple_choice', 'short_answer'],
    difficulty = 'medium',
    feedback
  } = params;

  let prompt = `Generate ${questionCount} assessment questions for the course "${course.name}".\n\n`;
  
  // Add course description if available
  if (course.description) {
    prompt += `Course Description: ${course.description}\n\n`;
  }

  // Add learning attributes/objectives
  if (attributes && attributes.length > 0) {
    prompt += 'Learning Objectives/Attributes to assess:\n';
    attributes.forEach(attr => {
      prompt += `- ${attr.name}${attr.description ? `: ${attr.description}` : ''}\n`;
    });
    prompt += '\n';
  }

  // Add document context if available
  if (documentText) {
    // Truncate document text to avoid exceeding token limits
    const truncatedText = documentText.length > 5000 
      ? documentText.substring(0, 5000) + '... [truncated]' 
      : documentText;
    
    prompt += `Document Context:\n${truncatedText}\n\n`;
  }

  // Add question type instructions
  prompt += `Question Types: ${questionTypes.join(', ')}\n`;
  prompt += `Difficulty Level: ${difficulty}\n\n`;

  // Add feedback for regeneration if available
  if (feedback) {
    prompt += `Feedback on previous questions: ${feedback}\n\n`;
  }

  // Add output format instructions
  prompt += `Return the questions as a JSON array of question objects with the following structure:
  [
    {
      "questionText": "The question text",
      "questionType": "multiple_choice | true_false | short_answer | essay",
      "options": [
        { "text": "Option 1", "isCorrect": true },
        { "text": "Option 2", "isCorrect": false }
      ],
      "correctAnswer": "For short_answer or essay questions, provide a model answer",
      "points": 1,
      "attributes": ["attributeId1", "attributeId2"]
    }
  ]`;

  return prompt;
};

/**
 * Validate and transform the questions from the AI
 * @param {Array} questions - Raw questions from AI
 * @returns {Array} - Validated and transformed questions
 */
const validateAndTransformQuestions = (questions) => {
  if (!Array.isArray(questions)) {
    throw new Error('Expected an array of questions');
  }

  return questions.map((q, index) => {
    // Basic validation
    if (!q.questionText || !q.questionType) {
      throw new Error(`Question at index ${index} is missing required fields`);
    }

    // Transform options if this is a multiple choice or true/false question
    let options = [];
    if (['multiple_choice', 'true_false'].includes(q.questionType)) {
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Question at index ${index} is missing valid options`);
      }
      
      // Ensure at least one correct option
      const hasCorrectOption = q.options.some(opt => opt.isCorrect);
      if (!hasCorrectOption) {
        q.options[0].isCorrect = true; // Auto-correct by marking first option as correct
      }
      
      options = q.options.map(opt => ({
        text: opt.text || 'Option',
        isCorrect: !!opt.isCorrect
      }));
    }

    // Set default points if not provided
    const points = typeof q.points === 'number' && q.points > 0 ? q.points : 1;

    // Ensure attributes is an array of strings
    const questionAttributes = Array.isArray(q.attributes) 
      ? q.attributes.map(a => a.toString())
      : [];

    return {
      questionText: q.questionText,
      questionType: q.questionType,
      options,
      correctAnswer: q.correctAnswer || '',
      points,
      attributes: questionAttributes
    };
  });
};
