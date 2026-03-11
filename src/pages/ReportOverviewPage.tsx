import React, { useEffect, useMemo, useState } from 'react';
import ReportLayout from '../components/report/ReportLayout';
import { submissionService, subjectService } from '../services/api';
import { ClassGradeDistributionResponse, ClassReportResponse, reportService } from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import { Subject } from '../types';
import { BarChart3, TrendingUp, Users, AlertTriangle, BookOpen } from 'lucide-react';
import TablePagination from '../components/ui/TablePagination';
import { useClientPagination } from '../hooks/useClientPagination';

type GapStatus = 'critical' | 'risk' | 'on_track';
type GapPriority = 'high' | 'medium' | 'low';

interface MasteryGapInsight {
  label: string;
  masteryPercent: number;
  status: GapStatus;
  priority: GapPriority;
  laggingStudents: number;
  evidenceCount: number;
  coveragePercent: number | null;
  impactedStudentPercent: number | null;
  recommendation: string;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getGapStatus = (masteryPercent: number): GapStatus => {
  if (masteryPercent < 45) return 'critical';
  if (masteryPercent < 65) return 'risk';
  return 'on_track';
};

const getGapPriority = (status: GapStatus): GapPriority => {
  if (status === 'critical') return 'high';
  if (status === 'risk') return 'medium';
  return 'low';
};

const getGapRecommendation = (status: GapStatus, masteryPercent: number, coveragePercent: number | null): string => {
  if (status === 'critical') {
    if (coveragePercent !== null && coveragePercent < 60) {
      return 'Close coverage gaps first, then run guided re-teach and short retrieval checks.';
    }
    return 'Run immediate re-teach cycles, scaffolded examples, and daily practice checks.';
  }
  if (status === 'risk') {
    return 'Use targeted mixed practice and weekly formative checks to prevent slippage.';
  }
  if (masteryPercent < 80) {
    return 'Reinforce with transfer questions and cumulative revision to stabilize mastery.';
  }
  return 'Sustain performance with spaced retrieval and challenge-level practice tasks.';
};

const getStatusBadgeClass = (status: GapStatus): string => {
  if (status === 'critical') return 'bg-rose-100 text-rose-700';
  if (status === 'risk') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const getPriorityBadgeClass = (priority: GapPriority): string => {
  if (priority === 'high') return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (priority === 'medium') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};

const normalizeGradeDistribution = (distribution?: Record<string, number> | null): Record<string, number> => {
  const source = distribution || {};
  return {
    A: Number(source.A || 0),
    B: Number(source.B || 0),
    C: Number(source.C || 0),
    D: Number(source.D || 0),
    E: Number(source.E || 0),
    U: Number(source.U || 0),
  };
};

const ReportOverviewPage: React.FC = () => {
  const { selectedSubject, setSelectedSubject } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalSubmissions: number;
    autoGradedCount: number;
    teacherReviewedCount: number;
    averageScore: number;
    averageConfidence: number;
  } | null>(null);
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [classReport, setClassReport] = useState<ClassReportResponse | null>(null);
  const [classGradeDistribution, setClassGradeDistribution] = useState<ClassGradeDistributionResponse | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, submissionsData, classReportData, classGradeDistributionData] = await Promise.all([
          submissionService.getGradingStats(selectedSubject?.id),
          submissionService.getPendingSubmissions(),
          reportService.getClassReport(selectedSubject?.id),
          reportService.getClassGradeDistribution(selectedSubject?.id).catch(() => null),
        ]);
        setStats(statsData);
        setSubmissions(submissionsData);
        setClassReport(classReportData);
        setClassGradeDistribution(classGradeDistributionData);
      } catch (error) {
        console.error('Error loading report data:', error);
        setClassReport(null);
        setClassGradeDistribution(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedSubject]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
      } catch (error) {
        console.error('Error loading subjects:', error);
        setSubjects([]);
      }
    };
    loadSubjects();
  }, []);

  const gradeFromPercent = (percent: number) => {
    if (percent >= 80) return 'A';
    if (percent >= 70) return 'B';
    if (percent >= 60) return 'C';
    if (percent >= 50) return 'D';
    if (percent >= 40) return 'E';
    return 'U';
  };

  const report = useMemo(() => {
    const byStudent = new Map<string, {
      id: string;
      name: string;
      total: number;
      count: number;
      types: Record<string, number[]>;
    }>();
    const typeScores: Record<string, number[]> = {};

    submissions.forEach((submission) => {
      const percent = submission.autoGrading?.result?.percentage ?? 0;
      const studentId = submission.student.id;
      const studentName = `${submission.student.firstName} ${submission.student.lastName}`;
      const type = submission.assessment.type || 'Unknown';

      if (!byStudent.has(studentId)) {
        byStudent.set(studentId, { id: studentId, name: studentName, total: 0, count: 0, types: {} });
      }
      const entry = byStudent.get(studentId)!;
      entry.total += percent;
      entry.count += 1;
      entry.types[type] = entry.types[type] || [];
      entry.types[type].push(percent);

      typeScores[type] = typeScores[type] || [];
      typeScores[type].push(percent);
    });

    const students = Array.from(byStudent.values()).map((entry) => {
      const average = entry.count ? entry.total / entry.count : 0;
      const typeAverages = Object.entries(entry.types).map(([type, scores]) => ({
        type,
        average: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }));
      const lowestTypes = typeAverages
        .sort((a, b) => a.average - b.average)
        .slice(0, 2)
        .map(item => item.type);
      return {
        ...entry,
        average,
        predictedGrade: gradeFromPercent(average),
        lowestTypes
      };
    });

    const gradeDistribution = students.reduce<Record<string, number>>((acc, student) => {
      acc[student.predictedGrade] = (acc[student.predictedGrade] || 0) + 1;
      return acc;
    }, {});

    const masteryGaps = Object.entries(typeScores)
      .map(([type, scores]) => {
        const rawMasteryPercent = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
        const masteryPercent = clampPercent(rawMasteryPercent);
        const laggingStudents = students.filter((student) => student.lowestTypes.includes(type)).length;
        const status = getGapStatus(masteryPercent);
        const priority = getGapPriority(status);
        return {
          label: type,
          masteryPercent,
          status,
          priority,
          laggingStudents,
          evidenceCount: scores.length,
          coveragePercent: null,
          impactedStudentPercent: students.length ? (laggingStudents / students.length) * 100 : null,
          recommendation: getGapRecommendation(status, masteryPercent, null),
        };
      })
      .sort((a, b) => a.masteryPercent - b.masteryPercent)
      .slice(0, 5);

    const classAverage = students.length
      ? students.reduce((sum, student) => sum + student.average, 0) / students.length
      : stats?.averageScore ?? 0;

    return {
      students,
      gradeDistribution,
      masteryGaps,
      classAverage
    };
  }, [submissions, stats]);

  const classAverage = classReport?.classAveragePercent ?? report.classAverage;
  const predictedGrade = classReport?.predictedGrade ?? gradeFromPercent(classAverage);
  const classStudentCount = classReport?.studentCount ?? report.students.length;
  const gradeDistribution = normalizeGradeDistribution(
    classGradeDistribution?.gradeDistribution ?? classReport?.gradeDistribution ?? report.gradeDistribution
  );
  const masteryGapInsights: MasteryGapInsight[] = classReport?.masteryGaps?.length
    ? classReport.masteryGaps
      .map((gap) => {
        const masteryPercent = clampPercent(gap.masteryPercent || 0);
        const status = (gap.status || getGapStatus(masteryPercent)) as GapStatus;
        const priority = (gap.priority || getGapPriority(status)) as GapPriority;
        const laggingStudents = Math.max(0, Number(gap.laggingStudents || 0));
        const coveragePercent = Number.isFinite(Number(gap.coveragePercent))
          ? clampPercent(Number(gap.coveragePercent))
          : null;
        return {
          label: gap.topic || 'Topic',
          masteryPercent,
          status,
          priority,
          laggingStudents,
          evidenceCount: Math.max(0, Number(classReport.assessmentCount || 0)),
          coveragePercent,
          impactedStudentPercent: classStudentCount > 0 ? (laggingStudents / classStudentCount) * 100 : null,
          recommendation: getGapRecommendation(status, masteryPercent, coveragePercent),
        };
      })
      .sort((a, b) => a.masteryPercent - b.masteryPercent)
    : report.masteryGaps;
  const criticalGapCount = masteryGapInsights.filter((gap) => gap.status === 'critical').length;
  const highPriorityGapCount = masteryGapInsights.filter((gap) => gap.priority === 'high').length;
  const averageGapMastery = masteryGapInsights.length
    ? masteryGapInsights.reduce((sum, gap) => sum + gap.masteryPercent, 0) / masteryGapInsights.length
    : 0;
  const gradeTotalFromDistribution = Object.values(gradeDistribution).reduce((sum, value) => sum + value, 0);
  const gradeTotal = gradeTotalFromDistribution > 0 ? gradeTotalFromDistribution : classStudentCount;
  const reportAssessmentCount = classGradeDistribution?.assessmentCount ?? classReport?.assessmentCount ?? 0;

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
  } = useClientPagination(report.students, {
    initialPageSize: 10,
    resetKey: `${selectedSubject?.id || 'all'}|${report.students.length}`,
  });

  return (
    <ReportLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ZIMSEC Readiness Report</h1>
              <p className="text-sm text-slate-500">
                Predicted final outcomes, mastery gaps, and readiness indicators based on current assessment evidence.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm">
                <BookOpen className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700">Subject</span>
                <select
                  value={selectedSubject?.id || 'all'}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'all') {
                      setSelectedSubject(null);
                      return;
                    }
                    const nextSubject = subjects.find((subject) => subject.id === value) || null;
                    setSelectedSubject(nextSubject);
                  }}
                  className="min-w-[160px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-4">
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
                <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <BarChart3 className="h-4 w-4 text-blue-600" /> Class Average
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {Math.round(classAverage)}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Predicted Outcome
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {predictedGrade}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Users className="h-4 w-4 text-indigo-600" /> Learners Assessed
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {classStudentCount}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Mastery Gaps
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {masteryGapInsights.length}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-5 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Predicted Grade Distribution</h3>
            <p className="text-xs text-slate-500">Projected final performance based on current evidence.</p>
            <div className="mt-4 space-y-3">
              {['A', 'B', 'C', 'D', 'E', 'U'].map((grade) => {
                const count = gradeDistribution[grade] || 0;
                const percent = gradeTotal ? (count / gradeTotal) * 100 : 0;
                return (
                  <div key={grade} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-semibold text-slate-500">{grade}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{count}</span>
                  </div>
                );
              })}
              {!gradeTotalFromDistribution && (
                <p className="text-xs text-slate-500">
                  {reportAssessmentCount > 0
                    ? 'Submissions exist, but score distributions will appear once grading is finalized.'
                    : 'No graded submissions yet.'}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-lg font-semibold text-slate-900">Mastery Gaps</h3>
            <p className="text-xs text-slate-500">Deep diagnostics for weakest categories and intervention focus.</p>
            {masteryGapInsights.length ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-rose-700">Critical gaps</p>
                    <p className="mt-1 text-lg font-semibold text-rose-800">{criticalGapCount}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-amber-700">High priority</p>
                    <p className="mt-1 text-lg font-semibold text-amber-800">{highPriorityGapCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-600">Avg gap mastery</p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">{Math.round(averageGapMastery)}%</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {masteryGapInsights.map((gap) => (
                    <div key={gap.label} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{gap.label}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${getStatusBadgeClass(gap.status)}`}>
                              {gap.status.replace('_', ' ')}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${getPriorityBadgeClass(gap.priority)}`}>
                              {gap.priority} priority
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{Math.round(gap.masteryPercent)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            gap.status === 'critical'
                              ? 'bg-rose-500'
                              : gap.status === 'risk'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${clampPercent(gap.masteryPercent)}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                        <p>
                          Lagging learners:{' '}
                          <span className="font-semibold text-slate-800">
                            {gap.laggingStudents}
                            {gap.impactedStudentPercent !== null ? ` (${Math.round(gap.impactedStudentPercent)}%)` : ''}
                          </span>
                        </p>
                        <p>
                          Evidence volume:{' '}
                          <span className="font-semibold text-slate-800">
                            {gap.evidenceCount}
                          </span>
                        </p>
                        <p>
                          Coverage:{' '}
                          <span className="font-semibold text-slate-800">
                            {gap.coveragePercent !== null ? `${Math.round(gap.coveragePercent)}%` : 'Not available'}
                          </span>
                        </p>
                        <p>
                          Mastery headroom:{' '}
                          <span className="font-semibold text-slate-800">{Math.round(100 - clampPercent(gap.masteryPercent))}%</span>
                        </p>
                      </div>
                      <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                        {gap.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-slate-500">No mastery gaps detected yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Student Predictions</h3>
              <p className="text-xs text-slate-500">Individual predicted ZIMSEC outcomes and gaps.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Average</th>
                  <th className="px-4 py-3 text-left">Predicted Grade</th>
                  <th className="px-4 py-3 text-left">Submissions</th>
                  <th className="px-4 py-3 text-left">Mastery Gaps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-slate-700">{Math.round(student.average)}%</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        {student.predictedGrade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{student.count}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {student.lowestTypes.length ? student.lowestTypes.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
                {!report.students.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No student submissions yet. Reports will populate once assessments are graded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
    </ReportLayout>
  );
};

export default ReportOverviewPage;

interface PendingSubmission {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
  assessment: {
    id: string;
    name: string;
    type: string;
    maxScore: number;
    dueDate: string;
  };
  submittedAt: string;
  status: string;
  autoGrading: {
    result: {
      totalScore: number;
      percentage: number;
      grade: string;
      confidence: number;
    };
  };
}
