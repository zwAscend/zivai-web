import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'short_answer', 'essay'],
    required: true
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  correctAnswer: {
    type: String,
    required: function() {
      return this.questionType === 'short_answer' || this.questionType === 'essay';
    }
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  attributes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseAttribute'
  }]
}, { _id: false });

const assessmentSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Assignment', 'Test', 'D-Plan', 'Project', 'Exam'],
    required: true
  },
  maxScore: {
    type: Number,
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  dueDate: {
    type: Date,
    required: true
  },
  resource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  questions: [questionSchema],
  isAIEnhanced: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Assessment = mongoose.model('Assessment', assessmentSchema);

export default Assessment;