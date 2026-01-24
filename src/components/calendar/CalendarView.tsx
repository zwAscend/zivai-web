import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Filter, 
  Download, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Clock,
  Eye,
  Loader2
} from 'lucide-react';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { Course } from '../../types';
import { calendarService } from '../../services/calendarService';
import { courseService } from '../../services/api';
import EventModal from './EventModal';
import EventDetailsModal from './EventDetailsModal';
import CalendarIntegration from './CalendarIntegration';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '../ui/use-toast';

type EventType = 'lecture' | 'lab' | 'assignment_due' | 'exam' | 'quiz' | 'meeting' | 'office_hours' | 'workshop' | 'seminar' | 'presentation' | 'project_due' | 'holiday';

// Define event types as a constant array for iteration
const EVENT_TYPES: EventType[] = [
  'lecture', 'lab', 'assignment_due', 'exam', 'quiz', 'meeting', 
  'office_hours', 'workshop', 'seminar', 'presentation', 'project_due', 'holiday'
];

const CalendarView: React.FC = () => {
  const { toast } = useToast();
  
  // Ref for FullCalendar API
  const calendarRef = useRef<FullCalendar>(null);
  
  // State management
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for controlled view and title
  const [calendarView, setCalendarView] = useState('dayGridMonth');
  const [calendarTitle, setCalendarTitle] = useState('');

  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Filter states
  const [filterCourse, setFilterCourse] = useState<string>('all');

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [eventsData, coursesData] = await Promise.all([
        loadMockEvents(), // Replace with calendarService.getEvents() when backend is ready
        courseService.getCourses().catch(() => [])
      ]);
      
      setEvents(eventsData);
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  // Mock events for demonstration
  const loadMockEvents = async (): Promise<CalendarEvent[]> => {
    const now = new Date();
    return [
      {
        id: '1',
        title: 'Network Security Lecture',
        description: 'Introduction to Firewalls and Intrusion Detection',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 30),
        type: 'lecture',
        courseId: courses[0]?._id || 'course1',
        courseName: 'HCC301 - Network Security',
        location: 'Room 101',
        color: '#3b82f6',
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        textColor: '#ffffff',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '2',
        title: 'Database Lab Assignment Due',
        description: 'SQL Queries and Normalization Lab',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59),
        type: 'assignment_due',
        courseId: courses[1]?._id || 'course2',
        courseName: 'HCC202 - Database Systems',
        allDay: true,
        color: '#ef4444',
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        textColor: '#ffffff',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '3',
        title: 'Office Hours',
        description: 'Student consultations and Q&A',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 14, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 16, 0),
        type: 'office_hours',
        location: 'Office 205',
        color: '#06b6d4',
        backgroundColor: '#06b6d4',
        borderColor: '#0891b2',
        textColor: '#ffffff',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '4',
        title: 'Mid-term Exam',
        description: 'Comprehensive examination covering chapters 1-5',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 10, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 12, 0),
        type: 'exam',
        courseId: courses[0]?._id || 'course1',
        courseName: 'HCC301 - Network Security',
        location: 'Main Hall',
        color: '#8b5cf6',
        backgroundColor: '#8b5cf6',
        borderColor: '#7c3aed',
        textColor: '#ffffff',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      }
    ];
  };

  // Event handlers
  const handleDateClick = (selectInfo: any) => {
    setSelectedDate(new Date(selectInfo.date));
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = (clickInfo: any) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
      setShowDetailsModal(true);
    }
  };

  const handleEventDrop = async (dropInfo: any) => {
    const event = events.find(e => e.id === dropInfo.event.id);
    if (!event) return;

    const updatedEvent = {
      ...event,
      start: dropInfo.event.start,
      end: dropInfo.event.end || dropInfo.event.start,
    };

    try {
      // Update in backend when ready
      // await calendarService.updateEvent(event.id, updatedEvent);
      
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      toast.success('Event updated successfully');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
      dropInfo.revert();
    }
  };

  const handleCreateEvent = async (eventData: EventFormData) => {
    try {
      const newEvent: CalendarEvent = {
        id: `temp-${Date.now()}`,
        title: eventData.title,
        description: eventData.description,
        start: new Date(eventData.start),
        end: eventData.end ? new Date(eventData.end) : undefined,
        allDay: eventData.allDay,
        type: eventData.type,
        courseId: eventData.courseId || undefined,
        courseName: eventData.courseId ? courses.find(c => c._id === eventData.courseId)?.name : undefined,
        location: eventData.location,
        recurring: eventData.recurring.enabled ? eventData.recurring : undefined,
        reminders: eventData.reminders,
        color: getEventTypeColor(eventData.type),
        backgroundColor: getEventTypeColor(eventData.type),
        borderColor: getEventTypeBorderColor(eventData.type),
        textColor: '#ffffff',
        createdBy: 'current-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create in backend when ready
      // const createdEvent = await calendarService.createEvent(eventData);
      
      setEvents(prev => [...prev, newEvent]);
      setShowEventModal(false);
      toast.success('Event created successfully');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const handleUpdateEvent = async (eventData: EventFormData) => {
    if (!selectedEvent) return;

    try {
      const updatedEvent: CalendarEvent = {
        ...selectedEvent,
        title: eventData.title,
        description: eventData.description,
        start: new Date(eventData.start),
        end: eventData.end ? new Date(eventData.end) : undefined,
        allDay: eventData.allDay,
        type: eventData.type,
        courseId: eventData.courseId || undefined,
        courseName: eventData.courseId ? courses.find(c => c._id === eventData.courseId)?.name : undefined,
        location: eventData.location,
        recurring: eventData.recurring.enabled ? eventData.recurring : undefined,
        reminders: eventData.reminders,
        color: getEventTypeColor(eventData.type),
        backgroundColor: getEventTypeColor(eventData.type),
        borderColor: getEventTypeBorderColor(eventData.type),
        updatedAt: new Date(),
      };

      // Update in backend when ready
      // await calendarService.updateEvent(selectedEvent.id, eventData);
      
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? updatedEvent : e));
      setShowEventModal(false);
      setShowDetailsModal(false);
      toast.success('Event updated successfully');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      // Delete from backend when ready
      // await calendarService.deleteEvent(eventId);
      
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setShowDetailsModal(false);
      toast.success('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  // Filter events based on current filters
  const filteredEvents = events.filter(event => {
    if (filterCourse !== 'all' && event.courseId !== filterCourse) return false;
    return true;
  });

  // Convert events to FullCalendar format
  const calendarEvents = filteredEvents.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    backgroundColor: event.backgroundColor,
    borderColor: event.borderColor,
    textColor: event.textColor,
    extendedProps: {
      type: event.type,
      courseId: event.courseId,
      courseName: event.courseName,
      location: event.location,
      description: event.description,
    },
  }));

  // Event type colors
  const getEventTypeColor = (type: EventType): string => {
    const colors = {
      lecture: '#3b82f6',
      lab: '#10b981',
      assignment_due: '#ef4444',
      exam: '#8b5cf6',
      quiz: '#f59e0b',
      meeting: '#6b7280',
      office_hours: '#06b6d4',
      workshop: '#6366f1',
      seminar: '#ec4899',
      presentation: '#eab308',
      project_due: '#dc2626',
      holiday: '#059669',
    } as Record<EventType, string>;
    return colors[type] || '#6b7280';
  };

  const getEventTypeBorderColor = (type: EventType): string => {
    const colors = {
      lecture: '#2563eb',
      lab: '#059669',
      assignment_due: '#dc2626',
      exam: '#7c3aed',
      quiz: '#d97706',
      meeting: '#4b5563',
      office_hours: '#0891b2',
      workshop: '#4f46e5',
      seminar: '#db2777',
      presentation: '#ca8a04',
      project_due: '#b91c1c',
      holiday: '#047857',
    } as Record<EventType, string>;
    return colors[type] || '#4b5563';
  };

  // Handlers for custom header controls
  const handleChangeView = (view: string) => {
    setCalendarView(view);
    calendarRef.current?.getApi().changeView(view);
  };

  const handleNav = (action: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    
    switch (action) {
      case 'prev':
        api.prev();
        break;
      case 'next':
        api.next();
        break;
      case 'today':
        api.today();
        break;
    }
  };

  const handleOpenNewEventModal = () => {
    setSelectedEvent(null);
    setSelectedDate(new Date());
    setShowEventModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72 bg-white rounded-lg shadow">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // New render function for event content to make text smaller
  const renderEventContent = (eventInfo: any) => {
    return (
      <div className="text-[10px] p-0.5 overflow-hidden leading-tight">
        {eventInfo.timeText && <b className="font-semibold mr-0.5">{eventInfo.timeText}</b>}
        <span className="truncate">{eventInfo.event.title}</span>
      </div>
    )
  }

return (
    <div className="flex flex-col h-[75vh] overflow-hidden bg-gray-50 p-2">

      {/* Unified Custom Header with All Controls */}
      <header className="bg-white border-b border-gray-200 p-2 flex items-center justify-between z-10 flex-shrink-0">
        {/* Left Side: Nav, Title */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-sm"
            onClick={() => handleNav('today')}
          >
            Today
          </Button>
          <div className="flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-7 border-r rounded-r-none"
              onClick={() => handleNav('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-7 rounded-l-none"
              onClick={() => handleNav('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold text-gray-800 ml-3 calendar-header-title">
            {calendarTitle}
          </h2>
        </div>
        
        {/* Right Side: Filters, View Switcher, Settings, New Event */}
        <div className="flex items-center gap-2">
          
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course._id} value={course._id}>
                  {course.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[
              { view: 'dayGridMonth', label: 'Month' },
              { view: 'timeGridWeek', label: 'Week' },
              { view: 'timeGridDay', label: 'Day' },
              { view: 'listWeek', label: 'Agenda' },
            ].map(item => (
              <button
                key={item.view}
                onClick={() => handleChangeView(item.view)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  calendarView === item.view
                    ? 'bg-white shadow text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowIntegrationModal(true)}
            className="w-8 h-8"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNewEventModal}
            className="h-8 bg-blue-600 hover:bg-blue-700 shadow-sm text-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            New
          </Button>
        </div>
      </header>

      {/* Calendar Area */}
      <main className="flex-1 overflow-hidden p-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 h-full">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            headerToolbar={false}
            initialView={calendarView}
            editable={true}
            selectable={true}
            selectMirror={true}
            weekends={true}
            events={calendarEvents}
            select={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventDrop}
            datesSet={(arg) => setCalendarTitle(arg.view.title)}
            eventDisplay="block"
            displayEventTime={true}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
            titleFormat={{ year: 'numeric', month: 'long' }}
            eventClassNames="cursor-pointer hover:opacity-80 transition-opacity"
            dayCellClassNames={() => 'text-xs p-1'}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={true}
            nowIndicator={true}
            scrollTime="08:00:00"
            eventOverlap={false}
            slotEventOverlap={false}
            
            // --- Compact Props ---
            height="100%"
            dayMaxEvents={4}            // show up to 4 events per day before +n
            dayMaxEventRows={4}       // limit event rows within each day cell
            eventContent={renderEventContent}
          />
        </div>
      </main>

      {/* Modals */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
          setSelectedDate(null);
        }}
        onSave={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        onDelete={selectedEvent ? handleDeleteEvent : undefined}
        event={selectedEvent}
        courses={courses}
        selectedDate={selectedDate}
      />

      <EventDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onEdit={(event) => {
          setSelectedEvent(event);
          setShowDetailsModal(false);
          setShowEventModal(true);
        }}
        onDelete={handleDeleteEvent}
        canEdit={true}
      />

      <AnimatePresence>
        {showIntegrationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <CalendarIntegration onClose={() => setShowIntegrationModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarView;
