import asyncHandler from '../utils/asyncHandler.js';
import CalendarEvent from '../models/calendarEventModel.js';
import Course from '../models/courseModel.js';

// @desc    Get all events for the current user
// @route   GET /api/calendar/events
// @access  Private
export const getEvents = asyncHandler(async (req, res) => {
  const { start, end, courseId, type } = req.query;
  
  // Build filter
  const filter = { createdBy: req.user._id };
  
  // Date range filter
  if (start || end) {
    filter.start = {};
    if (start) filter.start.$gte = new Date(start);
    if (end) filter.start.$lte = new Date(end);
  }
  
  // Course filter
  if (courseId) {
    filter.courseId = courseId;
  }
  
  // Event type filter
  if (type) {
    filter.type = type;
  }
  
  const events = await CalendarEvent.find(filter)
    .populate('courseId', 'name code')
    .sort({ start: 1 });
  
  // Transform for frontend
  const transformedEvents = events.map(event => ({
    ...event.toObject(),
    courseName: event.courseId ? `${event.courseId.code} - ${event.courseId.name}` : null
  }));
  
  res.json(transformedEvents);
});

// @desc    Get events for a specific course
// @route   GET /api/calendar/events/course/:courseId
// @access  Private
export const getCourseEvents = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  
  // Verify course exists and user has access
  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }
  
  // Check if user is teacher of this course or admin
  if (!req.user.isAdmin && course.teacher.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to view events for this course');
  }
  
  const events = await CalendarEvent.find({ courseId })
    .populate('courseId', 'name code')
    .sort({ start: 1 });
  
  res.json(events);
});

// @desc    Create a new event
// @route   POST /api/calendar/events
// @access  Private
export const createEvent = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    start,
    end,
    allDay,
    type,
    courseId,
    location,
    attendees,
    recurring,
    reminders,
    color,
    backgroundColor,
    borderColor,
    textColor
  } = req.body;
  
  // Validate required fields
  if (!title || !start || !type) {
    res.status(400);
    throw new Error('Title, start date, and type are required');
  }
  
  // Validate course if provided
  if (courseId) {
    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404);
      throw new Error('Course not found');
    }
    
    // Check if user is teacher of this course or admin
    if (!req.user.isAdmin && course.teacher.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to create events for this course');
    }
  }
  
  // Create event
  const event = await CalendarEvent.create({
    title,
    description,
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    allDay: allDay || false,
    type,
    courseId: courseId || undefined,
    location,
    attendees: attendees || [],
    recurring,
    reminders: reminders || [],
    color: color || '#3b82f6',
    backgroundColor: backgroundColor || '#3b82f6',
    borderColor: borderColor || '#2563eb',
    textColor: textColor || '#ffffff',
    createdBy: req.user._id
  });
  
  // Populate course info
  await event.populate('courseId', 'name code');
  
  res.status(201).json(event);
});

// @desc    Update an event
// @route   PUT /api/calendar/events/:id
// @access  Private
export const updateEvent = asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findById(req.params.id);
  
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }
  
  // Check if user owns this event or is admin
  if (!req.user.isAdmin && event.createdBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this event');
  }
  
  // Validate course if being updated
  if (req.body.courseId && req.body.courseId !== event.courseId?.toString()) {
    const course = await Course.findById(req.body.courseId);
    if (!course) {
      res.status(404);
      throw new Error('Course not found');
    }
    
    if (!req.user.isAdmin && course.teacher.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to assign events to this course');
    }
  }
  
  // Update fields
  const allowedFields = [
    'title', 'description', 'start', 'end', 'allDay', 'type', 
    'courseId', 'location', 'attendees', 'recurring', 'reminders',
    'color', 'backgroundColor', 'borderColor', 'textColor', 'status'
  ];
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'start' || field === 'end') {
        event[field] = req.body[field] ? new Date(req.body[field]) : undefined;
      } else {
        event[field] = req.body[field];
      }
    }
  });
  
  const updatedEvent = await event.save();
  await updatedEvent.populate('courseId', 'name code');
  
  res.json(updatedEvent);
});

// @desc    Delete an event
// @route   DELETE /api/calendar/events/:id
// @access  Private
export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findById(req.params.id);
  
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }
  
  // Check if user owns this event or is admin
  if (!req.user.isAdmin && event.createdBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this event');
  }
  
  await event.deleteOne();
  
  res.json({ message: 'Event deleted successfully' });
});

// @desc    Get upcoming events
// @route   GET /api/calendar/events/upcoming
// @access  Private
export const getUpcomingEvents = asyncHandler(async (req, res) => {
  const { limit = 10, days = 7 } = req.query;
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + parseInt(days));
  
  const events = await CalendarEvent.find({
    createdBy: req.user._id,
    start: { $gte: startDate, $lte: endDate },
    status: 'active'
  })
    .populate('courseId', 'name code')
    .sort({ start: 1 })
    .limit(parseInt(limit));
  
  res.json(events);
});

// @desc    Bulk create events
// @route   POST /api/calendar/events/bulk
// @access  Private/Teacher
export const bulkCreateEvents = asyncHandler(async (req, res) => {
  const { events } = req.body;
  
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400);
    throw new Error('Events array is required');
  }
  
  // Validate and prepare events
  const eventsToCreate = events.map(eventData => ({
    ...eventData,
    start: new Date(eventData.start),
    end: eventData.end ? new Date(eventData.end) : undefined,
    createdBy: req.user._id,
    color: eventData.color || '#3b82f6',
    backgroundColor: eventData.backgroundColor || '#3b82f6',
    borderColor: eventData.borderColor || '#2563eb',
    textColor: eventData.textColor || '#ffffff'
  }));
  
  const createdEvents = await CalendarEvent.insertMany(eventsToCreate);
  
  // Populate course info
  await CalendarEvent.populate(createdEvents, { path: 'courseId', select: 'name code' });
  
  res.status(201).json(createdEvents);
});

// @desc    Get calendar statistics
// @route   GET /api/calendar/stats
// @access  Private
export const getCalendarStats = asyncHandler(async (req, res) => {
  const { timeframe = '30d' } = req.query;
  
  // Calculate date range
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case '7d':
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
    case '30d':
      startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      break;
    case '90d':
      startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      break;
    default:
      startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  }
  
  const filter = {
    createdBy: req.user._id,
    start: { $gte: startDate }
  };
  
  // Get event counts by type
  const eventsByType = await CalendarEvent.aggregate([
    { $match: filter },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  // Get total events
  const totalEvents = await CalendarEvent.countDocuments(filter);
  
  // Get events by course
  const eventsByCourse = await CalendarEvent.aggregate([
    { $match: { ...filter, courseId: { $exists: true } } },
    { $group: { _id: '$courseId', count: { $sum: 1 } } },
    { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
    { $unwind: '$course' },
    { $project: { courseName: '$course.name', courseCode: '$course.code', count: 1 } },
    { $sort: { count: -1 } }
  ]);
  
  // Get upcoming events count
  const upcomingEvents = await CalendarEvent.countDocuments({
    createdBy: req.user._id,
    start: { $gte: now },
    status: 'active'
  });
  
  res.json({
    totalEvents,
    upcomingEvents,
    eventsByType,
    eventsByCourse,
    timeframe
  });
});