import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Repeat, 
  Save, 
  X,
  Plus,
  Trash2,
  AlertCircle,
  BookOpen,
  Eye
} from 'lucide-react';
import { CalendarEvent, EventFormData, EventType } from '../../types/calendar';
import { Course } from '../../types';
import { useToast } from '../ui/use-toast';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: EventFormData) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  event?: CalendarEvent | null;
  courses: Course[];
  selectedDate?: Date | null;
}

const EVENT_TYPES: { value: EventType; label: string; color: string; icon: string }[] = [
  { value: 'lecture', label: 'Lecture', color: 'bg-blue-500', icon: '📚' },
  { value: 'lab', label: 'Lab Session', color: 'bg-green-500', icon: '🔬' },
  { value: 'assignment_due', label: 'Assignment Due', color: 'bg-red-500', icon: '📝' },
  { value: 'exam', label: 'Exam', color: 'bg-purple-500', icon: '📋' },
  { value: 'quiz', label: 'Quiz', color: 'bg-orange-500', icon: '❓' },
  { value: 'meeting', label: 'Meeting', color: 'bg-gray-500', icon: '👥' },
  { value: 'office_hours', label: 'Office Hours', color: 'bg-cyan-500', icon: '🏢' },
  { value: 'workshop', label: 'Workshop', color: 'bg-indigo-500', icon: '🛠️' },
  { value: 'seminar', label: 'Seminar', color: 'bg-pink-500', icon: '🎓' },
  { value: 'presentation', label: 'Presentation', color: 'bg-yellow-500', icon: '📊' },
  { value: 'project_due', label: 'Project Due', color: 'bg-red-600', icon: '🚀' },
  { value: 'holiday', label: 'Holiday', color: 'bg-emerald-500', icon: '🎉' },
];

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  courses,
  selectedDate
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    start: '',
    end: '',
    allDay: false,
    type: 'lecture',
    courseId: '',
    location: '',
    recurring: {
      enabled: false,
      frequency: 'weekly',
      interval: 1,
      endDate: ''
    }
  });

  // Initialize form data
  useEffect(() => {
    if (event) {
      // Editing existing event
      const startDate = new Date(event.start);
      const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 60 * 60 * 1000);
      
      setFormData({
        title: event.title,
        description: event.description || '',
        start: formatDateTimeLocal(startDate),
        end: formatDateTimeLocal(endDate),
        allDay: event.allDay || false,
        type: event.type,
        courseId: event.courseId || '',
        location: event.location || '',
        recurring: {
          enabled: !!event.recurring,
          frequency: event.recurring?.frequency || 'weekly',
          interval: event.recurring?.interval || 1,
          endDate: event.recurring?.endDate ? formatDateLocal(new Date(event.recurring.endDate)) : ''
        }
      });
    } else if (selectedDate) {
      // Creating new event with selected date
      const start = new Date(selectedDate);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later
      
      setFormData(prev => ({
        ...prev,
        start: formatDateTimeLocal(start),
        end: formatDateTimeLocal(end),
        title: '',
        description: '',
        courseId: '',
        location: ''
      }));
    }
  }, [event, selectedDate]);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRecurringChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      recurring: {
        ...prev.recurring,
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Event title is required');
      return;
    }

    if (!formData.start) {
      toast.error('Start date and time are required');
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      toast.success(event ? 'Event updated successfully' : 'Event created successfully');
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this event?')) {
      setLoading(true);
      try {
        await onDelete(event.id);
        toast.success('Event deleted successfully');
        onClose();
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Failed to delete event');
      } finally {
        setLoading(false);
      }
    }
  };

  const selectedEventType = EVENT_TYPES.find(type => type.value === formData.type);

  // Add this function to check if we should show preview
  const shouldShowPreview = () => {
    return !!(formData.title || formData.location || formData.courseId || formData.type !== 'lecture');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${shouldShowPreview() ? 'max-w-5xl' : 'max-w-2xl'} max-h-[90vh] p-0 overflow-hidden transition-all duration-300`}>
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  {event ? 'Edit Event' : 'Create New Event'}
                </DialogTitle>
                <p className="text-blue-100 mt-1">
                  {event ? 'Update event details' : 'Add a new event to your calendar'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="text-white hover:bg-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.title.trim() || !formData.start}
                className="bg-white/20 hover:bg-white/30 text-white min-w-[120px]"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {event ? 'Update Event' : 'Create Event'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex">
          {/* Form Section - Now with flex-basis to control width */}
          <form onSubmit={handleSubmit} className={`${shouldShowPreview() ? 'flex-[0_0_60%] border-r border-gray-200' : 'w-full'} overflow-y-auto p-6 space-y-6`}>
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Event Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter event title"
                  className="h-11"
                  required
                />
              </div>

              {/* Temporarily removed description field
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Event description (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
              */}
            </div>

            {/* Event Type and Course */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Event Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => handleInputChange('type', value as EventType)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{type.icon}</span>
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Course</Label>
                <Select 
                  value={formData.courseId || 'none'} 
                  onValueChange={(value) => handleInputChange('courseId', value === 'none' ? '' : value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select course (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No course</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course._id} value={course._id}>
                        {course.code} - {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date and Time */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={formData.allDay}
                    onChange={(e) => handleInputChange('allDay', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="allDay" className="text-sm font-medium">All day event</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={formData.recurring.enabled}
                    onChange={(e) => handleRecurringChange('enabled', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="recurring" className="text-sm font-medium flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Recurring Event
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Start {formData.allDay ? 'Date' : 'Date & Time'} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="start"
                    type={formData.allDay ? 'date' : 'datetime-local'}
                    value={formData.allDay ? formData.start.split('T')[0] : formData.start}
                    onChange={(e) => handleInputChange('start', e.target.value)}
                    className="h-11"
                    required
                  />
                </div>

                {!formData.allDay && (
                  <div className="space-y-2">
                    <Label htmlFor="end" className="text-sm font-medium">End Date & Time</Label>
                    <Input
                      id="end"
                      type="datetime-local"
                      value={formData.end}
                      onChange={(e) => handleInputChange('end', e.target.value)}
                      min={formData.start}
                      className="h-11"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Room number, building, or online link"
                className="h-11"
              />
            </div>

            {/* Only render recurring options if enabled */}
            {formData.recurring.enabled && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Frequency</Label>
                    <Select 
                      value={formData.recurring.frequency} 
                      onValueChange={(value) => handleRecurringChange('frequency', value)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Repeat every</Label>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={formData.recurring.interval}
                      onChange={(e) => handleRecurringChange('interval', parseInt(e.target.value) || 1)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">End Date</Label>
                    <Input
                      type="date"
                      value={formData.recurring.endDate}
                      onChange={(e) => handleRecurringChange('endDate', e.target.value)}
                      min={formData.start.split('T')[0]}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Only render preview if there are details to show */}
          {shouldShowPreview() && (
            <div className="flex-[0_0_40%] p-6 bg-gray-50">
              <div className="sticky top-6">
                <h4 className="font-medium text-gray-900 mb-6 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Event Preview
                </h4>
                
                <div className="space-y-6">
                  {/* Event Card Preview */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${selectedEventType?.color || 'bg-blue-500'}`}></div>
                      <div className="flex-1 min-w-0">
                        {formData.title && (
                          <p className="font-medium text-gray-900 truncate">{formData.title}</p>
                        )}
                        {formData.start && (
                          <p className="text-sm text-gray-600">
                            {new Date(formData.start).toLocaleString()}
                          </p>
                        )}
                        {formData.location && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {formData.location}
                          </p>
                        )}
                        {formData.courseId && (
                          <p className="text-xs text-blue-600 mt-2">
                            {courses.find(c => c._id === formData.courseId)?.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Preview Info */}
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formData.allDay ? 'All day event' : 'Time-specific event'}</span>
                    </div>
                    {formData.recurring.enabled && (
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4" />
                        <span>Repeats {formData.recurring.frequency}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete button section */}
        {event && onDelete && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={loading}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Event
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;