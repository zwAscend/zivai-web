import { StepType } from '../../../types';
import { StudentActivityFeedItem } from '../../../services/studentService';
import { HomeProgressRow } from './types';

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const resolveActivityStepType = (activityType?: string | null): StepType => {
  const normalized = String(activityType || '').trim().toLowerCase();
  if (normalized.includes('assessment') || normalized.includes('practice') || normalized.includes('attempt')) {
    return 'assignment';
  }
  if (normalized.includes('plan')) {
    return 'document';
  }
  return 'discussion';
};

const resolveProgressPercent = (item: StudentActivityFeedItem): number => {
  if (typeof item.progressPercent === 'number' && Number.isFinite(item.progressPercent)) {
    return clampPercent(item.progressPercent);
  }
  if (
    typeof item.score === 'number' &&
    Number.isFinite(item.score) &&
    typeof item.maxScore === 'number' &&
    Number.isFinite(item.maxScore) &&
    item.maxScore > 0
  ) {
    return clampPercent((item.score / item.maxScore) * 100);
  }
  return 0;
};

const resolveCorrectTotal = (item: StudentActivityFeedItem): string => {
  if (typeof item.correctCount === 'number' && typeof item.totalCount === 'number' && item.totalCount > 0) {
    return `${item.correctCount}/${item.totalCount}`;
  }
  return '–';
};

const parseOccurredAt = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const mapActivityFeedToProgressRows = (
  activityFeed: StudentActivityFeedItem[],
  fallbackSubjectNameById: Map<string, string>
): HomeProgressRow[] => {
  return activityFeed
    .map((item): HomeProgressRow | null => {
      const occurredAt = parseOccurredAt(item.occurredAt);
      if (!occurredAt) return null;
      const subjectName = String(item.subjectName || '').trim()
        || (item.subjectId ? fallbackSubjectNameById.get(item.subjectId) : null)
        || 'General';

      return {
        id: item.id || `${item.activityType}-${item.sourceId || occurredAt.toISOString()}`,
        title: item.title || 'Learning activity',
        subjectName,
        type: resolveActivityStepType(item.activityType),
        activityType: item.activityType || undefined,
        progressPercent: resolveProgressPercent(item),
        date: occurredAt,
        correctTotal: resolveCorrectTotal(item),
        timeMinutes: Math.max(0, Number(item.timeMinutes || 0)),
      };
    })
    .filter((row): row is HomeProgressRow => Boolean(row))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
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
  rows
    .filter((row) => !isLearnStepType(row.type))
    .reduce((total, row) => total + Math.max(0, row.timeMinutes), 0);

export const getProgressTotalLearningMinutes = (rows: HomeProgressRow[]) =>
  rows.reduce((total, row) => total + Math.max(0, row.timeMinutes), 0);

export const formatProgressDate = (date: Date) => {
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
};

export const isLearnStepType = (type: StepType) => type === 'document' || type === 'video' || type === 'discussion';
