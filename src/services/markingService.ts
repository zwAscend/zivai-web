interface MarkingResult {
  marks: number;
  feedback: string;
  criteria: Array<{
    criterion: string;
    score: number;
    comments: string;
  }>;
}

export const markingService = {
  /**
   * Analyze and mark a document.
   * Gemini is disabled for this project.
   */
  async markDocument(_file: File): Promise<MarkingResult> {
    throw new Error('AI marking is disabled for this project.');
  }
};

export default markingService;
