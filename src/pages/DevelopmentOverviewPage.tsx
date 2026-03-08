import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { developmentService, studentService, subjectService } from '../services/api';
import { authService } from '../services/authService';
import { teacherService } from '../services/teacherService';
import type { TeacherStudentSummary } from '../services/teacherService';
import type { MasterySignalsSummary } from '../services/developmentService';
import { useAuth } from '../context/AuthContext';
import type { Subject } from '../types';
import DevelopmentLayout from '../components/development/DevelopmentLayout';
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

interface DevelopmentLearner {
  id: string;
  firstName: string;
  lastName: string;
  overall: number;
  performance: string;
  planStatus?: string | null;
  planProgress?: number | null;
  activePlanName?: string | null;
}

type PerformanceBucketKey = 'excellent' | 'good' | 'average' | 'needs improvement' | 'other';

const normalizePlanStatus = (status?: string | null): string | undefined => {
  if (!status) return undefined;
  const cleaned = status.replace(/_/g, ' ').trim().toLowerCase();
  if (cleaned === 'active') return 'active';
  if (cleaned === 'completed') return 'completed';
  if (cleaned === 'on hold') return 'on hold';
  if (cleaned === 'cancelled') return 'cancelled';
  return undefined;
};

const DevelopmentOverviewPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const navigate = useNavigate();
  const [learners, setLearners] = useState<DevelopmentLearner[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [masterySummary, setMasterySummary] = useState<MasterySignalsSummary | null>(null);

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
    const loadOverview = async () => {
      setLoading(true);
      const subjectId = subjectFilter || undefined;

      try {
        const teacherId = authService.getCurrentUserId();
        const [masterySignals, learnerSummaries] = await Promise.all([
          developmentService
            .getMasterySignalsSummary({ subjectId })
            .catch(() => null),
          (async () => {
            if (!teacherId) return [] as TeacherStudentSummary[];
            const allItems: TeacherStudentSummary[] = [];
            const size = 200;
            let page = 0;
            let totalPages = 1;

            while (page < totalPages) {
              const response = await teacherService.getStudentsSummary(teacherId, {
                subjectId,
                page,
                size,
              });
              allItems.push(...(Array.isArray(response.items) ? response.items : []));
              totalPages = Math.max(1, Number(response.totalPages || 1));
              page += 1;
            }

            return allItems;
          })().catch(() => [] as TeacherStudentSummary[]),
        ]);

        let nextLearners: DevelopmentLearner[] = learnerSummaries.map((summary) => ({
          id: summary.studentId,
          firstName: summary.firstName || '',
          lastName: summary.lastName || '',
          overall: Number(summary.overall ?? 0),
          performance: summary.performance || '',
          planStatus: normalizePlanStatus(summary.planStatus),
          planProgress:
            summary.planProgress === null || summary.planProgress === undefined
              ? null
              : Number(summary.planProgress),
          activePlanName: summary.activePlanName || null,
        }));

        // Fallback for contexts where teacher summary endpoint is unavailable.
        if (nextLearners.length === 0) {
          const fallbackStudents = await studentService.getStudents(subjectId).catch(() => []);
          nextLearners = (Array.isArray(fallbackStudents) ? fallbackStudents : []).map((student) => ({
            id: student.id,
            firstName: student.firstName || '',
            lastName: student.lastName || '',
            overall: Number(student.overall ?? 0),
            performance: student.performance || '',
            planStatus: normalizePlanStatus((student.activePlan as any)?.status),
            planProgress:
              (student.activePlan as any)?.currentProgress === null ||
              (student.activePlan as any)?.currentProgress === undefined
                ? null
                : Number((student.activePlan as any)?.currentProgress),
            activePlanName: (student.activePlan as any)?.plan?.name || null,
          }));
        }

        setLearners(nextLearners);
        setMasterySummary(masterySignals);
      } catch (error) {
        console.error('Failed to load development overview:', error);
        setLearners([]);
        setMasterySummary(null);
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [subjectFilter]);

  const derivedMasterySummary = useMemo<MasterySignalsSummary>(() => {
    if (learners.length === 0) {
      return {
        totalStudents: 0,
        excellent: 0,
        good: 0,
        average: 0,
        needsImprovement: 0,
        averageOverall: 0,
      };
    }

    let excellent = 0;
    let good = 0;
    let average = 0;
    let needsImprovement = 0;
    let totalOverall = 0;

    learners.forEach((learner) => {
      const overall = Number(learner.overall || 0);
      totalOverall += overall;
      if (overall >= 85) excellent += 1;
      else if (overall >= 70) good += 1;
      else if (overall >= 55) average += 1;
      else needsImprovement += 1;
    });

    return {
      totalStudents: learners.length,
      excellent,
      good,
      average,
      needsImprovement,
      averageOverall: Math.round((totalOverall / learners.length) * 10) / 10,
    };
  }, [learners]);

  const effectiveMasterySummary = masterySummary || derivedMasterySummary;
  const averageOverall = Math.round(effectiveMasterySummary.averageOverall || 0);
  const needsIntervention = effectiveMasterySummary.needsImprovement;

  const performanceBuckets = useMemo<Record<PerformanceBucketKey, number>>(
    () => ({
      excellent: effectiveMasterySummary.excellent,
      good: effectiveMasterySummary.good,
      average: effectiveMasterySummary.average,
      'needs improvement': effectiveMasterySummary.needsImprovement,
      other: 0,
    }),
    [effectiveMasterySummary]
  );

  const planStatusBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      active: 0,
      completed: 0,
      'on hold': 0,
      cancelled: 0,
      unassigned: 0,
    };

    learners.forEach((learner) => {
      const status = normalizePlanStatus(learner.planStatus);
      if (!status) {
        buckets.unassigned += 1;
      } else if (status in buckets) {
        buckets[status] += 1;
      } else {
        buckets.unassigned += 1;
      }
    });

    return buckets;
  }, [learners]);

  const activePlans = planStatusBuckets.active;

  const planCompletionDistribution = useMemo(() => (
    learners
      .map((learner, index) => {
        const parsed = Number(learner.planProgress);
        if (!Number.isFinite(parsed)) return null;
        const progress = Math.max(0, Math.min(100, Math.round(parsed)));
        return {
          learner: `L${index + 1}`,
          student: `${learner.firstName} ${learner.lastName}`.trim(),
          progress,
        };
      })
      .filter((item): item is { learner: string; student: string; progress: number } => item !== null)
      .sort((a, b) => a.progress - b.progress)
  ), [learners]);

  const priorityLearners = useMemo(() => (
    learners
      .filter((learner) => {
        const performance = (learner.performance || '').toLowerCase();
        return learner.overall < 50 || performance.includes('needs');
      })
      .sort((a, b) => a.overall - b.overall)
      .slice(0, 4)
  ), [learners]);

  const totalStudents = Math.max(effectiveMasterySummary.totalStudents, 1);

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
              <p className="text-xs text-slate-500 mt-1">Across {effectiveMasterySummary.totalStudents} learners</p>
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
                    onClick={() => navigate('/development/plans')}
                    className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Open Plan Workspace
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
              {([
                { label: 'Excellent', key: 'excellent', color: 'bg-emerald-500' },
                { label: 'Good', key: 'good', color: 'bg-blue-500' },
                { label: 'Average', key: 'average', color: 'bg-yellow-500' },
                { label: 'Needs improvement', key: 'needs improvement', color: 'bg-red-500' },
              ] as Array<{ label: string; key: Exclude<PerformanceBucketKey, 'other'>; color: string }>).map((item) => {
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
                  {priorityLearners.map((learner) => (
                    <button
                      key={learner.id}
                      onClick={() => navigate(`/development/${learner.id}`)}
                      className="w-full text-left border border-slate-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:shadow transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {learner.firstName} {learner.lastName}
                          </p>
                          <p className="text-xs text-slate-500">Overall: {learner.overall}%</p>
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
    </DevelopmentLayout>
  );
};

export default DevelopmentOverviewPage;
