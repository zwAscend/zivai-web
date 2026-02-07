import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { assessmentService, developmentService, studentService, subjectService } from '../services/api';
import { DevelopmentPlan, Student, Subject } from '../types';

interface SubjectMap {
  [id: string]: Subject;
}

interface AssessmentSummary {
  totalAssessments: number;
  latestAssessmentName?: string;
  latestScore?: number;
  latestExpected?: number;
  latestDate?: string;
}

const TeacherStudentsPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectMap>({});
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentSummary>({ totalAssessments: 0 });
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getSubjects();
        const map: SubjectMap = {};
        (data || []).forEach((subject) => {
          map[subject.id] = subject;
        });
        setSubjects(map);
      } catch (error) {
        console.error('Failed to load subjects:', error);
        setSubjects({});
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      setLoadingList(true);
      try {
        const data = await studentService.getStudents(selectedSubject?.id);
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        const initialId = list[0]?.id || '';
        setSelectedStudentId(initialId);
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
        setSelectedStudentId('');
      } finally {
        setLoadingList(false);
      }
    };

    loadStudents();
  }, [selectedSubject?.id]);

  useEffect(() => {
    const loadStudentDetails = async () => {
      if (!selectedStudentId) {
        setSelectedStudent(null);
        setPlans([]);
        setAssessmentSummary({ totalAssessments: 0 });
        return;
      }
      setLoadingDetails(true);
      try {
        const student = await studentService.getStudent(selectedStudentId);
        setSelectedStudent(student);

        const planData = await developmentService.getAllPlansForStudent(selectedStudentId).catch(() => []);
        setPlans(planData || []);

        const subjectIds = (student.subjects || [])
          .map((subject) => (typeof subject === 'string' ? subject : subject?.id))
          .filter(Boolean) as string[];

        if (subjectIds.length === 0) {
          setAssessmentSummary({ totalAssessments: 0 });
          return;
        }

        const assessmentGroups = await Promise.all(
          subjectIds.map((id) => assessmentService.getAssessmentsBySubjectId(id).catch(() => []))
        );
        const allAssessments = assessmentGroups.flat();
        const totalAssessments = allAssessments.length;

        if (totalAssessments === 0) {
          setAssessmentSummary({ totalAssessments: 0 });
          return;
        }

        const latestAssessment = [...allAssessments].sort((a, b) => {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return bDate - aDate;
        })[0];

        const results = await assessmentService.getResults(latestAssessment.id, selectedStudentId).catch(() => []);
        const latestResult = results[0];

        setAssessmentSummary({
          totalAssessments,
          latestAssessmentName: latestAssessment.name,
          latestScore: latestResult?.actualMark,
          latestExpected: latestResult?.expectedMark,
          latestDate: latestResult?.submittedDate ? new Date(latestResult.submittedDate).toLocaleDateString() : undefined,
        });
      } catch (error) {
        console.error('Failed to load student details:', error);
        setSelectedStudent(null);
        setPlans([]);
        setAssessmentSummary({ totalAssessments: 0 });
      } finally {
        setLoadingDetails(false);
      }
    };

    loadStudentDetails();
  }, [selectedStudentId]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || (student.email || '').toLowerCase().includes(query);
    });
  }, [students, searchQuery]);

  const averageProgress = useMemo(() => {
    if (plans.length === 0) return 0;
    const total = plans.reduce((sum, plan) => sum + (plan.currentProgress || 0), 0);
    return Math.round(total / plans.length);
  }, [plans]);

  return (
    <div className="h-full overflow-y-auto">
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
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selectedStudentId === student.id
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
        ) : selectedStudent ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg shadow p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                  <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                  <p className="text-sm text-gray-500">Reg #: {selectedStudent.registrationNumber || selectedStudent.id}</p>
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
                <h4 className="text-sm font-semibold mb-2">Subjects Enrolled</h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedStudent.subjects || []).length > 0 ? (
                    (selectedStudent.subjects || []).map((subject, index) => {
                      const subjectId = typeof subject === 'string' ? subject : subject?.id;
                      const subjectName = subjectId && subjects[subjectId]?.name
                        ? subjects[subjectId].name
                        : typeof subject !== 'string'
                          ? subject?.name
                          : 'Subject';
                      return (
                        <span key={`${subjectId || 'subject'}-${index}`} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {subjectName}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-gray-500">No subjects assigned.</span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-2">Assessments</h4>
                <div className="text-sm text-gray-600">Total: {assessmentSummary.totalAssessments}</div>
                {assessmentSummary.latestAssessmentName ? (
                  <div className="mt-2 text-xs text-gray-500">
                    Latest: {assessmentSummary.latestAssessmentName}
                    <div className="text-sm text-gray-700 font-medium">
                      {assessmentSummary.latestScore ?? 0} / {assessmentSummary.latestExpected ?? 0}
                    </div>
                    {assessmentSummary.latestDate && (
                      <div>{assessmentSummary.latestDate}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-2">No recent assessment results.</div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-2">Mastery Plans</h4>
                <div className="text-sm text-gray-600">Active plans: {plans.filter((plan) => plan.status === 'Active').length}</div>
                <div className="text-xs text-gray-500 mt-2">Average progress: {averageProgress}%</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold mb-3">Development Plans by Subject</h4>
              {plans.length > 0 ? (
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const subjectName = subjects[plan.plan.subjectId]?.name || 'Subject';
                    return (
                      <div key={plan.id} className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">{plan.plan.name}</div>
                            <div className="text-xs text-gray-500">{subjectName}</div>
                          </div>
                          <div className="text-xs text-gray-500">{plan.status}</div>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{plan.currentProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${plan.currentProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No development plans assigned.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg shadow p-4 text-sm text-gray-500">Select a student to view details.</div>
        )}
      </div>
      </div>
    </div>
  );
};

export default TeacherStudentsPage;
