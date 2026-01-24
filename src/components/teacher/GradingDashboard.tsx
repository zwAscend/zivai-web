import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Users,
  BarChart3,
  Filter,
  Search,
  ArrowLeft
} from 'lucide-react';
import { submissionService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import SubmissionReviewModal from './SubmissionReviewModal';

interface GradingStats {
  totalSubmissions: number;
  autoGradedCount: number;
  teacherReviewedCount: number;
  averageScore: number;
  averageConfidence: number;
}

interface PendingSubmission {
  _id: string;
  student: {
    _id: string;
    id: string;
    firstName: string;
    lastName: string;
  };
  assessment: {
    _id: string;
    name: string;
    type: string;
    maxScore: number;
    dueDate: string;
  };
  submittedAt: string;
  status: string;
  autoGrading: {
    result: {
      totalScore: number;
      percentage: number;
      grade: string;
      confidence: number;
    };
  };
}

const GradingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GradingStats | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'graded' | 'submitted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedCourse } = useAuth();

  useEffect(() => {
    fetchData();
  }, [selectedCourse]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, submissionsData] = await Promise.all([
        submissionService.getGradingStats(selectedCourse?.id),
        submissionService.getPendingSubmissions()
      ]);
      
      setStats(statsData);
      console.log('Fetched stats:', statsData);
      console.log('Fetched submissions:', submissionsData);
      setPendingSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching grading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmission = (submissionId: string) => {
    setSelectedSubmission(submissionId);
    setShowReviewModal(true);
  };

  const filteredSubmissions = pendingSubmissions.filter(submission => {
    const matchesStatus = filterStatus === 'all' || submission.status === filterStatus;
    const matchesSearch = searchQuery === '' || 
      submission.student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.assessment.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded': return 'text-green-600 bg-green-100';
      case 'submitted': return 'text-yellow-600 bg-yellow-100';
      case 'reviewed': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-blue-600';
    if (confidence >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4 mb-2">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800">Grading Dashboard</h2>
          </div>
          <p className="text-sm text-gray-600 ml-14">Review automatically graded assignments and manage submissions</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-blue-500 mr-2" />
                <div>
                  <div className="text-xl font-bold text-gray-800">{stats.totalSubmissions}</div>
                  <div className="text-xs text-gray-500">Total Submissions</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
                <div>
                  <div className="text-xl font-bold text-gray-800">{stats.autoGradedCount}</div>
                  <div className="text-xs text-gray-500">Auto-Graded</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <Users className="w-6 h-6 text-purple-500 mr-2" />
                <div>
                  <div className="text-xl font-bold text-gray-800">{stats.teacherReviewedCount}</div>
                  <div className="text-xs text-gray-500">Teacher Reviewed</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <BarChart3 className="w-6 h-6 text-orange-500 mr-2" />
                <div>
                  <div className="text-xl font-bold text-gray-800">{Math.round(stats.averageScore)}</div>
                  <div className="text-xs text-gray-500">Avg Score</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 text-cyan-500 mr-2" />
                <div>
                  <div className="text-xl font-bold text-gray-800">{Math.round(stats.averageConfidence)}%</div>
                  <div className="text-xs text-gray-500">AI Confidence</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex gap-2">
              {['all', 'graded', 'submitted'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search submissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 border-b">
            <h3 className="text-base font-semibold text-gray-800">Recent Submissions</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {submission.student.firstName} {submission.student.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{submission.student.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{submission.assessment.name}</div>
                        <div className="text-sm text-gray-500">{submission.assessment.type}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {submission.autoGrading.result.totalScore}/{submission.assessment.maxScore}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.autoGrading.result.percentage}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getConfidenceColor(submission.autoGrading.result.confidence)}`}>
                        {submission.autoGrading.result.confidence}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(submission.status)}`}>
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleReviewSubmission(submission._id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSubmissions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No submissions found matching your criteria.
            </div>
          )}
        </div>

        {/* Review Modal */}
        {showReviewModal && selectedSubmission && (
          <SubmissionReviewModal
            isOpen={showReviewModal}
            onClose={() => {
              setShowReviewModal(false);
              setSelectedSubmission(null);
            }}
            submissionId={selectedSubmission}
            onReviewComplete={() => {
              fetchData(); // Refresh data
            }}
          />
        )}
      </div>
    </div>
  );
};

export default GradingDashboard;