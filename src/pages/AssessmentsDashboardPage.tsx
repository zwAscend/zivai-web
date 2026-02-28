import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import { ApiError } from '../services/http';
import Sidebar from '../components/resources/Sidebar';
import TablePagination from '../components/ui/TablePagination';
import { useClientPagination } from '../hooks/useClientPagination';

const normalizeType = (value?: string | null) => {
  const normalized = String(value || 'test').toLowerCase().replace(/\s+/g, '-');
  return normalized === 'homework' ? 'home-work' : normalized;
};

const AssessmentsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const teacherId = useMemo(() => authService.getCurrentUserId(), []);

  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string; email: string }>>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchMode, setSearchMode] = useState<'assessment' | 'student'>('assessment');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [subjectOverviewFallback, setSubjectOverviewFallback] = useState(false);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!teacherId) {
        setSubjects([]);
        return;
      }
      try {
        const data = await teacherService.getMySubjects(teacherId);
        const mapped = (data || []).map((subject) => ({
          id: subject.subjectId,
          name: subject.subjectName,
        }));
        setSubjects(mapped);
        if (mapped.length > 0) {
          setSelectedSubjectId((prev) => prev || mapped[0].id);
        }
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
        return;
      }
      try {
        const response = await teacherService.getStudentsSummary(teacherId, {
          subjectId: selectedSubjectId || undefined,
          q: searchMode === 'student' && searchQuery.trim() ? searchQuery.trim() : undefined,
          page: 0,
          size: 500,
        });
        const items = Array.isArray(response?.items) ? response.items : [];
        setStudents(items.map((student) => ({
          id: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
        })));
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
      }
    };

    loadStudents();
  }, [teacherId, selectedSubjectId, searchMode, searchQuery]);

  const matchingStudents = useMemo(() => {
    const query = searchMode === 'student' ? searchQuery.trim().toLowerCase() : '';
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || (student.email || '').toLowerCase().includes(query);
    });
  }, [students, searchMode, searchQuery]);

  useEffect(() => {
    const query = searchMode === 'student' ? searchQuery.trim() : '';
    if (!query) {
      setSelectedStudentId('');
      return;
    }
    if (matchingStudents.length === 1) {
      setSelectedStudentId(matchingStudents[0].id);
    } else {
      setSelectedStudentId('');
    }
  }, [searchMode, searchQuery, matchingStudents]);

  useEffect(() => {
    setSubjectOverviewFallback(false);
    setOverviewError(null);
  }, [selectedSubjectId]);

  useEffect(() => {
    const loadOverview = async () => {
      setLoading(true);
      setOverviewError(null);
      const currentTeacherId = teacherId;
      if (!currentTeacherId) {
        setRows([]);
        setOverviewError(null);
        setLoading(false);
        return;
      }
      if (subjects.length > 0 && !selectedSubjectId) {
        setRows([]);
        setOverviewError(null);
        setLoading(false);
        return;
      }
      try {
        if (searchMode === 'student' && searchQuery.trim() && !selectedStudentId) {
          setRows([]);
          setOverviewError(null);
          return;
        }

        const filters = {
          subjectId: subjectOverviewFallback ? undefined : (selectedSubjectId || undefined),
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          studentId: selectedStudentId || undefined,
          search: searchMode === 'assessment' && searchQuery.trim() ? searchQuery.trim() : undefined,
        };

        const data = await teacherService.getAssessmentsOverview(currentTeacherId, filters);
        setRows(data || []);
      } catch (error) {
        if (!subjectOverviewFallback && selectedSubjectId && error instanceof ApiError && error.status >= 500) {
          try {
            const fallbackData = await teacherService.getAssessmentsOverview(currentTeacherId, {
              status: selectedStatus !== 'all' ? selectedStatus : undefined,
              studentId: selectedStudentId || undefined,
              search: searchMode === 'assessment' && searchQuery.trim() ? searchQuery.trim() : undefined,
            });
            setRows(fallbackData || []);
            setSubjectOverviewFallback(true);
            setOverviewError('Subject-specific overview is temporarily unavailable. Showing combined subjects.');
            return;
          } catch (fallbackError) {
            setRows([]);
            if (fallbackError instanceof ApiError) {
              setOverviewError(fallbackError.message);
            } else {
              setOverviewError('Failed to load assessment overview.');
            }
            return;
          }
        }

        setRows([]);
        if (error instanceof ApiError) {
          setOverviewError(error.message);
        } else {
          setOverviewError('Failed to load assessment overview.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [
    teacherId,
    subjects.length,
    selectedSubjectId,
    selectedStatus,
    selectedStudentId,
    searchMode,
    searchQuery,
    subjectOverviewFallback,
  ]);

  const filteredRows = useMemo(() => {
    if (selectedType === 'all') return rows;
    return rows.filter((row) => normalizeType(row.assessmentType) === selectedType);
  }, [rows, selectedType]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedRows,
    rangeStart,
    rangeEnd,
    setCurrentPage,
    setPageSize,
  } = useClientPagination(filteredRows, {
    initialPageSize: 10,
    resetKey: `${selectedSubjectId}|${selectedType}|${selectedStatus}|${searchMode}|${searchQuery}|${selectedStudentId}|${filteredRows.length}`,
  });

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onViewAssessments={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="view-assessments"
        recentUploads={[]}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          {overviewError && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {overviewError}
            </div>
          )}
          <div className="mb-4">
            <label className="text-xs text-gray-500">
              {searchMode === 'assessment' ? 'Search assessment' : 'Search student'}
            </label>
            <div className="mt-1 flex flex-col sm:flex-row sm:items-stretch">
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as 'assessment' | 'student')}
                className="w-full shrink-0 rounded-md border border-gray-200 px-3 py-2 text-sm sm:w-[180px] sm:rounded-r-none sm:border-r-0"
              >
                <option value="assessment">Assessment name</option>
                <option value="student">Student</option>
              </select>
              <div className="relative flex-1 min-w-0">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchMode === 'assessment' ? 'Search assessment name' : 'Search student'}
                  className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm sm:-ml-px sm:rounded-l-none"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Assessment Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
                <option value="home-work">Homework</option>
                <option value="test">Test</option>
                <option value="project">Project</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="marked">Marked</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Assessment List</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Filter className="h-4 w-4" />
              {filteredRows.length} assessments
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[1180px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Marked</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Passed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Failed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Average</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pass Rate</th>
                  {selectedStudentId && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student Score</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">AI Review</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 w-40 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-28 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                      {selectedStudentId && <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-slate-200" /></td>}
                      <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : paginatedRows.length > 0 ? (
                  paginatedRows.map((row) => (
                    <tr key={row.assignmentId} className="align-top">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-800">{row.assessmentName}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.assessmentType || 'Assessment'}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-sm text-gray-700">{row.assessmentStatus || 'draft'}</span>
                          {row.attempted > 0 && (
                            <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Marked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.subjectName}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {row.dueTime ? new Date(row.dueTime).toLocaleString() : 'No due date'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.submitted}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.attempted}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.passed}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.failed}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{(row.averageScore ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{Math.round(row.passRate ?? 0)}%</td>
                      {selectedStudentId && (
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {row.studentActualMark ?? 0}/{row.studentExpectedMark ?? 0}
                        </td>
                      )}
                      <td className="px-4 py-4 text-sm text-gray-700">{row.aiEnhanced ? 'Enabled' : 'Disabled'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/assessments/view/${row.assessmentId}`)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            View assessment
                          </button>
                          <button
                            onClick={() => navigate(`/assessments/analysis?assessmentId=${row.assessmentId}`)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-800"
                          >
                            Analysis
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={selectedStudentId ? 14 : 13} className="px-4 py-8 text-center text-sm text-gray-500">
                      No assessments found for the selected filters.
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
      </main>
    </div>
  );
};

export default AssessmentsDashboardPage;
