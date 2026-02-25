import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import Sidebar from '../components/resources/Sidebar';
import { assessmentService, subjectService } from '../services/api';
import { Assessment, Subject } from '../types';

const AssessmentAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assessmentResults, setAssessmentResults] = useState<Array<{ actualMark?: number; expectedMark?: number }>>([]);
  const [metrics, setMetrics] = useState({
    attempted: 0,
    submitted: 0,
    passed: 0,
    failed: 0,
    averageScore: 0,
    passRate: 0,
  });

  const assessmentFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('assessmentId') || '';
  }, [location.search]);

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
        if (assessmentFromQuery) {
          setSelectedAssessmentId(assessmentFromQuery);
        } else if (data && data.length > 0) {
          setSelectedAssessmentId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load assessments:', error);
        setAssessments([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssessments();
  }, [selectedSubjectId, assessmentFromQuery]);

  useEffect(() => {
    const loadMetrics = async () => {
      if (!selectedAssessmentId) return;
      setLoading(true);
      try {
        const results = await assessmentService.getResults(selectedAssessmentId).catch(() => []);
        const normalizedResults = Array.isArray(results)
          ? results.map((result: any) => ({
              actualMark: Number(result?.actualMark ?? 0),
              expectedMark: Number(result?.expectedMark ?? 0),
            }))
          : [];
        setAssessmentResults(normalizedResults);
        const attempted = results.length;
        const submitted = results.length;
        const totalScore = results.reduce((sum, result) => sum + (result.actualMark || 0), 0);
        const averageScore = attempted > 0 ? totalScore / attempted : 0;
        const passed = results.filter((result) => {
          const expected = result.expectedMark ?? 0;
          if (expected > 0) {
            return (result.actualMark || 0) >= expected * 0.5;
          }
          return (result.grade || '').toLowerCase() !== 'fail';
        }).length;
        const failed = attempted - passed;
        const passRate = attempted > 0 ? Math.round((passed / attempted) * 100) : 0;

        setMetrics({
          attempted,
          submitted,
          passed,
          failed,
          averageScore,
          passRate,
        });
      } catch (error) {
        console.error('Failed to load assessment metrics:', error);
        setAssessmentResults([]);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [selectedAssessmentId]);

  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === selectedAssessmentId),
    [assessments, selectedAssessmentId]
  );

  const marksDistribution = useMemo(() => {
    const buckets = [
      { band: '0-39', min: 0, max: 39, count: 0 },
      { band: '40-49', min: 40, max: 49, count: 0 },
      { band: '50-59', min: 50, max: 59, count: 0 },
      { band: '60-69', min: 60, max: 69, count: 0 },
      { band: '70-79', min: 70, max: 79, count: 0 },
      { band: '80-89', min: 80, max: 89, count: 0 },
      { band: '90-100', min: 90, max: 100, count: 0 },
    ];

    assessmentResults.forEach((result) => {
      const actual = Number(result.actualMark ?? 0);
      const expected = Number(result.expectedMark ?? 0);
      const normalizedScore = expected > 0 ? (actual / expected) * 100 : actual;
      const score = Math.max(0, Math.min(100, Number.isFinite(normalizedScore) ? normalizedScore : 0));
      const target = buckets.find((bucket) => score >= bucket.min && score <= bucket.max);
      if (target) target.count += 1;
    });

    return buckets.map(({ band, count }) => ({ band, count }));
  }, [assessmentResults]);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onViewAssessments={() => navigate('/assessments/view')}
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onAssessmentAnalysis={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="analysis-assessment"
        recentUploads={[]}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Class Assessment Analysis</h1>
              <p className="text-sm text-gray-500">Monitor assessment outcomes and plan interventions.</p>
            </div>
            <button
              onClick={() => navigate('/assessments/view')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Assessments
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="text-xs text-gray-500">Assessment</label>
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                >
                  {assessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedAssessment?.name || 'Assessment'}</h2>
                    <p className="text-xs text-gray-500">
                      {(selectedAssessment as any)?.assessmentType || selectedAssessment?.type || 'Assessment'} • Status: {selectedAssessment?.status || 'draft'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    AI Review: {(selectedAssessment as any)?.isAIEnhanced || (selectedAssessment as any)?.aiEnhanced ? 'Enabled' : 'Disabled'}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Attempted</div>
                    <div className="font-semibold">{metrics.attempted}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Submitted</div>
                    <div className="font-semibold">{metrics.submitted}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Passed</div>
                    <div className="font-semibold">{metrics.passed}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Failed</div>
                    <div className="font-semibold">{metrics.failed}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Average</div>
                    <div className="font-semibold">{metrics.averageScore.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Pass rate</div>
                    <div className="font-semibold">{metrics.passRate}%</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Marks Distribution</h3>
                  <span className="text-xs text-gray-500">Score bands (%)</span>
                </div>
                {assessmentResults.length > 0 ? (
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marksDistribution} margin={{ left: -20, right: 8, top: 8 }}>
                        <XAxis dataKey="band" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    No marks available yet for distribution.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Strengths</h3>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {metrics.passRate >= 75 && <li>Strong pass rate indicates solid overall understanding.</li>}
                    {metrics.averageScore >= 70 && <li>Average score suggests good mastery across topics.</li>}
                    {metrics.submitted >= metrics.attempted && <li>High submission completion rate.</li>}
                    {metrics.passRate < 75 && metrics.averageScore < 70 && (
                      <li>No significant strengths detected yet. Continue monitoring.</li>
                    )}
                  </ul>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Weaknesses</h3>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {metrics.passRate < 50 && <li>Low pass rate highlights overall performance gaps.</li>}
                    {metrics.averageScore < 50 && <li>Average score is below target threshold.</li>}
                    {metrics.failed > 0 && <li>{metrics.failed} students failed this assessment.</li>}
                    {metrics.passRate >= 50 && metrics.averageScore >= 50 && metrics.failed === 0 && (
                      <li>No major weaknesses detected. Review for specific topic-level gaps.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Action Plan</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Focus revision on the weakest concepts detected in the assessment.</li>
                  <li>Schedule a remediation session for students below 50% performance.</li>
                  <li>Provide individualized feedback for borderline passes.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AssessmentAnalysisPage;
