import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { teacherService } from '../services/teacherService';
import { authService } from '../services/authService';
import Sidebar from '../components/resources/Sidebar';

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
    const loadOverview = async () => {
      setLoading(true);
      try {
        if (!teacherId) {
          setRows([]);
          return;
        }

        if (searchMode === 'student' && searchQuery.trim() && !selectedStudentId) {
          setRows([]);
          return;
        }

        const data = await teacherService.getAssessmentsOverview(teacherId, {
          subjectId: selectedSubjectId || undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          studentId: selectedStudentId || undefined,
          search: searchMode === 'assessment' && searchQuery.trim() ? searchQuery.trim() : undefined,
        });
        setRows(data || []);
      } catch (error) {
        console.error('Failed to load assessment overview:', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [
    teacherId,
    selectedSubjectId,
    selectedStatus,
    selectedStudentId,
    searchMode,
    searchQuery,
  ]);

  const filteredRows = useMemo(() => {
    if (selectedType === 'all') return rows;
    return rows.filter((row) => normalizeType(row.assessmentType) === selectedType);
  }, [rows, selectedType]);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500">Search by</label>
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as 'assessment' | 'student')}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="assessment">Assessment name</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">
                {searchMode === 'assessment' ? 'Search assessment' : 'Search student'}
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchMode === 'assessment' ? 'Search assessment name' : 'Search student'}
                  className="w-full border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm"
                />
              </div>
              {searchMode === 'student' && (
                <p className="text-[11px] text-gray-400 mt-1">Search will narrow to one student before loading student-specific marks.</p>
              )}
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

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="space-y-3">
              {filteredRows.map((row) => (
                <div key={row.assignmentId} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{row.assessmentName}</div>
                      <div className="text-xs text-gray-500">
                        {row.assessmentType || 'Assessment'} • Status: {row.assessmentStatus || 'draft'}
                      </div>
                    </div>
                    {row.attempted > 0 && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Marked
                      </span>
                    )}
                    {selectedStudentId && (
                      <div className="text-sm text-gray-600">
                        Score: {row.studentActualMark ?? 0}/{row.studentExpectedMark ?? 0}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/assessments/view/${row.assessmentId}`)}
                        className="text-blue-600 text-sm font-medium hover:text-blue-700"
                      >
                        View assessment
                      </button>
                      <button
                        onClick={() => navigate(`/assessments/analysis?assessmentId=${row.assessmentId}`)}
                        className="text-slate-600 text-sm font-medium hover:text-slate-800"
                      >
                        Analysis
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs text-gray-600">
                    <div className="bg-slate-50 rounded px-2 py-1">Marked submissions: {row.attempted}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Submitted: {row.submitted}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Passed: {row.passed}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Failed: {row.failed}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Average: {(row.averageScore ?? 0).toFixed(1)}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Pass rate: {Math.round(row.passRate ?? 0)}%</div>
                  </div>
                  <div className="text-xs text-gray-500">AI Review: {row.aiEnhanced ? 'Enabled' : 'Disabled'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No assessments found for the selected filters.</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AssessmentsDashboardPage;
