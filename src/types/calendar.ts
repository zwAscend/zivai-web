export interface CalendarRecurringConfig {
  enabled?: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  endDate?: Date | string;
}

export interface CalendarReminderConfig {
  time: number;
  type: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  type: EventType;
  subjectId?: string;
  subjectName?: string;
  location?: string;
  attendees?: string[];
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  recurring?: CalendarRecurringConfig;
  reminders?: CalendarReminderConfig[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EventType = 
  | 'lesson'
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
  subjectId: string;
  location: string;
  recurring: Required<Omit<CalendarRecurringConfig, 'endDate'>> & { endDate: string };
  reminders?: CalendarReminderConfig[];
  createdBy?: string;
  schoolId?: string;
}

export interface CalendarView {
  name: string;
  type: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
  buttonText: string;
}
