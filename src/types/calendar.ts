export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  type: EventType;
  courseId?: string;
  courseName?: string;
  location?: string;
  attendees?: string[];
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EventType = 
  | 'lecture' 
  | 'lab' 
  | 'assignment_due' 
  | 'exam' 
  | 'meeting' 
  | 'office_hours' 
  | 'holiday' 
  | 'workshop' 
  | 'seminar'
  | 'project_due'
  | 'quiz'
  | 'presentation';

export interface EventFormData {
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  type: EventType;
  courseId: string;
  location: string;
  recurring?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate: string;
  };
}

export interface CalendarView {
  name: string;
  type: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
  buttonText: string;
}