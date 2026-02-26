import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { developmentService, studentService, subjectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlanStatus, Student, Subject } from '../types';
import DevelopmentLayout from '../components/development/DevelopmentLayout';
import CreateDevelopmentPlanModal from '../components/resources/CreateDevelopmentPlanModal';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const DevelopmentOverviewPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const normalizePlanStatus = (status?: string): PlanStatus | undefined => {
    if (!status) return undefined;
    const cleaned = status.replace(/_/g, ' ').toLowerCase();
    if (cleaned === 'active') return 'Active';
    if (cleaned === 'completed') return 'Completed';
    if (cleaned === 'on hold') return 'On Hold';
    if (cleaned === 'cancelled') return 'Cancelled';
    return undefined;
  };

  const toEpochMs = (value?: Date): number => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (!subjectFilter && selectedSubject?.id) {
          setSubjectFilter(selectedSubject.id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, [selectedSubject?.id]);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const [studentData, planPage] = await Promise.all([
          studentService.getStudents(subjectFilter || undefined),
          developmentService.listStudentPlans({
            subjectId: subjectFilter || undefined,
            size: 200,
          }),
        ]);

        const planItems = Array.isArray(planPage?.items) ? planPage.items : [];
        const planByStudent = new Map<string, typeof planItems[number]>();

        planItems.forEach((plan) => {
          const studentId = plan.student;
          if (!studentId) return;
          const normalizedStatus = normalizePlanStatus(plan.status as string);
          const normalizedPlan = normalizedStatus ? { ...plan, status: normalizedStatus } : plan;
          const existing = planByStudent.get(studentId);
          if (!existing) {
            planByStudent.set(studentId, normalizedPlan);
            return;
          }
          const existingStatus = (existing.status || '').toString().toLowerCase();
          const newStatus = (normalizedPlan.status || '').toString().toLowerCase();
          const existingIsActive = existingStatus === 'active';
          const newIsActive = newStatus === 'active';
          if (!existingIsActive && newIsActive) {
            planByStudent.set(studentId, normalizedPlan);
            return;
          }
          if (existingIsActive && !newIsActive) {
            return;
          }
          const existingTime = toEpochMs(existing.updatedAt) || toEpochMs(existing.createdAt);
          const newTime = toEpochMs(normalizedPlan.updatedAt) || toEpochMs(normalizedPlan.createdAt);
          if (newTime > existingTime) {
            planByStudent.set(studentId, normalizedPlan);
          }
        });

        const studentsList = Array.isArray(studentData) ? studentData : [];
        const mergedStudents = studentsList.map((student) => ({
          ...student,
          activePlan: planByStudent.get(student.id) ?? student.activePlan,
        }));

        setStudents(mergedStudents);
      } catch (error) {
        console.error('Failed to load students for development overview:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [subjectFilter, reloadToken]);

  const averageOverall = useMemo(() => {
    if (students.length === 0) return 0;
    const total = students.reduce((sum, student) => sum + (student.overall || 0), 0);
    return Math.round(total / students.length);
  }, [students]);

  const activePlans = useMemo(() => students.filter((student) => student.activePlan).length, [students]);
  const needsIntervention = useMemo(() => (
    students.filter((student) => (student.overall || 0) < 50 || (student.performance || '').toLowerCase().includes('needs')).length
  ), [students]);

  const performanceBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      excellent: 0,
      good: 0,
      average: 0,
      'needs improvement': 0,
      other: 0,
    };
    students.forEach((student) => {
      const key = (student.performance || '').toLowerCase();
      if (key in buckets) {
        buckets[key] += 1;
      } else {
        buckets.other += 1;
      }
    });
    return buckets;
  }, [students]);

  const planStatusBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      active: 0,
      completed: 0,
      'on hold': 0,
      cancelled: 0,
      unassigned: 0,
    };
    students.forEach((student) => {
      const status = (student.activePlan?.status || '').toLowerCase();
      if (!status) {
        buckets.unassigned += 1;
      } else if (status in buckets) {
        buckets[status] += 1;
      } else {
        buckets.unassigned += 1;
      }
    });
    return buckets;
  }, [students]);

  const planCompletionDistribution = useMemo(() => (
    students
      .map((student, index) => {
        const rawProgress = student.activePlan?.currentProgress;
        const parsed = typeof rawProgress === 'number' ? rawProgress : Number(rawProgress);
        if (!Number.isFinite(parsed)) return null;
        const progress = Math.max(0, Math.min(100, Math.round(parsed)));
        return {
          learner: `L${index + 1}`,
          student: `${student.firstName} ${student.lastName}`.trim(),
          progress,
        };
      })
      .filter((item): item is { learner: string; student: string; progress: number } => item !== null)
      .sort((a, b) => a.progress - b.progress)
  ), [students]);

  const priorityLearners = useMemo(() => (
    students
      .filter((student) => (student.overall || 0) < 50 || (student.performance || '').toLowerCase().includes('needs'))
      .sort((a, b) => (a.overall || 0) - (b.overall || 0))
      .slice(0, 4)
  ), [students]);

  const totalStudents = students.length || 1;
  
  if (loading) {
    return (
      <DevelopmentLayout>
        <div className="space-y-4">
          <div className="h-36 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </DevelopmentLayout>
    );
  }

  return (
    <DevelopmentLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="rounded-lg border border-slate-200 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Student Development Intelligence</h2>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="w-full sm:w-auto sm:min-w-[200px] px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium border border-slate-200 bg-white text-slate-700"
                >
                  <option value="">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => navigate('/classroom')}
                  className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Open Classroom
                </button>
                <button
                  onClick={() => navigate('/assessments/analysis')}
                  className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Class Assessment Analysis
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Average mastery</p>
              <p className="text-2xl font-semibold text-slate-900">{averageOverall}%</p>
              <p className="text-xs text-slate-500 mt-1">Across {students.length} learners</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Active plans</p>
              <p className="text-2xl font-semibold text-slate-900">{activePlans}</p>
              <p className="text-xs text-slate-500 mt-1">Currently in progress</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Needs intervention</p>
              <p className="text-2xl font-semibold text-slate-900">{needsIntervention}</p>
              <p className="text-xs text-slate-500 mt-1">Below 50% or needs improvement</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Development Profile</h3>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                  <button
                    onClick={() => setIsPlanModalOpen(true)}
                    className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Generate Targeted Plan
                  </button>
                  <button
                    onClick={() => navigate('/development/reteach')}
                    className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    View Re-teach Cards
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Plans active</p>
                  <p className="text-2xl font-semibold text-slate-900">{planStatusBuckets.active}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Plans completed</p>
                  <p className="text-2xl font-semibold text-slate-900">{planStatusBuckets.completed}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Plans on hold</p>
                  <p className="text-2xl font-semibold text-slate-900">{planStatusBuckets['on hold']}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Plan completion distribution</h4>
                {planCompletionDistribution.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={planCompletionDistribution}
                        margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="learner" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis
                          domain={[0, 100]}
                          allowDecimals={false}
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, 'Completion']}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.student || 'Student'}
                        />
                        <Line
                          type="monotone"
                          dataKey="progress"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No plan progress data available for this subject.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Mastery Signals</h4>
              {[
                { label: 'Excellent', key: 'excellent', color: 'bg-emerald-500' },
                { label: 'Good', key: 'good', color: 'bg-blue-500' },
                { label: 'Average', key: 'average', color: 'bg-yellow-500' },
                { label: 'Needs improvement', key: 'needs improvement', color: 'bg-red-500' },
              ].map((item) => {
                const count = performanceBuckets[item.key] || 0;
                const percent = Math.round((count / totalStudents) * 100);
                return (
                  <div key={item.key} className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{item.label}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full mt-2">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Performance Distribution</h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Excellent', value: performanceBuckets.excellent || 0 },
                      { name: 'Good', value: performanceBuckets.good || 0 },
                      { name: 'Average', value: performanceBuckets.average || 0 },
                      { name: 'Needs', value: performanceBuckets['needs improvement'] || 0 },
                    ]}
                    margin={{ left: -20, right: 10 }}
                  >
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Plan Status Mix</h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Active', value: planStatusBuckets.active },
                        { name: 'Completed', value: planStatusBuckets.completed },
                        { name: 'On Hold', value: planStatusBuckets['on hold'] },
                        { name: 'Unassigned', value: planStatusBuckets.unassigned },
                      ]}
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                    >
                      {['#3b82f6', '#22c55e', '#f59e0b', '#94a3b8'].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Priority Learners</h4>
              {priorityLearners.length > 0 ? (
                <div className="space-y-3">
                  {priorityLearners.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => navigate(`/development/${student.id}`)}
                      className="w-full text-left border border-slate-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:shadow transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-slate-500">Overall: {student.overall ?? 0}%</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600">Needs focus</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No priority learners flagged.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <CreateDevelopmentPlanModal
        isOpen={isPlanModalOpen}
        onOpenChange={setIsPlanModalOpen}
        onPlanCreated={() => setReloadToken((prev) => prev + 1)}
        students={students}
        subjectId={subjectFilter || selectedSubject?.id || ''}
      />
    </DevelopmentLayout>
  );
};

export default DevelopmentOverviewPage;
