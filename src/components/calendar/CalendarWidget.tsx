import React from 'react';
import { motion } from 'framer-motion';
import { CalendarEvent } from '../../types/calendar';

interface CalendarWidgetProps {
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: (date: Date) => void;
  events?: CalendarEvent[];
  selectedDate?: Date;
  className?: string;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  onDateSelect,
  onEventClick,
  onCreateEvent,
  events = [],
  selectedDate,
  className = ''
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date
  const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Generate today + next 6 days to fill a 7-day week
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return {
      day: date.getDate(),
      fullDate: date,
      isToday: i === 0,
      dayName: date.toLocaleString('en-US', { weekday: 'short' })
    };
  });

  // Get the correct weekday headers for the dates
  const displayWeekDays = dates.map(date => date.dayName);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Get upcoming events from the current time onwards
  const getUpcomingEvents = (date: Date) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return events.filter(event => {
      const eventStart = new Date(event.start);
      return (isToday && eventStart >= now) || (eventStart.toDateString() === date.toDateString() && !isToday);
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  // Handle date double click for creating events
  const handleDateDoubleClick = (date: Date) => {
    if (onCreateEvent) {
      onCreateEvent(date);
    }
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEventClick) {
      onEventClick(event);
    }
  };

  const todayEvents = getUpcomingEvents(today);

  return (
    <div className={`bg-gray-50 p-4 rounded-lg shadow h-full flex flex-col ${className}`}>
      {/* Month Header */}
      <h2 className="text-xl font-bold text-left mb-2">{currentMonth}</h2>

      {/* Calendar Grid */}
      <div className="grid grid-cols-8 gap-1 h-full divide-x divide-gray-200">
        {/* Day headers */}
        {displayWeekDays.map((day, index) => (
          <div
            key={`day-${index}`}
            className={`
              text-center text-xs font-semibold text-gray-600
              ${dates[index].isToday ? 'col-span-2' : ''}
            `}
          >
            {day}
          </div>
        ))}

        {/* Date cells */}
        {dates.map((date, index) => {
          const isToday = date.isToday;
          const dayEvents = getEventsForDate(date.fullDate);
          const hasEvents = dayEvents.length > 0;

          return (
            <motion.div
              key={`date-${index}`}
              className={`
                flex flex-col p-1 cursor-pointer transition-colors duration-200
                ${isToday
                  ? 'bg-blue-600 text-white rounded-lg shadow-md relative z-10 col-span-2'
                  : 'hover:bg-gray-200 rounded-md items-center justify-start'
                }
              `}
              onClick={() => handleDateClick(date.fullDate)}
              onDoubleClick={() => handleDateDoubleClick(date.fullDate)}
              whileHover={{ scale: isToday ? 1.01 : 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Content for Today's Date */}
              {isToday ? (
                <div className="flex w-full h-full">
                  {/* Date Number on the left */}
                  <div className="flex-shrink-0 font-bold text-xl p-2 pr-4 self-start">
                    {date.day}
                  </div>
                  {/* Events list on the right */}
                  <div className="flex-1 w-full space-y-1 overflow-y-auto pr-1">
                    {todayEvents.length > 0 ? (
                      todayEvents.map((event) => (
                        <motion.div
                          key={event.id}
                          className="text-xs p-1 rounded-md cursor-pointer truncate bg-white/20 hover:bg-white/30"
                          onClick={(e) => handleEventClick(event, e)}
                          title={event.title}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {event.allDay ? (
                            <span className="font-medium">{event.title}</span>
                          ) : (
                            <>
                              <span className="font-semibold">{new Date(event.start).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}</span>
                              <span className="ml-1 font-medium">{event.title}</span>
                            </>
                          )}
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center text-white/80 text-xs mt-2 p-2">
                        No upcoming events today.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Date number for other days */}
                  <div className="font-medium text-sm">
                    {date.day}
                  </div>
                  {/* Event indicators for other days */}
                  {hasEvents && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((event, eventIndex) => (
                        <motion.div
                          key={eventIndex}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: event.color || '#3b82f6' }}
                          title={event.title}
                          onClick={(e) => handleEventClick(event, e)}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.98 }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarWidget;