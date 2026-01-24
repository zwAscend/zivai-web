// server/models/Resource.js
import mongoose from 'mongoose';

const resourceSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  originalName: { // Add this field to store the original filename
    type: String,
    required: true
  },
  mimeType: { // Add this crucial field for file type detection
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['document', 'image', 'video', 'other'],
    required: true
  },
  size: {
    type: String, // Consider storing as Number for easier calculations
    required: true
  },
  url: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: false // Made optional for local storage
  },
  path: {
    type: String,
    required: false // Local file system path
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  tags: [{
    type: String
  }],
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for full-text search
resourceSchema.index({
  name: 'text',
  tags: 'text'
});

// Index for efficient class filtering
//resourceSchema.index({ classes: 1 }); // Note: Your schema uses 'course', not 'classes'. You might want to update this index.
// Corrected index if you intend to filter by course:
resourceSchema.index({ course: 1 });


// Index for sorting by downloads
resourceSchema.index({ downloads: -1 });

const Resource = mongoose.model('Resource', resourceSchema);

export default Resource;