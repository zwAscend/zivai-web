import { fetchData } from './api';
import { DevelopmentPlan, Plan, Student, SubjectAttribute, StudentAttributes } from '../types';

// The base URL for the agent service
const AGENT_API_URL = 'http://localhost:8000/api/v1/agents/teacher/plan-generation';

interface GeneratePlanParams {
  student: Student;
  subjectId: string;
  attributes: SubjectAttribute[];
  studentAttributes: StudentAttributes;
  targetScores: Record<string, number>;
  subjectName: string;
}

export interface GuidedPlanReferenceDocument {
  documentName: string;
  markdown: string;
}

export interface GuidedPlanCriticalSkill {
  name: string;
  attributeId?: string;
  currentScore?: number | null;
  potentialScore?: number | null;
  targetScore?: number | null;
  gap?: number | null;
  weight?: number | null;
  priority?: number | null;
  reason?: string;
}

export interface GenerateGuidedPlanParams {
  student: Student;
  subjectId: string;
  subjectName: string;
  criticalSkills: GuidedPlanCriticalSkill[];
  stepCount: number;
  stepApproach: 'balanced' | 'practice' | 'intervention';
  objective: string;
  guidance?: string;
  context?: string;
  referenceDocuments?: GuidedPlanReferenceDocument[];
}

