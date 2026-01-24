import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  AlertCircle,
  ChevronRight,
  Filter,
  Plus
} from 'lucide-react';
import { CalendarEvent, EventType } from '../../types/calendar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { calendarService } from '../../services/calendarService';
import { useToast } from '../ui/use-toast';

interface UpcomingEventsProps {
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
  limit?: number;
  showFilters?: boolean;
}

const EVENT_TYPE_ICONS: Record<EventType, string> = {
  lecture: '📚',
  lab: '🔬',
  assignment_due: '📝',
  exam: '📋',
  quiz: '❓',
  meeting: '👥',
  office_hours: '🏢',
  workshop: '🛠️',
  seminar: '🎓',
  presentation: '📊',
  project_due: '🚀',
  holiday: '🎉',
};

const UpcomingEvents: React.FC<UpcomingEventsProps> = ({
  onEventClick,
  onCreateEvent,
  limit = 10,
  showFilters = true
}) => {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    loadUpcomingEvents();
  }, [limit]);

  const loadUpcomingEvents = async () => {
    try {
      setLoading(true);
      // For now, using mock data. In production, this would call the API
      const mockEvents = await loadMockUpcomingEvents();
      setEvents(mockEvents);
    } catch (error) {
      console.error('Error loading upcoming events:', error);
      toast.error('Failed to load upcoming events');
    } finally {
      setLoading(false);
    }
  };

  const loadMockUpcomingEvents = async (): Promise<CalendarEvent[]> => {
    const now = new Date();
    return [
      {
        id: '1',
        title: 'Network Security Lecture',
        description: 'OSPF Routing Protocols',
        start: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        end: new Date(now.getTime() + 3.5 * 60 * 60 * 1000),
        type: 'lecture',
        courseId: 'hcc301',
        courseName: 'HCC301',
        location: 'Room 101',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '2',
        title: 'Lab Assignment Due',
        description: 'VLAN Configuration Lab',
        start: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        type: 'assignment_due',
        courseId: 'hcc301',
        courseName: 'HCC301',
        allDay: true,
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '3',
        title: 'Office Hours',
        description: 'Student consultations',
        start: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        end: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        type: 'office_hours',
        location: 'Office 205',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '4',
        title: 'Database Systems Quiz',
        description: 'SQL Queries and Normalization',
        start: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        end: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        type: 'quiz',
        courseId: 'hcc202',
        courseName: 'HCC202',
        location: 'Lab 3',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '5',
        title: 'Project Presentation',
        description: 'Final project presentations',
        start: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        type: 'presentation',
        courseId: 'hcc303',
        courseName: 'HCC303',
        location: 'Auditorium',
        createdBy: 'teacher1',
        createdAt: now,
        updatedAt: now,
      }
    ];
  };

  // Filter events based on selected filters
  const filteredEvents = events.filter(event => {
    const typeMatch = filterType === 'all' || event.type === filterType;
    
    const now = new Date();
    let timeMatch = true;
    
    if (timeFilter === 'today') {
      const eventDate = new Date(event.start);
      timeMatch = eventDate.toDateString() === now.toDateString();
    } else if (timeFilter === 'week') {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const eventDate = new Date(event.start);
      timeMatch = eventDate >= now && eventDate <= weekFromNow;
    } else if (timeFilter === 'month') {
      const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const eventDate = new Date(event.start);
      timeMatch = eventDate >= now && eventDate <= monthFromNow;
    }
    
    return typeMatch && timeMatch;
  }).slice(0, limit);

  const formatEventTime = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const now = new Date();
    
    if (event.allDay) {
      return 'All day';
    }
    
    const isToday = start.toDateString() === now.toDateString();
    const isTomorrow = start.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    let dateStr = '';
    if (isToday) {
      dateStr = 'Today';
    } else if (isTomorrow) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = start.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    const timeStr = start.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${dateStr} at ${timeStr}`;
  };

  const getEventTypeColor = (type: EventType) => {
    switch (type) {
      case 'lecture': return 'bg-blue-100 text-blue-800';
      case 'lab': return 'bg-green-100 text-green-800';
      case 'assignment_due': return 'bg-red-100 text-red-800';
      case 'exam': return 'bg-purple-100 text-purple-800';
      case 'quiz': return 'bg-orange-100 text-orange-800';
      case 'meeting': return 'bg-gray-100 text-gray-800';
      case 'office_hours': return 'bg-cyan-100 text-cyan-800';
      case 'workshop': return 'bg-indigo-100 text-indigo-800';
      case 'seminar': return 'bg-pink-100 text-pink-800';
      case 'presentation': return 'bg-yellow-100 text-yellow-800';
      case 'project_due': return 'bg-red-100 text-red-800';
      case 'holiday': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimeUntilEvent = (event: CalendarEvent) => {
    const now = new Date();
    const eventStart = new Date(event.start);
    const diffMs = eventStart.getTime() - now.getTime();
    
    if (diffMs < 0) return 'Past event';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Upcoming Events
          </h2>
          {onCreateEvent && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateEvent}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="flex gap-2">
            <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={(value) => setFilterType(value as EventType | 'all')}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.keys(EVENT_TYPE_ICONS).map((type) => (
                  <SelectItem key={type} value={type}>
                    {EVENT_TYPE_ICONS[type as EventType]} {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No upcoming events</p>
            <p className="text-sm text-gray-400">
              {filterType !== 'all' || timeFilter !== 'week' 
                ? 'Try adjusting your filters' 
                : 'Create your first event to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                onClick={() => onEventClick?.(event)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">
                      {EVENT_TYPE_ICONS[event.type] || '📅'}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {event.title}
                        </h3>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatEventTime(event)}</span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      
                      {event.courseName && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          <span className="truncate">{event.courseName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getEventTypeColor(event.type)}`}>
                          {event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                        
                        {(() => {
                          const timeUntil = getTimeUntilEvent(event);
                          const isUrgent = timeUntil.includes('hour') || timeUntil === 'in 1 day';
                          
                          return (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                isUrgent ? 'border-red-300 text-red-700 bg-red-50' : 'border-gray-300'
                              }`}
                            >
                              {isUrgent && <AlertCircle className="w-3 h-3 mr-1" />}
                              {timeUntil}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredEvents.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Showing {filteredEvents.length} of {events.length} events</span>
            <button 
              onClick={loadUpcomingEvents}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpcomingEvents;