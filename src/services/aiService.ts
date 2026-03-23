import { fetchData } from './api';
import { buildAiAgentsUrl, ensureAiBackendReady } from './aiBackend';
import { Assessment, SubjectAttribute, Question } from '../types';

interface AttributeInput {
  id: string;
  name: string;
  description?: string;
}

interface GenerateQuestionsParams {
  subjectId: string;
  subjectName?: string;
  attributes: Array<string | AttributeInput>;
  documentId?: string;
  questionCount?: number;
  questionTypes?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  context?: string;
  tags?: string[];
  uploadedFiles?: File[];
  referenceDocuments?: Array<{
    documentName: string;
    markdown: string;
  }>;
}

interface RegenerateQuestionsParams {
  prompt: any;
  feedback?: string;
  questionsToKeep?: any[];
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface OCRDocument {
  documentName: string;
  markdown: string;
  file_id?: string;
  file_url?: string;
  view_url?: string;
}

interface AssessmentGenerationRequest {
  context: string;
  subjectName?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionTypes: 'multiple_choice' | 'structured' | 'mixed';
  numberOfQuestions: number;
  attributes: Record<string, any>;
  referenceDocuments: Array<{
    documentName: string;
    markdown: string;
  }>;
  tags: string[];
}

// API endpoints for the new assessment generation service
const ASSESSMENT_API_BASE = buildAiAgentsUrl('/');
const OCR_ENDPOINT = `${ASSESSMENT_API_BASE}/ocr/general`;
const ASSESSMENT_GENERATION_ENDPOINT = `${ASSESSMENT_API_BASE}/teacher/assessment-generation`;

export const aiService = {

  /**
   * Process uploaded documents using OCR
   */
  processDocumentsWithOCR: async (files: File[]): Promise<OCRDocument[]> => {
    try {
      await ensureAiBackendReady();
      const ocrResults: OCRDocument[] = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('files', file, file.name);
        
        const response = await fetch(OCR_ENDPOINT, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`OCR processing failed for ${file.name}: ${response.statusText}`);
        }
        
        const result = await response.json();
        ocrResults.push(...result);
      }
      
      return ocrResults;
    } catch (error) {
      console.error('Error processing documents with OCR:', error);
      throw new Error('Failed to process documents with OCR');
    }
  },

  /**
   * Generate assessment questions using the new AI API
   */
  generateQuestions: async (params: GenerateQuestionsParams): Promise<Question[]> => {
    try {
      await ensureAiBackendReady();
      console.log('Generating questions with new API, params:', params);
      
      // Check if params.attributes is an array of strings (IDs) or objects with name property
      const isArrayOfStrings = params.attributes.length > 0 && typeof params.attributes[0] === 'string';
      
      let attributeNames: string[] = [];
      let attributesObject: Record<string, any> = {};
      
      if (isArrayOfStrings) {
        // If we have attribute IDs, resolve them from the subject attribute catalog.
        let subjectAttributes: SubjectAttribute[] = [];
        try {
          subjectAttributes = await fetchData<SubjectAttribute[]>(
            `/development/attributes/subject/${params.subjectId}`
          );
        } catch (catalogError) {
          console.warn('Failed to load subject attributes for AI generation:', catalogError);
        }

        const subjectAttributeById = new Map(
          (Array.isArray(subjectAttributes) ? subjectAttributes : []).map((attr) => [attr.id, attr])
        );
        const attributes = (params.attributes as string[]).map((attrId) => (
          subjectAttributeById.get(attrId) || { id: attrId, name: `Attribute ${attrId}`, description: '' }
        ));
        attributeNames = attributes.map(attr => attr.name);
        
        // Create attributes object for the API
        attributes.forEach(attr => {
          attributesObject[attr.name] = attr.description || attr.name;
        });
      } else {
        // If we already have objects with name property, just extract the names
        attributeNames = (params.attributes as any[]).map(attr => 
          typeof attr === 'object' && attr !== null ? attr.name || `Attribute ${attr.id || 'unknown'}` : String(attr)
        );
        
        // Create attributes object for the API
        (params.attributes as any[]).forEach(attr => {
          if (typeof attr === 'object' && attr !== null) {
            attributesObject[attr.name || attr.id] = attr.description || attr.name || attr.id;
          }
        });
      }
      
      // Process uploaded documents if any
      let referenceDocuments: Array<{ documentName: string; markdown: string }> = Array.isArray(params.referenceDocuments)
        ? params.referenceDocuments
            .filter((doc) => typeof doc?.documentName === 'string' && typeof doc?.markdown === 'string')
            .map((doc) => ({
              documentName: doc.documentName,
              markdown: doc.markdown,
            }))
        : [];
      if (params.uploadedFiles && params.uploadedFiles.length > 0) {
        console.log('Processing uploaded files:', params.uploadedFiles.map(f => f.name));
        try {
          const ocrResults = await aiService.processDocumentsWithOCR(params.uploadedFiles);
          referenceDocuments = [
            ...referenceDocuments,
            ...ocrResults.map(doc => ({
              documentName: doc.documentName,
              markdown: doc.markdown
            })),
          ];
          console.log('OCR processed documents:', referenceDocuments.length);
        } catch (ocrError) {
          console.error('OCR processing failed:', ocrError);
          // Continue without reference documents if OCR fails
        }
      }

      const uniqueReferenceDocuments = referenceDocuments.filter((doc, index, documents) => {
        const key = `${doc.documentName}:${doc.markdown}`;
        return documents.findIndex((candidate) => `${candidate.documentName}:${candidate.markdown}` === key) === index;
      });

      const normalizedQuestionTypes = Array.isArray(params.questionTypes)
        ? params.questionTypes.map((value) => String(value || '').toLowerCase())
        : [];
      const hasObjectiveQuestions = normalizedQuestionTypes.some((value) =>
        ['multiple_choice', 'mcq', 'true_false'].includes(value)
      );
      const hasStructuredQuestions = normalizedQuestionTypes.some((value) =>
        ['structured', 'short_answer', 'essay'].includes(value)
      );
      const questionTypesMode: 'multiple_choice' | 'structured' | 'mixed' = hasObjectiveQuestions && hasStructuredQuestions
        ? 'mixed'
        : hasStructuredQuestions
          ? 'structured'
          : 'multiple_choice';
      
      // Prepare the request body for the assessment generation API
      const requestBody: AssessmentGenerationRequest = {
        context: params.context || 'Generate classroom-ready assessment questions for ZIMSEC O Level high-school learners. Keep the wording practical, clear, and age-appropriate. Do not generate tertiary-level content.',
        subjectName: params.subjectName,
        difficulty: params.difficulty || 'medium',
        questionTypes: questionTypesMode,
        numberOfQuestions: params.questionCount || 5,
        attributes: Object.keys(attributesObject).length > 0 ? attributesObject : {
          subject: "General Subject",
          topic: attributeNames.join(', ') || "General Topic"
        },
        referenceDocuments: uniqueReferenceDocuments,
        tags: params.tags || [params.subjectName || '', ...attributeNames].filter(Boolean)
      };
      
      console.log('Assessment generation request:', requestBody);
      
      // Make the API call
      const response = await fetch(ASSESSMENT_GENERATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        console.error('Response status:', response.status);
        console.error('Response headers:', response.headers);
        throw new Error(`Assessment generation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const generatedQuestions = await response.json();
      
      // Transform to match the expected Question type
      return generatedQuestions.map((q: any, index: number) => ({
        id: `temp_${Date.now()}_${index}`,
        text: q.text,
        type: q.type || 'multiple_choice',
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        difficulty: q.difficulty || params.difficulty || 'medium',
        tags: [...(q.tags || []), ...attributeNames],
        points: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error generating questions with new AI API:', error);
      throw new Error('Failed to generate questions with AI');
    }
  },

  /**
   * Regenerate questions based on feedback using the new AI API
   */
  regenerateQuestions: async (params: RegenerateQuestionsParams): Promise<Question[]> => {
    try {
      // Use the same generateQuestions method but with feedback context
      const context = `Please regenerate questions based on the following feedback: ${params.feedback || 'No specific feedback provided'}. Previous questions to keep: ${JSON.stringify(params.questionsToKeep || [], null, 2)}`;
      
      const generateParams: GenerateQuestionsParams = {
        subjectId: params.prompt?.subjectId || '',
        attributes: params.prompt?.attributes || [],
        questionCount: params.questionCount || 5,
        questionTypes: params.prompt?.questionTypes || ['multiple_choice'],
        difficulty: params.difficulty || 'medium',
        context
      };
      
      return await aiService.generateQuestions(generateParams);
    } catch (error) {
      console.error('Error regenerating questions with AI:', error);
      throw new Error('Failed to regenerate questions with AI');
    }
  },

  /**
   * Upload a document for AI processing
   */
  uploadDocument: async (file: File, subjectId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', subjectId);

    return fetchData('/resources/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header, let the browser set it with the correct boundary
      headers: {},
    });
  },

  /**
   * Get subject attributes for a specific subject
   */
  getSubjectAttributes: async (subjectId: string): Promise<SubjectAttribute[]> => {
    return fetchData(`/development/attributes/subject/${subjectId}`);
  },

  /**
   * Create a new assessment with AI-generated questions
   */
  createAssessmentWithAI: async (assessmentData: any) => {
    // Convert questions to JSON string if they're an object
    const data = {
      ...assessmentData,
      questions: typeof assessmentData.questions === 'string' 
        ? assessmentData.questions 
        : JSON.stringify(assessmentData.questions),
    };

    return fetchData('/assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an assessment with AI-generated questions
   */
  updateAssessmentWithAI: async (id: string, assessmentData: any) => {
    // Convert questions to JSON string if they're an object
    const data = {
      ...assessmentData,
      questions: assessmentData.questions && typeof assessmentData.questions !== 'string'
        ? JSON.stringify(assessmentData.questions)
        : assessmentData.questions,
    };

    return fetchData(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get an assessment with its questions
   */
  getAssessmentWithQuestions: async (id: string): Promise<Assessment> => {
    return fetchData(`/assessments/${id}/with-questions`);
  },

  /**
   * Get all assessments for a subject
   */
  getSubjectAssessments: async (subjectId: string, status?: string): Promise<Assessment[]> => {
    const url = status 
      ? `/assessments/subject/${subjectId}?status=${status}`
      : `/assessments/subject/${subjectId}`;
      
    return fetchData(url);
  },
};

export default aiService;
