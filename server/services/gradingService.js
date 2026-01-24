import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromDocument } from './documentProcessor.js';
import Assessment from '../models/assessmentModel.js';
import Result from '../models/resultModel.js';
import Student from '../models/studentModel.js';
import User from '../models/userModel.js';
import CourseAttribute from '../models/courseAttributeModel.js';

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Automatically grade a submitted assignment using AI
 * @param {Object} params - Grading parameters
 * @returns {Promise<Object>} - Grading result with score, feedback, and breakdown
 */
export const gradeAssignmentWithAI = async (params) => {
  try {
    const { assessmentId, studentId, submissionFile, submissionText } = params;

    // Get assessment details
    const assessment = await Assessment.findById(assessmentId)
      .populate('courseId', 'name description')
      .populate('questions.attributes', 'name description category');

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Extract text from submission if it's a file
    let submissionContent = submissionText || '';
    if (submissionFile && !submissionText) {
      submissionContent = await extractTextFromDocument(submissionFile);
    }

    if (!submissionContent.trim()) {
      throw new Error('No content found in submission');
    }

    // Generate grading prompt
    const prompt = buildGradingPrompt(assessment, submissionContent, student);

    // Get AI model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
      }
    });

    // Generate grading
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const gradingText = response.text();

    // Parse the grading response
    const gradingResult = parseGradingResponse(gradingText, assessment.maxScore);

    // Create detailed breakdown for teacher review
    const breakdown = createGradingBreakdown(gradingResult, assessment);

    return {
      totalScore: gradingResult.totalScore,
      percentage: Math.round((gradingResult.totalScore / assessment.maxScore) * 100),
      grade: calculateGrade(gradingResult.totalScore, assessment.maxScore),
      feedback: gradingResult.feedback,
      breakdown: breakdown,
      criteriaScores: gradingResult.criteriaScores,
      suggestions: gradingResult.suggestions,
      confidence: gradingResult.confidence || 85
    };

  } catch (error) {
    console.error('Error grading assignment with AI:', error);
    throw new Error(`Failed to grade assignment: ${error.message}`);
  }
};

/**
 * Build the grading prompt for AI
 */
const buildGradingPrompt = (assessment, submissionContent, student) => {
  let prompt = `You are an expert educator grading a ${assessment.type.toLowerCase()} submission. Please evaluate this student's work comprehensively.

ASSESSMENT DETAILS:
- Title: ${assessment.name}
- Description: ${assessment.description}
- Type: ${assessment.type}
- Maximum Score: ${assessment.maxScore}
- Course: ${assessment.courseId?.name || 'Unknown Course'}

STUDENT INFORMATION:
- Name: ${student.firstName} ${student.lastName}
- Current Performance Level: ${student.performance || 'Unknown'}
- Overall Score: ${student.overall || 'Unknown'}

SUBMISSION CONTENT:
${submissionContent}

`;

  // Add questions if this is a quiz/test
  if (assessment.questions && assessment.questions.length > 0) {
    prompt += `\nASSESSMENT QUESTIONS:\n`;
    assessment.questions.forEach((q, index) => {
      prompt += `${index + 1}. ${q.questionText} (${q.points} points)\n`;
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, optIndex) => {
          prompt += `   ${String.fromCharCode(97 + optIndex)}) ${opt.text}${opt.isCorrect ? ' [CORRECT]' : ''}\n`;
        });
      }
      if (q.correctAnswer) {
        prompt += `   Correct Answer: ${q.correctAnswer}\n`;
      }
      prompt += '\n';
    });
  }

  prompt += `
GRADING CRITERIA:
1. Content Accuracy (40%): Correctness of information and understanding of concepts
2. Critical Thinking (25%): Analysis, evaluation, and synthesis of ideas
3. Organization & Structure (20%): Logical flow and clear presentation
4. Completeness (15%): Addressing all requirements and thoroughness

INSTRUCTIONS:
- Evaluate the submission against each criterion
- Provide specific, constructive feedback
- Identify strengths and areas for improvement
- Be fair but maintain academic standards
- Consider the student's current performance level for context

Return your evaluation as JSON with this exact structure:
{
  "totalScore": number (0-${assessment.maxScore}),
  "criteriaScores": {
    "contentAccuracy": number (0-40),
    "criticalThinking": number (0-25),
    "organization": number (0-20),
    "completeness": number (0-15)
  },
  "feedback": "Detailed overall feedback",
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "suggestions": "Specific suggestions for improvement",
  "confidence": number (0-100)
}`;

  return prompt;
};

