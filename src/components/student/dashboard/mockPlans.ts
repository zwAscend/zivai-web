import { DevelopmentPlan, StepType, Subject } from '../../../types';

const STEP_TYPE_SEQUENCE: StepType[] = ['document', 'assignment', 'quiz', 'discussion', 'video'];

const getMockStepTitles = (subjectName: string): string[] => {
  const name = subjectName.toLowerCase();
  if (name.includes('english')) {
    return [
      'Read short story',
      'Write a paragraph response',
      'Vocabulary reinforcement quiz',
      'Peer discussion reflection',
      'Weekly tutor feedback',
    ];
  }
  if (name.includes('math')) {
    return [
      'Review concept notes',
      'Solve guided examples',
      'Timed practice set',
      'Reasoning checkpoint',
      'Mastery quiz',
    ];
  }
  if (name.includes('physics')) {
    return [
      'Read topic overview',
      'Explain formulas in words',
      'Problem solving set',
      'Experiment reflection',
      'Topic checkpoint quiz',
    ];
  }
  return [
    'Read concept overview',
    'Write understanding summary',
    'Practice exercises',
    'Reasoning dialogue',
    'Mastery checkpoint',
  ];
};

export const buildMockPlan = (subject: Subject, index: number): DevelopmentPlan => {
  const stepTitles = getMockStepTitles(subject.name);
  const progress = 22 + ((index * 17) % 53);
  const steps = stepTitles.map((title, stepIndex) => ({
    title,
    type: STEP_TYPE_SEQUENCE[stepIndex % STEP_TYPE_SEQUENCE.length],
    order: stepIndex + 1,
    link: '',
    additionalResources: [],
  }));

  return {
    id: `mock-plan-${subject.id}`,
    student: 'mock-student',
    plan: {
      id: `mock-plan-template-${subject.id}`,
      name: `${subject.name} Mastery Plan`,
      description: `Structured weekly plan for ${subject.name} with guided practice and coaching.`,
      progress,
      potentialOverall: 85,
      eta: 28,
      performance: 'Good',
      skills: [],
      steps,
      subjectId: subject.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      link: '',
      additionalResources: [],
    },
    startDate: new Date(),
    currentProgress: progress,
    status: 'Active',
    skillProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

// Fallback demo data keeps Home usable when a student has no subject assignments yet.
export const MOCK_SUBJECTS: Subject[] = [
  {
    id: 'mock-subject-math',
    code: 'MTH-01',
    name: 'Mathematics',
    description: 'Numeracy, algebra, and problem solving.',
    teacher: 'mock-teacher',
  },
  {
    id: 'mock-subject-english',
    code: 'ENG-01',
    name: 'English Language',
    description: 'Reading, writing, and communication skills.',
    teacher: 'mock-teacher',
  },
  {
    id: 'mock-subject-physics',
    code: 'PHY-01',
    name: 'Physics',
    description: 'Mechanics, waves, and scientific reasoning.',
    teacher: 'mock-teacher',
  },
  {
    id: 'mock-subject-biology',
    code: 'BIO-01',
    name: 'Biology',
    description: 'Life sciences, systems, and data interpretation.',
    teacher: 'mock-teacher',
  },
];
