import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StudentsLayout from '../components/students/StudentsLayout';
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

interface SubjectSummary extends AssessmentSummary {
  subjectId: string;
  subjectName: string;
  plans: DevelopmentPlan[];
}

const getInitials = (student: Student) =>
  `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();

const StudentProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectMap>({});
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentSummary>({ totalAssessments: 0 });
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
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
        const data = await studentService.getStudents();
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        if (!selectedStudentId && list.length > 0) {
          setSelectedStudentId(list[0].id);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
      } finally {
        setLoadingList(false);
      }
    };
    loadStudents();
  }, [selectedStudentId]);

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

        const filteredSubjectIds = subjectFocusId === 'all' ? subjectIds : subjectIds.filter((id) => id === subjectFocusId);

        if (filteredSubjectIds.length === 0) {
          setAssessmentSummary({ totalAssessments: 0 });
          setSubjectSummaries([]);
          return;
        }

        const summaryGroups = await Promise.all(
          filteredSubjectIds.map(async (id) => {
            const assessments = await assessmentService.getAssessmentsBySubjectId(id).catch(() => []);
            const subjectName = subjects[id]?.name
              || (student.subjects || []).find((subject) => (typeof subject === 'string' ? subject === id : subject?.id === id) && typeof subject !== 'string')?.name
              || 'Subject';
            const totalAssessments = assessments.length;

            if (totalAssessments === 0) {
              return {
                subjectId: id,
                subjectName,
                totalAssessments: 0,
                plans: planData.filter((plan) => plan.plan.subjectId === id),
              } as SubjectSummary;
            }

            const latestAssessment = [...assessments].sort((a, b) => {
              const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
              const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
              return bDate - aDate;
            })[0];

            const results = await assessmentService.getResults(latestAssessment.id, selectedStudentId).catch(() => []);
            const latestResult = results[0];

            return {
              subjectId: id,
              subjectName,
              totalAssessments,
              latestAssessmentName: latestAssessment.name,
              latestScore: latestResult?.actualMark,
              latestExpected: latestResult?.expectedMark,
              latestDate: latestResult?.submittedDate ? new Date(latestResult.submittedDate).toLocaleDateString() : undefined,
              plans: planData.filter((plan) => plan.plan.subjectId === id),
            } as SubjectSummary;
          })
        );

        setSubjectSummaries(summaryGroups);

        const totalAssessments = summaryGroups.reduce((sum, summary) => sum + summary.totalAssessments, 0);
        setAssessmentSummary({ totalAssessments });
      } catch (error) {
        console.error('Failed to load student details:', error);
        setSelectedStudent(null);
        setPlans([]);
        setAssessmentSummary({ totalAssessments: 0 });
        setSubjectSummaries([]);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadStudentDetails();
  }, [selectedStudentId, subjectFocusId]);

  const filteredStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || (student.email || '').toLowerCase().includes(query);
    });
  }, [students, studentQuery]);

  const averageProgress = useMemo(() => {
    const filteredPlans = subjectFocusId === 'all'
      ? plans
      : plans.filter((plan) => plan.plan.subjectId === subjectFocusId);
    if (filteredPlans.length === 0) return 0;
    const total = filteredPlans.reduce((sum, plan) => sum + (plan.currentProgress || 0), 0);
    return Math.round(total / filteredPlans.length);
  }, [plans, subjectFocusId]);

  const visibleSubjectSummaries = useMemo(() => {
    if (subjectFocusId === 'all') return subjectSummaries;
    return subjectSummaries.filter((summary) => summary.subjectId === subjectFocusId);
  }, [subjectSummaries, subjectFocusId]);

  const registrationNumber = selectedStudent
    ? (selectedStudent as { registrationNumber?: string }).registrationNumber
    : '';

  const extraDetails = useMemo(() => {
    if (!selectedStudent) return [];
    const excluded = new Set([
      'id',
      'firstName',
      'lastName',
      'email',
      'overall',
      'strength',
      'performance',
      'engagement',
      'subjects',
      'activePlan',
      'attributes',
      'attendance',
      'assessments',
      'registrationNumber',
    ]);
    return Object.entries(selectedStudent)
      .filter(([key, value]) => !excluded.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => ({ key, value: String(value) }));
  }, [selectedStudent]);

  return (
    <StudentsLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Student Profile</h1>
              <p className="text-sm text-slate-500">Complete student record with mastery and assessment signals.</p>
            </div>
            <button
              onClick={() => navigate('/students')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Directory
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">Filters</div>
            <div className="flex flex-wrap gap-2">
              <input
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Search student"
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
              <select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
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
                {Object.values(subjects).map((subject) => (
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
        ) : selectedStudent ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                    {getInitials(selectedStudent)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                    <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                    <p className="text-sm text-gray-500">Reg #: {registrationNumber || selectedStudent.id}</p>
                  </div>
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
                <h4 className="text-sm font-semibold mb-2">Profile Details</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Performance</span><span>{selectedStudent.performance || '—'}</span></div>
                  <div className="flex justify-between"><span>Engagement</span><span>{selectedStudent.engagement || '—'}</span></div>
                  <div className="flex justify-between"><span>Strength</span><span>{selectedStudent.strength || '—'}</span></div>
                  <div className="flex justify-between"><span>Attendance</span><span>{selectedStudent.attendance ?? '—'}</span></div>
                  <div className="flex justify-between"><span>Assessments</span><span>{selectedStudent.assessments ?? assessmentSummary.totalAssessments}</span></div>
                </div>
              </div>

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
                <h4 className="text-sm font-semibold mb-2">Assessment Overview</h4>
                <div className="text-sm text-gray-600">Total assessments: {assessmentSummary.totalAssessments}</div>
                <div className="text-xs text-gray-500 mt-2">See per-subject breakdown below.</div>
              </div>
            </div>

            {extraDetails.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-semibold mb-2">Additional Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                  {extraDetails.map((detail) => (
                    <div key={detail.key} className="flex justify-between gap-4">
                      <span className="text-gray-500">{detail.key}</span>
                      <span className="font-medium text-gray-700">{detail.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold mb-3">Subject Breakdown</h4>
              {visibleSubjectSummaries.length > 0 ? (
                <div className="space-y-4">
                  {visibleSubjectSummaries.map((summary) => (
                    <div key={summary.subjectId} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{summary.subjectName}</div>
                          <div className="text-xs text-gray-500">Subject assessments & development plans</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>Assessments: {summary.totalAssessments}</span>
                          <button
                            type="button"
                            onClick={() => navigate(`/assessments/student-analysis?subjectId=${summary.subjectId}&studentId=${selectedStudentId}`)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            View assessments
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/development/${selectedStudentId}`)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            View development
                          </button>
                        </div>
                      </div>

                      {summary.latestAssessmentName ? (
                        <div className="text-xs text-gray-600">
                          Latest assessment: <span className="font-medium text-gray-800">{summary.latestAssessmentName}</span>
                          <div className="text-sm text-gray-700 font-semibold">
                            {summary.latestScore ?? 0} / {summary.latestExpected ?? 0}
                          </div>
                          {summary.latestDate && (
                            <div className="text-xs text-gray-500">Submitted: {summary.latestDate}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No assessment results for this subject yet.</div>
                      )}

                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-2">Development Plans</div>
                        {summary.plans.length > 0 ? (
                          <div className="space-y-2">
                            {summary.plans.map((plan) => (
                              <div key={plan.id} className="border border-gray-100 rounded-md p-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold">{plan.plan.name}</div>
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
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">No development plans for this subject.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No subjects assigned to this student.</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold mb-3">Mastery Attributes</h4>
              {selectedStudent.attributes ? (
                <div className="space-y-2 text-sm text-gray-600">
                  {Object.entries(selectedStudent.attributes).map(([name, attr]) => (
                    <div key={name} className="border border-gray-100 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{name}</span>
                        <span className="text-xs text-gray-500">
                          Last assessed {attr.lastAssessed ? new Date(attr.lastAssessed).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-500">
                        <div>
                          <span className="block">Current</span>
                          <span className="text-sm font-semibold text-blue-600">{attr.current}</span>
                        </div>
                        <div>
                          <span className="block">Potential</span>
                          <span className="text-sm font-semibold text-emerald-600">{attr.potential}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No mastery attributes available.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg shadow p-4 text-sm text-gray-500">
            Select a student to view details.
          </div>
        )}
      </div>
    </StudentsLayout>
  );
};

export default StudentProfilePage;
