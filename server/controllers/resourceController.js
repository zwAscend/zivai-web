import asyncHandler from '../utils/asyncHandler.js';
import Resource from '../models/resourceModel.js';
import Course from '../models/courseModel.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

// Configure file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Define the root directory for local uploads. This should be 'uploads' relative to your project root.
const UPLOADS_ROOT_DIR = join(__dirname, '../../uploads');

// Helper function to ensure local upload directory exists for a specific course
const ensureLocalUploadDirExists = async (courseCode) => {
    const courseDir = join(UPLOADS_ROOT_DIR, courseCode);
    try {
        await fs.access(courseDir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(courseDir, { recursive: true });
        } else {
            throw error; // Re-throw other errors
        }
    }
    return courseDir;
};

// @desc    Get resource counts by type for ALL courses
// @route   GET /api/resources/counts
// @access  Private
export const getResourceCounts = asyncHandler(async (req, res) => {
    try {
        const counts = await Resource.aggregate([
            {
                $group: {
                    _id: {
                        course: '$course',
                        type: '$type'
                    },
                    count: { $sum: 1 },
                    latestUpload: { $max: '$createdAt' }
                }
            },
            {
                $group: {
                    _id: '$_id.course',
                    total: { $sum: '$count' },
                    types: {
                        $push: {
                            type: '$_id.type',
                            count: '$count'
                        }
                    },
                    lastUpdated: { $max: '$latestUpload' }
                }
            },
            {
                $project: {
                    _id: 1,
                    count: '$total',
                    documents: {
                        $sum: {
                            $map: {
                                input: '$types',
                                as: 'typeInfo',
                                in: {
                                    $cond: [{ $eq: ['$$typeInfo.type', 'document'] }, '$$typeInfo.count', 0]
                                }
                            }
                        }
                    },
                    images: {
                        $sum: {
                            $map: {
                                input: '$types',
                                as: 'typeInfo',
                                in: {
                                    $cond: [{ $eq: ['$$typeInfo.type', 'image'] }, '$$typeInfo.count', 0]
                                }
                            }
                        }
                    },
                    videos: {
                        $sum: {
                            $map: {
                                input: '$types',
                                as: 'typeInfo',
                                in: {
                                    $cond: [{ $eq: ['$$typeInfo.type', 'video'] }, '$$typeInfo.count', 0]
                                }
                            }
                        }
                    },
                    others: {
                        $sum: {
                            $map: {
                                input: '$types',
                                as: 'typeInfo',
                                in: {
                                    $cond: [{ $eq: ['$$typeInfo.type', 'other'] }, '$$typeInfo.count', 0]
                                }
                            }
                        }
                    },
                    lastUpdated: 1
                }
            }
        ]);

        const result = counts.reduce((acc, current) => {
            acc[current._id] = {
                count: current.count,
                documents: current.documents,
                images: current.images,
                videos: current.videos,
                others: current.others,
                lastUpdated: current.lastUpdated
            };
            return acc;
        }, {});

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting resource counts for dashboard:', error);
        res.status(500).json({ message: 'Error getting resource counts' });
    }
});

// @desc    Get resources for a specific course
// @route   GET /api/resources/course/:courseId
// @access  Private
export const getCourseResources = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { search, type, sort = 'recent' } = req.query;

    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        res.status(404);
        throw new Error('Course not found');
    }

    let query = { course: courseId };

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } }
        ];
    }

    if (type && type !== 'All' && type !== 'all') {
        query.type = type.toLowerCase();
    }

    let sortOption = {};
    switch (sort) {
        case 'downloads':
            sortOption = { downloads: -1 };
            break;
        case 'name':
            sortOption = { name: 1 };
            break;
        case 'recent':
        default:
            sortOption = { createdAt: -1 };
    }

    const resources = await Resource.find(query)
        .sort(sortOption)
        .populate('uploadedBy', 'firstName lastName');

    res.json(resources);
});

// @desc    Upload a new resource
// @route   POST /api/resources/upload
// @access  Private/Teacher
export const uploadResource = asyncHandler(async (req, res) => {
    const { courseId, tags } = req.body;
    const file = req.file; // Multer provides file.originalname, file.buffer, file.mimetype, file.size

    if (!courseId) {
        res.status(400);
        throw new Error('Course ID is required for resource upload.');
    }
    if (!file) {
        res.status(400);
        throw new Error('No file uploaded.');
    }

    const course = await Course.findOne({
        _id: courseId,
        teacher: req.user._id // Ensure the teacher owns the course
    }).select('code name');

    if (!course) {
        res.status(404);
        throw new Error('Course not found or you are not authorized to upload to this course');
    }

    // Generate a sanitized course code for directory
    const courseCode = course.code || course.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '');

    // Determine general file type
    const fileType = getFileType(file.mimetype);

    // --- Local Storage Path ---
    const courseDir = await ensureLocalUploadDirExists(courseCode);
    
    // *** CRITICAL CHANGE: Use original name directly ***
    const filenameOnDisk = file.originalname; 
    const localFilePath = join(courseDir, filenameOnDisk);
    const resourceUrl = `/uploads/${courseCode}/${encodeURIComponent(filenameOnDisk)}`; // Publicly accessible URL

    try {
        await fs.writeFile(localFilePath, file.buffer);
        console.log(`File uploaded locally: ${localFilePath}`);
    } catch (localFileError) {
        console.error('Error saving file locally:', localFileError);
        res.status(500); // Set status before throwing
        throw new Error('Failed to save file locally.');
    }

    // Create resource in database
    const newResource = await Resource.create({
        name: file.originalname,
        originalName: file.originalname, // Store original file name
        mimeType: file.mimetype,
        type: fileType,
        size: file.size, // Store raw bytes
        url: resourceUrl, // The URL path for frontend access
        path: localFilePath, // Absolute path on server
        key: filenameOnDisk, // Store the filename on disk (which is the original name)
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        course: courseId,
        uploadedBy: req.user._id,
        order: 0,
        // createdAt and updatedAt are typically handled by mongoose timestamps if schema is configured
    });

    // Update course resource counts
    const updatedCourse = await Course.findById(courseId);
    if (updatedCourse && typeof updatedCourse.updateResourceCounts === 'function') {
        await updatedCourse.updateResourceCounts();
    }

    res.status(201).json({
        message: 'Resource uploaded successfully',
        resource: newResource.toObject()
    });
});

