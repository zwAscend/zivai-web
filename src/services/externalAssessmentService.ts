// External Assessment API response types
interface AssessmentCriteria {
  criterion: string;
  score: number;
  feedback: string;
}

interface QuestionAssessment {
  max_marks: number;
  awarded_marks: number;
  feedback: string;
  improvement: string;
}

interface AssessmentData {
  is_correct_module: boolean;
  confidence_assessment_score: number;
  total_possible_marks: number;
  marks_achieved: number;
  marks_percentage: number;
  overall_feedback: string;
  strengths: string[];
  improvements: string[];
  criteria: AssessmentCriteria[];
  assessment_details: Record<string, QuestionAssessment>;
  detected_module: string | null;
  mark_consistency_check: string;
  marking_scheme_used: boolean;
}

export interface AssessmentResponse {
  success: boolean;
  data?: {
    module: string;
    filename?: string;
    content_type?: string;
    ocr_type?: string;
    markdown: string;
    pages?: number;
    assessment: AssessmentData;
    file_id?: string;
    file_url?: string;
    view_url?: string;
  };
  error?: string;
  message?: string;
}

export const externalAssessmentService = {
  assessDocument: async (file: File, moduleName: string): Promise<AssessmentResponse> => {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("module", moduleName);

    // Log request details for debugging
    console.log('External API Request Details:', {
      url: "http://localhost:8000/api/v1/agents/student/assessment",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      moduleName: moduleName
    });

    const requestOptions: RequestInit = {
      method: "POST",
      body: formData,
      redirect: "follow"
    };

    try {
      const response = await fetch("http://localhost:8000/api/v1/agents/student/assessment", requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('External API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        throw new Error(`Assessment API error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      console.log('External API Success Response:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('External Assessment Service Error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to assess document using external service'
      };
    }
  },

  assessText: async (textContent: string, moduleName: string): Promise<AssessmentResponse> => {
    const formData = new FormData();
    formData.append("text", textContent);
    formData.append("module", moduleName);

    // Log request details for debugging
    console.log('External API Text Assessment Request:', {
      url: "http://localhost:8000/api/v1/agents/student/assessment",
      textLength: textContent.length,
      moduleName: moduleName
    });

    const requestOptions: RequestInit = {
      method: "POST",
      body: formData,
      redirect: "follow"
    };

    try {
      const response = await fetch("http://localhost:8000/api/v1/agents/student/assessment", requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('External API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        throw new Error(`Assessment API error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      console.log('External API Text Assessment Success:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('External Text Assessment Service Error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to assess text using external service'
      };
    }
  }
};
