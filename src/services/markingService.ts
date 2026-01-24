import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google Generative AI
const MARKING_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!MARKING_API_KEY) {
  throw new Error('GEMINI_API_KEY is required for the marking service');
}

const genAI = new GoogleGenerativeAI(MARKING_API_KEY);

interface MarkingResult {
  marks: number;
  feedback: string;
  criteria: Array<{
    criterion: string;
    score: number;
    comments: string;
  }>;
}

const MARKING_PROMPT = `You are an experienced educator. Please evaluate the submitted assignment based on the following criteria:

1. Content Accuracy (30%): The assignment demonstrates a thorough understanding of the subject matter.
2. Critical Thinking (25%): The assignment shows evidence of analysis, synthesis, and evaluation.
3. Organization (20%): The assignment is well-structured with a clear flow of ideas.
4. Clarity (15%): The assignment is written clearly and is easy to understand.

Provide:
1. An overall score out of 100
2. Detailed feedback for each criterion
3. Areas of strength
4. Areas for improvement

Format your response as JSON with the following structure:
{
  "marks": number,
  "feedback": string,
  "criteria": [
    {
      "criterion": string,
      "score": number,
      "comments": string
    }
  ]
}`;

export const markingService = {
  /**
   * Analyze and mark a document using Google Gemini
   * @param file The file to be analyzed (PDF, DOCX, TXT, etc.)
   * @returns Promise<MarkingResult>
   */
  async markDocument(file: File): Promise<MarkingResult> {
    try {
      // Convert file to base64
      const base64Data = await this.fileToBase64(file);
      
      // Get the appropriate MIME type
      const mimeType = file.type || this.getMimeType(file.name);
      
      // Initialize the model (using gemini-1.5-pro for better document understanding)
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      // Prepare the content parts
      const contents = [
        { text: MARKING_PROMPT },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ];

      // Generate content
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: contents
        }]
      });

      const response = await result.response;
      const text = response.text();

      // Try to parse the response as JSON first, handling potential code blocks
      try {
        // Handle code block formatting (```json ... ```)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*|\s*```$/g, '').trim();
        }
        
        const parsedResponse = JSON.parse(jsonText);
        return this.formatMarkingResult(parsedResponse);
      } catch (e) {
        // Fall back to text extraction if JSON parsing fails
        return this.extractMarksFromText(text);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Failed to mark the document: ${errorMessage}`);
    }
  },

  /**
   * Convert a file to base64
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  },

  /**
   * Get MIME type based on file extension
   */
  getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'odt': 'application/vnd.oasis.opendocument.text',
    };
    return mimeTypes[extension as keyof typeof mimeTypes] || 'application/octet-stream';
  },

  /**
   * Format the marking result to ensure it matches the expected structure
   */
  formatMarkingResult(response: any): MarkingResult {
    // Ensure the response has the correct structure
    const result: MarkingResult = {
      marks: 0,
      feedback: '',
      criteria: []
    };

    if (typeof response.marks === 'number') {
      result.marks = Math.min(100, Math.max(0, response.marks));
    }

    if (typeof response.feedback === 'string') {
      result.feedback = response.feedback;
    }

    if (Array.isArray(response.criteria)) {
      result.criteria = response.criteria.map((item: any) => ({
        criterion: item.criterion || 'Unnamed Criterion',
        score: typeof item.score === 'number' ? Math.min(100, Math.max(0, item.score)) : 0,
        comments: item.comments || ''
      }));
    }

    return result;
  },

  /**
   * Fallback method to extract marks from unstructured text
   */
  extractMarksFromText(text: string): MarkingResult {
    // Try to find a score in the text (e.g., "85/100" or "Score: 85")
    const markMatch = text.match(/(\d+)\s*\/\s*100|score\s*:\s*(\d+)/i);
    const marks = markMatch ? parseInt(markMatch[1] || markMatch[2], 10) : 0;

    return {
      marks,
      feedback: text,
      criteria: [{
        criterion: 'Overall Assessment',
        score: marks,
        comments: 'Automatically extracted from response'
      }]
    };
  }
};

export default markingService;
