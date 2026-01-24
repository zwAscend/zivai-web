import '@fullcalendar/common/main.css';
import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { Calendar as CalendarIcon, Plus, Download, Eye, EyeOff, ChevronLeft, ChevronRight, Clock as Today } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// Define types locally to avoid import conflicts
type EventType = 'lecture' | 'lab' | 'assignment_due' | 'exam' | 'quiz' | 'meeting' | 'office_hours' | 'workshop' | 'seminar' | 'presentation' | 'project_due' | 'holiday';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  type: EventType;
  courseId?: string;
  courseName?: string;
  location?: string;
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

interface Course {
  _id: string;
  code: string;
  name: string;
}

interface CalendarViewOption {
  name: string;
  type: string;
  buttonText: string;
}

const CALENDAR_VIEWS: CalendarViewOption[] = [
  { name: 'month', type: 'dayGridMonth', buttonText: 'Month' },
  { name: 'week', type: 'timeGridWeek', buttonText: 'Week' },
  { name: 'day', type: 'timeGridDay', buttonText: 'Day' },
  { name: 'list', type: 'listWeek', buttonText: 'Agenda' },
];

const EVENT_TYPE_COLORS: Record<EventType, { bg: string; border: string; text: string }> = {
  lecture: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  lab: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  assignment_due: { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
  exam: { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },
  quiz: { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },
  meeting: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
  office_hours: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  workshop: { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' },
  seminar: { bg: '#ec4899', border: '#db2777', text: '#ffffff' },
  presentation: { bg: '#eab308', border: '#ca8a04', text: '#000000' },
  project_due: { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' },
  holiday: { bg: '#059669', border: '#047857', text: '#ffffff' },
};

const AcademicCalendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<string>('dayGridMonth');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [hiddenEventTypes, setHiddenEventTypes] = useState<Set<EventType>>(new Set());

  // Mock toast function - replace with your actual toast implementation
  const toast = {
    success: (message: string) => console.log('Success:', message),
    error: (message: string) => console.log('Error:', message),
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Mock courses data
        const mockCourses: Course[] = [
          { _id: 'hcc301', code: 'HCC301', name: 'Network Security' },
          { _id: 'hcc401', code: 'HCC401', name: 'Advanced Networking' },
        ];
        
        const eventsData = await loadMockEvents();
        
        setCourses(mockCourses);
        setEvents(eventsData);
      } catch (error) {
        console.error('Error loading calendar data:', error);
        toast.error('Failed to load calendar data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Mock events for demonstration
  const loadMockEvents = async (): Promise<CalendarEvent[]> => {
    const now = new Date();
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Network Security Lecture',
        description: 'Introduction to Firewalls and Intrusion Detection',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 30),
        type: 'lecture',
        courseId: 'hcc301',
        courseName: 'HCC301 - Network Security',
        location: 'Room 101',
        color: EVENT_TYPE_COLORS.lecture.bg,
        backgroundColor: EVENT_TYPE_COLORS.lecture.bg,
        borderColor: EVENT_TYPE_COLORS.lecture.border,
        textColor: EVENT_TYPE_COLORS.lecture.text,
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        title: 'OSPF Lab Session',
        description: 'Hands-on OSPF configuration and troubleshooting',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 16, 0),
        type: 'lab',
        courseId: 'hcc301',
        courseName: 'HCC301 - Network Security',
        location: 'Computer Lab 2',
        color: EVENT_TYPE_COLORS.lab.bg,
        backgroundColor: EVENT_TYPE_COLORS.lab.bg,
        borderColor: EVENT_TYPE_COLORS.lab.border,
        textColor: EVENT_TYPE_COLORS.lab.text,
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        title: 'Network Design Assignment Due',
        description: 'Submit your network topology design',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 23, 59),
        type: 'assignment_due',
        allDay: false,
        courseId: 'hcc301',
        courseName: 'HCC301 - Network Security',
        color: EVENT_TYPE_COLORS.assignment_due.bg,
        backgroundColor: EVENT_TYPE_COLORS.assignment_due.bg,
        borderColor: EVENT_TYPE_COLORS.assignment_due.border,
        textColor: EVENT_TYPE_COLORS.assignment_due.text,
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '4',
        title: 'Mid-term Exam',
        description: 'Comprehensive networking exam covering chapters 1-5',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 10, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 12, 0),
        type: 'exam',
        courseId: 'hcc301',
        courseName: 'HCC301 - Network Security',
        location: 'Exam Hall A',
        color: EVENT_TYPE_COLORS.exam.bg,
        backgroundColor: EVENT_TYPE_COLORS.exam.bg,
        borderColor: EVENT_TYPE_COLORS.exam.border,
        textColor: EVENT_TYPE_COLORS.exam.text,
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '5',
        title: 'Office Hours',
        description: 'Available for student consultations',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 15, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 17, 0),
        type: 'office_hours',
        location: 'Office 205',
        color: EVENT_TYPE_COLORS.office_hours.bg,
        backgroundColor: EVENT_TYPE_COLORS.office_hours.bg,
        borderColor: EVENT_TYPE_COLORS.office_hours.border,
        textColor: EVENT_TYPE_COLORS.office_hours.text,
        recurring: {
          frequency: 'weekly',
          interval: 1,
        },
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    return mockEvents;
  };

  // Filter events based on selected filters
  const filteredEvents = events.filter(event => {
    const courseMatch = filterCourse === 'all' || event.courseId === filterCourse;
    const typeMatch = filterType === 'all' || event.type === filterType;
    const visibilityMatch = !hiddenEventTypes.has(event.type);
    
    return courseMatch && typeMatch && visibilityMatch;
  });

  // Handle date selection
  const handleDateSelect = (selectInfo: any) => {
    setSelectedDate(selectInfo.start);
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  // Handle event click
  const handleEventClick = (clickInfo: any) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
      setSelectedDate(null);
      setShowEventModal(true);
    }
  };

  // Handle event drag and drop
  const handleEventDrop = async (dropInfo: any) => {
    const event = events.find(e => e.id === dropInfo.event.id);
    if (!event) return;

    try {
      const updatedEvent = {
        ...event,
        start: dropInfo.event.start,
        end: dropInfo.event.end || dropInfo.event.start,
      };

      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      toast.success('Event updated successfully');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
      dropInfo.revert();
    }
  };

  // Toggle event type visibility
  const toggleEventTypeVisibility = (type: EventType) => {
    setHiddenEventTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Navigation functions
  const goToToday = () => {
    calendarRef.current?.getApi().today();
  };

  const goToPrev = () => {
    calendarRef.current?.getApi().prev();
  };

  const goToNext = () => {
    calendarRef.current?.getApi().next();
  };

  // Export calendar data
  const exportCalendar = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calendar-events-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Academic Calendar</h1>
              <p className="text-sm text-gray-600">Manage your schedule and important dates</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCalendar}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            
            <Button
              onClick={() => {
                setSelectedEvent(null);
                setSelectedDate(new Date());
                setShowEventModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </Button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* View Selector */}
            <Select 
              value={currentView} 
              onValueChange={(value) => {
                setCurrentView(value);
                calendarRef.current?.getApi().changeView(value);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALENDAR_VIEWS.map((view) => (
                  <SelectItem key={view.name} value={view.type}>
                    {view.buttonText}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Course Filter */}
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course._id} value={course._id}>
                    {course.code} - {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Event Type Filter */}
            <Select value={filterType} onValueChange={(value) => setFilterType(value as EventType | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(EVENT_TYPE_COLORS).map(([type, colors]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: colors.bg }}
                      ></div>
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              <Today className="w-4 h-4" />
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Event Type Legend */}
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(EVENT_TYPE_COLORS).map(([type, colors]) => {
            const isHidden = hiddenEventTypes.has(type as EventType);
            const eventCount = filteredEvents.filter(e => e.type === type).length;
            
            return (
              <button
                key={type}
                onClick={() => toggleEventTypeVisibility(type as EventType)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isHidden 
                    ? 'bg-gray-100 text-gray-400 opacity-50' 
                    : 'bg-white border shadow-sm hover:shadow-md'
                }`}
                style={{
                  borderColor: isHidden ? '#d1d5db' : colors.border,
                  color: isHidden ? '#9ca3af' : colors.bg
                }}
              >
                {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: isHidden ? '#d1d5db' : colors.bg }}
                ></div>
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {eventCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {eventCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-6 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading calendar...</p>
            </div>
          </div>
        ) : (
          <div className="h-full">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={currentView}
              headerToolbar={false}
              events={filteredEvents.map(event => ({
                id: event.id,
                title: event.title,
                start: event.start,
                end: event.end,
                allDay: event.allDay,
                backgroundColor: event.backgroundColor,
                borderColor: event.borderColor,
                textColor: event.textColor,
                extendedProps: {
                  description: event.description,
                  type: event.type,
                  courseId: event.courseId,
                  courseName: event.courseName,
                  location: event.location,
                }
              }))}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              editable={true}
              droppable={true}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventDrop}
              height="100%"
              nowIndicator={true}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              expandRows={true}
              eventContent={(eventInfo) => (
                <div className="p-1 overflow-hidden">
                  <div className="font-medium text-xs truncate">
                    {eventInfo.event.title}
                  </div>
                  {eventInfo.event.extendedProps.location && (
                    <div className="text-xs opacity-75 truncate">
                      📍 {eventInfo.event.extendedProps.location}
                    </div>
                  )}
                  {eventInfo.event.extendedProps.courseName && (
                    <div className="text-xs opacity-75 truncate">
                      {eventInfo.event.extendedProps.courseName}
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* Mock Event Modal placeholder */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full m-4">
            <h2 className="text-xl font-bold mb-4">
              {selectedEvent ? 'Edit Event' : 'Create Event'}
            </h2>
            <p className="text-gray-600 mb-4">
              Event modal functionality would go here.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                  setSelectedDate(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => setShowEventModal(false)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;