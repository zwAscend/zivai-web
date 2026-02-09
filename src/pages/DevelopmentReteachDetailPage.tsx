import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DevelopmentLayout from '../components/development/DevelopmentLayout';
import { Student } from '../types';
import { reteachCardService } from '../services/api';
import type { ReteachCardDetail } from '../services/reteachCardService';

interface ReteachCardState {
  card?: {
    id: string;
    topic: string;
    subject: string;
    priority: 'High' | 'Normal';
    students: Student[];
    planName: string;
    notes: string;
  };
}

const DevelopmentReteachDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = location.state as ReteachCardState | null;
  const card = state?.card;
  const [detail, setDetail] = useState<ReteachCardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPriorityLabel = (value?: string) => {
    if (!value) return 'Normal';
    const cleaned = value.replace(/_/g, ' ').toLowerCase();
    if (cleaned === 'high') return 'High';
    if (cleaned === 'medium') return 'Medium';
    if (cleaned === 'low') return 'Low';
    if (cleaned === 'normal') return 'Normal';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  useEffect(() => {
    const loadDetail = async () => {
      if (!id) return;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) return;
      setLoading(true);
      setError('');
      try {
        const data = await reteachCardService.getDetail(id);
        setDetail(data);
      } catch (err) {
        console.error('Failed to load re-teach card detail:', err);
        setError('Unable to load re-teach card details right now.');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [id]);

  const displayTopic = detail?.topicName || card?.topic || 'Topic';
  const displaySubject = detail?.subjectName || card?.subject || 'Subject';
  const priorityLabel = detail ? formatPriorityLabel(detail.priority) : card?.priority || 'Normal';
  const issueSummary = detail?.issueSummary || card?.notes;
  const recommendedActions = detail?.recommendedActions || card?.planName;
  const affectedStudents = detail?.affectedStudents
    ? detail.affectedStudents.map((student) => ({
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
      }))
    : card?.students || [];

  return (
    <DevelopmentLayout>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Re-teach Card Details</h2>
            <p className="text-sm text-slate-500">Topic-level remediation plan and student impact.</p>
          </div>
          <button
            onClick={() => navigate('/development/reteach')}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Back to Re-teach Cards
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-36 bg-slate-200 rounded-lg animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : !card && !detail ? (
          <div className="text-sm text-slate-500">No details available for card {id}.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{displayTopic}</p>
                    <p className="text-xs text-slate-500">Subject: {displaySubject}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      priorityLabel === 'High' ? 'bg-red-50 text-red-600' : priorityLabel === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {priorityLabel} priority
                  </span>
                </div>
                {issueSummary ? (
                  <div className="mt-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Focus issue</p>
                    <p className="mt-1">{issueSummary}</p>
                  </div>
                ) : null}
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-900">Suggested re-teach plan</p>
                {recommendedActions ? (
                  <p className="text-xs text-slate-500 mt-1">{recommendedActions}</p>
                ) : (
                  <ul className="text-xs text-slate-600 mt-3 space-y-2">
                    <li>• Re-teach the key misconception with a worked example.</li>
                    <li>• Run a short guided practice set and check for understanding.</li>
                    <li>• Assign an exit assessment and update mastery signals.</li>
                  </ul>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-sm font-semibold text-slate-900">Students affected</p>
              <p className="text-xs text-slate-500 mt-1">{affectedStudents.length} learners</p>
              {affectedStudents.length ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {affectedStudents.map((student) => (
                    <span
                      key={student.id}
                      className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600"
                    >
                      {student.firstName} {student.lastName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-3">No students linked yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </DevelopmentLayout>
  );
};

export default DevelopmentReteachDetailPage;
