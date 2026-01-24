import { promises as fs } from 'fs';
import { join } from 'path';
import Resource from '../models/resourceModel.js';
import Course from '../models/courseModel.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cron from 'node-cron'; // Import node-cron

// Configure file paths (should be consistent with your controller)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadDir = join(__dirname, '../../uploads');

/**
 * Syncs database resource entries with actual files on disk.
 * It deletes database entries for which the physical file is missing.
 */
const syncResourcesJob = async () => {
    console.log('--- Starting resource synchronization job ---');
    try {
        // 1. Get all resource paths from the database
        const dbResources = await Resource.find({}, 'name path course').lean(); // Lean to get plain JS objects, optimize memory
        const dbResourcePaths = new Set(dbResources.map(r => r.path).filter(Boolean)); // Filter out null/undefined paths

        // 2. Get all actual file paths from the local storage
        let actualFilePaths = new Set();
        try {
            const courseDirs = await fs.readdir(uploadDir);
            for (const courseCode of courseDirs) {
                const courseDirPath = join(uploadDir, courseCode);
                const stats = await fs.stat(courseDirPath); // Check if it's a directory
                if (stats.isDirectory()) {
                    const files = await fs.readdir(courseDirPath);
                    for (const filename of files) {
                        actualFilePaths.add(join(courseDirPath, filename));
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`Upload directory not found at ${uploadDir}. No local files to sync.`);
            } else {
                console.error('Error reading local upload directory during sync:', error);
            }
            // If the upload directory doesn't exist, actualFilePaths remains empty, which is fine.
        }

        // 3. Identify and delete orphaned database entries
        let deletedCount = 0;
        for (const dbResource of dbResources) {
            // Check if the database path exists and if the actual file is NOT present
            if (dbResource.path && !actualFilePaths.has(dbResource.path)) {
                console.warn(`Found orphaned DB entry for resource ID: ${dbResource._id}, Name: "${dbResource.name}". Local file missing: ${dbResource.path}`);

                try {
                    await Resource.deleteOne({ _id: dbResource._id });
                    deletedCount++;
                    console.log(`Successfully deleted orphaned DB entry for ${dbResource._id}.`);

                    // Update course resource counts
                    if (dbResource.course) {
                        const course = await Course.findById(dbResource.course);
                        if (course) {
                            await course.updateResourceCounts();
                        }
                    }
                } catch (dbDeleteError) {
                    console.error(`Failed to delete orphaned DB entry ${dbResource._id}:`, dbDeleteError);
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`--- Resource synchronization job completed. Deleted ${deletedCount} orphaned DB entries. ---`);
        } else {
            console.log('--- Resource synchronization job completed. No orphaned DB entries found. ---');
        }

    } catch (error) {
        console.error('--- Resource synchronization job failed overall: ---', error);
    }
};

// Export the function to be scheduled
export default syncResourcesJob;