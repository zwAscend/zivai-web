import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/resources/Sidebar';
import { assessmentService } from '../services/api';
import { Assessment } from '../types';

const AssessmentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssessment = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await assessmentService.getAssessment(id);
        setAssessment(data);
      } catch (error) {
        console.error('Failed to load assessment:', error);
        setAssessment(null);
      } finally {
        setLoading(false);
      }
    };

    loadAssessment();
  }, [id]);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onViewAssessments={() => navigate('/assessments')}
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onAssessmentAnalysis={() => navigate(`/assessments/analysis${id ? `?assessmentId=${id}` : ''}`)}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="view-assessments"
        recentUploads={[]}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Assessment Details</h1>
              <p className="text-sm text-gray-500">Review assessment structure and metadata.</p>
            </div>
            <button
              onClick={() => navigate('/assessments')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Assessments
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : assessment ? (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{assessment.name}</h2>
                <p className="text-sm text-gray-500">{assessment.description || 'No description provided.'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <span className="text-xs text-gray-400">Type</span>
                  <div className="font-medium">{assessment.type || (assessment as any).assessmentType || 'Assessment'}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Status</span>
                  <div className="font-medium">{assessment.status || 'draft'}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Visibility</span>
                  <div className="font-medium">{(assessment as any).visibility || 'private'}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Max Score</span>
                  <div className="font-medium">{assessment.maxScore ?? 0}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Weight %</span>
                  <div className="font-medium">{assessment.weight ?? (assessment as any).weightPct ?? 0}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">AI Enhanced</span>
                  <div className="font-medium">{(assessment as any).isAIEnhanced || (assessment as any).aiEnhanced ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/assessments/analysis?assessmentId=${assessment.id}`)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View assessment analysis
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Assessment not found.</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AssessmentDetailPage;
