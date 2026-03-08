import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import StudentsLayout from '../components/students/StudentsLayout';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import { studentService } from '../services/api';

const getInitials = (student: { firstName?: string; lastName?: string }) =>
  `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();

const formatStatusLabel = (value?: string | null) => {
  if (!value) return 'N/A';
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const StudentProfilePage: React.FC = () => {
  const location = useLocation();
  const teacherId = authService.getCurrentUserId();

  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [profileSummary, setProfileSummary] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [studentQuery, setStudentQuery] = useState('');
  const [subjectFocusId, setSubjectFocusId] = useState('all');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const studentId = params.get('studentId');
    if (studentId) {
      setSelectedStudentId(studentId);
    }
  }, [location.search]);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!teacherId) {
        setSubjects([]);
        return;
      }
      try {
        const data = await teacherService.getMySubjects(teacherId);
        setSubjects((data || []).map((subject) => ({ id: subject.subjectId, name: subject.subjectName })));
      } catch (error) {
        console.error('Failed to load subjects:', error);
        setSubjects([]);
      }
    };
    loadSubjects();
  }, [teacherId]);

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
          subjectId: subjectFocusId === 'all' ? undefined : subjectFocusId,
          q: studentQuery.trim() || undefined,
          page: 0,
          size: 200,
        });
        let items = Array.isArray(response?.items) ? response.items : [];

        if (items.length === 0) {
          const rawStudents = await studentService.getStudents(subjectFocusId === 'all' ? undefined : subjectFocusId).catch(() => []);
          const normalizedQuery = studentQuery.trim().toLowerCase();
          items = (Array.isArray(rawStudents) ? rawStudents : [])
            .filter((student) => {
              if (!normalizedQuery) return true;
              const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
              return fullName.includes(normalizedQuery) || (student.email || '').toLowerCase().includes(normalizedQuery);
            })
            .map((student) => ({
              studentId: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              email: student.email,
              overall: student.overall ?? 0,
              performance: student.performance ?? null,
              engagement: student.engagement ?? null,
              strength: student.strength ?? null,
              subjectCount: Array.isArray(student.subjects) ? student.subjects.length : 0,
              classCount: 0,
              planStatus: null,
              planProgress: null,
              activePlanName: null,
            }));
        }

        setStudents(items);
        if (!selectedStudentId && items.length > 0) {
          setSelectedStudentId(items[0].studentId);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
      } finally {
        setLoadingList(false);
      }
    };

    loadStudents();
  }, [teacherId, selectedStudentId, subjectFocusId, studentQuery]);

  useEffect(() => {
    const loadStudentDetails = async () => {
      if (!teacherId || !selectedStudentId) {
        setProfileSummary(null);
        return;
      }
      setLoadingDetails(true);
      try {
        const summary = await teacherService.getStudentProfileSummary(
          teacherId,
          selectedStudentId,
          subjectFocusId === 'all' ? undefined : subjectFocusId
        );
        setProfileSummary(summary);
      } catch (error) {
        console.error('Failed to load student profile summary:', error);
        setProfileSummary(null);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadStudentDetails();
  }, [teacherId, selectedStudentId, subjectFocusId]);

  const filteredStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || (student.email || '').toLowerCase().includes(query);
    });
  }, [students, studentQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((student) => student.studentId === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const selectedStudentOptionValue = useMemo(() => {
    return filteredStudents.some((student) => student.studentId === selectedStudentId)
      ? selectedStudentId
      : '';
  }, [filteredStudents, selectedStudentId]);

  const studentCard = profileSummary?.student || selectedStudent;

  return (
    <StudentsLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <input
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Search student"
              className="w-full lg:max-w-[380px] px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              <select
                value={selectedStudentOptionValue}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                <option value="" disabled>
                  {filteredStudents.length > 0 ? 'Select student' : 'No students found'}
                </option>
                {filteredStudents.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
              <select
                value={subjectFocusId}
                onChange={(event) => setSubjectFocusId(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                <option value="all">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadingList || loadingDetails ? (
          <div className="bg-gray-50 rounded-lg shadow p-4 space-y-4">
            <div className="h-24 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
            <div className="h-32 bg-slate-200 rounded animate-pulse" />
          </div>
        ) : studentCard && profileSummary ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                    {getInitials(studentCard)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{studentCard.firstName} {studentCard.lastName}</h3>
                    <p className="text-sm text-gray-500">{studentCard.email}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Overall</div>
                    <div className="text-lg font-bold text-blue-600">{studentCard.overall ?? 0}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Mastery</div>
                    <div className="text-lg font-bold text-green-600">{Math.round(profileSummary.planSummary?.averageProgress ?? 0)}%</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-2">Profile Details</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Performance</span><span>{studentCard.performance || 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Engagement</span><span>{studentCard.engagement || 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Strength</span><span>{studentCard.strength || 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Grade level</span><span>{studentCard.gradeLevel || 'N/A'}</span></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-2">Plan Overview</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Total plans</span><span>{profileSummary.planSummary?.totalPlans ?? 0}</span></div>
                  <div className="flex justify-between"><span>Active plans</span><span>{profileSummary.planSummary?.activePlans ?? 0}</span></div>
                  <div className="flex justify-between"><span>Completed plans</span><span>{profileSummary.planSummary?.completedPlans ?? 0}</span></div>
                  <div className="flex justify-between"><span>Latest status</span><span>{formatStatusLabel(profileSummary.planSummary?.latestStatus)}</span></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-2">Assessment Overview</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Total assigned</span><span>{profileSummary.assessmentSummary?.totalAssigned ?? 0}</span></div>
                  <div className="flex justify-between"><span>Attempted</span><span>{profileSummary.assessmentSummary?.attempted ?? 0}</span></div>
                  <div className="flex justify-between"><span>Reviewed</span><span>{profileSummary.assessmentSummary?.reviewed ?? 0}</span></div>
                  <div className="flex justify-between"><span>Average score</span><span>{profileSummary.assessmentSummary?.averageScore ?? 0}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold mb-3">Latest Snapshot</h4>
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2 text-sm text-gray-600">
                <div>
                  Latest assessment:{' '}
                  <span className="font-semibold text-gray-800">{profileSummary.assessmentSummary?.latestAssessmentName || 'N/A'}</span>
                </div>
                <div>
                  Latest score:{' '}
                  <span className="font-semibold text-gray-800">{profileSummary.assessmentSummary?.latestScore ?? 0}</span>
                </div>
                <div>
                  Latest grade:{' '}
                  <span className="font-semibold text-gray-800">{profileSummary.assessmentSummary?.latestGrade || 'N/A'}</span>
                </div>
                <div>
                  Latest due date:{' '}
                  <span className="font-semibold text-gray-800">
                    {profileSummary.assessmentSummary?.latestDueTime
                      ? new Date(profileSummary.assessmentSummary.latestDueTime).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  Latest plan:{' '}
                  <span className="font-semibold text-gray-800">{profileSummary.planSummary?.latestPlanName || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Student Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade Level</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-sm text-center text-gray-500">
                      Select a student to view details.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </StudentsLayout>
  );
};

export default StudentProfilePage;
