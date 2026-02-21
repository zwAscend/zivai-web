import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import StudentsLayout from '../components/students/StudentsLayout';

const TeacherStudentsPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const teacherId = authService.getCurrentUserId();

  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [profileSummary, setProfileSummary] = useState<any | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadStudents = async () => {
      if (!teacherId) {
        setStudents([]);
        setSelectedStudentId('');
        setLoadingList(false);
        return;
      }

      setLoadingList(true);
      try {
        const response = await teacherService.getStudentsSummary(teacherId, {
          subjectId: selectedSubject?.id,
          q: searchQuery.trim() || undefined,
          page: 0,
          size: 200,
        });
        const items = Array.isArray(response?.items) ? response.items : [];
        setStudents(items);
        setSelectedStudentId((prev) => prev || items[0]?.studentId || '');
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
        setSelectedStudentId('');
      } finally {
        setLoadingList(false);
      }
    };

    loadStudents();
  }, [teacherId, selectedSubject?.id, searchQuery]);

  useEffect(() => {
    const loadStudentDetails = async () => {
      if (!teacherId || !selectedStudentId) {
        setProfileSummary(null);
        return;
      }
      setLoadingDetails(true);
      try {
        const summary = await teacherService.getStudentProfileSummary(teacherId, selectedStudentId, selectedSubject?.id);
        setProfileSummary(summary);
      } catch (error) {
        console.error('Failed to load student details:', error);
        setProfileSummary(null);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadStudentDetails();
  }, [teacherId, selectedStudentId, selectedSubject?.id]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || (student.email || '').toLowerCase().includes(query);
    });
  }, [students, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((student) => student.studentId === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const averageProgress = Math.round(profileSummary?.planSummary?.averageProgress ?? 0);

  return (
    <StudentsLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Students</h2>
            <span className="text-xs text-gray-500">{students.length}</span>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email"
            className="w-full mb-4 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loadingList ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filteredStudents.map((student) => (
                <button
                  key={student.studentId}
                  onClick={() => setSelectedStudentId(student.studentId)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedStudentId === student.studentId
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="text-sm font-medium truncate">
                    {student.firstName} {student.lastName}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{student.email}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No students found.</div>
          )}
        </div>

        <div className="lg:col-span-9 col-span-12 space-y-4">
          {loadingDetails ? (
            <div className="bg-gray-50 rounded-lg shadow p-4 space-y-4">
              <div className="h-20 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 bg-slate-200 rounded animate-pulse" />
                ))}
              </div>
              <div className="h-32 bg-slate-200 rounded animate-pulse" />
            </div>
          ) : selectedStudent && profileSummary ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg shadow p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                    <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                    <p className="text-sm text-gray-500">Reg #: {selectedStudent.studentId}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Overall</div>
                      <div className="text-lg font-bold text-blue-600">{selectedStudent.overall ?? 0}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Mastery</div>
                      <div className="text-lg font-bold text-green-600">{averageProgress}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold mb-2">Profile</h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between"><span>Performance</span><span>{selectedStudent.performance || '—'}</span></div>
                    <div className="flex justify-between"><span>Engagement</span><span>{selectedStudent.engagement || '—'}</span></div>
                    <div className="flex justify-between"><span>Strength</span><span>{selectedStudent.strength || '—'}</span></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold mb-2">Assessments</h4>
                  <div className="text-sm text-gray-600">Total assigned: {profileSummary.assessmentSummary?.totalAssigned ?? 0}</div>
                  <div className="text-sm text-gray-600">Attempted: {profileSummary.assessmentSummary?.attempted ?? 0}</div>
                  <div className="text-sm text-gray-600">Reviewed: {profileSummary.assessmentSummary?.reviewed ?? 0}</div>
                  <div className="text-xs text-gray-500 mt-2">Avg score: {profileSummary.assessmentSummary?.averageScore ?? 0}</div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold mb-2">Mastery Plans</h4>
                  <div className="text-sm text-gray-600">Total plans: {profileSummary.planSummary?.totalPlans ?? 0}</div>
                  <div className="text-sm text-gray-600">Active plans: {profileSummary.planSummary?.activePlans ?? 0}</div>
                  <div className="text-sm text-gray-600">Completed: {profileSummary.planSummary?.completedPlans ?? 0}</div>
                  <div className="text-xs text-gray-500 mt-2">Latest status: {profileSummary.planSummary?.latestStatus || '—'}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-3">Latest Snapshot</h4>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm text-gray-600 space-y-2">
                  <div>Assessment: <span className="font-medium text-gray-800">{profileSummary.assessmentSummary?.latestAssessmentName || '—'}</span></div>
                  <div>Grade: <span className="font-medium text-gray-800">{profileSummary.assessmentSummary?.latestGrade || '—'}</span></div>
                  <div>Plan: <span className="font-medium text-gray-800">{profileSummary.planSummary?.latestPlanName || '—'}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg shadow p-4 text-sm text-gray-500">Select a student to view details.</div>
          )}
        </div>
      </div>
    </StudentsLayout>
  );
};

export default TeacherStudentsPage;
