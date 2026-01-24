import mongoose from 'mongoose';

const reminderSchema = mongoose.Schema({
  time: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['email', 'notification'],
    required: true
  }
}, { _id: false });

const recurringSchema = mongoose.Schema({
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  interval: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  endDate: {
    type: Date
  }
}, { _id: false });

const calendarEventSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date
  },
  allDay: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: [
      'lecture', 
      'lab', 
      'assignment_due', 
      'exam', 
      'meeting', 
      'office_hours', 
      'holiday', 
      'workshop', 
      'seminar',
      'presentation',
      'project_due',
      'quiz'
    ],
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  location: {
    type: String,
    trim: true
  },
  attendees: [{
    type: String,
    trim: true
  }],
  color: {
    type: String,
    default: '#3b82f6'
  },
  backgroundColor: {
    type: String,
    default: '#3b82f6'
  },
  borderColor: {
    type: String,
    default: '#2563eb'
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  recurring: recurringSchema,
  reminders: [reminderSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
calendarEventSchema.index({ start: 1, end: 1 });
calendarEventSchema.index({ createdBy: 1, start: 1 });
calendarEventSchema.index({ courseId: 1, start: 1 });
calendarEventSchema.index({ type: 1, start: 1 });

// Virtual for course name
calendarEventSchema.virtual('courseName', {
  ref: 'Course',
  localField: 'courseId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in JSON output
calendarEventSchema.set('toJSON', { virtuals: true });
calendarEventSchema.set('toObject', { virtuals: true });

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

export default CalendarEvent;