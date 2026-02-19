import { DevelopmentPlan, StepType, Subject } from '../../../types';
import { HomeProgressRow } from './types';

interface SubjectPlanPair {
  subject: Subject;
  plan: DevelopmentPlan | null;
}

export const buildHomeProgressRows = (overviewSubjects: SubjectPlanPair[]): HomeProgressRow[] => {
  const rows: HomeProgressRow[] = [];

  overviewSubjects.forEach(({ subject, plan }, subjectIndex) => {
    if (!plan?.plan?.steps?.length) return;

    const sortedSteps = [...plan.plan.steps].sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 5);
    const progressUnits = (Math.max(0, Math.min(100, plan.currentProgress || 0)) / 100) * Math.max(sortedSteps.length, 1);

    sortedSteps.forEach((step, stepIndex) => {
      const date = new Date();
      date.setMinutes(date.getMinutes() - (subjectIndex * 145 + stepIndex * 38 + 12));

      const progressPercent = Math.max(0, Math.min(100, Math.round((progressUnits - stepIndex) * 100)));
      const isScored = step.type === 'quiz' || step.type === 'assignment';
      const scoredCorrect = Math.max(0, Math.min(4, Math.round((progressPercent / 100) * 4)));
      const baseTime = step.type === 'video' ? 0 : step.type === 'document' ? 1 : step.type === 'discussion' ? 2 : 3;

      rows.push({
        id: `${subject.id}-${step.title}-${stepIndex}`,
        title: step.title,
        subjectName: subject.name,
        type: step.type,
        progressPercent,
        date,
        correctTotal: isScored ? `${scoredCorrect}/4` : '–',
        timeMinutes: Math.max(0, baseTime + Math.round(progressPercent / 50)),
      });
    });
  });

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
};

export const filterHomeProgressRows = (
  rows: HomeProgressRow[],
  progressWindow: 'week' | 'month' | 'all',
  progressContentFilter: string,
  progressActivityFilter: 'all' | 'learn' | 'practice'
) => {
  const now = new Date();
  return rows.filter((row) => {
    if (progressWindow === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      if (row.date < weekAgo) return false;
    } else if (progressWindow === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setDate(now.getDate() - 30);
      if (row.date < monthAgo) return false;
    }

    if (progressContentFilter !== 'all' && row.subjectName !== progressContentFilter) {
      return false;
    }

    if (progressActivityFilter === 'learn' && (row.type === 'quiz' || row.type === 'assignment')) {
      return false;
    }

    if (progressActivityFilter === 'practice' && (row.type === 'document' || row.type === 'video' || row.type === 'discussion')) {
      return false;
    }

    return true;
  });
};

export const getProgressExerciseMinutes = (rows: HomeProgressRow[]) =>
  Math.max(12, rows.reduce((total, row) => total + row.timeMinutes, 0));

export const getProgressTotalLearningMinutes = (rows: HomeProgressRow[]) =>
  Math.max(38, rows.reduce((total, row) => total + Math.max(1, row.timeMinutes + (row.progressPercent > 0 ? 1 : 0)), 0));

export const formatProgressDate = (date: Date) => {
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
};

export const isLearnStepType = (type: StepType) => type === 'document' || type === 'video' || type === 'discussion';
