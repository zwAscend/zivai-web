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

export type HomePanelKey = 'subjects' | 'progress' | 'profile' | 'teachers';

export interface HomeProgressRow {
  id: string;
  title: string;
  subjectName: string;
  type: StepType;
  progressPercent: number;
  date: Date;
  correctTotal: string;
  timeMinutes: number;
}
