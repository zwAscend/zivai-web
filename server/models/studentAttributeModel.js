import mongoose from 'mongoose';

const studentAttributeSchema = mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  attribute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseAttribute',
    required: true
  },
  current: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  potential: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  lastAssessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure unique student-attribute combinations
studentAttributeSchema.index({ student: 1, attribute: 1 }, { unique: true });

const StudentAttribute = mongoose.model('StudentAttribute', studentAttributeSchema);

export default StudentAttribute;