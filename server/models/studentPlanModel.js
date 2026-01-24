import mongoose from 'mongoose';

const studentPlanSchema = mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  currentProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'On Hold', 'Cancelled'],
    default: 'On Hold'
  },
  completionDate: {
    type: Date
  }
}, {
  timestamps: true
});

// A student can only have one active plan per course
studentPlanSchema.index(
  { student: 1, courseId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Active' }
  }
);

const StudentPlan = mongoose.model('StudentPlan', studentPlanSchema);

export default StudentPlan;
