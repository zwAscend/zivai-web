import { CalendarEvent, EventFormData } from '../types/calendar';
import { fetchData } from './api';

export const calendarService = {
  // Get all events for the current user
  getEvents: async (startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate.toISOString());
    if (endDate) params.append('end', endDate.toISOString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/calendar/events?${queryString}` : '/calendar/events';
    
    return fetchData<CalendarEvent[]>(endpoint);
  },

  // Get events for a specific course
  getCourseEvents: async (courseId: string): Promise<CalendarEvent[]> => {
    return fetchData<CalendarEvent[]>(`/calendar/events/course/${courseId}`);
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
  getUpcomingEvents: async (limit = 10): Promise<CalendarEvent[]> => {
    return fetchData<CalendarEvent[]>(`/calendar/events/upcoming?limit=${limit}`);
  },

  // Bulk create events (for importing schedules)
  bulkCreateEvents: async (events: Omit<EventFormData, 'id'>[]): Promise<CalendarEvent[]> => {
    return fetchData<CalendarEvent[]>('/calendar/events/bulk', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  },
};