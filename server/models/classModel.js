import mongoose from 'mongoose';

const classSchema = mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  documents: {
    type: Number,
    default: 0
  },
  images: {
    type: Number,
    default: 0
  },
  videos: {
    type: Number,
    default: 0
  },
  others: {
    type: Number,
    default: 0
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  resources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  }]
}, {
  timestamps: true
});

// Update resource counts
classSchema.methods.updateResourceCounts = async function() {
  const resources = await mongoose.model('Resource').find({ classes: this._id });
  
  this.documents = resources.filter(r => r.type === 'document').length;
  this.images = resources.filter(r => r.type === 'image').length;
  this.videos = resources.filter(r => r.type === 'video').length;
  this.others = resources.filter(r => r.type === 'other').length;
  
  await this.save();
};

const Class = mongoose.model('Class', classSchema);

export default Class;