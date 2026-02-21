import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import DevelopmentLayout from '../components/development/DevelopmentLayout';

const DevelopmentPlansPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const navigate = useNavigate();
  const teacherId = authService.getCurrentUserId();

  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      if (!teacherId) {
        setSubjects([]);
        return;
      }
      try {
        const data = await teacherService.getMySubjects(teacherId);
        const mapped = (data || []).map((subject) => ({ id: subject.subjectId, name: subject.subjectName }));
        setSubjects(mapped);
        if (!subjectFilter && selectedSubject?.id) {
          setSubjectFilter(selectedSubject.id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
        setSubjects([]);
      }
    };
    loadSubjects();
  }, [teacherId, selectedSubject?.id, subjectFilter]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!teacherId) {
        setStudents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await teacherService.getStudentsSummary(teacherId, {
          subjectId: subjectFilter || undefined,
          performance: performanceFilter === 'all' ? undefined : performanceFilter,
          planStatus: planFilter === 'all' ? undefined : planFilter,
          q: query.trim() || undefined,
          page: 0,
          size: 200,
        });

        setStudents(Array.isArray(response?.items) ? response.items : []);
      } catch (error) {
        console.error('Failed to load students for development plans:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [teacherId, subjectFilter, performanceFilter, planFilter, query]);

  return (
    <DevelopmentLayout>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Student Development Plans</h2>
            <p className="text-sm text-slate-500">Track active plans, progress, and intervention status per learner.</p>
          </div>
          <button
            onClick={() => navigate('/development/profile')}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Back to Development Profile
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student"
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select
            value={performanceFilter}
            onChange={(e) => setPerformanceFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All performance</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="average">Average</option>
            <option value="needs-improvement">Needs improvement</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All plans</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ) : students.length > 0 ? (
          <div className="space-y-3">
            {students.map((student) => {
              const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`;
              const progress = student.planProgress ?? 0;
              const status = student.planStatus || 'Unassigned';
              const planName = student.activePlanName || 'Plan not assigned';
              return (
                <div
                  key={student.studentId}
                  className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-left hover:border-blue-400 hover:shadow transition"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                        {initials || 'ST'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Overall: {student.overall ?? 0}% • {student.performance || 'Tracking'}
                        </p>
                        <p className="text-xs text-slate-600">Plan: {planName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                        {status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Plan progress</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Engagement</span>
                        <span className="font-medium">{student.engagement || 'Medium'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Strength</span>
                        <span className="font-medium">{student.strength || 'Tracking'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => navigate(`/development/${student.studentId}`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                        type="button"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No student plans available for the selected filters.</div>
        )}
      </div>
    </DevelopmentLayout>
  );
};

export default DevelopmentPlansPage;
