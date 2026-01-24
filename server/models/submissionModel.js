import mongoose from 'mongoose';

const submissionSchema = mongoose.Schema({
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
  submissionType: {
    type: String,
    enum: ['file', 'text', 'url'],
    required: true
  },
  content: {
    type: String, // File path, text content, or URL
    required: true
  },
  originalFileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['submitted', 'grading', 'graded', 'reviewed'],
    default: 'submitted'
  },
  autoGrading: {
    enabled: {
      type: Boolean,
      default: true
    },
    result: {
      totalScore: Number,
      percentage: Number,
      grade: String,
      feedback: String,
      breakdown: mongoose.Schema.Types.Mixed,
      confidence: Number,
      gradedAt: Date
    }
  },
  teacherReview: {
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adjustments: {
      scoreAdjustment: Number,
      feedbackAdjustment: String,
      finalScore: Number,
      finalGrade: String
    }
  },
  // New optional field to store the full external assessment JSON
  externalAssessmentData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
submissionSchema.index({ student: 1, assessment: 1 }, { unique: true });
submissionSchema.index({ status: 1, createdAt: -1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;