// @desc    Download a resource / Get preview URL
// @route   GET /api/resources/download/:id (resource MongoDB _id)
// @access  Private
export const getDownloadUrl = asyncHandler(async (req, res) => {
    const { id } = req.params; // Expecting resource MongoDB _id

    const resource = await Resource.findById(id);

    if (!resource) {
        res.status(404);
        throw new Error('Resource not found in database');
    }

    // --- Local Storage Handling ---
    // Construct public URL for local file
    // resource.url already contains something like /uploads/courseCode/filename.ext
    // We need to prepend the base URL for the frontend.
    const finalDownloadUrl = `http://localhost:5000${resource.url}`; // Adjust 'http://localhost:5000' as needed for production
    console.log(`Using local URL for ${resource.name}: ${finalDownloadUrl}`);

    // Increment download count
    resource.downloads = (resource.downloads || 0) + 1;
    await resource.save();

    // Send the determined URL back to the frontend
    res.status(200).json({
        url: finalDownloadUrl,
        name: resource.originalName || resource.name,
        mimeType: resource.mimeType || getFileType(resource.name.split('.').pop()) // Fallback to guess mimeType
    });
});


// @desc    Update resource order (e.g., within a course)
// @route   PUT /api/resources/order
// @access  Private/Teacher
export const updateResourceOrder = asyncHandler(async (req, res) => {
    const { resources: orderedResources } = req.body;

    if (!Array.isArray(orderedResources) || orderedResources.length === 0) {
        res.status(400);
        throw new Error('Invalid resource order data provided.');
    }

    await Promise.all(
        orderedResources.map((resource, index) =>
            Resource.findByIdAndUpdate(resource.id, { order: index }, { new: true })
        )
    );

    res.json({ message: 'Resource order updated successfully' });
});

// @desc    Delete a resource
// @route   DELETE /api/resources/:id
// @access  Private/Teacher
export const deleteResource = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const resource = await Resource.findById(id);
    if (!resource) {
        res.status(404);
        throw new Error('Resource not found');
    }

    // --- Local File Deletion ---
    // Use resource.path for absolute path to the file
    if (resource.path) {
        try {
            await fs.access(resource.path); // Check if file exists before trying to unlink
            await fs.unlink(resource.path);
            console.log(`Successfully deleted local file: ${resource.path}`);
        } catch (localFileError) {
            if (localFileError.code === 'ENOENT') {
                console.warn(`Local file for resource ${resource._id} not found at ${resource.path}, skipping deletion.`);
            } else {
                console.error(`Error deleting local file ${resource.path} for resource ${resource._id}:`, localFileError);
            }
        }
    } else {
        console.warn(`Resource ${resource._id} has no local file path for deletion.`);
    }

    // Get the course ID to update resource counts BEFORE deleting the resource
    const courseIdToUpdate = resource.course;

    // Delete resource from database
    await resource.deleteOne();

    // Update course resource counts
    if (courseIdToUpdate) {
        const course = await Course.findById(courseIdToUpdate);
        if (course && typeof course.updateResourceCounts === 'function') {
            await course.updateResourceCounts();
        }
    }

    res.json({ message: 'Resource deleted successfully' });
});

// Helper functions
const getFileType = (mimetype) => {
    if (mimetype) {
        const lowerMime = mimetype.toLowerCase();
        if (lowerMime.startsWith('image/')) return 'image';
        if (lowerMime.startsWith('video/')) return 'video';
        if (lowerMime.includes('pdf') ||
            lowerMime.includes('text/') ||
            lowerMime.includes('application/msword') || // .doc
            lowerMime.includes('application/vnd.openxmlformats-officedocument.wordprocessingml') || // .docx
            lowerMime.includes('application/vnd.ms-excel') || // .xls
            lowerMime.includes('application/vnd.openxmlformats-officedocument.spreadsheetml') || // .xlsx
            lowerMime.includes('application/vnd.ms-powerpoint') || // .ppt
            lowerMime.includes('application/vnd.openxmlformats-officedocument.presentationml') || // .pptx
            lowerMime.includes('application/json') ||
            lowerMime.includes('application/xml')) return 'document';
    }
    return 'other'; // Default to 'other' if mimetype is missing or unknown
};

// @desc    Get recent uploads
// @route   GET /api/resources/recent
// @access  Private
export const getRecentUploads = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;

    const recentUploads = await Resource.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('course', 'name code')
        .populate('uploadedBy', 'firstName lastName');

    res.status(200).json(recentUploads);
});