// Enums or Union Types for clarity
export type ResourceType = 'document' | 'image' | 'video' | 'other';
export type PlanStatus = 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
export type AssessmentType = 'Assignment' | 'Test' | 'D-Plan' | 'Project' | 'Exam' | 'Quiz' | 'Exercise';
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'code';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type AssessmentStatus = 'draft' | 'published' | 'archived';
export type UserRole = 'student' | 'teacher' | 'admin';
export type AttributeCategory = 'Technical' | 'Soft Skills' | 'Core Concepts' | 'Advanced' | 'Transferable';
export type SkillColor = 'yellow' | 'cyan' | 'blue' | 'green' | 'red';
export type StepType = 'video' | 'document' | 'assignment' | 'quiz' | 'discussion';
export type SubmissionType = 'file' | 'text' | 'url';
export type SubmissionStatus = 'submitted' | 'grading' | 'graded' | 'reviewed';
export type NotificationType = 'assignment_graded' | 'assignment_submitted' | 'plan_assigned' | 'message_received';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// User Interface - Represents a user in the system (student, teacher, admin)
export interface User {
  _id: string; // MongoDB's default ID
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole; // Derived from isAdmin/isTeacher fields on backend
  avatar?: string; // Optional avatar URL
  createdAt?: Date; // Mongoose timestamps
  updatedAt?: Date; // Mongoose timestamps
  token?: string; // Transient property for authentication, not stored in DB
}

// Student Interface - Represents a student profile
export interface Student {
  _id: string; // MongoDB's default ID
  id: string; // The explicit 'id' field from your studentModel.js
  firstName: string;
  lastName: string;
  email: string;
  overall: number; // Overall performance score
  strength: string; // E.g., 'Problem Solving', 'Networking'
  performance: string; // E.g., 'Excellent', 'Good', 'Needs Improvement'
  engagement: string; // E.g., 'High', 'Medium', 'Low'
  // References to other models
  subjects?: string[]; // Array of Subject IDs the student is enrolled in
  activePlan?: DevelopmentPlan; // The student's currently active development plan (populated)
  attributes?: StudentAttributes; // Aggregated student attributes (transformed object)
  // Derived or aggregated fields (not directly from student model, but useful for frontend)
  attendance?: number;
  assessments?: number;
}

// Skill Interfaces (from Plan Model)
export interface Subskill {
  name: string;
  score: number; // Score from the plan template
  color: SkillColor;
}

export interface Skill {
  name: string;
  score: number; // Score from the plan template
  subskills: Subskill[];
}

// Step Interface (from Plan Model)
export interface Step {
  title: string;
  type: StepType;
  link?: string;
  additionalResources?: string[];
  order: number;
}

// NEW: Plan Interface - Represents a plan TEMPLATE (from planModel.js)
export interface Plan {
  _id: string;
  name: string;
  description: string;
  progress: number; // This is the default progress for the template (likely 0)
  potentialOverall: number;
  eta: number;
  performance: string;
  skills: Skill[]; // Array of skills and subskills defined in the plan template
  steps: Step[]; // Array of steps defined in the plan template
  subjectId: string; // The ID of the Subject this plan belongs to
  createdAt?: Date; // Mongoose timestamps
  updatedAt?: Date; // Mongoose timestamps
  link?: string;
  additionalResources?: string[];
}

// DevelopmentPlan Interface - Represents a student's assigned, progress-tracked instance of a plan
// This combines fields from Plan and StudentPlan models.
export interface DevelopmentPlan {
  _id: string; // The _id of the StudentPlan document
  student: string; // Student ID (from StudentPlan)
  plan: Plan; // The populated Plan template (from StudentPlan.plan reference)
  startDate: Date; // From StudentPlan
  currentProgress: number; // Student's actual progress (from StudentPlan)
  status: PlanStatus; // From StudentPlan
  completionDate?: Date; // Optional, when the plan was completed (from StudentPlan)
  skillProgress?: StudentSkillProgress[]; // Student's current scores for skills within this plan (from StudentPlan)
  createdAt?: Date; // Mongoose timestamps
  updatedAt?: Date; // Mongoose timestamps
}

// StudentSkillProgress - Represents a student's progress on a specific skill within a plan
export interface StudentSkillProgress {
  skill: string; // Name of the skill
  currentScore: number;
  targetScore: number;
  lastUpdated: Date;
}

// StudentAttributes Interface - Represents aggregated attributes for a student
// This is transformed from an array of StudentAttribute documents into a key-value pair object
export interface StudentAttributes {
  [attributeName: string]: { // Key is the attribute name (e.g., 'problemSolving')
    current: number;
    potential: number;
    lastAssessed: Date;
  };
  // You can also include derived overall growth metrics if calculated on backend
  //currentGrowth?: number;
  //potentialGrowth?: number;
}

// Question Option Interface - For multiple choice questions
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

// Question Interface - Represents a single question in an assessment
export interface Question {
  _id?: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[]; // For multiple choice questions
  correctAnswer?: string | string[]; // For short answer, true/false, or multiple correct answers
  explanation?: string;
  points: number;
  difficulty: DifficultyLevel;
  subjectAttributes?: string[]; // IDs of related subject attributes
  metadata?: {
    isAIEnhanced?: boolean;
    aiPrompt?: string;
    feedback?: string;
  };
  order?: number;
}

