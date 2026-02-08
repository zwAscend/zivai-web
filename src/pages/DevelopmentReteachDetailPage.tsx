import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DevelopmentLayout from '../components/development/DevelopmentLayout';
import { Student } from '../types';

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

        {!card ? (
          <div className="text-sm text-slate-500">No details available for card {id}.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{card.topic}</p>
                    <p className="text-xs text-slate-500">Subject: {card.subject}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${card.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}
                  >
                    {card.priority} priority
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Focus issue</p>
                  <p className="mt-1">{card.notes}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-900">Suggested re-teach plan</p>
                <p className="text-xs text-slate-500 mt-1">{card.planName}</p>
                <ul className="text-xs text-slate-600 mt-3 space-y-2">
                  <li>• Re-teach the key misconception with a worked example.</li>
                  <li>• Run a short guided practice set and check for understanding.</li>
                  <li>• Assign an exit assessment and update mastery signals.</li>
                </ul>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-sm font-semibold text-slate-900">Students affected</p>
              <p className="text-xs text-slate-500 mt-1">{card.students.length} learners</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {card.students.map((student) => (
                  <span
                    key={student.id}
                    className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600"
                  >
                    {student.firstName} {student.lastName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DevelopmentLayout>
  );
};

export default DevelopmentReteachDetailPage;
