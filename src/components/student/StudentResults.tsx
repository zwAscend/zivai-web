import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Award, Target, FileText } from 'lucide-react';
import { assessmentService } from '../../services/api';
import { studentService } from '../../services/studentService';
import TablePagination from '../ui/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';

interface StudentResultsProps {
  studentId: string;
  selectedSubjectId?: string;
  onOpenTutor?: (prompt?: string) => void;
}

type StudentResultType = 'all' | 'Assignment' | 'Test' | 'Project' | 'Exam' | 'Quiz';

interface StudentAssessmentRow {
  id: string;
  assessmentId: string;
  assessmentName: string;
  assessmentType: string;
  weightPct: number | null;
  actualMark: number | null;
  expectedMark: number | null;
  maxScore: number | null;
  grade: string | null;
  feedback: string | null;
  submittedAt: Date | null;
  difference: number | null;
}

const parseOptionalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toTypeLabel = (value?: string | null): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ');
  if (!normalized) return 'Assessment';
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const deriveGradeFromPercent = (percent: number | null): string | null => {
  if (percent === null) return null;
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'U';
};

const gradePillClass = (grade: string | null) => {
  const normalized = String(grade || '').toUpperCase();
  if (normalized.startsWith('A')) return 'bg-green-100 text-green-800';
  if (normalized.startsWith('B')) return 'bg-blue-100 text-blue-800';
  if (normalized.startsWith('C') || normalized.startsWith('D')) return 'bg-yellow-100 text-yellow-800';
  if (!normalized || normalized === 'N/A') return 'bg-slate-100 text-slate-700';
  return 'bg-red-100 text-red-800';
};

