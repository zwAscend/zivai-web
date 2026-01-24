import mongoose from 'mongoose';

const attributeSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Technical', 'Soft Skills', 'Core Concepts', 'Advanced', "Transferable"]
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  }
}, {
  timestamps: true
});

// Ensure unique attribute names per course
attributeSchema.index({ name: 1, courseId: 1 }, { unique: true });

const CourseAttribute = mongoose.model('CourseAttribute', attributeSchema);

export default CourseAttribute;