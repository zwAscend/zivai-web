import { CalendarEvent, EventFormData } from '../types/calendar';
import { fetchData } from './api';

export const calendarService = {
  // Get all events for the current user
  getEvents: async (startDate?: Date, endDate?: Date, studentId?: string): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate.toISOString());
    if (endDate) params.append('end', endDate.toISOString());
    if (studentId) params.append('studentId', studentId);
    
    const queryString = params.toString();
    const endpoint = queryString ? `/calendar/events?${queryString}` : '/calendar/events';
    
    return fetchData<CalendarEvent[]>(endpoint, { cacheTtlMs: 30 * 1000 });
  },

  // Get events for a specific subject
  getSubjectEvents: async (subjectId: string, studentId?: string): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams();
    if (studentId) params.append('studentId', studentId);
    const query = params.toString();
    return fetchData<CalendarEvent[]>(`/calendar/events/subject/${subjectId}${query ? `?${query}` : ''}`, {
      cacheTtlMs: 30 * 1000,
    });
  },

  // Create a new event
  createEvent: async (eventData: Omit<EventFormData, 'id'>): Promise<CalendarEvent> => {
    return fetchData<CalendarEvent>('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  // Update an existing event
  updateEvent: async (id: string, eventData: Partial<EventFormData>): Promise<CalendarEvent> => {
    return fetchData<CalendarEvent>(`/calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    });
  },

  // Delete an event
  deleteEvent: async (id: string): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/calendar/events/${id}`, {
      method: 'DELETE',
    });
  },

  // Get upcoming events (next 7 days)
  getUpcomingEvents: async (limit = 10, studentId?: string): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (studentId) params.append('studentId', studentId);
    return fetchData<CalendarEvent[]>(`/calendar/events/upcoming?${params.toString()}`, { cacheTtlMs: 30 * 1000 });
  },

  // Bulk create events (for importing schedules)
  bulkCreateEvents: async (events: Omit<EventFormData, 'id'>[]): Promise<CalendarEvent[]> => {
    return fetchData<CalendarEvent[]>('/calendar/events/bulk', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  },
};
