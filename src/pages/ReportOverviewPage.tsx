import React, { useEffect, useMemo, useState } from 'react';
import ReportLayout from '../components/report/ReportLayout';
import { submissionService, subjectService } from '../services/api';
import { ClassReportResponse, reportService } from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import { Subject } from '../types';
import { BarChart3, TrendingUp, Users, AlertTriangle, BookOpen } from 'lucide-react';
import TablePagination from '../components/ui/TablePagination';
import { useClientPagination } from '../hooks/useClientPagination';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, submissionsData, classReportData] = await Promise.all([
          submissionService.getGradingStats(selectedSubject?.id),
          submissionService.getPendingSubmissions(),
          reportService.getClassReport(selectedSubject?.id)
        ]);
        setStats(statsData);
        setSubmissions(submissionsData);
        setClassReport(classReportData);
      } catch (error) {
        console.error('Error loading report data:', error);
        setClassReport(null);
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
      .map(([type, scores]) => ({
        type,
        average: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }))
      .sort((a, b) => a.average - b.average)
      .slice(0, 3);

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
  const gradeDistribution = classReport?.gradeDistribution ?? report.gradeDistribution;
  const masteryGapCards = classReport?.masteryGaps?.length
    ? classReport.masteryGaps.map((gap) => ({
        label: gap.topic || 'Topic',
        value: gap.masteryPercent
      }))
    : report.masteryGaps.map((gap) => ({
        label: gap.type,
        value: gap.average
      }));
  const gradeTotal = classStudentCount || Object.values(gradeDistribution).reduce((sum, value) => sum + value, 0);

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
                {masteryGapCards.length}
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
              {!gradeTotal && (
                <p className="text-xs text-slate-500">No graded submissions yet.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-lg font-semibold text-slate-900">Mastery Gaps</h3>
            <p className="text-xs text-slate-500">Lowest-performing assessment categories.</p>
            <div className="mt-4 space-y-3">
              {masteryGapCards.length ? masteryGapCards.map((gap) => (
                <div key={gap.label} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{gap.label}</p>
                    <span className="text-xs text-slate-500">{Math.round(gap.value)}%</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Recommend targeted practice and re-teach sessions.
                  </p>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No mastery gaps detected yet.</p>
              )}
            </div>
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
