import mongoose from 'mongoose';

// Subskill schema
const subskillSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  color: {
    type: String,
    enum: ['yellow', 'cyan', 'blue', 'green', 'red'],
    default: 'yellow'
  }
});

// Skill schema
const skillSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  subskills: [subskillSchema]
});

// Step schema
const stepSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['video', 'document', 'assignment', 'quiz', 'discussion']
  },
  link: {
    type: String,
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: false });
// Main plan schema
const planSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  progress: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  potentialOverall: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  eta: {
    type: Number,
    required: true,
    min: 1
  },
  performance: {
    type: String,
    required: true
    // enum: [
    //   'Excellent',
    //   'Good',
    //   'Average',
    //   'Needs Improvement',
    //   'Behind Schedule',
    //   'On Track',
    //   'Ahead of Schedule'
    // ]
  },
  skills: [skillSchema],
  steps: {
    type: [stepSchema],
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  }
}, {
  timestamps: true
});

// Middleware to auto-correct step ordering before validation
planSchema.pre('validate', function (next) {
  if (!Array.isArray(this.steps) || this.steps.length === 0) {
    return next();
  }

  // Sort steps by current order or fallback to original index
  this.steps.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Reassign order to be sequential starting from 1
  this.steps.forEach((step, index) => {
    step.order = index + 1;
  });

  next();
});

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
