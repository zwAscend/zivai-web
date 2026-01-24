import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
  FileText,
  Edit3,
  Save,
  CheckCircle,
  User,
  Calendar,
  Award,
  TrendingUp,
  AlertTriangle,
  Eye,
  X,
  Clock,
  Target,
  BookOpen
} from 'lucide-react';
import { submissionService } from '../../services/api';
import { toast } from 'sonner';
import ExternalAssessmentDetails from './ExternalAssessmentDetails';

interface SubmissionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  onReviewComplete: () => void;
}

interface SubmissionDetails {
  _id: string;
  student: {
    _id: string;
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assessment: {
    _id: string;
    name: string;
    description: string;
    type: string;
    maxScore: number;
    weight: number;
    dueDate: string;
  };
  submissionType: 'file' | 'text';
  submittedAt: string;
  status: string;
  autoGrading: {
    result: {
      totalScore: number;
      percentage: number;
      grade: string;
      feedback: string;
      breakdown: any;
      confidence: number;
      gradedAt: string;
    };
  };
  teacherReview?: {
    reviewed: boolean;
    reviewedAt?: string;
    adjustments?: {
      scoreAdjustment: number;
      feedbackAdjustment: string;
      finalScore: number;
      finalGrade: string;
    };
  };
  submissionContent: string;
  externalAssessmentData?: any;
}

const SubmissionReviewModal: React.FC<SubmissionReviewModalProps> = ({
  isOpen,
  onClose,
  submissionId,
  onReviewComplete,
}) => {
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedScore, setEditedScore] = useState<number>(0);
  const [editedGrade, setEditedGrade] = useState<string>('');
  const [additionalFeedback, setAdditionalFeedback] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'content'>('overview');

  useEffect(() => {
    if (isOpen && submissionId) {
      fetchSubmissionDetails();
    }
  }, [isOpen, submissionId]);

