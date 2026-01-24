import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { CalendarEvent } from '../../types/calendar';
import { Button } from '../ui/button';

interface MiniCalendarProps {
  events?: CalendarEvent[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  events = [],
  selectedDate,
  onDateSelect,
  onEventClick,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get calendar layout
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Generate calendar days
  const calendarDays = [];
  
  // Previous month's trailing days
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    calendarDays.push({ date, isCurrentMonth: false });
  }
  
  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    calendarDays.push({ date, isCurrentMonth: true });
  }
  
  // Next month's leading days to fill the grid
  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    calendarDays.push({ date, isCurrentMonth: false });
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Check if date is today
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-6 w-6 p-0"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-6 w-6 p-0"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dayEvents = getEventsForDate(date);
            const hasEvents = dayEvents.length > 0;
            
            return (
              <button
                key={index}
                onClick={() => onDateSelect?.(date)}
                className={`
                  relative h-8 w-8 text-xs rounded-md transition-all hover:bg-gray-100
                  ${isCurrentMonth 
                    ? 'text-gray-900' 
                    : 'text-gray-400'
                  }
                  ${isToday(date) 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : ''
                  }
                  ${isSelected(date) 
                    ? 'ring-1 ring-blue-500 bg-blue-50' 
                    : ''
                  }
                  ${hasEvents && !isToday(date) && !isSelected(date)
                    ? 'font-semibold bg-blue-50 text-blue-900' 
                    : ''
                  }
                `}
              >
                {date.getDate()}
                
                {/* Event indicator */}
                {hasEvents && (
                  <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
                    <div className={`w-1 h-1 rounded-full ${
                      isToday(date) ? 'bg-white' : 'bg-blue-500'
                    }`} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's events preview */}
      {(() => {
        const todayEvents = getEventsForDate(today);
        if (todayEvents.length === 0) return null;
        
        return (
          <div className="border-t border-gray-200 p-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Today ({todayEvents.length})
            </h4>
            <div className="space-y-1">
              {todayEvents.slice(0, 2).map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="w-full text-left p-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {event.title}
                    </span>
                  </div>
                  {!event.allDay && (
                    <div className="text-xs text-gray-500 ml-4">
                      {new Date(event.start).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </div>
                  )}
                </button>
              ))}
              
              {todayEvents.length > 2 && (
                <div className="text-xs text-gray-500 text-center py-1">
                  +{todayEvents.length - 2} more events
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MiniCalendar;