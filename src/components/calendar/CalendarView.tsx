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
} from 'lucide-react';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { Subject } from '../../types';
import { calendarService } from '../../services/calendarService';
import { authService, subjectService } from '../../services/api';
import EventModal from './EventModal';
import EventDetailsModal from './EventDetailsModal';
import CalendarIntegration from './CalendarIntegration';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '../ui/use-toast';

type EventType = 'lesson' | 'lab' | 'assignment_due' | 'exam' | 'quiz' | 'meeting' | 'office_hours' | 'workshop' | 'seminar' | 'presentation' | 'project_due' | 'holiday';

// Define event types as a constant array for iteration
const EVENT_TYPES: EventType[] = [
  'lesson', 'lab', 'assignment_due', 'exam', 'quiz', 'meeting', 
  'office_hours', 'workshop', 'seminar', 'presentation', 'project_due', 'holiday'
];

const CalendarView: React.FC = () => {
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();
  
  // Ref for FullCalendar API
  const calendarRef = useRef<FullCalendar>(null);
  
  // State management
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
  const [filterSubject, setFilterSubject] = useState<string>('all');

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [eventsData, subjectsData] = await Promise.all([
        calendarService.getEvents().catch(() => []),
        subjectService.getSubjects().catch(() => [])
      ]);

      const normalizedEvents = eventsData.map((event) => ({
        ...event,
        start: event.start ? new Date(event.start) : new Date(),
        end: event.end ? new Date(event.end) : undefined,
        color: event.color || getEventTypeColor(event.type),
        backgroundColor: event.backgroundColor || getEventTypeColor(event.type),
        borderColor: event.borderColor || getEventTypeBorderColor(event.type),
        textColor: event.textColor || '#ffffff',
      }));
      
      setEvents(normalizedEvents);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
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
      await calendarService.updateEvent(event.id, {
        title: updatedEvent.title,
        description: updatedEvent.description,
        start: updatedEvent.start instanceof Date ? updatedEvent.start.toISOString() : String(updatedEvent.start),
        end: updatedEvent.end
          ? (updatedEvent.end instanceof Date ? updatedEvent.end.toISOString() : String(updatedEvent.end))
          : '',
        allDay: !!updatedEvent.allDay,
        type: updatedEvent.type,
        subjectId: updatedEvent.subjectId || '',
        location: updatedEvent.location || '',
        recurring: updatedEvent.recurring ? { ...updatedEvent.recurring } : { enabled: false, frequency: 'weekly', interval: 1, endDate: '' },
        reminders: updatedEvent.reminders,
        createdBy: currentUser?.id,
      });

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
      const createdEvent = await calendarService.createEvent({
        ...eventData,
        createdBy: currentUser?.id,
      });
      const normalizedEvent: CalendarEvent = {
        ...createdEvent,
        start: new Date(createdEvent.start),
        end: createdEvent.end ? new Date(createdEvent.end) : undefined,
        color: createdEvent.color || getEventTypeColor(createdEvent.type),
        backgroundColor: createdEvent.backgroundColor || getEventTypeColor(createdEvent.type),
        borderColor: createdEvent.borderColor || getEventTypeBorderColor(createdEvent.type),
        textColor: createdEvent.textColor || '#ffffff',
      };

      setEvents(prev => [...prev, normalizedEvent]);
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
        subjectId: eventData.subjectId || undefined,
        subjectName: eventData.subjectId ? subjects.find(c => c.id === eventData.subjectId)?.name : undefined,
        location: eventData.location,
        recurring: eventData.recurring.enabled ? eventData.recurring : undefined,
        reminders: eventData.reminders,
        color: getEventTypeColor(eventData.type),
        backgroundColor: getEventTypeColor(eventData.type),
        borderColor: getEventTypeBorderColor(eventData.type),
        updatedAt: new Date(),
      };

      await calendarService.updateEvent(selectedEvent.id, {
        ...eventData,
        createdBy: currentUser?.id,
      });

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
      await calendarService.deleteEvent(eventId);

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
    if (filterSubject !== 'all' && event.subjectId !== filterSubject) return false;
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
      subjectId: event.subjectId,
      subjectName: event.subjectName,
      location: event.location,
      description: event.description,
    },
  }));

  // Event type colors
  const getEventTypeColor = (type: EventType): string => {
    const colors = {
      lesson: '#3b82f6',
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
      lesson: '#2563eb',
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
          
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.code}
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
          {loading ? (
            <div className="h-full space-y-3">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-6 bg-slate-200 rounded animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2 h-[calc(100%-2.25rem)]">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="bg-slate-100 border border-slate-200 rounded p-1">
                    <div className="h-3 w-6 bg-slate-200 rounded animate-pulse mb-1" />
                    <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
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
          )}
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
        subjects={subjects}
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