/**
 * Parse the AI grading response
 */
const parseGradingResponse = (gradingText, maxScore) => {
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = gradingText.match(/```(?:json)?\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : gradingText;
    
    const parsed = JSON.parse(jsonString);
    
    // Validate and sanitize the response
    const totalScore = Math.min(maxScore, Math.max(0, parsed.totalScore || 0));
    
    return {
      totalScore,
      criteriaScores: parsed.criteriaScores || {},
      feedback: parsed.feedback || 'No feedback provided',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      suggestions: parsed.suggestions || '',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 85))
    };
  } catch (error) {
    console.error('Error parsing grading response:', error);
    // Fallback grading
    return {
      totalScore: Math.round(maxScore * 0.7), // Default to 70%
      criteriaScores: {},
      feedback: 'Automatic grading completed. Please review manually.',
      strengths: [],
      improvements: [],
      suggestions: 'Manual review recommended',
      confidence: 50
    };
  }
};

/**
 * Create detailed grading breakdown for teacher review
 */
const createGradingBreakdown = (gradingResult, assessment) => {
  const breakdown = {
    assessmentInfo: {
      name: assessment.name,
      type: assessment.type,
      maxScore: assessment.maxScore,
      weight: assessment.weight
    },
    scoring: {
      totalScore: gradingResult.totalScore,
      maxScore: assessment.maxScore,
      percentage: Math.round((gradingResult.totalScore / assessment.maxScore) * 100),
      grade: calculateGrade(gradingResult.totalScore, assessment.maxScore)
    },
    criteria: Object.entries(gradingResult.criteriaScores).map(([criterion, score]) => ({
      name: formatCriterionName(criterion),
      score: score,
      maxScore: getCriterionMaxScore(criterion),
      percentage: Math.round((score / getCriterionMaxScore(criterion)) * 100)
    })),
    feedback: {
      overall: gradingResult.feedback,
      strengths: gradingResult.strengths,
      improvements: gradingResult.improvements,
      suggestions: gradingResult.suggestions
    },
    metadata: {
      gradedAt: new Date(),
      confidence: gradingResult.confidence,
      method: 'AI_GRADING'
    }
  };

  return breakdown;
};

/**
 * Calculate letter grade from score
 */
const calculateGrade = (score, maxScore) => {
  const percentage = (score / maxScore) * 100;
  
  if (percentage >= 90) return 'A+';
  if (percentage >= 85) return 'A';
  if (percentage >= 80) return 'A-';
  if (percentage >= 75) return 'B+';
  if (percentage >= 70) return 'B';
  if (percentage >= 65) return 'B-';
  if (percentage >= 60) return 'C+';
  if (percentage >= 55) return 'C';
  if (percentage >= 50) return 'C-';
  if (percentage >= 45) return 'D+';
  if (percentage >= 40) return 'D';
  if (percentage >= 35) return 'D-';
  return 'F';
};

/**
 * Format criterion name for display
 */
const formatCriterionName = (criterion) => {
  const names = {
    contentAccuracy: 'Content Accuracy',
    criticalThinking: 'Critical Thinking',
    organization: 'Organization & Structure',
    completeness: 'Completeness'
  };
  return names[criterion] || criterion;
};

/**
 * Get maximum score for each criterion
 */
const getCriterionMaxScore = (criterion) => {
  const maxScores = {
    contentAccuracy: 40,
    criticalThinking: 25,
    organization: 20,
    completeness: 15
  };
  return maxScores[criterion] || 25;
};

export default {
  gradeAssignmentWithAI,
  calculateGrade
};