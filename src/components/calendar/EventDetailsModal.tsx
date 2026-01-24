import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  User, 
  Edit, 
  Trash2,
  X,
  Bell,
  Repeat,
  ExternalLink
} from 'lucide-react';
import { CalendarEvent } from '../../types/calendar';
import { format } from 'date-fns';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  canEdit?: boolean;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  isOpen,
  onClose,
  event,
  onEdit,
  onDelete,
  canEdit = true
}) => {
  if (!event) return null;

  const formatEventDate = (start: Date | string, end?: Date | string, allDay?: boolean) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    
    if (allDay) {
      if (endDate && startDate.toDateString() !== endDate.toDateString()) {
        return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
      }
      return format(startDate, 'MMMM d, yyyy');
    }
    
    if (endDate) {
      if (startDate.toDateString() === endDate.toDateString()) {
        return `${format(startDate, 'MMMM d, yyyy')} • ${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
      }
      return `${format(startDate, 'MMM d, h:mm a')} - ${format(endDate, 'MMM d, h:mm a')}`;
    }
    
    return `${format(startDate, 'MMMM d, yyyy')} • ${format(startDate, 'h:mm a')}`;
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'lecture': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'lab': return 'bg-green-100 text-green-800 border-green-200';
      case 'assignment_due': return 'bg-red-100 text-red-800 border-red-200';
      case 'exam': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'quiz': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'meeting': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'office_hours': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'workshop': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'seminar': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'presentation': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'project_due': return 'bg-red-100 text-red-800 border-red-200';
      case 'holiday': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      onDelete?.(event.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  Event Details
                </DialogTitle>
                <p className="text-blue-100 mt-1">
                  {event.courseName || 'General Event'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Event Title and Type */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900 flex-1">
                {event.title}
              </h1>
              <Badge className={`${getEventTypeColor(event.type)} border`}>
                {event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>
            
            {event.description && (
              <p className="text-gray-600 leading-relaxed">
                {event.description}
              </p>
            )}
          </div>

          {/* Event Details */}
          <div className="grid gap-4">
            {/* Date and Time */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {formatEventDate(event.start, event.end, event.allDay)}
                </p>
                {event.allDay && (
                  <p className="text-sm text-gray-500">All day event</p>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">{event.location}</p>
                  <p className="text-sm text-gray-500">Event location</p>
                </div>
              </div>
            )}

            {/* Course */}
            {event.courseName && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <BookOpen className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">{event.courseName}</p>
                  <p className="text-sm text-gray-500">Associated course</p>
                </div>
              </div>
            )}

            {/* Recurring Info */}
            {event.recurring && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Repeat className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    Repeats {event.recurring.frequency}
                    {event.recurring.interval > 1 && ` (every ${event.recurring.interval})`}
                  </p>
                  {event.recurring.endDate && (
                    <p className="text-sm text-blue-700">
                      Until {format(new Date(event.recurring.endDate), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Reminders */}
            {event.reminders && event.reminders.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <Bell className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 mb-1">Reminders set</p>
                  <div className="space-y-1">
                    {event.reminders.map((reminder, index) => (
                      <p key={index} className="text-sm text-yellow-800">
                        {reminder.time} minutes before ({reminder.type})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 mb-1">
                    Attendees ({event.attendees.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {event.attendees.slice(0, 5).map((attendee, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {attendee}
                      </Badge>
                    ))}
                    {event.attendees.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{event.attendees.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
              <div>
                <p>Created: {format(new Date(event.createdAt), 'MMM d, yyyy h:mm a')}</p>
                {event.updatedAt && event.updatedAt !== event.createdAt && (
                  <p>Updated: {format(new Date(event.updatedAt), 'MMM d, yyyy h:mm a')}</p>
                )}
              </div>
              <div>
                <p>Created by: {event.createdBy}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                {onDelete && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Event
                  </Button>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                {onEdit && (
                  <Button
                    onClick={() => onEdit(event)}
                    className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Event
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailsModal;