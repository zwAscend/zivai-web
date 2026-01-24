import mongoose from 'mongoose';

const resultSchema = mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  expectedMark: {
    type: Number,
    required: true
  },
  actualMark: {
    type: Number,
    required: true
  },
  grade: {
    type: String,
    required: true
  },
  feedback: {
    type: String,
    default: ''
  },
  submittedDate: {
    type: Date,
    default: Date.now
  },
  // New optional field to store the full external assessment JSON
  externalAssessmentData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
}, {
  timestamps: true
});

// Create a compound index to ensure a student can only have one result per assessment
resultSchema.index({ student: 1, assessment: 1 }, { unique: true });

const Result = mongoose.model('Result', resultSchema);

export default Result;