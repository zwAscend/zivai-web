import { StepType } from '../../../types';

export type NavItemKey =
  | 'overview'
  | 'plan'
  | 'subjects'
  | 'messages'
  | 'assessments'
  | 'results'
  | 'tutor'
  | 'peer-study'
  | 'profile';

export type HomePanelKey = 'subjects' | 'progress' | 'activities' | 'profile' | 'teachers';

export interface HomeProgressRow {
  id: string;
  title: string;
  subjectName: string;
  type: StepType;
  activityType?: string;
  progressPercent: number;
  date: Date;
  correctTotal: string;
  timeMinutes: number;
}
