import React, { useEffect, useMemo, useState, DragEvent } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { 
  Loader2, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Award,
  Eye,
  Download,
  User
} from 'lucide-react';
import { markingService } from '@/services/markingService';
import { toast } from 'sonner';
import { Assessment, Student, Subject } from '@/types';
import { assessmentService } from '@/services/assessmentService';

interface MarkAssignmentModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  embedded?: boolean;
  subjects: Subject[];
  selectedSubjectId: string;
  onSubjectChange: (subjectId: string) => void;
  students: Student[];
  assessments: Assessment[];
}

interface MarkingResult {
  marks: number;
  feedback: string;
  criteria: Array<{
    criterion: string;
    score: number;
    comments: string;
  }>;
}

export const MarkAssignmentModal: React.FC<MarkAssignmentModalProps> = ({
  isOpen,
  onOpenChange,
  embedded = false,
  subjects,
  selectedSubjectId,
  onSubjectChange,
  students,
  assessments,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [results, setResults] = useState<MarkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');

  useEffect(() => {
    if (!selectedStudentId || !students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0]?.id || '');
    }
  }, [students, selectedStudentId]);

  useEffect(() => {
    if (!selectedAssessmentId || !assessments.some((assessment) => assessment.id === selectedAssessmentId)) {
      setSelectedAssessmentId(assessments[0]?.id || '');
    }
  }, [assessments, selectedAssessmentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId),
    [students, selectedStudentId],
  );

  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === selectedAssessmentId),
    [assessments, selectedAssessmentId],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setResults(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp'
      ];
      
      if (allowedTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setError(null);
        setResults(null);
      } else {
        setError('Please upload a PDF, Word document, text file, or image');
      }
    }
  };

  const resolveGrade = (marks: number) => {
    if (marks >= 80) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 50) return 'D';
    return 'F';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please select a file to mark');
      return;
    }

    if (!selectedStudentId) {
      toast.error('Select the student whose work is being marked');
      return;
    }

    if (!selectedAssessmentId) {
      toast.error('Select the assessment being marked');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await markingService.markDocument(file);
      setResults(result);
      toast.success('Assessment marked successfully');
    } catch (error) {
      console.error('Error marking assessment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark assessment';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResult = async () => {
    if (!results || !selectedAssessmentId || !selectedStudentId) {
      toast.error('Missing assessment or student selection.');
      return;
    }

    setIsSavingResult(true);
    try {
      await assessmentService.addResult(selectedAssessmentId, {
        student: selectedStudentId,
        expectedMark: selectedAssessment?.maxScore ?? 100,
        actualMark: results.marks,
        grade: resolveGrade(results.marks),
        feedback: results.feedback,
        submittedDate: new Date(),
        externalAssessmentData: {
          source: 'ai_marking_workspace',
          fileName: file?.name || null,
          criteria: results.criteria,
        },
      });
      toast.success('Marked result saved to the selected student.');
    } catch (saveError) {
      console.error('Failed to save marked result:', saveError);
      const message = saveError instanceof Error ? saveError.message : 'Failed to save marked result';
      toast.error(message);
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setError(null);
    setIsLoading(false);
    if (!embedded) {
      onOpenChange?.(false);
    }
  };

  const getGradeColor = (marks: number) => {
    if (marks >= 85) return 'text-green-600 bg-green-100';
    if (marks >= 70) return 'text-blue-600 bg-blue-100';
    if (marks >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCriterionColor = (score: number) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const workspace = (
    <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 bg-white">
          {!results ? (
            /* Upload Section */
            <form onSubmit={handleSubmit} className="h-full min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(event) => onSubjectChange(event.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    >
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Assessment</label>
                    <select
                      value={selectedAssessmentId}
                      onChange={(event) => setSelectedAssessmentId(event.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    >
                      {assessments.length === 0 ? (
                        <option value="">No assessments for this subject</option>
                      ) : assessments.map((assessment) => (
                        <option key={assessment.id} value={assessment.id}>
                          {assessment.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Student</label>
                    <select
                      value={selectedStudentId}
                      onChange={(event) => setSelectedStudentId(event.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    >
                      {students.length === 0 ? (
                        <option value="">No students for this subject</option>
                      ) : students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedStudent && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="w-4 h-4" />
                      <span className="text-sm font-semibold">Student Context</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 space-y-1">
                      <div>{selectedStudent.firstName} {selectedStudent.lastName}</div>
                      <div className="text-xs">{selectedStudent.email}</div>
                      <div className="text-xs">Performance: {selectedStudent.performance || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {/* File Upload Area */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Upload Assessment</h3>
                  </div>

                  <div
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : error
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileChange}
                      disabled={isLoading}
                      className="hidden"
                    />

                    {file ? (
                      <div className="space-y-3">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                          <FileText className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                          dragActive ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Upload className={`w-8 h-8 ${
                            dragActive ? 'text-blue-600' : 'text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <p className="text-lg font-medium text-gray-900">
                            {dragActive ? 'Drop your file here' : 'Upload assessment file'}
                          </p>
                          <p className="text-gray-500 mt-1">
                            Drag & drop or click to browse
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
                            Supported: PDF, DOC, DOCX, TXT, PNG, JPG, WEBP (max 10MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 p-4">
                <div className="flex justify-end gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || !file}
                    className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 min-w-[160px]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Marking...
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 mr-2" />
                        Mark Assessment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            /* Results Section */
            <div className="h-full min-h-0 overflow-y-auto p-6 space-y-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-800">Marked For</div>
                <div className="mt-1 text-sm text-slate-600">
                  {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'No student selected'}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedAssessment?.name || 'No assessment selected'}
                </div>
              </div>

              {/* Overall Score */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-green-900">Marking Results</h3>
                  <Badge className={`text-lg px-4 py-2 ${getGradeColor(results.marks)}`}>
                    {results.marks}/100
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700 font-medium">Overall Performance</span>
                    <span className="text-green-900 font-bold">{results.marks}%</span>
                  </div>
                  <Progress value={results.marks} className="h-3" />
                </div>
              </div>

              {/* Criteria Breakdown */}
              {results.criteria.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Detailed Breakdown
                  </h4>
                  
                  <div className="grid gap-4">
                    {results.criteria.map((criterion, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-semibold text-gray-800">{criterion.criterion}</h5>
                          <Badge variant="outline" className="font-bold">
                            {criterion.score}/100
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <Progress 
                            value={criterion.score} 
                            className="h-2"
                            style={{
                              '--progress-background': getCriterionColor(criterion.score)
                            } as React.CSSProperties}
                          />
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {criterion.comments}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall Feedback */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Overall Feedback
                </h4>
                <div className="prose prose-sm max-w-none">
                  <p className="text-blue-800 leading-relaxed whitespace-pre-wrap">
                    {results.feedback}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResults(null);
                    setFile(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Mark Another
                </Button>
                
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveResult}
                    disabled={isSavingResult}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                  >
                    {isSavingResult ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Save to Student
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Export results functionality
                      const exportData = {
                        fileName: file?.name,
                        marks: results.marks,
                        feedback: results.feedback,
                        criteria: results.criteria,
                        markedAt: new Date().toISOString()
                      };
                      
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                        type: 'application/json'
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `marking-results-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Results
                  </Button>
                  
                  <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );

  if (embedded) {
    return workspace;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        {workspace}
      </DialogContent>
    </Dialog>
  );
};
