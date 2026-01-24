import mongoose from 'mongoose';

const courseSchema = mongoose.Schema({
    // Unique identifier for the course itself (e.g., "HCC301")
    code: {
        type: String,
        required: true,
        unique: true
    },
    // The full name of the course (e.g., "Network Security")
    name: {
        type: String,
        required: true
    },
    // Detailed description of the course content
    description: {
        type: String,
        required: true
    },
    // The primary teacher assigned to this course.
    // If a course can have multiple teachers (e.g., co-teachers), this could be an array.
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Students enrolled in this specific course.
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    // Resources directly associated with this course.
    // IMPORTANT: Your Resource model needs to reference 'Course' now, not 'Class'.
    resources: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource'
    }],
    // Pre-calculated counts of different resource types for this course.
    resourceCounts: {
        documents: { type: Number, default: 0 },
        images: { type: Number, default: 0 },
        videos: { type: Number, default: 0 },
        others: { type: Number, default: 0 }
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true } // Include virtuals when converting to plain objects
});

// Virtual populate for CourseAttributes.
// This allows you to easily get all attributes defined for a specific course.
// Assumes 'CourseAttribute' model has a 'courseId' field that references this Course's _id.
courseSchema.virtual('attributes', {
    ref: 'CourseAttribute',
    localField: '_id',
    foreignField: 'courseId'
});

// Virtual populate for Plans.
// This allows you to easily get all learning plans associated with a specific course.
// Assumes 'Plan' model has a 'courseId' field that references this Course's _id.
courseSchema.virtual('plans', {
    ref: 'Plan',
    localField: '_id',
    foreignField: 'courseId'
});

// Instance method to update resource counts.
// This method queries the 'Resource' model to find resources linked to this course
// and updates the counts accordingly.
// IMPORTANT: Ensure your Resource model has a field (e.g., 'course') that links to the Course _id.
courseSchema.methods.updateResourceCounts = async function() {
    // Find resources where this course's ID is in the 'courses' array (assuming Resource has a 'courses' field)
    const resources = await mongoose.model('Resource').find({ courses: this._id }); 
    
    this.resourceCounts = {
        documents: resources.filter(r => r.type === 'document').length,
        images: resources.filter(r => r.type === 'image').length,
        videos: resources.filter(r => r.type === 'video').length,
        others: resources.filter(r => r.type === 'other').length
    };
    
    await this.save(); // Save the updated course document
};

const Course = mongoose.model('Course', courseSchema);

export default Course;