const StudentResults: React.FC<StudentResultsProps> = ({ studentId, selectedSubjectId }) => {
  const [results, setResults] = useState<StudentAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'semester' | 'month'>('all');
  const [selectedType, setSelectedType] = useState<StudentResultType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      if (!studentId) {
        setResults([]);
        setLoading(false);
        setLoadError(null);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const subjectId = selectedSubjectId && selectedSubjectId !== 'all' ? selectedSubjectId : undefined;

        const [history, assessments] = await Promise.all([
          studentService.getAssessmentHistory(studentId, { subjectId }),
          subjectId
            ? assessmentService.getAssessmentsBySubjectId(subjectId).catch(() => [])
            : assessmentService.getAssessments().catch(() => []),
        ]);

        const weightByAssessmentId = new Map<string, number>();
        (Array.isArray(assessments) ? assessments : []).forEach((assessment: any) => {
          const rawWeight = assessment?.weightPct ?? assessment?.weight;
          const weight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight ?? NaN);
          if (assessment?.id && Number.isFinite(weight)) {
            weightByAssessmentId.set(assessment.id, weight);
          }
        });

        const mappedRows: StudentAssessmentRow[] = (Array.isArray(history) ? history : []).map((item) => {
          const maxScore = typeof item.maxScore === 'number' ? item.maxScore : null;
          const actualMark =
            typeof item.actualMark === 'number'
              ? item.actualMark
              : typeof item.score === 'number'
                ? item.score
                : null;
          const expectedMark = typeof item.expectedMark === 'number' ? item.expectedMark : null;
          const difference =
            actualMark !== null && expectedMark !== null ? actualMark - expectedMark : null;
          const submittedAt =
            parseOptionalDate(item.submittedAt) ||
            parseOptionalDate(item.gradedAt) ||
            parseOptionalDate(item.dueTime) ||
            parseOptionalDate(item.startTime);

          return {
            id: item.enrollmentId || `${item.assessmentId}-${item.assignmentId || 'result'}`,
            assessmentId: item.assessmentId,
            assessmentName: item.assessmentName || 'Assessment',
            assessmentType: toTypeLabel(item.assessmentType),
            weightPct: weightByAssessmentId.get(item.assessmentId) ?? null,
            actualMark,
            expectedMark,
            maxScore,
            grade: item.grade || null,
            feedback: item.feedback || null,
            submittedAt,
            difference,
          };
        });

        setResults(mappedRows);
      } catch (error) {
        console.error('Failed to fetch student performance results:', error);
        setResults([]);
        setLoadError('Failed to load results from the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [studentId, selectedSubjectId]);

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      const query = searchQuery.trim().toLowerCase();
      const queryMatch = !query || result.assessmentName.toLowerCase().includes(query);
      const typeMatch = selectedType === 'all' || result.assessmentType === selectedType;

      let periodMatch = true;
      if (selectedPeriod !== 'all') {
        if (!result.submittedAt) {
          periodMatch = false;
        } else if (selectedPeriod === 'semester') {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          periodMatch = result.submittedAt >= sixMonthsAgo;
        } else if (selectedPeriod === 'month') {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          periodMatch = result.submittedAt >= oneMonthAgo;
        }
      }

      return typeMatch && periodMatch && queryMatch;
    });
  }, [results, searchQuery, selectedType, selectedPeriod]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedResults,
    rangeStart,
    rangeEnd,
    setCurrentPage,
    setPageSize,
  } = useClientPagination(filteredResults, {
    initialPageSize: 10,
    resetKey: `${selectedSubjectId || 'all'}|${selectedPeriod}|${selectedType}|${searchQuery}|${filteredResults.length}`,
  });

  const totalAssessments = filteredResults.length;
  const scoredAssessments = filteredResults.filter(
    (result) => result.actualMark !== null && result.maxScore !== null && result.maxScore > 0
  );
  const averageScore =
    scoredAssessments.length > 0
      ? Math.round(
          scoredAssessments.reduce(
            (sum, result) => sum + ((result.actualMark as number) / (result.maxScore as number)) * 100,
            0
          ) / scoredAssessments.length
        )
      : 0;
  const comparableAssessments = filteredResults.filter(
    (result) => result.actualMark !== null && result.expectedMark !== null
  );
  const improvementCount = comparableAssessments.filter(
    (result) => (result.actualMark as number) > (result.expectedMark as number)
  ).length;
  const improvementRate =
    comparableAssessments.length > 0 ? Math.round((improvementCount / comparableAssessments.length) * 100) : 0;
  const aGradeCount = filteredResults.filter((result) =>
    String(result.grade || '').toUpperCase().startsWith('A')
  ).length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="border border-slate-200 bg-white p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <div className="h-10 w-44 rounded-md bg-slate-200" />
              <div className="h-10 w-36 rounded-md bg-slate-200" />
              <div className="h-10 w-36 rounded-md bg-slate-200" />
            </div>
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-6">
          <div className="h-6 w-28 rounded bg-slate-200 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 border border-slate-200 rounded-lg bg-slate-50" />
            ))}
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-6">
          <div className="h-6 w-36 rounded bg-slate-200 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-sm">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-full flex-wrap gap-3 md:w-auto md:justify-end">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full md:w-auto min-w-[150px] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="semester">This Semester</option>
              <option value="month">This Month</option>
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as StudentResultType)}
              className="w-full md:w-auto min-w-[150px] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="Assignment">Assignments</option>
              <option value="Test">Tests</option>
              <option value="Project">Projects</option>
              <option value="Exam">Exams</option>
              <option value="Quiz">Quizzes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Total Assessments</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{totalAssessments}</p>
            </div>
            <div className="rounded-md bg-blue-50 p-2 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Average Score</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{averageScore}%</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-600">
              <Target className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Above Expected</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{improvementRate}%</p>
            </div>
            <div className="rounded-md bg-violet-50 p-2 text-violet-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">A Grades</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{aGradeCount}</p>
            </div>
            <div className="rounded-md bg-amber-50 p-2 text-amber-600">
              <Award className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Detailed Results</h3>
        </div>

        {loadError && (
          <div className="px-6 py-3 border-b border-rose-100 bg-rose-50 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assessment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Feedback
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedResults.map((result) => {
                const hasScoredResult =
                  result.actualMark !== null && result.maxScore !== null && result.maxScore > 0;
                const scorePercent = hasScoredResult
                  ? Math.round(((result.actualMark as number) / (result.maxScore as number)) * 100)
                  : null;
                const gradeLabel = result.grade || deriveGradeFromPercent(scorePercent) || 'N/A';
                return (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{result.assessmentName}</div>
                        <div className="text-sm text-gray-500">
                          Weight: {result.weightPct !== null ? `${result.weightPct}%` : 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {result.assessmentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {hasScoredResult ? (
                        <>
                          <div className="font-semibold">
                            {result.actualMark}/{result.maxScore}
                          </div>
                          <div className="text-xs text-gray-500">({scorePercent}%)</div>
                        </>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${gradePillClass(gradeLabel)}`}>
                        {gradeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {result.difference === null ? (
                        <span className="text-sm text-gray-400">N/A</span>
                      ) : (
                        <div className="flex items-center">
                          {result.difference > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                          ) : result.difference < 0 ? (
                            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                          ) : (
                            <div className="w-4 h-4 mr-1" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              result.difference > 0
                                ? 'text-green-600'
                                : result.difference < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {result.difference > 0 ? '+' : ''}
                            {Math.round(result.difference * 10) / 10}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[220px]">
                      {result.feedback ? (
                        <span>{result.feedback}</span>
                      ) : (
                        <span className="text-gray-400">No feedback yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.submittedAt ? result.submittedAt.toLocaleDateString('en-GB') : 'N/A'}
                    </td>
                  </tr>
                );
              })}
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

        {filteredResults.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No results found for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentResults;