export const planningService = {
  /**
   * Generate a personalized development plan by calling the agent API
   */
  async generateDevelopmentPlan(params: GeneratePlanParams): Promise<Omit<Plan, 'id'>> {
    try {
      const { student, subjectId, subjectName, attributes, studentAttributes, targetScores } = params;

      // Prepare the data payload for the API
      const payload = this.preparePayload(student, subjectName, subjectId, attributes, studentAttributes, targetScores);

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
      return generatedPlan as Omit<Plan, 'id'>;
    } catch (error) {
      console.warn('AI plan generation failed, falling back to local plan template:', error);
      return this.generateLocalPlan(params);
    }
  },

  async generateGuidedDevelopmentPlan(params: GenerateGuidedPlanParams): Promise<Omit<Plan, 'id'>> {
    const response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.prepareGuidedPayload(params)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent API failed with status ${response.status}: ${errorText}`);
    }

    const generatedPlan = await response.json();
    return generatedPlan as Omit<Plan, 'id'>;
  },

  /**
   * Local fallback plan generation (no AI dependency)
   */
  generateLocalPlan(params: GeneratePlanParams): Omit<Plan, 'id'> {
    const { subjectId, subjectName, attributes, targetScores, student } = params;

    const skills = (attributes && attributes.length > 0 ? attributes : [
      { id: 'overall', name: 'Overall Performance', description: '' }
    ]).map((attr) => {
      const target = targetScores[attr.id] || 80;
      return {
        name: attr.name || 'Skill',
        score: target,
        subskills: []
      };
    });

    const scoreValues = Object.values(targetScores || {});
    const potentialOverall = scoreValues.length > 0
      ? Math.min(100, Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length))
      : Math.min(100, Math.round((student.overall || 70) * 1.15));

    return {
      name: `${subjectName} Development Plan`,
      description: `Personalized plan for ${student.firstName} ${student.lastName} based on current performance and growth targets.`,
      progress: 0,
      potentialOverall,
      eta: 30,
      performance: student.performance || 'Average',
      skills,
      steps: [
        { title: 'Review core concepts', type: 'document', order: 1 },
        { title: 'Practice targeted exercises', type: 'assignment', order: 2 },
        { title: 'Complete a mastery check', type: 'quiz', order: 3 }
      ],
      subjectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  generateGuidedLocalPlan(params: GenerateGuidedPlanParams): Omit<Plan, 'id'> {
    const criticalSkills = params.criticalSkills.length
      ? [...params.criticalSkills].sort((a, b) => (a.priority || 999) - (b.priority || 999))
      : [{ name: 'Overall Performance', priority: 1 }];
    const stepTypeForApproach = (approach: GenerateGuidedPlanParams['stepApproach'], index: number) => {
      if (approach === 'practice') {
        return (['assignment', 'quiz', 'assessment'] as const)[index % 3];
      }
      if (approach === 'intervention') {
        return (['document', 'document', 'assignment'] as const)[index % 3];
      }
      return (['document', 'assignment', 'quiz'] as const)[index % 3];
    };
    const steps = Array.from({ length: Math.max(1, Math.min(10, params.stepCount || 1)) }).map((_, index) => {
      const skill = criticalSkills[index % criticalSkills.length];
      const type = stepTypeForApproach(params.stepApproach, index);
      return {
        title: `Improve ${skill.name}`,
        type,
        content: [
          `<p><strong>Focus skill:</strong> ${skill.name}</p>`,
          `<p><strong>Objective:</strong> ${params.objective || 'Close the learner skill gap.'}</p>`,
          `<p><strong>Teacher guidance:</strong> ${params.guidance || 'Use scaffolded instruction and short mastery checks.'}</p>`,
        ].join(''),
        order: index + 1,
        link: '',
        additionalResources: [],
      };
    });

    return {
      name: `${params.subjectName} Development Plan`,
      description: `Personalized plan for ${params.student.firstName} ${params.student.lastName} focused on critical skill gaps in ${params.subjectName}.`,
      progress: 0,
      potentialOverall: Math.min(100, Math.round((params.student.overall || 0) + 10)),
      eta: Math.max(7, steps.length * 7),
      performance: params.student.performance || 'Average',
      skills: criticalSkills.slice(0, 4).map((skill) => ({
        name: skill.name,
        score: Math.round(skill.targetScore ?? skill.potentialScore ?? skill.currentScore ?? 75),
        subskills: [
          {
            name: `${skill.name} mastery target`,
            score: Math.round(skill.targetScore ?? skill.potentialScore ?? skill.currentScore ?? 75),
            color: 'yellow' as const,
          },
        ],
      })),
      steps,
      subjectId: params.subjectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Prepares the JSON payload for the plan generation API
   */
  preparePayload(
    student: Student,
    subjectName: string,
    subjectId: string,
    attributes: SubjectAttribute[],
    studentAttributes: StudentAttributes,
    targetScores: Record<string, number>
  ): Record<string, unknown> {
    type AttributeDetail = {
      name: string;
      currentScore: string;
      potentialScore: string;
      targetScore: string;
      gap: string;
      weight: string;
    };
    const attributeDetails: AttributeDetail[] = [];
    let currentWeightedScore = student.overall || 0;

    if (studentAttributes) {
      const processedAttributes = Object.entries(studentAttributes).map(([attributeId, attributeData]) => {
        if (!attributeData || typeof attributeData !== 'object') return null;
        
        const attrData = attributeData as Record<string, unknown>;
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
            attr.id === attributeId || attr.attributeId === attributeId
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
      }).filter((attr): attr is AttributeDetail => attr !== null);

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
      subjectName,
      subjectID: subjectId,
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

  prepareGuidedPayload(params: GenerateGuidedPlanParams): Record<string, unknown> {
    const stepCount = Math.max(1, Math.min(10, params.stepCount || 1));
    const criticalSkills = [...params.criticalSkills]
      .filter((skill) => skill.name?.trim().length)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));

    const selectedSkills = criticalSkills.map((skill, index) => ({
      attributeId: skill.attributeId || `critical-skill-${index + 1}`,
      name: skill.name,
      currentScore: skill.currentScore ?? 0,
      potentialScore: skill.potentialScore ?? skill.targetScore ?? skill.currentScore ?? 0,
      targetScore: skill.targetScore ?? skill.potentialScore ?? Math.min(100, (skill.currentScore ?? 0) + 10),
      gap: skill.gap ?? Math.max(0, (skill.targetScore ?? skill.potentialScore ?? 0) - (skill.currentScore ?? 0)),
      weight: skill.weight ?? 1,
    }));

    return {
      requestContext: {
        studentId: params.student.id,
        subjectId: params.subjectId,
      },
      studentProfile: {
        firstName: params.student.firstName,
        lastName: params.student.lastName,
        email: params.student.email || undefined,
        overallScore: params.student.overall || 0,
        performance: params.student.performance || 'Average',
        engagement: params.student.engagement || 'Medium',
        strength: params.student.strength || undefined,
      },
      subject: {
        id: params.subjectId,
        name: params.subjectName,
      },
      skillSnapshot: {
        selectedSkills,
        criticalSkills: criticalSkills.map((skill, index) => ({
          attributeId: skill.attributeId || `critical-skill-${index + 1}`,
          name: skill.name,
          priority: skill.priority || index + 1,
          gap: skill.gap ?? Math.max(0, (skill.targetScore ?? skill.potentialScore ?? 0) - (skill.currentScore ?? 0)),
          reason: skill.reason || `Priority ${skill.priority || index + 1} focus area.`,
        })),
      },
      planPreferences: {
        name: `${params.subjectName} Development Plan`,
        context: params.context || 'Focus on actionable steps, varied resources, and clear goals.',
        stepCount,
        stepApproach: params.stepApproach,
        objective: params.objective,
        guidance: params.guidance || 'Use scaffolded instruction, concrete examples, focused practice, and short mastery checks.',
      },
      referenceDocuments: params.referenceDocuments || [],
    };
  },

  async assignPlanToStudent(studentId: string, planId: string, subjectId: string): Promise<DevelopmentPlan> {
    try {
      const createdPlan = await fetchData<DevelopmentPlan>(`/development/plans/student/${studentId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          subjectId
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
      const response = await fetchData<DevelopmentPlan>(`/development/plans/${developmentPlanId}/progress`, {
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
      const plans = await fetchData<DevelopmentPlan[]>(`/students/${studentId}/development-plans`);
      if (!Array.isArray(plans) || plans.length === 0) {
        return null;
      }
      return plans[0];
    } catch (error) {
      console.error('Error fetching development plan:', error);
      return null;
    }
  }
};

export default planningService;
