// import mongoose from 'mongoose';

// const subskillSchema = mongoose.Schema({
//   name: {
//     type: String,
//     required: true
//   },
//   score: {
//     type: Number,
//     required: true,
//     min: 0,
//     max: 100
//   },
//   color: {
//     type: String,
//     enum: ['yellow', 'cyan', 'blue', 'green', 'red'],
//     default: 'yellow'
//   }
// });

// const skillSchema = mongoose.Schema({
//   name: {
//     type: String,
//     required: true
//   },
//   score: {
//     type: Number,
//     required: true,
//     min: 0,
//     max: 100
//   },
//   subskills: [subskillSchema]
// });

// const planSchema = mongoose.Schema({
//   name: {
//     type: String,
//     required: true
//   },
//   description: {
//     type: String,
//     required: true
//   },
//   progress: {
//     type: Number,
//     required: true,
//     min: 0,
//     max: 100
//   },
//   potentialOverall: {
//     type: Number,
//     required: true,
//     min: 0,
//     max: 100
//   },
//   eta: {
//     type: Number,
//     required: true
//   },
//   performance: {
//     type: String,
//     required: true
//   },
//   skills: [skillSchema]
// });

// const studentSchema = mongoose.Schema({
//   id: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   firstName: {
//     type: String,
//     required: true
//   },
//   lastName: {
//     type: String,
//     required: true
//   },
//   email: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   overall: {
//     type: Number,
//     required: true,
//     min: 0,
//     max: 100
//   },
//   engagement: {
//     type: String,
//     required: true
//   },
//   strength: {
//     type: String,
//     required: true
//   },
//   performance: {
//     type: String,
//     required: true
//   },
//   plan: planSchema,
//   attributes: {
//     problemSolving: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     criticalThinking: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     analyticalThinking: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     creativity: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     routing: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     switching: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     datacomBasics: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     ipv6: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     networkSecurity: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     vpn: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     },
//     wan: {
//       current: { type: Number, min: 0, max: 100 },
//       potential: { type: Number, min: 0, max: 100 }
//     }
//   }
// }, {
//   timestamps: true
// });

// const Student = mongoose.model('Student', studentSchema);

// export default Student;


import mongoose from 'mongoose';

const studentSchema = mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  overall: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  engagement: {
    type: String,
    required: true
  },
  strength: {
    type: String,
    required: true
  },
  performance: {
    type: String,
    required: true
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  activePlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentPlan'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate for attributes
studentSchema.virtual('attributes', {
  ref: 'StudentAttribute',
  localField: '_id',
  foreignField: 'student'
});

// Virtual populate for all plans
studentSchema.virtual('plans', {
  ref: 'StudentPlan',
  localField: '_id',
  foreignField: 'student'
});

const Student = mongoose.model('Student', studentSchema);

export default Student;