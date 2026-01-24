import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { prompt, feedback, questionsToKeep } = req.body;
    
    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const promptText = `You are a question generator for academic assessments.
Please regenerate questions based on the following feedback:

Feedback: ${feedback || 'No specific feedback provided'}

Previous questions to keep:
${JSON.stringify(questionsToKeep || [], null, 2)}

Generate ${prompt.questionCount || 5} questions with the following parameters:
- Question types: ${(prompt.questionTypes || ['multiple_choice']).join(', ')}
- Difficulty: ${prompt.difficulty || 'medium'}
- Course: ${prompt.courseId || 'N/A'}
- Attributes: ${prompt.attributes?.join(', ') || 'N/A'}

Format the response as a JSON array of question objects with the following structure:
[
  {
    "text": "The question text",
    "type": "question_type",
    "options": ["option1", "option2", ...],
    "correctAnswer": "correct_answer_or_index",
    "explanation": "Explanation of the answer",
    "difficulty": "easy|medium|hard",
    "tags": ["tag1", "tag2", ...]
  },
  ...
]`;

    const result = await model.generateContent(promptText);
    const response = await result.response;
    const generatedText = response.text();

    // Parse the response
    const jsonMatch = generatedText.match(/```(?:json)?\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : generatedText;
    const questions = JSON.parse(jsonString);

    // Format the response
    const formattedQuestions = questions.map((q: any, index: number) => ({
      _id: `temp_${Date.now()}_${index}`,
      text: q.text,
      type: q.type || 'multiple_choice',
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      difficulty: q.difficulty || prompt.difficulty || 'medium',
      tags: [...(q.tags || []), ...(prompt.attributes || [])],
      points: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    res.status(200).json(formattedQuestions);
  } catch (error) {
    console.error('Error regenerating questions:', error);
    res.status(500).json({ error: 'Failed to regenerate questions' });
  }
}
