import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import DevelopmentLayout from '../components/development/DevelopmentLayout';
import { developmentService, studentService } from '../services/api';
import TablePagination from '../components/ui/TablePagination';
import { useClientPagination } from '../hooks/useClientPagination';

const normalizePlanStatus = (status?: string): string | undefined => {
  if (!status) return undefined;
  const cleaned = status.replace(/_/g, ' ').replace(/-/g, ' ').trim().toLowerCase();
  if (cleaned === 'active') return 'active';
  if (cleaned === 'completed') return 'completed';
  if (cleaned === 'on hold') return 'on hold';
  if (cleaned === 'cancelled') return 'cancelled';
  return undefined;
};

const toEpochMs = (value?: Date): number => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

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

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedStudents,
    rangeStart,
    rangeEnd,
    setCurrentPage,
    setPageSize,
  } = useClientPagination(students, {
    initialPageSize: 10,
    resetKey: `${query}|${performanceFilter}|${planFilter}|${subjectFilter}|${students.length}`,
  });

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
        const normalizedPlanFilter = normalizePlanStatus(planFilter);
        const [response, rawStudents, planPage] = await Promise.all([
          teacherService.getStudentsSummary(teacherId, {
            subjectId: subjectFilter || undefined,
            performance: performanceFilter === 'all' ? undefined : performanceFilter,
            planStatus: normalizedPlanFilter,
            q: query.trim() || undefined,
            page: 0,
            size: 200,
          }).catch(() => ({ items: [] })),
          studentService.getStudents(subjectFilter || undefined).catch(() => []),
          developmentService.listStudentPlans({
            subjectId: subjectFilter || undefined,
            status: normalizedPlanFilter,
            page: 0,
            size: 500,
          }).catch(() => ({ items: [] })),
        ]);

        const summaryItems = Array.isArray(response?.items) ? response.items : [];
        const studentsList = Array.isArray(rawStudents) ? rawStudents : [];
        const planItems = Array.isArray(planPage?.items) ? planPage.items : [];

        const plansByStudent = new Map<string, any[]>();
        planItems.forEach((plan) => {
          if (!plan?.student) return;
          const existing = plansByStudent.get(plan.student) || [];
          existing.push(plan);
          plansByStudent.set(plan.student, existing);
        });

        const summaryByStudentId = new Map(summaryItems.map((item) => [item.studentId, item]));
        const mergedStudents = new Map<string, any>();

        summaryItems.forEach((item) => {
          mergedStudents.set(item.studentId, {
            studentId: item.studentId,
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            overall: item.overall ?? 0,
            performance: item.performance ?? 'Tracking',
            engagement: item.engagement ?? 'Medium',
            strength: item.strength ?? 'Tracking',
            subjectCount: item.subjectCount ?? 0,
            classCount: item.classCount ?? 0,
            planStatus: item.planStatus ?? null,
            planProgress: item.planProgress ?? 0,
            activePlanName: item.activePlanName ?? '',
          });
        });

        studentsList.forEach((student) => {
          const summary = summaryByStudentId.get(student.id);
          const existing = mergedStudents.get(student.id) || {};
          mergedStudents.set(student.id, {
            studentId: student.id,
            firstName: summary?.firstName ?? student.firstName,
            lastName: summary?.lastName ?? student.lastName,
            email: summary?.email ?? student.email,
            overall: summary?.overall ?? student.overall ?? 0,
            performance: summary?.performance ?? student.performance ?? 'Tracking',
            engagement: summary?.engagement ?? student.engagement ?? 'Medium',
            strength: summary?.strength ?? student.strength ?? 'Tracking',
            subjectCount: summary?.subjectCount ?? (Array.isArray(student.subjects) ? student.subjects.length : 0),
            classCount: summary?.classCount ?? 0,
            planStatus: summary?.planStatus ?? existing.planStatus ?? null,
            planProgress: summary?.planProgress ?? existing.planProgress ?? 0,
            activePlanName: summary?.activePlanName ?? existing.activePlanName ?? '',
          });
        });

        const mergedItems = Array.from(mergedStudents.values()).map((student) => {
          const studentPlans = plansByStudent.get(student.studentId) || [];
          const selectedPlan =
            studentPlans.find((plan) => normalizePlanStatus(plan?.status) === 'active') ||
            [...studentPlans].sort((a, b) => {
              const aTime = toEpochMs(a?.updatedAt) || toEpochMs(a?.createdAt);
              const bTime = toEpochMs(b?.updatedAt) || toEpochMs(b?.createdAt);
              return bTime - aTime;
            })[0];

          if (!selectedPlan) {
            return {
              ...student,
              planStatus: student.planStatus || 'Unassigned',
              planProgress: Number(student.planProgress || 0),
              activePlanName: student.activePlanName || 'Plan not assigned',
            };
          }

          return {
            ...student,
            planStatus: selectedPlan.status || student.planStatus || 'Active',
            planProgress:
              typeof selectedPlan.currentProgress === 'number'
                ? selectedPlan.currentProgress
                : Number(selectedPlan.currentProgress || student.planProgress || 0),
            activePlanName: selectedPlan.plan?.name || student.activePlanName || 'Plan not assigned',
          };
        });

        const normalizedQuery = query.trim().toLowerCase();
        const filteredItems = mergedItems.filter((item) => {
          const matchesQuery =
            !normalizedQuery ||
            `${item.firstName} ${item.lastName}`.toLowerCase().includes(normalizedQuery) ||
            (item.email || '').toLowerCase().includes(normalizedQuery);
          const matchesPerformance =
            performanceFilter === 'all' ||
            (item.performance || '').toLowerCase() === performanceFilter.toLowerCase();
          const matchesPlanStatus =
            planFilter === 'all' ||
            normalizePlanStatus(item.planStatus) === normalizePlanStatus(planFilter);
          return matchesQuery && matchesPerformance && matchesPlanStatus;
        });

        setStudents(filteredItems);
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
      <div className="flex h-full min-h-0 flex-col rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Student Development Plans</h2>
            <p className="text-sm text-slate-500">Track active plans, progress, and intervention status per learner.</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student"
              className="w-full md:w-72 border border-slate-200 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full sm:w-auto border border-slate-200 rounded-md px-3 py-2 text-sm"
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
                className="w-full sm:w-auto border border-slate-200 rounded-md px-3 py-2 text-sm"
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
                className="w-full sm:w-auto border border-slate-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All plans</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Student</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Overall</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Performance</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Plan</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Status</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Progress</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Engagement</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-slate-200">Strength</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td className="px-4 py-3 border-b border-slate-100" colSpan={8}>
                      <div className="h-4 rounded bg-slate-200 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : paginatedStudents.length > 0 ? (
                paginatedStudents.map((student, index) => {
                  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`;
                  const progress = Math.max(0, Number(student.planProgress ?? 0));
                  const status = student.planStatus || 'Unassigned';
                  const planName = student.activePlanName || 'Plan not assigned';
                  return (
                    <tr
                      key={student.studentId}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
                    >
                      <td className="px-4 py-2 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => navigate(`/development/${student.studentId}`)}
                          className="flex items-center gap-2 text-left"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                            {initials || 'ST'}
                          </span>
                          <span className="font-medium text-slate-900">
                            {student.firstName} {student.lastName}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{student.overall ?? 0}%</td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{student.performance || 'Tracking'}</td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{planName}</td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{progress}%</td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{student.engagement || 'Medium'}</td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{student.strength || 'Tracking'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No learners matched the current subject, performance, and plan filters.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4">
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </DevelopmentLayout>
  );
};

export default DevelopmentPlansPage;
