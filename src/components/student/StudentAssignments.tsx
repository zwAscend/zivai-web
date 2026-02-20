import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, Loader2, Upload, X, Eye, Sparkles } from 'lucide-react';
import { Assessment, Result, Submission, SubmissionPayload, Student } from '../../types';
import { Dialog } from '@headlessui/react';
import { assessmentService, studentService, submissionService } from '../../services/api';
import { externalAssessmentService } from '../../services/externalAssessmentService';

interface StudentAssignmentsProps {
  studentId: string;
  selectedSubjectId?: string; // Add this prop to filter by subject
  onOpenTutor?: (prompt?: string) => void;
}

interface SubmissionWithResult extends Submission {
  result?: Result & {
    externalAssessmentData?: any; // Adjust this type based on your actual external assessment data structure
  };
}

interface AssignmentWithResult extends Assessment {
  result?: Result;
  submission?: SubmissionWithResult;
  isSubmitted: boolean;
  isOverdue: boolean;
}

type MockAssessmentCard = {
  id: string;
  title: string;
  description: string;
  questions: number;
  duration: string;
  format: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

const mockAttemptCards: MockAssessmentCard[] = [
  {
    id: 'mock-quick-check',
    title: 'Quick Mastery Check',
    description: 'Short mixed set to refresh core concepts and identify small gaps.',
    questions: 8,
    duration: '12-15 min',
    format: 'Mixed quiz',
    difficulty: 'Easy',
  },
  {
    id: 'mock-exam-readiness',
    title: 'Exam Readiness Drill',
    description: 'Exam-style questions with reasoning and structured working required.',
    questions: 16,
    duration: '25-30 min',
    format: 'Structured assessment',
    difficulty: 'Medium',
  },
  {
    id: 'mock-challenge',
    title: 'Challenge Mode',
    description: 'Higher-order problems to strengthen confidence before finals.',
    questions: 20,
    duration: '35-40 min',
    format: 'Extended paper',
    difficulty: 'Hard',
  },
];

const StudentAssignments: React.FC<StudentAssignmentsProps> = ({ studentId, selectedSubjectId, onOpenTutor }) => {
  const [assignments, setAssignments] = useState<AssignmentWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [textSubmission, setTextSubmission] = useState('');
  const [submissionType, setSubmissionType] = useState<'file' | 'text'>('file');
  const [activeAssignment, setActiveAssignment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'submitted' | 'graded' | 'overdue'>('all');
  const [selectedType, setSelectedType] = useState<'all' | string>('all');
  const [assessmentTab, setAssessmentTab] = useState<'attempt' | 'list' | 'review'>('attempt');
  const [selectedReviewAssessmentId, setSelectedReviewAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    console.log('--- Fetching Student Assignments ---');
    console.log('Student ID:', studentId);
    console.log('Selected Subject ID:', selectedSubjectId);

    const fetchStudentAssignments = async () => {
      if (!studentId) {
        console.log('DEBUG: No student ID provided. Skipping fetch.');
        setAssignments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log('DEBUG: Starting to fetch assignments for student ID:', studentId);
      
      try {
        // Fetch all required data in parallel
        const [student, submissions] = await Promise.all([
          studentService.getStudent(studentId).catch(error => {
            console.error('Error fetching student:', error);
            return null;
          }),
          submissionService.getStudentSubmissions(studentId).catch(error => {
            console.error('Error fetching submissions:', error);
            return [];
          })
        ]);

        // Process subject IDs to fetch
        const subjectIdsToFetch = (() => {
          if (selectedSubjectId && selectedSubjectId !== 'all') {
            return [selectedSubjectId];
          }
          return (student?.subjects || [])
            .map(subject => typeof subject === 'string' ? subject : subject?.id)
            .filter(Boolean) as string[];
        })();

        if (subjectIdsToFetch.length === 0) {
          console.log('DEBUG: No valid subject IDs found to fetch assignments for.');
          setAssignments([]);
          setLoading(false);
          return;
        }

        // Fetch assessments for all subjects in parallel
        const assessmentsBySubject = await Promise.all(
          subjectIdsToFetch.map(subjectId => 
            assessmentService.getAssessmentsBySubjectId(subjectId).catch(error => {
              console.error(`ERROR fetching assessments for subject ${subjectId}:`, error);
              return [];
            })
          )
        );

        const allAssessments = assessmentsBySubject.flat();
        console.log(`DEBUG: Found ${allAssessments.length} assessments across ${subjectIdsToFetch.length} subjects`);

        // *** IMPROVED RESULT CHECKING ***
        // Fetch results for each assessment specifically for this student
        const resultsPromises = allAssessments.map(assessment => 
          assessment?.id 
            ? assessmentService.getResults(assessment.id, studentId) // Pass studentId as query param
                .then(results => ({ 
                  assessmentId: assessment.id, 
                  result: results && results.length > 0 ? results[0] : null 
                }))
                .catch(error => {
                  console.error(`ERROR fetching result for assessment ${assessment.id}:`, error);
                  return { assessmentId: assessment.id, result: null };
                })
            : Promise.resolve({ assessmentId: '', result: null })
        );

        const results = await Promise.all(resultsPromises);
        const resultsMap = new Map(
          results
            .filter(r => r.assessmentId) // Include even null results for proper checking
            .map(({ assessmentId, result }) => [assessmentId, result])
        );

        // Create a map of submission by assessment ID
        const submissionMap = new Map(
          submissions
            .filter((s: any) => s.assessment || s.assessmentId)
            .map((submission: any) => [
              (submission.assessment || submission.assessmentId) as string, 
              submission
            ])
        );

        // Merge all data together with proper result existence checking
        const now = new Date();
        const processedAssignments = allAssessments.map(assessment => {
          const submission = submissionMap.get(assessment.id);
          const result = resultsMap.get(assessment.id); // This will be null if no result exists
          const dueDate = new Date(assessment.dueDate);
          
          // *** IMPROVED STATUS LOGIC ***
          const hasResult = result !== null && result !== undefined;
          const hasSubmission = !!submission;
          const isSubmitted = hasSubmission || hasResult; // Either submission OR result indicates submission
          const isOverdue = dueDate < now && !isSubmitted;

          console.log(`Assessment ${assessment.name}:`, {
            hasSubmission,
            hasResult,
            isSubmitted,
            resultExists: hasResult
          });

          return {
            ...assessment,
            dueDate,
            isSubmitted,
            isOverdue,
            result: result, // This will be null if no result exists
            submission: submission 
              ? {
                  ...submission,
                  result: result // Attach result to submission if it exists
                }
              : undefined
          } as AssignmentWithResult;
        });

        console.log('DEBUG: Processed assignments with results and submissions:', processedAssignments);
        setAssignments(processedAssignments);
      } catch (error) {
        console.error('ERROR: Failed to fetch student assignments:', error);
        setAssignments([]);
      } finally {
        setLoading(false);
        console.log('DEBUG: Assignment fetching process complete.');
      }
    };

    if (studentId) {
      fetchStudentAssignments();
    } else {
      setLoading(false);
      setAssignments([]);
      console.log('DEBUG: No student ID provided. Skipping fetch.');
    }
  }, [studentId, selectedSubjectId]);

  useEffect(() => {
    if (assignments.length === 0) {
      setSelectedReviewAssessmentId(null);
      return;
    }

    const selectedStillExists = selectedReviewAssessmentId
      ? assignments.some((assignment) => assignment.id === selectedReviewAssessmentId)
      : false;

    if (selectedStillExists) return;

    const bestDefault =
      assignments.find((assignment) => assignment.isSubmitted || assignment.result || assignment.submission) ||
      assignments[0];

    setSelectedReviewAssessmentId(bestDefault?.id || null);
  }, [assignments, selectedReviewAssessmentId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, assignmentId: string) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    console.log(`DEBUG: Attempting to submit assignment ${assignmentId} with type: ${submissionType}`);
    setSubmitting(assignmentId);
  
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }
  
      // The moduleName should be derived from the assignment's associated subject
      const moduleName = 'Operating Systems'; 
  
      // Step 1: Trigger external assessment first
      let assessmentResult;
      if (submissionType === 'file' && selectedFile) {
        console.log('DEBUG: Assessing file submission with external service');
        assessmentResult = await externalAssessmentService.assessDocument(selectedFile, moduleName);
      } else if (submissionType === 'text' && textSubmission.trim()) {
        console.log('DEBUG: Assessing text submission with external service');
        assessmentResult = await externalAssessmentService.assessText(textSubmission.trim(), moduleName);
      } else {
        throw new Error('No valid submission content found');
      }
  
      // Check for success and data before proceeding
      if (!assessmentResult.success || !assessmentResult.data) {
        throw new Error(assessmentResult.error || 'Assessment failed to return data');
      }
  
      const { assessment, module: assessedModule } = assessmentResult.data;
      const totalPossibleMarks = assessment?.total_possible_marks || assignment.maxScore;
      const marksAchieved = assessment?.marks_achieved || 0;
      const percentage = assessment?.marks_percentage || 0;
  
      const calculateGrade = (percentage: number) => {
        if (percentage >= 90) return 'A';
        if (percentage >= 80) return 'B';
        if (percentage >= 70) return 'C';
        if (percentage >= 60) return 'D';
        return 'F';
      };
  
      // Step 2: Create the result data object
      const resultData = {
        student: studentId,
        assessment: assignmentId,
        expectedMark: Math.round(totalPossibleMarks * 0.7),
        actualMark: marksAchieved,
        grade: calculateGrade(percentage),
        feedback: assessment?.overall_feedback || 'No feedback provided',
        submittedDate: new Date(),
        externalAssessmentData: assessmentResult.data
      };
  
      // Step 3: Save the result using the API service
      const resultResponse = await assessmentService.addResult(assignmentId, resultData);
      console.log('DEBUG: Result created:', resultResponse);
  
      // Step 4: Prepare the submission payload with correct field names
      const submissionPayload: SubmissionPayload = {
        assessmentId: assignmentId,
        studentId: studentId,  // Correct field name
        submissionType,
        result: resultResponse.id, // Link to the created result
        externalAssessmentData: assessmentResult.data,
        // Add file-specific fields if it's a file submission
        ...(submissionType === 'file' && selectedFile ? { 
          file: selectedFile,
          originalFilename: selectedFile.name,
          fileType: selectedFile.type
        } : {}),
        // Add text content if it's a text submission
        ...(submissionType === 'text' ? { 
          textContent: textSubmission 
        } : {}),
      };
  
      // Step 5: Submit the assignment
      const submissionResponse = await submissionService.submitAssignment(submissionPayload);
      console.log('DEBUG: Submission created:', submissionResponse);
  
      // Step 6: Update the local state
      setAssignments(prev => prev.map(a => 
        a.id === assignmentId 
          ? { 
            ...a, 
            isSubmitted: true, 
            result: {
              ...resultResponse,
              assessment: assignmentId,
            }
          }
          : a
      ));
  
      // Reset form state
      setSelectedFile(null);
      setTextSubmission('');
      setActiveAssignment(null);
      
      alert(`Assignment submitted and graded successfully!\nScore: ${resultData.actualMark}/${assignment.maxScore}\nGrade: ${resultData.grade}`);
  
    } catch (error) {
      console.error('ERROR: Failed to submit assignment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to submit assignment: ${errorMessage}`);
    } finally {
      setSubmitting(null);
    }
  };

  // Function to handle viewing detailed feedback
  const handleViewDetailedFeedback = (assignment: AssignmentWithResult) => {
    const feedbackData = assignment.submission?.result?.externalAssessmentData || assignment.result?.externalAssessmentData;
    console.log('Opening detailed feedback modal with data:', feedbackData);
    setSelectedFeedback(feedbackData);
    setIsDetailsOpen(true);
  };

  // Updated status functions - now synchronous since we have all data
  const getStatusColor = (assignment: AssignmentWithResult) => {
    if (assignment.isSubmitted && assignment.result) return 'text-green-600 bg-green-100';
    if (assignment.isSubmitted) return 'text-blue-600 bg-blue-100';
    if (assignment.isOverdue) return 'text-red-600 bg-red-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getStatusText = (assignment: AssignmentWithResult) => {
    if (assignment.isSubmitted && assignment.result) {
      return 'Graded';
    }
    if (assignment.isSubmitted) {
      return 'Submitted (awaiting review)';
    }
    if (assignment.isOverdue) return 'Overdue';
    return 'Pending';
  };

  const getStatusIcon = (assignment: AssignmentWithResult) => {
    if (assignment.isSubmitted && assignment.result) return <CheckCircle className="w-4 h-4" />;
    if (assignment.isSubmitted) return <Clock className="w-4 h-4" />;
    if (assignment.isOverdue) return <AlertCircle className="w-4 h-4" />;
    return <Calendar className="w-4 h-4" />;
  };

  const getAssessmentTypeLabel = (assignment: AssignmentWithResult) => {
    const rawType = (assignment as any).assessmentType || (assignment as any).type || 'Assessment';
    return String(rawType)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getStatusKey = (assignment: AssignmentWithResult) => {
    if (assignment.isSubmitted && assignment.result) return 'graded';
    if (assignment.isSubmitted) return 'submitted';
    if (assignment.isOverdue) return 'overdue';
    return 'pending';
  };

  const assessmentTypes = Array.from(
    new Set(assignments.map((assignment) => getAssessmentTypeLabel(assignment)))
  ).sort();

  const filteredAssignments = assignments.filter((assignment) => {
    const statusMatch = selectedStatus === 'all' || getStatusKey(assignment) === selectedStatus;
    const typeMatch = selectedType === 'all' || getAssessmentTypeLabel(assignment) === selectedType;
    const query = searchQuery.trim().toLowerCase();
    const queryMatch = !query || assignment.name.toLowerCase().includes(query);
    return statusMatch && typeMatch && queryMatch;
  });

  const attemptAssignments = filteredAssignments.filter((assignment) => !assignment.isSubmitted);
  const selectedReviewAssignment = assignments.find(
    (assignment) => assignment.id === selectedReviewAssessmentId
  ) || null;

  const getSubmissionDetails = (assignment: AssignmentWithResult) => {
    console.log('--- Getting Submission Details ---');
    console.log('Assignment:', assignment.name);
    console.log('Submission exists:', !!assignment.submission);
    
    if (!assignment.isSubmitted) {
      console.log('No submission found for this assignment');
      return null;
    }
    
    const submission = assignment.submission;
    const result = assignment.result;
    const submittedDate = submission?.submittedAt 
      ? new Date(submission.submittedAt).toLocaleString() 
      : 'Unknown';
    
    // Check if detailed feedback is available
    const hasDetailedFeedback = submission?.result?.externalAssessmentData || result?.externalAssessmentData;
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2">Submission Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Submitted on:</p>
            <p className="font-medium">{submittedDate}</p>
          </div>
          {submission?.submissionType === 'file' && submission.originalFilename && (
            <div>
              <p className="text-sm text-gray-600">Submitted file:</p>
              <p className="font-medium">{submission.originalFilename}</p>
            </div>
          )}
          {result && (
            <>
              <div>
                <p className="text-sm text-gray-600">Score:</p>
                <p className="font-medium">
                  {result.actualMark} / {assignment.maxScore} 
                  <span className="ml-2 text-sm text-gray-500">
                    ({Math.round((result.actualMark / assignment.maxScore) * 100)}%)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Grade:</p>
                <p className="font-medium">{result.grade}</p>
              </div>
            </>
          )}
        </div>
        
        {result?.feedback && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h5 className="text-sm font-medium text-gray-700">Feedback</h5>
              {hasDetailedFeedback && (
                <button
                  onClick={() => handleViewDetailedFeedback(assignment)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View Details
                </button>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-gray-600">
              <p>{result.feedback}</p>
              
              {submission?.result?.externalAssessmentData?.assessment?.overall_feedback && (
                <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400">
                  <p className="text-blue-700">
                    {submission.result.externalAssessmentData.assessment.overall_feedback}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="h-7 w-40 bg-blue-100 rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-blue-50 rounded-lg p-4 space-y-2">
              <div className="h-5 w-52 bg-blue-100 rounded animate-pulse" />
              <div className="h-4 w-full bg-blue-100 rounded animate-pulse" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-4 bg-blue-100 rounded animate-pulse" />
                <div className="h-4 bg-blue-100 rounded animate-pulse" />
                <div className="h-4 bg-blue-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[680px]">
        <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Assessments</p>
          <nav className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setAssessmentTab('attempt')}
              className={`w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                assessmentTab === 'attempt'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Attempt Assessment</span>
            </button>
            <button
              type="button"
              onClick={() => setAssessmentTab('list')}
              className={`w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                assessmentTab === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Assessment List</span>
            </button>
            <button
              type="button"
              onClick={() => setAssessmentTab('review')}
              className={`w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                assessmentTab === 'review'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>Assessment Review</span>
            </button>
          </nav>

          <div className="mt-5 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
            <p className="flex items-center justify-between text-slate-600">
              <span>Total</span>
              <span className="font-semibold text-slate-900">{assignments.length}</span>
            </p>
            <p className="flex items-center justify-between text-slate-600">
              <span>Pending</span>
              <span className="font-semibold text-slate-900">{assignments.filter((item) => !item.isSubmitted).length}</span>
            </p>
            <p className="flex items-center justify-between text-slate-600">
              <span>Reviewed</span>
              <span className="font-semibold text-slate-900">{assignments.filter((item) => !!item.result).length}</span>
            </p>
          </div>
        </aside>

        <section className="p-4 sm:p-6 space-y-4">
          {assessmentTab === 'attempt' && (
            <>
              {attemptAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{assignment.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">{assignment.description}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      {assignment.isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {assignment.dueDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>Max Score: {assignment.maxScore}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                      {getAssessmentTypeLabel(assignment)}
                    </span>
                  </div>

                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { setSubmissionType('file'); setActiveAssignment(assignment.id); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          submissionType === 'file' && activeAssignment === assignment.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        File Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSubmissionType('text'); setActiveAssignment(assignment.id); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          submissionType === 'text' && activeAssignment === assignment.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Text Submission
                      </button>
                    </div>

                    {submissionType === 'file' && activeAssignment === assignment.id && (
                      <label className="block">
                        <input
                          type="file"
                          onChange={(e) => handleFileSelect(e, assignment.id)}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.txt,.zip"
                        />
                        <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600">
                            {selectedFile ? selectedFile.name : 'Choose file to upload'}
                          </span>
                        </div>
                      </label>
                    )}

                    {submissionType === 'text' && activeAssignment === assignment.id && (
                      <textarea
                        value={textSubmission}
                        onChange={(e) => setTextSubmission(e.target.value)}
                        placeholder="Enter your assignment submission here..."
                        className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[180px]"
                        rows={8}
                      />
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleSubmitAssignment(assignment.id)}
                        disabled={
                          (submissionType === 'file' && (!selectedFile || activeAssignment !== assignment.id)) ||
                          (submissionType === 'text' && !textSubmission.trim()) ||
                          submitting === assignment.id
                        }
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submitting === assignment.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting & Grading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Submit Assessment
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {attemptAssignments.length === 0 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                        <div>
                          <p className="text-lg font-semibold text-slate-800">All formal assessments are submitted</p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            Keep momentum with AI-generated mock assessments.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssessmentTab('list')}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View assessment list
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {mockAttemptCards.map((mock) => (
                      <article key={mock.id} className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          <Sparkles className="w-3.5 h-3.5" />
                          Mock assessment
                        </div>
                        <h4 className="mt-3 text-lg font-semibold text-slate-900">{mock.title}</h4>
                        <p className="mt-2 text-sm text-slate-600">{mock.description}</p>
                        <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                          <p>{mock.questions} questions</p>
                          <p>{mock.duration}</p>
                          <p>{mock.format} • {mock.difficulty}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!onOpenTutor) return;
                            const scope = selectedSubjectId && selectedSubjectId !== 'all' ? 'the selected subject' : 'all active subjects';
                            onOpenTutor(
                              `Generate a ${mock.questions}-question ${mock.difficulty.toLowerCase()} ${mock.format.toLowerCase()} mock assessment for ${scope}. Title: "${mock.title}". Let me attempt first, then give feedback and mark scheme.`
                            );
                          }}
                          className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!onOpenTutor}
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate in AI Coach
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {assessmentTab === 'list' && (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="text-sm text-slate-600">Filters</div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search assessments"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    />
                    <select
                      value={selectedType}
                      onChange={(event) => setSelectedType(event.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="all">All types</option>
                      {assessmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(event) => setSelectedStatus(event.target.value as any)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="all">All status</option>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="graded">Graded</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {filteredAssignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => {
                      setSelectedReviewAssessmentId(assignment.id);
                      setAssessmentTab('review');
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/40 transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold text-slate-900 truncate">{assignment.name}</p>
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{assignment.description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(assignment)}`}>
                        {getStatusIcon(assignment)}
                        {getStatusText(assignment)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>Due: {assignment.dueDate.toLocaleDateString()}</span>
                      <span>Max Score: {assignment.maxScore}</span>
                      <span>Weight: {assignment.weight}%</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {getAssessmentTypeLabel(assignment)}
                      </span>
                      {assignment.result && (
                        <span className="font-semibold text-emerald-700">
                          Score: {Math.round((assignment.result.actualMark / assignment.maxScore) * 100)}%
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {filteredAssignments.length === 0 && !loading && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700">No Assessments</h3>
                  <p className="text-sm text-slate-500">No assessments match the selected filters.</p>
                </div>
              )}
            </>
          )}

          {assessmentTab === 'review' && (
            <>
              {!selectedReviewAssignment ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                  <Eye className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700">Select an assessment to review</h3>
                  <p className="text-sm text-slate-500">Open Assessment List and pick an assessment.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{selectedReviewAssignment.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{selectedReviewAssignment.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssessmentTab('list')}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Back to list
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-500">Outcome</p>
                        <p className="text-base font-semibold text-slate-800">
                          {selectedReviewAssignment.result
                            ? `${selectedReviewAssignment.result.actualMark}/${selectedReviewAssignment.maxScore}`
                            : 'Not graded'}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-500">Grade</p>
                        <p className="text-base font-semibold text-slate-800">
                          {selectedReviewAssignment.result?.grade || 'Pending'}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="text-base font-semibold text-slate-800">{getStatusText(selectedReviewAssignment)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                      <h4 className="text-lg font-semibold text-slate-900">Student Attempt</h4>
                      {!selectedReviewAssignment.submission ? (
                        <p className="text-sm text-slate-500">No submission has been made for this assessment yet.</p>
                      ) : (
                        <>
                          <div className="text-sm text-slate-600 space-y-1">
                            <p>
                              Submitted: {new Date(selectedReviewAssignment.submission.submittedAt).toLocaleString()}
                            </p>
                            <p>
                              Type: {selectedReviewAssignment.submission.submissionType === 'file' ? 'File upload' : 'Text submission'}
                            </p>
                          </div>
                          {selectedReviewAssignment.submission.submissionType === 'file' ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <p className="font-semibold">Uploaded file</p>
                              <p className="mt-1">
                                {(selectedReviewAssignment.submission as any).originalFilename ||
                                  selectedReviewAssignment.submission.originalFileName ||
                                  (selectedReviewAssignment.submission as any).content ||
                                  'File submitted'}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <p className="font-semibold mb-2">Submitted response</p>
                              <pre className="whitespace-pre-wrap break-words text-sm text-slate-700">
                                {(selectedReviewAssignment.submission as any).textContent ||
                                  (selectedReviewAssignment.submission as any).content ||
                                  'No text captured.'}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                      <h4 className="text-lg font-semibold text-slate-900">Feedback and Outcome</h4>
                      {!selectedReviewAssignment.result ? (
                        <p className="text-sm text-slate-500">Feedback will appear once this assessment has been graded.</p>
                      ) : (
                        <>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                            <p>
                              Expected mark: <span className="font-semibold">{selectedReviewAssignment.result.expectedMark}</span>
                            </p>
                            <p>
                              Actual mark: <span className="font-semibold">{selectedReviewAssignment.result.actualMark}</span>
                            </p>
                            <p>
                              Grade: <span className="font-semibold">{selectedReviewAssignment.result.grade}</span>
                            </p>
                          </div>
                          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            <p className="font-semibold">Teacher/AI Feedback</p>
                            <p className="mt-1">{selectedReviewAssignment.result.feedback || 'No feedback provided.'}</p>
                          </div>
                          {((selectedReviewAssignment.submission as any)?.result?.externalAssessmentData ||
                            (selectedReviewAssignment.result as any)?.externalAssessmentData) && (
                            <button
                              type="button"
                              onClick={() => handleViewDetailedFeedback(selectedReviewAssignment)}
                              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="w-4 h-4" />
                              View detailed rubric
                            </button>
                          )}
                          {onOpenTutor && (
                            <button
                              type="button"
                              onClick={() => onOpenTutor(
                                `Review my performance on "${selectedReviewAssignment.name}". My feedback: ${selectedReviewAssignment.result?.feedback || 'No feedback yet.'}. Help me identify where I went wrong and how to improve.`
                              )}
                              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              Review with AI Coach
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* Feedback Details Modal */}
      <Dialog
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium text-gray-900">
                Detailed Feedback
              </Dialog.Title>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {selectedFeedback?.assessment ? (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Assessment Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-3">Assessment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 bg-white rounded-md shadow-sm">
                      <p className="text-gray-600">Total Score</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedFeedback.assessment.marks_achieved || 'N/A'} {selectedFeedback.assessment.total_possible_marks || 'N/A'}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-md shadow-sm">
                      <p className="text-gray-600">Percentage</p>
                      <p className="text-2xl font-bold text-green-600">
                        {selectedFeedback.assessment.marks_percentage || 'N/A'}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-md shadow-sm">
                      <p className="text-gray-600">Confidence Score</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {selectedFeedback.assessment.confidence_assessment_score || 'N/A'}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Overall Feedback */}
                {selectedFeedback.assessment.overall_feedback && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">Overall Feedback</h4>
                    <p className="text-blue-900 leading-relaxed">{selectedFeedback.assessment.overall_feedback}</p>
                  </div>
                )}

                {/* Strengths */}
                {selectedFeedback.assessment.strengths && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Strengths
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-green-800">
                      {Array.isArray(selectedFeedback.assessment.strengths) ? (
                        selectedFeedback.assessment.strengths.map((item: string, idx: number) => (
                          <li key={idx} className="leading-relaxed">{item}</li>
                        ))
                      ) : (
                        <li className="leading-relaxed">{selectedFeedback.assessment.strengths}</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Areas for Improvement */}
                {selectedFeedback.assessment.improvements && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Areas for Improvement
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-yellow-800">
                      {Array.isArray(selectedFeedback.assessment.improvements) ? (
                        selectedFeedback.assessment.improvements.map((item: string, idx: number) => (
                          <li key={idx} className="leading-relaxed">{item}</li>
                        ))
                      ) : (
                        <li className="leading-relaxed">{selectedFeedback.assessment.improvements}</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Assessment Criteria Breakdown */}
                {selectedFeedback.assessment.criteria && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-3">Detailed Assessment Criteria</h4>
                    <div className="space-y-3">
                      {selectedFeedback.assessment.criteria.map((criterion: any, idx: number) => (
                        <div key={idx} className="bg-white p-3 rounded-md border border-gray-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-800">{criterion.criterion}</span>
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {criterion.score} / {criterion.max_marks || '30'}
                            </span>
                          </div>
                          {criterion.feedback && (
                            <p className="text-sm text-gray-700 leading-relaxed">{criterion.feedback}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question-by-Question Breakdown */}
                {selectedFeedback.assessment.assessment_details && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-3">Question-by-Question Feedback</h4>
                    <div className="space-y-3">
                      {Object.entries(selectedFeedback.assessment.assessment_details).map(([questionKey, details]: [string, any]) => (
                        <div key={questionKey} className="bg-white p-3 rounded-md border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-slate-800 capitalize">
                              {questionKey.replace('_', ' ')}
                            </span>
                            <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                              {details.awarded_marks} / {details.max_marks}
                            </span>
                          </div>
                          {details.feedback && (
                            <p className="text-sm text-slate-700 mb-2 leading-relaxed">{details.feedback}</p>
                          )}
                          {details.improvement && (
                            <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 border-l-2 border-blue-400">
                              <strong>Improvement tip:</strong> {details.improvement}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Information */}
                {(selectedFeedback.filename || selectedFeedback.module) && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">Submission Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {selectedFeedback.filename && (
                        <div>
                          <span className="text-blue-600 font-medium">File:</span>
                          <p className="text-blue-800">{selectedFeedback.filename}</p>
                        </div>
                      )}
                      {selectedFeedback.module && (
                        <div>
                          <span className="text-blue-600 font-medium">Module:</span>
                          <p className="text-blue-800">{selectedFeedback.module}</p>
                        </div>
                      )}
                      {selectedFeedback.content_type && (
                        <div>
                          <span className="text-blue-600 font-medium">File Type:</span>
                          <p className="text-blue-800">{selectedFeedback.content_type}</p>
                        </div>
                      )}
                      {selectedFeedback.pages && (
                        <div>
                          <span className="text-blue-600 font-medium">Pages:</span>
                          <p className="text-blue-800">{selectedFeedback.pages}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No detailed feedback available.</p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default StudentAssignments;
