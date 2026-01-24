import { fetchData } from './api';
import { DevelopmentPlan, Plan, Student, CourseAttribute, StudentAttributes } from '../types';

// The base URL for the agent service
const AGENT_API_URL = 'http://localhost:8000/api/v1/agents/teacher/plan-generation';

interface GeneratePlanParams {
  student: Student;
  courseId: string;
  attributes: CourseAttribute[];
  studentAttributes: StudentAttributes;
  targetScores: Record<string, number>;
  courseName: string;
}

export const planningService = {
  /**
   * Generate a personalized development plan by calling the agent API
   */
  async generateDevelopmentPlan(params: GeneratePlanParams): Promise<Omit<Plan, '_id'>> {
    try {
      const { student, courseId, courseName, attributes, studentAttributes, targetScores } = params;

      // Prepare the data payload for the API
      const payload = this.preparePayload(student, courseName, courseId, attributes, studentAttributes, targetScores);

      // Make the POST request to the agent API using standard fetch
      const response = await fetch(AGENT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent API failed with status ${response.status}: ${errorText}`);
      }

      const generatedPlan = await response.json();

      // The API returns the full plan, so we just return it
      const { _id, ...planWithoutId } = generatedPlan;
      return planWithoutId;
    } catch (error) {
      console.error('Error generating development plan:', error);
      throw new Error('Failed to generate development plan with agent API');
    }
  },

  /**
   * Prepares the JSON payload for the plan generation API
   */
  preparePayload(
    student: Student,
    courseName: string,
    courseId: string,
    attributes: CourseAttribute[],
    studentAttributes: StudentAttributes,
    targetScores: Record<string, number>
  ): any {
    const attributeDetails = [];
    let currentWeightedScore = student.overall || 0;

    if (studentAttributes) {
      const processedAttributes = Object.entries(studentAttributes).map(([attributeId, attributeData]) => {
        if (!attributeData || typeof attributeData !== 'object') return null;
        
        const attrData = attributeData as any;
        const currentScore = typeof attrData.currentScore === 'number' ? attrData.currentScore :
          typeof attrData.current === 'number' ? attrData.current : 0;
        
        const potentialScore = typeof attrData.potentialScore === 'number' ? attrData.potentialScore :
          typeof attrData.potential === 'number' ? attrData.potential :
            Math.min(100, Math.round(currentScore * 1.2));
        
        const targetScore = targetScores[attributeId] ||
          (potentialScore > currentScore ? potentialScore : Math.min(100, Math.round(currentScore * 1.2)));

        const gap = targetScore - currentScore;
        
        let attributeName = attributeId;
        if (attributes && Array.isArray(attributes)) {
          const matchingAttr = attributes.find(attr =>
            attr.id === attributeId || attr._id === attributeId || attr.attributeId === attributeId
          );
          if (matchingAttr && matchingAttr.name) {
            attributeName = matchingAttr.name;
          }
        }
        if (attributeName === attributeId) {
          attributeName = attributeId.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }

        return {
          name: attributeName,
          currentScore: `${currentScore}%`,
          potentialScore: `${potentialScore}%`,
          targetScore: `${targetScore}%`,
          gap: `${gap}%`,
          weight: `${typeof attrData.weight === 'number' ? attrData.weight : 1}`
        };
      }).filter(Boolean);

      attributeDetails.push(...processedAttributes);
      const totalWeight = attributeDetails.reduce((sum, attr) => sum + parseFloat(attr.weight), 0);
      currentWeightedScore = totalWeight > 0 ? 
        attributeDetails.reduce((sum, attr) => sum + (parseFloat(attr.currentScore) * parseFloat(attr.weight)), 0) / totalWeight
        : student.overall || 0;
    } else {
      console.warn('No valid studentAttributes found or studentAttributes is not an object');
    }

    const sortedAttributes = [...attributeDetails].sort((a, b) => parseFloat(b.gap) - parseFloat(a.gap));

    const payload = {
      firstName: student.firstName,
      lastName: student.lastName,
      courseName,
      courseID: courseId,
      currentOverallScore: `${(student.overall || currentWeightedScore).toFixed(1)}%`,
      potentialOverallScore: `${Math.min(100, Math.round(currentWeightedScore + 10))}%`,
      targetScore: `${Math.max(85, Math.min(100, Math.round(currentWeightedScore + 10)))}%`,
      overallPerformance: student.performance || 'Average',
      overallEngagement: student.engagement || 'Medium',
      attributeDetails: sortedAttributes,
      context: 'Focus on actionable steps, varied resources, and clear goals.',
      referenceDocuments: []
    };

    return payload;
  },

  async assignPlanToStudent(studentId: string, planId: string, courseId: string): Promise<DevelopmentPlan> {
    try {
      const createdPlan = await fetchData<DevelopmentPlan>(`/api/development/plans/student/${studentId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          courseId
        }),
      });
      return createdPlan;
    } catch (error) {
      console.error('Error assigning plan to student:', error);
      throw new Error('Failed to assign development plan to student');
    }
  },

  async updatePlanProgress(developmentPlanId: string, progress: number, skillProgress: Record<string, number>) {
    try {
      const response = await fetchData<DevelopmentPlan>(`/api/development/plans/${developmentPlanId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          progress,
          skillProgress
        }),
      });
      return response;
    } catch (error) {
      console.error('Error updating plan progress:', error);
      throw new Error('Failed to update development plan progress');
    }
  },

  async getStudentDevelopmentPlan(studentId: string): Promise<DevelopmentPlan | null> {
    try {
      return await fetchData<DevelopmentPlan>(`/api/students/${studentId}/development-plan`);
    } catch (error) {
      console.error('Error fetching development plan:', error);
      return null;
    }
  }
};

export default planningService;