  const fetchSubmissionDetails = async () => {
    try {
      setLoading(true);
      const details = await submissionService.getSubmissionDetails(submissionId);
      setSubmission(details);

      const currentScore = details.teacherReview?.adjustments?.finalScore || details.autoGrading.result.totalScore;
      const currentGrade = details.teacherReview?.adjustments?.finalGrade || details.autoGrading.result.grade;

      setEditedScore(currentScore);
      setEditedGrade(currentGrade);
      setAdditionalFeedback(details.teacherReview?.adjustments?.feedbackAdjustment || '');
    } catch (error) {
      console.error('Error fetching submission details:', error);
      toast.error('Failed to load submission details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!submission) return;
    
    try {
      setSaving(true);
      const scoreAdjustment = editedScore - submission.autoGrading.result.totalScore;

      await submissionService.reviewSubmission(submissionId, {
        scoreAdjustment,
        feedbackAdjustment: additionalFeedback,
        finalScore: editedScore,
        finalGrade: editedGrade,
      });

      toast.success('Review saved successfully');
      setEditing(false);
      onReviewComplete();
      await fetchSubmissionDetails();
    } catch (error) {
      console.error('Error saving review:', error);
      toast.error('Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  const calculateGrade = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 45) return 'D+';
    if (percentage >= 40) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string) => {
    if (['A+', 'A'].includes(grade)) return 'text-green-600 bg-green-100 border-green-200';
    if (['A-', 'B+', 'B'].includes(grade)) return 'text-blue-600 bg-blue-100 border-blue-200';
    if (['B-', 'C+', 'C'].includes(grade)) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-100';
    if (confidence >= 70) return 'text-blue-600 bg-blue-100';
    if (confidence >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'details', label: 'AI Analysis', icon: TrendingUp },
    { key: 'content', label: 'Submission', icon: FileText }
  ];

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  Assignment Review
                </DialogTitle>
                {submission && (
                  <p className="text-emerald-100 mt-1">
                    {submission.assessment.name} • {submission.student.firstName} {submission.student.lastName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading submission details...</p>
            </div>
          </div>
        ) : submission ? (
          <div className="flex-1 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 bg-white">
              <div className="flex">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                      activeTab === key
                        ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Student & Assignment Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Student Information
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-blue-900">
                              {submission.student.firstName} {submission.student.lastName}
                            </p>
                            <p className="text-sm text-blue-700">{submission.student.id}</p>
                          </div>
                        </div>
                        <div className="text-sm text-blue-800">
                          <p><strong>Email:</strong> {submission.student.email}</p>
                          <p><strong>Submitted:</strong> {new Date(submission.submittedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Assignment Details
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-purple-900">{submission.assessment.name}</h4>
                          <p className="text-sm text-purple-700 mt-1">{submission.assessment.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-purple-800">
                          <div>
                            <p><strong>Type:</strong> {submission.assessment.type}</p>
                            <p><strong>Max Score:</strong> {submission.assessment.maxScore}</p>
                          </div>
                          <div>
                            <p><strong>Weight:</strong> {submission.assessment.weight}%</p>
                            <p><strong>Due:</strong> {new Date(submission.assessment.dueDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grading Results */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Award className="w-6 h-6 text-emerald-600" />
                        Grading Results
                      </h3>
                      {!editing && (
                        <Button 
                          variant="outline" 
                          onClick={() => setEditing(true)}
                          className="flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit Grade
                        </Button>
                      )}
                    </div>

                    {editing ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              Score (out of {submission.assessment.maxScore})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={submission.assessment.maxScore}
                              value={editedScore}
                              onChange={(e) => {
                                const score = parseInt(e.target.value);
                                setEditedScore(score);
                                setEditedGrade(calculateGrade(score, submission.assessment.maxScore));
                              }}
                              className="text-lg font-semibold"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Grade</label>
                            <Input 
                              value={editedGrade} 
                              onChange={(e) => setEditedGrade(e.target.value)}
                              className="text-lg font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">
                            Additional Teacher Feedback
                          </label>
                          <Textarea
                            value={additionalFeedback}
                            onChange={(e) => setAdditionalFeedback(e.target.value)}
                            rows={4}
                            placeholder="Add your comments, suggestions, or additional feedback..."
                            className="resize-none"
                          />
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                          <Button 
                            onClick={handleSaveReview} 
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2"
                          >
                            {saving ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Review
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setEditing(false)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Score Display */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <div className="text-4xl font-bold text-emerald-600">
                                  {submission.teacherReview?.adjustments?.finalScore || submission.autoGrading.result.totalScore}
                                </div>
                                <p className="text-sm text-emerald-700">
                                  out of {submission.assessment.maxScore}
                                </p>
                              </div>
                              <div className="text-center">
                                <Badge className={`text-xl px-4 py-2 border ${getGradeColor(submission.teacherReview?.adjustments?.finalGrade || submission.autoGrading.result.grade)}`}>
                                  {submission.teacherReview?.adjustments?.finalGrade || submission.autoGrading.result.grade}
                                </Badge>
                                <p className="text-sm text-emerald-700 mt-1">
                                  {submission.autoGrading.result.percentage}%
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right space-y-2">
                              <Badge className={`${getConfidenceColor(submission.autoGrading.result.confidence)} border`}>
                                AI Confidence: {submission.autoGrading.result.confidence}%
                              </Badge>
                              {submission.teacherReview?.reviewed && (
                                <div className="flex items-center gap-1 text-sm text-emerald-700">
                                  <CheckCircle className="w-4 h-4" />
                                  Teacher Reviewed
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <Progress 
                            value={(editedScore / submission.assessment.maxScore) * 100} 
                            className="h-3"
                          />
                        </div>

                        {/* Feedback Sections */}
                        <div className="grid gap-4">
                          {submission.autoGrading.result.feedback && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                AI Feedback
                              </h4>
                              <p className="text-blue-800 text-sm leading-relaxed">
                                {submission.autoGrading.result.feedback}
                              </p>
                            </div>
                          )}

                          {submission.teacherReview?.adjustments?.feedbackAdjustment && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Teacher's Additional Feedback
                              </h4>
                              <p className="text-green-800 text-sm leading-relaxed">
                                {submission.teacherReview.adjustments.feedbackAdjustment}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'details' && submission.externalAssessmentData?.assessment && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Detailed AI Analysis</h3>
                    <p className="text-gray-600">Comprehensive breakdown of the automated grading process</p>
                  </div>
                  <ExternalAssessmentDetails assessment={submission.externalAssessmentData.assessment} />
                </div>
              )}

              {activeTab === 'content' && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Student Submission</h3>
                    <p className="text-gray-600">Original content submitted by the student</p>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <h4 className="font-semibold text-gray-900">Submission Content</h4>
                      <Badge variant="outline" className="text-xs">
                        {submission.submissionType.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                        {submission.submissionContent}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">Failed to load submission details</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionReviewModal;