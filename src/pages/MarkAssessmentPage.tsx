import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, CheckCircle, Search, Filter } from 'lucide-react';
import { MarkAssignmentModal } from '../components/resources/MarkAssignmentModal';
import Sidebar from '../components/resources/Sidebar';
import { assessmentService, subjectService } from '../services/api';
import { Assessment, Subject } from '../types';

interface AssessmentMetrics {
  attempted: number;
  submitted: number;
  averageScore: number;
  passRate: number;
}

const MarkAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filtered, setFiltered] = useState<Assessment[]>([]);
  const [metricsByAssessment, setMetricsByAssessment] = useState<Record<string, AssessmentMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [assessmentQuery, setAssessmentQuery] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (data && data.length > 0) {
          setSelectedSubjectId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadAssessments = async () => {
      setLoading(true);
      try {
        const data = selectedSubjectId
          ? await assessmentService.getAssessmentsBySubjectId(selectedSubjectId)
          : await assessmentService.getAssessments();
        setAssessments(data || []);
      } catch (error) {
        console.error('Failed to load assessments:', error);
        setAssessments([]);
      } finally {
        setLoading(false);
      }
    };
    loadAssessments();
  }, [selectedSubjectId]);

  useEffect(() => {
    const applyFilters = async () => {
      setLoading(true);
      try {
        let list = assessments;
        const search = assessmentQuery.trim().toLowerCase();
        if (search) {
          list = list.filter((item) => (item.name || '').toLowerCase().includes(search));
        }
        if (selectedType !== 'all') {
          list = list.filter((item: any) => (item.assessmentType || item.type || '').toLowerCase() === selectedType);
        }
        if (selectedStatus !== 'all' && selectedStatus !== 'marked') {
          list = list.filter((item) => (item.status || 'draft') === selectedStatus);
        }

        const metricsEntries = await Promise.all(
          list.map(async (item) => {
            const resultsList = await assessmentService.getResults(item.id).catch(() => []);
            const attempted = resultsList.length;
            const submitted = resultsList.length;
            const totalScore = resultsList.reduce((sum, result) => sum + (result.actualMark || 0), 0);
            const averageScore = attempted > 0 ? totalScore / attempted : 0;
            const passed = resultsList.filter((result) => {
              const expected = result.expectedMark ?? item.maxScore ?? 0;
              if (expected > 0) {
                return (result.actualMark || 0) >= expected * 0.5;
              }
              return (result.grade || '').toLowerCase() !== 'fail';
            }).length;
            const passRate = attempted > 0 ? Math.round((passed / attempted) * 100) : 0;
            return [
              item.id,
              {
                attempted,
                submitted,
                averageScore,
                passRate,
              } as AssessmentMetrics,
            ] as const;
          })
        );
        const metrics = Object.fromEntries(metricsEntries);
        setMetricsByAssessment(metrics);

        if (selectedStatus === 'marked') {
          list = list.filter((item) => metrics[item.id]?.attempted > 0);
        }

        setFiltered(list);
      } catch (error) {
        console.error('Failed to filter assessments:', error);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    applyFilters();
  }, [assessments, assessmentQuery, selectedType, selectedStatus]);

  const assessmentCount = useMemo(() => filtered.length, [filtered]);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onViewAssessments={() => navigate('/assessments/view')}
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="mark-assessment"
        recentUploads={[]}
      />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Mark Assessment</h1>
              <p className="text-sm text-gray-500">Upload an assessment for AI marking or review manually.</p>
            </div>
            <button
              onClick={() => navigate('/grading')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Open Reports
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-5 space-y-3">
              <div className="flex items-center gap-2 text-blue-600">
                <BrainCircuit className="w-5 h-5" />
                <h3 className="text-lg font-semibold">AI Marking</h3>
              </div>
              <p className="text-sm text-gray-500">
                Upload an assessment file for automated grading and OCR-driven feedback.
              </p>
              <button
                onClick={() => setOpenModal(true)}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Upload for AI Marking
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Manual Review</h3>
              </div>
              <p className="text-sm text-gray-500">
                Review submissions manually and adjust scores as needed.
              </p>
              <button
                onClick={() => navigate('/grading')}
                className="mt-2 border border-emerald-500 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-50 transition"
              >
                Go to Manual Review
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Marked Assessments</h2>
                <p className="text-xs text-gray-500">Review marked submissions and export results.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Filter className="h-4 w-4" />
                {assessmentCount} assessments
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500">Search assessment</label>
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={assessmentQuery}
                    onChange={(e) => setAssessmentQuery(e.target.value)}
                    placeholder="Search assessment name"
                    className="w-full border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm"
                  />
                </div>
              </div>
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

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 bg-slate-200 rounded animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-gray-500">No marked assessments match the current filters.</div>
            ) : (
              <div className="space-y-3">
                {filtered.map((assessment) => (
                  <div key={assessment.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{assessment.name}</div>
                        <div className="text-xs text-gray-500">
                          {(assessment as any).assessmentType || assessment.type || 'Assessment'} • Status: {assessment.status || 'draft'}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/assessments/analysis?assessmentId=${assessment.id}`)}
                        className="text-blue-600 text-sm font-medium hover:text-blue-700"
                      >
                        View analysis
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                      <div className="bg-slate-50 rounded px-2 py-1">Marked: {metricsByAssessment[assessment.id]?.attempted ?? 0}</div>
                      <div className="bg-slate-50 rounded px-2 py-1">Average: {(metricsByAssessment[assessment.id]?.averageScore ?? 0).toFixed(1)}</div>
                      <div className="bg-slate-50 rounded px-2 py-1">Pass rate: {metricsByAssessment[assessment.id]?.passRate ?? 0}%</div>
                      <div className="bg-slate-50 rounded px-2 py-1">Submissions: {metricsByAssessment[assessment.id]?.submitted ?? 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <MarkAssignmentModal isOpen={openModal} onOpenChange={setOpenModal} />
      </div>
    </div>
  );
};

export default MarkAssessmentPage;
