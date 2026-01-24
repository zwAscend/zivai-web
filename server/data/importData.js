import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import connectDB from '../config/db.js';
import Student from '../models/studentModel.js';
import User from '../models/userModel.js';
import Course from '../models/courseModel.js';
import Plan from '../models/planModel.js';
import Assessment from '../models/assessmentModel.js';
import Result from '../models/resultModel.js';
import CourseAttribute from '../models/courseAttributeModel.js';
import StudentPlan from '../models/studentPlanModel.js';
import StudentAttribute from '../models/studentAttributeModel.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

const importData = async () => {
  try {
    // Clear existing data
    await Promise.all([
      Student.deleteMany(),
      User.deleteMany(),
      Course.deleteMany(),
      Plan.deleteMany(),
      Assessment.deleteMany(),
      Result.deleteMany(),
      CourseAttribute.deleteMany()
    ]);

    // Create at least one teacher user
    const teachers = await User.insertMany([
      { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@university.edu', password: 'password', role: 'teacher' },
      { firstName: 'John', lastName: 'Doe', email: 'john.doe@university.edu', password: 'password', role: 'teacher' }
    ]);
    // Load data from JSON files
    const studentsPath = path.resolve('data', 'students.json');
    const coursesPath = path.resolve('data', 'courses.json');
    const plansPath = path.resolve('data', 'plans.json');
    const courseAttributesPath = path.resolve('data', 'courseAttributes.json');

    const studentsRaw = fs.readFileSync(studentsPath, 'utf-8');
    const coursesRaw = fs.readFileSync(coursesPath, 'utf-8');
    const plansRaw = fs.readFileSync(plansPath, 'utf-8');
    const courseAttributesRaw = fs.readFileSync(courseAttributesPath, 'utf-8');

    const studentsData = JSON.parse(studentsRaw);
    let coursesData = JSON.parse(coursesRaw);
    if (!Array.isArray(coursesData) && coursesData.courses) {
      coursesData = coursesData.courses;
    }
    const plansData = JSON.parse(plansRaw);
    const courseAttributesData = JSON.parse(courseAttributesRaw).courseAttributes;

    // Ensure all required fields and assign teacher to each course
    coursesData = coursesData.map((course, idx) => ({
      code: course.code || `C${100 + idx}`,
      name: course.name || `Course ${idx + 1}`,
      description: course.description || `Description for course ${idx + 1}`,
      teacher: teachers[idx % teachers.length]._id,
      students: [],
      resources: [],
      resourceCounts: { documents: 0, images: 0, videos: 0, others: 0 }
    }));

    // Insert courses
    const insertedCourses = await Course.insertMany(coursesData);
    const courseIdMap = {};
    insertedCourses.forEach(c => { courseIdMap[c._id.toString()] = c; });

    // Build courseMap by code and name
    const courseMap = {};
    insertedCourses.forEach(c => {
      if (c.code) courseMap[c.code] = c._id;
      if (c.name) courseMap[c.name] = c._id;
    });
    // Build legacyIdToNewId map from original course _id, id, code, or name to new ObjectId
    const legacyIdToNewId = {};
    coursesData.forEach((course, idx) => {
      if (course._id) legacyIdToNewId[course._id] = insertedCourses[idx]._id;
      if (course.id) legacyIdToNewId[course.id] = insertedCourses[idx]._id;
      if (course.code) legacyIdToNewId[course.code] = insertedCourses[idx]._id;
      if (course.name) legacyIdToNewId[course.name] = insertedCourses[idx]._id;
    });
    // Insert course attributes with correct ObjectId mapping, ignore any _id from JSON
    const courseAttributes = courseAttributesData.map(attr => {
      // Remove _id if present
      const { _id, ...rest } = attr;
      // Map courseId using any possible legacy key
      let mappedCourseId = legacyIdToNewId[attr.courseId] || legacyIdToNewId[attr.courseCode] || legacyIdToNewId[attr.courseName] || attr.courseId;
      return {
        ...rest,
        courseId: mappedCourseId
      };
    });
    const insertedCourseAttributes = await CourseAttribute.insertMany(courseAttributes);
    // Debug output
    console.log('LegacyIdToNewId:', legacyIdToNewId);
    console.log('Mapped course attribute courseIds:', courseAttributes.map(a => a.courseId.toString()).slice(0, 10));

    // Insert plans (ensure courseId is valid)
    const plans = plansData.map(plan => {
      let courseId = plan.courseId;
      if (!courseId || !courseIdMap[courseId]) {
        // Assign a random course if not valid
        courseId = getRandomElement(insertedCourses)._id;
      }
      return { ...plan, courseId };
    });
    const insertedPlans = await Plan.insertMany(plans);

    // Insert students, assign courses, plans, attributes
    const students = [];
    for (const s of studentsData) {
      // Assign 1-2 courses
      const studentCourses = shuffle([...insertedCourses]).slice(0, getRandomInt(1, 2));
      // Assign 3-7 plans from those courses
      const coursePlans = insertedPlans.filter(p => studentCourses.some(c => c._id.equals(p.courseId)));
      const studentPlans = shuffle([...coursePlans]).slice(0, getRandomInt(3, 7));
      const activePlan = getRandomElement(studentPlans);
      // Assign random values for all course attributes for each course
      const attributes = {};
      for (const course of studentCourses) {
        const attrs = insertedCourseAttributes.filter(a => a.courseId.equals(course._id));
        attributes[course._id] = attrs.map(attr => ({
          attributeId: attr._id,
          value: getRandomInt(60, 100)
        }));
      }
      students.push({
        ...s,
        courses: studentCourses.map(c => c._id),
        plans: studentPlans.map(p => p._id),
        activePlan: activePlan ? activePlan._id : null,
        attributes
      });
    }
    const insertedStudents = await Student.insertMany(students);

    // --- Create StudentPlan and StudentAttribute documents ---
    await Promise.all(insertedStudents.map(async (student) => {
      // Student Plans: assign 3-7 plans from student's courses
      const studentCoursePlans = insertedPlans.filter(
        p => student.courses.some(cid => p.courseId.equals(cid))
      );
      const plansToAssign = shuffle([...studentCoursePlans]).slice(0, getRandomInt(3, 7));
      let activeAssigned = false;
      for (const plan of plansToAssign) {
        await StudentPlan.create({
          student: student._id,
          plan: plan._id,
          courseId: plan.courseId,
          status: !activeAssigned ? 'Active' : 'On Hold',
          currentProgress: getRandomInt(0, 100)
        });
        if (!activeAssigned) activeAssigned = true;
      }

      // Student Attributes: for each course, for each attribute, create StudentAttribute
      for (const courseId of student.courses) {
        const attrs = insertedCourseAttributes.filter(a => a.courseId.equals(courseId));
        for (const attr of attrs) {
          await StudentAttribute.create({
            student: student._id,
            attribute: attr._id,
            current: getRandomInt(60, 100),
            potential: getRandomInt(80, 100)
          });
        }
      }
    }));

    // Debug output to check ObjectId mapping
    console.log('Inserted course ObjectIds:', insertedCourses.map(c => c._id.toString()));
    console.log('Sample student courses:', insertedStudents[0]?.courses);
    console.log('Sample course attribute courseIds:', insertedCourseAttributes.map(a => a.courseId.toString()).slice(0, 10));

    // --- Check if collections are populated ---
    const studentPlanCount = await StudentPlan.countDocuments();
    const studentAttributeCount = await StudentAttribute.countDocuments();
    if (studentPlanCount === 0) {
      console.warn('Warning: StudentPlan collection is empty! Check plan assignment logic.');
    }
    if (studentAttributeCount === 0) {
      console.warn('Warning: StudentAttribute collection is empty! Check attribute assignment logic.');
    }

    // Update courses with student lists
    for (const course of insertedCourses) {
      const enrolled = insertedStudents.filter(s => s.courses.includes(course._id)).map(s => s._id);
      await Course.findByIdAndUpdate(course._id, { students: enrolled });
    }

    // Generate random assessments for each course
    const assessmentTypes = ['Assignment', 'Test', 'D-Plan', 'Project', 'Exam'];
    const assessments = [];
    for (const course of insertedCourses) {
      for (let i = 0; i < getRandomInt(5, 10); i++) {
        assessments.push({
          name: `${course.name} ${getRandomElement(assessmentTypes)} ${i + 1}`,
          description: `Assessment ${i + 1} for ${course.name}`,
          type: getRandomElement(assessmentTypes),
          maxScore: 100,
          courseId: course._id,
          weight: getRandomInt(10, 30),
          dueDate: new Date(Date.now() + getRandomInt(1, 60) * 24 * 60 * 60 * 1000)
        });
      }
    }
    const insertedAssessments = await Assessment.insertMany(assessments);

    // Assign random assessments to students and create results
    const results = [];
    for (const student of insertedStudents) {
      // Each student gets 5-10 assessments
      const studentAssessments = shuffle([...insertedAssessments]).slice(0, getRandomInt(5, 10));
      for (const assessment of studentAssessments) {
        const expectedMark = getRandomInt(60, 100);
        const actualMark = getRandomInt(50, expectedMark);
        let grade = 'C';
        if (actualMark >= 75) grade = 'A';
        else if (actualMark >= 60) grade = 'B';
        else if (actualMark >= 50) grade = 'C';
        else if (actualMark >= 40) grade = 'D';
        else if (actualMark >= 30) grade = 'E';
        else grade = 'F';
        results.push({
          student: student._id,
          assessment: assessment._id,
          expectedMark,
          actualMark,
          grade,
          feedback: `Feedback for ${student.firstName} on ${assessment.name}`,
          submittedDate: new Date(Date.now() - getRandomInt(1, 30) * 24 * 60 * 60 * 1000)
        });
      }
    }
    await Result.insertMany(results);

    console.log('Rich mock data imported from JSON files successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Promise.all([
      Student.deleteMany(),
      User.deleteMany(),
      Course.deleteMany(),
      Plan.deleteMany(),
      Assessment.deleteMany(),
      Result.deleteMany(),
      CourseAttribute.deleteMany()
    ]);
    console.log('Data destroyed successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}