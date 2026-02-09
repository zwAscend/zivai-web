import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import ReportLayout from '../components/report/ReportLayout';
import { submissionService } from '../services/api';
import { reportService, StudentReportResponse } from '../services/reportService';
import { useAuth } from '../context/AuthContext';

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

interface AssessmentRow {
  id: string;
  name: string;
  type: string;
  score: number;
  maxScore: number;
  percent: number;
  submittedAt?: string | null;
}

const ReportSubmissionsPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentReport, setStudentReport] = useState<StudentReportResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assessmentQuery, setAssessmentQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const submissionsData = await submissionService.getPendingSubmissions();
      setPendingSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };


  const gradeFromPercent = (percent: number) => {
    if (percent >= 80) return 'A';
    if (percent >= 70) return 'B';
    if (percent >= 60) return 'C';
    if (percent >= 50) return 'D';
    if (percent >= 40) return 'E';
    return 'U';
  };

  const studentSummaries = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      total: number;
      count: number;
      submissions: PendingSubmission[];
    }>();

    pendingSubmissions.forEach((submission) => {
      const percent = submission.autoGrading?.result?.percentage ?? 0;
      const id = submission.student.id;
      const name = `${submission.student.firstName} ${submission.student.lastName}`;
      if (!map.has(id)) {
        map.set(id, { id, name, total: 0, count: 0, submissions: [] });
      }
      const entry = map.get(id)!;
      entry.total += percent;
      entry.count += 1;
      entry.submissions.push(submission);
    });

    return Array.from(map.values())
      .map((entry) => {
        const average = entry.count ? entry.total / entry.count : 0;
        return {
          ...entry,
          average,
          predictedGrade: gradeFromPercent(average)
        };
      })
      .filter((entry) =>
        searchQuery === '' || entry.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.average - a.average);
  }, [pendingSubmissions, searchQuery]);

  useEffect(() => {
    if (!selectedStudentId && studentSummaries.length) {
      setSelectedStudentId(studentSummaries[0].id);
    }
  }, [selectedStudentId, studentSummaries]);

  useEffect(() => {
    const fetchStudentReport = async () => {
      if (!selectedStudentId) {
        setStudentReport(null);
        return;
      }
      try {
        setLoadingReport(true);
        const report = await reportService.getStudentReport(selectedStudentId, selectedSubject?.id);
        setStudentReport(report);
      } catch (error) {
        console.error('Error loading student report:', error);
        setStudentReport(null);
      } finally {
        setLoadingReport(false);
      }
    };
    fetchStudentReport();
  }, [selectedStudentId, selectedSubject]);

  const selectedStudent = studentSummaries.find(student => student.id === selectedStudentId) || studentSummaries[0];
  const selectedSubmissions = selectedStudent?.submissions || [];
  const selectedStudentName = studentReport?.studentName || selectedStudent?.name || 'Student';

  const baseAssessmentRows = useMemo<AssessmentRow[]>(() => {
    if (studentReport?.assessments?.length) {
      return studentReport.assessments.map((assessment, index) => ({
        id: assessment.assessmentId || `assessment-${index}`,
        name: assessment.assessmentName || 'Assessment',
        type: assessment.assessmentType || 'Unknown',
        score: assessment.score ?? 0,
        maxScore: assessment.maxScore ?? 0,
        percent: assessment.percent ?? 0,
        submittedAt: assessment.submittedAt ?? null
      }));
    }
    return selectedSubmissions.map((submission) => ({
      id: submission.id,
      name: submission.assessment.name,
      type: submission.assessment.type || 'Unknown',
      score: submission.autoGrading?.result?.totalScore ?? 0,
      maxScore: submission.assessment.maxScore ?? 0,
      percent: submission.autoGrading?.result?.percentage ?? 0,
      submittedAt: submission.submittedAt
    }));
  }, [studentReport, selectedSubmissions]);

  const filteredAssessmentRows = useMemo(() => {
    return baseAssessmentRows.filter((assessment) => {
      const matchesAssessment = assessmentQuery === '' ||
        assessment.name.toLowerCase().includes(assessmentQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || assessment.type === typeFilter;
      return matchesAssessment && matchesType;
    });
  }, [assessmentQuery, baseAssessmentRows, typeFilter]);

  const assessmentTypes = Array.from(new Set(baseAssessmentRows.map((assessment) => assessment.type).filter(Boolean)));

  return (
    <ReportLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold text-gray-800">Student Assessment Report</h2>
          <p className="text-sm text-gray-600">Student-level predicted outcomes and assessment attempts.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-white rounded-lg shadow p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search student"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
              />
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-12 bg-slate-200 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {studentSummaries.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left border rounded-lg px-3 py-2 transition ${
                      selectedStudent?.id === student.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-500">
                      Avg: {Math.round(student.average)}% • Predicted {student.predictedGrade}
                    </p>
                  </button>
                ))}
                {!studentSummaries.length && (
                  <p className="text-sm text-slate-500">No student submissions yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-white rounded-lg shadow p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Assessment Attempts</h3>
                <p className="text-xs text-slate-500">
                  {selectedStudentId ? `Showing attempts for ${selectedStudentName}` : 'Select a student to view attempts.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Search assessment"
                  value={assessmentQuery}
                  onChange={(e) => setAssessmentQuery(e.target.value)}
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">All types</option>
                  {assessmentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Assessment</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssessmentRows.map((assessment) => (
                    <tr key={assessment.id}>
                      <td className="px-4 py-3 text-slate-900 font-medium">{assessment.name}</td>
                      <td className="px-4 py-3 text-slate-600">{assessment.type}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {assessment.score}/{assessment.maxScore} • {Math.round(assessment.percent)}%
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {assessment.submittedAt ? new Date(assessment.submittedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {!filteredAssessmentRows.length && !loadingReport && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No attempts found for this student.
                      </td>
                    </tr>
                  )}
                  {loadingReport && !filteredAssessmentRows.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        Loading student report...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
};

export default ReportSubmissionsPage;
