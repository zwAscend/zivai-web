import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentsLayout from '../components/students/StudentsLayout';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

const performanceOptions = [
  { value: 'all', label: 'All performance' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'average', label: 'Average' },
  { value: 'needs-improvement', label: 'Needs improvement' },
];

const getInitials = (student: { firstName?: string; lastName?: string }) =>
  `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();

const normalizePerformance = (student: { overall?: number | null; performance?: string | null }) => {
  const overall = typeof student.overall === 'number' ? student.overall : 0;
  if (overall >= 75) return 'excellent';
  if (overall >= 65) return 'good';
  if (overall >= 55) return 'average';
  if (overall > 0) return 'needs-improvement';

  const raw = (student.performance || '').toLowerCase();
  if (raw.includes('excellent')) return 'excellent';
  if (raw.includes('good')) return 'good';
  if (raw.includes('average')) return 'average';
  if (raw.includes('need')) return 'needs-improvement';
  return 'unknown';
};

const getPerformanceLabel = (student: { performance?: string | null; overall?: number | null }) => {
  if (student.performance) return student.performance;
  const bucket = normalizePerformance(student);
  if (bucket === 'excellent') return 'Excellent';
  if (bucket === 'good') return 'Good';
  if (bucket === 'average') return 'Average';
  if (bucket === 'needs-improvement') return 'Needs improvement';
  return 'Unrated';
};

const getPerformanceBadge = (student: { performance?: string | null; overall?: number | null }) => {
  const bucket = normalizePerformance(student);
  if (bucket === 'excellent') return 'bg-emerald-50 text-emerald-700';
  if (bucket === 'good') return 'bg-blue-50 text-blue-700';
  if (bucket === 'average') return 'bg-amber-50 text-amber-700';
  if (bucket === 'needs-improvement') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-600';
};

const StudentDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedSubject } = useAuth();
  const teacherId = authService.getCurrentUserId();

  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!teacherId) {
        setSubjects([]);
        return;
      }
      try {
        const teaching = await teacherService.getMySubjects(teacherId);
        const mapped = (teaching || []).map((subject) => ({
          id: subject.subjectId,
          name: subject.subjectName,
        }));
        setSubjects(mapped);
        if (selectedSubject?.id) {
          setSelectedSubjectId(selectedSubject.id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
        setSubjects([]);
      }
    };
    loadSubjects();
  }, [teacherId, selectedSubject]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!teacherId) {
        setStudents([]);
        setLoadingList(false);
        return;
      }

      setLoadingList(true);
      try {
        const response = await teacherService.getStudentsSummary(teacherId, {
          subjectId: selectedSubjectId === 'all' ? undefined : selectedSubjectId,
          performance: performanceFilter === 'all' ? undefined : performanceFilter,
          q: searchQuery.trim() || undefined,
          page: 0,
          size: 200,
        });
        setStudents(Array.isArray(response?.items) ? response.items : []);
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
      } finally {
        setLoadingList(false);
      }
    };

    loadStudents();
  }, [teacherId, selectedSubjectId, performanceFilter, searchQuery]);

  return (
    <StudentsLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Student Directory</h1>
              <p className="text-sm text-slate-500">Browse students, filter by subject, and open full profiles.</p>
            </div>
            <div className="text-xs text-slate-500">{students.length} students</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">Filters</div>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name or email"
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                <option value="all">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <select
                value={performanceFilter}
                onChange={(event) => setPerformanceFilter(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                {performanceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadingList ? (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 bg-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-sm text-slate-500">No students found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {students.map((student) => (
              <div key={student.studentId} className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                      {getInitials(student)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{student.email}</div>
                      <div className="text-xs text-slate-500">
                        Reg #: {student.studentId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Overall</div>
                      <div className="text-lg font-semibold text-blue-600">{student.overall ?? 0}%</div>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-full ${getPerformanceBadge(student)}`}>
                      {getPerformanceLabel(student)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Engagement: {student.engagement || '—'}</span>
                  <span>Subjects: {student.subjectCount ?? 0}</span>
                  <button
                    onClick={() => navigate(`/students/profile?studentId=${student.studentId}`)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentsLayout>
  );
};

export default StudentDirectoryPage;