// Assessment Interface - Represents an assessment definition
export interface Assessment {
  _id: string;
  name: string;
  description: string;
  type: AssessmentType;
  maxScore: number;
  weight: number;
  dueDate: Date;
  subjectId: string;
  status: AssessmentStatus;
  isAIEnhanced?: boolean;
  questions: Question[] | string; // Can be array of questions or JSON string
  resource?: string; // ID of the linked resource/document
  createdBy: string | { _id: string; firstName: string; lastName: string };
  lastModifiedBy: string | { _id: string; firstName: string; lastName: string };
  createdAt?: Date;
  updatedAt?: Date;
}

// Result Interface - Represents a student's submission/result for an assessment
export interface Result {
  _id: string;
  student: string; // Student ID
  assessment: string; // Assessment ID
  expectedMark: number;
  actualMark: number;
  grade: string; // E.g., 'A+', 'B', 'Pass'
  feedback?: string; // Optional feedback
  submittedDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// StudentAssessmentResult - Combines Assessment definition with a student's Result on it
export interface StudentAssessmentResult {
  assessment: Assessment; // The full assessment definition
  result: { // The student's specific result details
    _id: string;
    expectedMark: number;
    actualMark: number;
    grade: string;
    feedback?: string;
    submittedDate: Date;
  };
  difference?: number; // Derived: actualMark - expectedMark
}


// ChatMessage Interface - Represents a single message in a chat conversation
export interface ChatMessage {
  id: string; // Maps to _id from backend
  sender: { // Populated sender details from User model
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string; // Include if you populate avatar as well
  };
  content: string;
  timestamp: Date;
  read: boolean;
  chatId: string; // Identifier for the conversation thread
  isTeacher?: boolean; // Derived from sender's role for UI display
  createdAt?: Date;
  updatedAt?: Date;
}

// Resource Interface - Represents an uploaded file/resource
export interface Resource {
  id: string; // Maps to _id from backend
  name: string;
  type: ResourceType;
  size: string; // Formatted string like "5.2 MB"
  url: string; // Direct S3 URL (could be temporary signed URL from getDownloadUrl)
  key: string; // S3 object key
  lastModified: Date | string; // Can be either Date or string
  tags: string[];
  classes: string[]; // Array of Subject IDs this resource is associated with
  downloads: number;
  uploadedBy?: { // Populated uploader details from User model
    _id: string;
    firstName: string;
    lastName: string;
  };
  order?: number; // For custom ordering of resources within a subject
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubmissionPayload {
  assessmentId: string;
  studentId: string;  // Changed from 'student' to 'studentId'
  submissionType: 'file' | 'text';
  file?: File;
  textContent?: string;
  externalAssessmentData?: any;
  result?: string;  // Link to result document
  originalFilename?: string;
  fileType?: string;
}

// ClassResource - Represents aggregated resource counts for a subject (from Subject model's resourceCounts)
export interface ClassResource {
  id: string; // This would be the Subject's ID
  code: string; // This would be the Subject's code
  name: string; // This would be the Subject's name
  teacher:{id:string; email:string;}; // This would be the Subject's teacher
  documents: number;
  images: number;
  videos: number;
  others: number;
}

// SubjectAttribute Interface - Represents a specific attribute defined for a subject
export interface SubjectAttribute {
  _id: string;
  name: string;
  description: string;
  category: AttributeCategory;
  subjectId: string; // The ID of the subject this attribute belongs to
  createdAt?: Date;
  updatedAt?: Date;
}

// Subject Interface - Represents a single subject
export interface Subject {
  _id: string;
  code: string; // E.g., "HCC301"
  name: string; // E.g., "Network Security"
  description: string;
  teacher: string | { _id: string; firstName: string; lastName: string; }; // Teacher ID or populated Teacher object
  students?: string[]; // Array of student IDs enrolled
  resources?: string[]; // Array of resource IDs associated (if not using resourceCounts)
  resourceCounts?: { // Pre-calculated counts
    documents: number;
    images: number;
    videos: number;
    others: number;
  };
  // Virtuals for easier access to related data (if populated on backend)
  attributes?: SubjectAttribute[]; // Array of SubjectAttribute definitions for this subject
  plans?: Plan[]; // Array of Plan templates associated with this subject
  createdAt?: Date;
  updatedAt?: Date;
}

// Submission Interface - Represents a student's assignment submission
export interface Submission {
  _id: string;
  student: string | Student;
  assessment: string | Assessment;
  submissionType: SubmissionType;
  content: string; // File path, text content, or URL
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  submittedAt: Date;
  status: SubmissionStatus;
  autoGrading: {
    enabled: boolean;
    result?: {
      totalScore: number;
      percentage: number;
      grade: string;
      feedback: string;
      breakdown: any;
      confidence: number;
      gradedAt: Date;
    };
  };
  teacherReview?: {
    reviewed: boolean;
    reviewedAt?: Date;
    reviewedBy?: string | User;
    adjustments?: {
      scoreAdjustment: number;
      feedbackAdjustment: string;
      finalScore: number;
      finalGrade: string;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Notification Interface - Represents system notifications
export interface Notification {
  _id: string;
  recipient: string | User;
  type: NotificationType;
  title: string;
  message: string;
  data: any; // Flexible data object for notification-specific information
  read: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}