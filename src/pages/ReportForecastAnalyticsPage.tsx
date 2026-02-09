import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Sparkles } from 'lucide-react';
import ReportLayout from '../components/report/ReportLayout';
import { reportService, CurriculumTopicForecast } from '../services/reportService';
import { subjectService } from '../services/subjectService';
import { useAuth } from '../context/AuthContext';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
  CURRENT_YEAR + 2,
].map((year) => year.toString());

const buildConicGradient = (segments: { value: number; color: string }[]) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return 'conic-gradient(#e2e8f0 0deg 360deg)';
  let start = 0;
  const parts = segments.map((segment) => {
    const span = (segment.value / total) * 360;
    const end = start + span;
    const part = `${segment.color} ${start}deg ${end}deg`;
    start = end;
    return part;
  });
  return `conic-gradient(${parts.join(', ')})`;
};

const ReportForecastAnalyticsPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'curriculum' | 'term'>('curriculum');
  const [curriculumTopics, setCurriculumTopics] = useState<CurriculumTopicForecast[]>([]);
  const [termTopics, setTermTopics] = useState<CurriculumTopicForecast[]>([]);
  const [term, setTerm] = useState(TERM_OPTIONS[0]);
  const [academicYear, setAcademicYear] = useState(CURRENT_YEAR.toString());
  const [termExpectedCoverage, setTermExpectedCoverage] = useState(0);
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);
  const [loadingTerm, setLoadingTerm] = useState(true);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const teaching = await subjectService.getTeachingSubjects();
        const list = (teaching || []).map((subject) => ({
          id: subject.id,
          name: subject.name,
        }));
        setSubjects(list);
        if (selectedSubject?.id) {
          setSelectedSubjectId(selectedSubject.id);
        } else if (list.length > 0) {
          setSelectedSubjectId(list[0].id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, [selectedSubject]);

  useEffect(() => {
    const loadCurriculum = async () => {
      if (!selectedSubjectId) {
        setCurriculumTopics([]);
        return;
      }
      setLoadingCurriculum(true);
      try {
        const response = await reportService.getCurriculumForecast(selectedSubjectId);
        setCurriculumTopics(response?.topics ?? []);
      } catch (error) {
        console.error('Curriculum analytics unavailable:', error);
        setCurriculumTopics([]);
      } finally {
        setLoadingCurriculum(false);
      }
    };
    loadCurriculum();
  }, [selectedSubjectId]);

  useEffect(() => {
    const loadTerm = async () => {
      if (!selectedSubjectId) {
        setTermTopics([]);
        setTermExpectedCoverage(0);
        return;
      }
      setLoadingTerm(true);
      try {
        const response = await reportService.getTermForecast(
          selectedSubjectId,
          term,
          academicYear
        );
        setTermTopics(response?.topics ?? []);
        setTermExpectedCoverage(response?.expectedCoveragePercent ?? 0);
      } catch (error) {
        console.error('Term analytics unavailable:', error);
        setTermTopics([]);
        setTermExpectedCoverage(0);
      } finally {
        setLoadingTerm(false);
      }
    };
    loadTerm();
  }, [selectedSubjectId, term, academicYear]);

  const subjectName = useMemo(() => {
    return subjects.find((subject) => subject.id === selectedSubjectId)?.name || 'Select subject';
  }, [subjects, selectedSubjectId]);

  const curriculumStats = useMemo(() => {
    const totalTopics = curriculumTopics.length;
    const avgCoverage = totalTopics
      ? Math.round(curriculumTopics.reduce((sum, topic) => sum + topic.coveragePercent, 0) / totalTopics)
      : 0;
    const avgMastery = totalTopics
      ? Math.round(curriculumTopics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / totalTopics)
      : 0;
    const laggingStudents = curriculumTopics.reduce((sum, topic) => sum + topic.laggingStudents, 0);
    const priorityCounts = curriculumTopics.reduce(
      (acc, topic) => {
        acc[topic.priority] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
    const gapTopics = curriculumTopics
      .slice()
      .sort((a, b) => (b.masteryPercent - b.coveragePercent) - (a.masteryPercent - a.coveragePercent))
      .slice(0, 5);
    return { totalTopics, avgCoverage, avgMastery, laggingStudents, priorityCounts, gapTopics };
  }, [curriculumTopics]);

  const curriculumTopicPerformance = useMemo(() => {
    return curriculumTopics
      .slice()
      .sort((a, b) => b.coveragePercent - a.coveragePercent)
      .slice(0, 8);
  }, [curriculumTopics]);

  const curriculumLaggingMax = useMemo(() => {
    const max = Math.max(0, ...curriculumTopics.map((topic) => topic.laggingStudents));
    return max || 1;
  }, [curriculumTopics]);

  const termStats = useMemo(() => {
    const totalTopics = termTopics.length;
    const avgCoverage = totalTopics
      ? Math.round(termTopics.reduce((sum, topic) => sum + topic.coveragePercent, 0) / totalTopics)
      : 0;
    const avgMastery = totalTopics
      ? Math.round(termTopics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / totalTopics)
      : 0;
    const topGaps = termTopics
      .slice()
      .sort((a, b) => (termExpectedCoverage - a.coveragePercent) - (termExpectedCoverage - b.coveragePercent))
      .slice(0, 5);
    return { totalTopics, avgCoverage, avgMastery, topGaps };
  }, [termTopics, termExpectedCoverage]);

  const termTopicPerformance = useMemo(() => {
    return termTopics
      .slice()
      .sort((a, b) => b.coveragePercent - a.coveragePercent)
      .slice(0, 8);
  }, [termTopics]);

  const termLaggingMax = useMemo(() => {
    const max = Math.max(0, ...termTopics.map((topic) => topic.laggingStudents));
    return max || 1;
  }, [termTopics]);

  const priorityGradient = buildConicGradient([
    { value: curriculumStats.priorityCounts.high, color: '#ef4444' },
    { value: curriculumStats.priorityCounts.medium, color: '#f59e0b' },
    { value: curriculumStats.priorityCounts.low, color: '#10b981' },
  ]);

  return (
    <ReportLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Forecast Analytics</h1>
              <p className="text-sm text-slate-500">
                Deep analytics across curriculum and term forecasts, with priority and readiness insights.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Activity className="h-4 w-4" />
              <select
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('curriculum')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'curriculum'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Curriculum Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('term')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'term'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Term Forecast Analytics
            </button>
          </div>
        </div>

        {activeTab === 'curriculum' && (
          <section className="bg-white rounded-lg shadow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Curriculum Analytics</h2>
                <p className="text-xs text-slate-500">Whole-subject coverage and mastery signals.</p>
              </div>
              <span className="text-xs text-slate-500">{subjectName}</span>
            </div>

            {loadingCurriculum ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                      <div className="h-6 w-14 bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[0.7fr_1.3fr] gap-4">
                  <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
                    <div className="mx-auto h-24 w-24 rounded-full bg-slate-200 animate-pulse" />
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                      ))}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
                        <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                        <div className="h-2 w-24 bg-slate-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Avg coverage</p>
                    <p className="text-xl font-semibold text-slate-900">{curriculumStats.avgCoverage}%</p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Avg mastery</p>
                    <p className="text-xl font-semibold text-slate-900">{curriculumStats.avgMastery}%</p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Lagging learners</p>
                    <p className="text-xl font-semibold text-slate-900">{curriculumStats.laggingStudents}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[0.7fr_1.3fr] gap-4">
                  <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Priority split</span>
                      <span>{curriculumStats.totalTopics} topics</span>
                    </div>
                    <div className="mx-auto h-28 w-28 rounded-full" style={{ background: priorityGradient }} />
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High
                        </span>
                        <span>{curriculumStats.priorityCounts.high}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Medium
                        </span>
                        <span>{curriculumStats.priorityCounts.medium}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Low
                        </span>
                        <span>{curriculumStats.priorityCounts.low}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Biggest readiness gaps</span>
                      <BarChart3 className="h-4 w-4 text-slate-400" />
                    </div>
                    {curriculumStats.gapTopics.length === 0 ? (
                      <p className="text-xs text-slate-500">No topic analytics yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {curriculumStats.gapTopics.map((topic) => (
                          <div key={topic.id}>
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="font-medium text-slate-800">{topic.topic}</span>
                              <span>{topic.masteryPercent}% mastery</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 mt-1">
                              <div
                                className="h-2 rounded-full bg-blue-600"
                                style={{ width: `${topic.coveragePercent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                              <span>Coverage</span>
                              <span>{topic.coveragePercent}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Topic performance breakdown</span>
                    <span className="text-xs text-slate-400">Coverage vs mastery</span>
                  </div>
                  {curriculumTopicPerformance.length === 0 ? (
                    <p className="text-xs text-slate-500">No topic analytics yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {curriculumTopicPerformance.map((topic) => (
                        <div key={topic.id}>
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span className="font-medium text-slate-800">{topic.topic}</span>
                            <span>{topic.laggingStudents} lagging</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <div className="h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-blue-600"
                                  style={{ width: `${topic.coveragePercent}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                                <span>Coverage</span>
                                <span>{topic.coveragePercent}%</span>
                              </div>
                            </div>
                            <div>
                              <div className="h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{ width: `${topic.masteryPercent}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                                <span>Mastery</span>
                                <span>{topic.masteryPercent}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="h-2 rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full bg-rose-500/70"
                                style={{
                                  width: `${Math.round((topic.laggingStudents / curriculumLaggingMax) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                              <span>Lagging students intensity</span>
                              <span>{topic.laggingStudents}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'term' && (
          <section className="bg-white rounded-lg shadow p-5 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Term Forecast Analytics</h2>
                <p className="text-xs text-slate-500">Measure term progress against expected coverage.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <select
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                >
                  {TERM_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                >
                  {YEAR_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingTerm ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                      <div className="h-6 w-14 bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="h-3 w-36 bg-slate-200 rounded animate-pulse" />
                  <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                  <div className="h-2 w-32 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="h-3 w-36 bg-slate-200 rounded animate-pulse" />
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Avg term coverage</p>
                    <p className="text-xl font-semibold text-slate-900">{termStats.avgCoverage}%</p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Avg mastery</p>
                    <p className="text-xl font-semibold text-slate-900">{termStats.avgMastery}%</p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Expected coverage</p>
                    <p className="text-xl font-semibold text-slate-900">{termExpectedCoverage}%</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Term readiness vs target</span>
                    <Sparkles className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-emerald-500"
                      style={{ width: `${termStats.avgCoverage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Current: {termStats.avgCoverage}%</span>
                    <span>Target: {termExpectedCoverage}%</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Most critical term gaps</span>
                    <span className="text-xs text-slate-400">{termStats.totalTopics} topics</span>
                  </div>
                  {termStats.topGaps.length === 0 ? (
                    <p className="text-xs text-slate-500">No term topics available.</p>
                  ) : (
                    <div className="space-y-3">
                      {termStats.topGaps.map((topic) => {
                        const gap = Math.max(0, Math.round(termExpectedCoverage - topic.coveragePercent));
                        return (
                          <div key={topic.id}>
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="font-medium text-slate-800">{topic.topic}</span>
                              <span>{gap}% gap</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 mt-1">
                              <div
                                className="h-2 rounded-full bg-rose-500"
                                style={{ width: `${topic.coveragePercent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Term topic performance</span>
                    <span className="text-xs text-slate-400">Coverage, mastery, gap</span>
                  </div>
                  {termTopicPerformance.length === 0 ? (
                    <p className="text-xs text-slate-500">No term topics available.</p>
                  ) : (
                    <div className="space-y-4">
                      {termTopicPerformance.map((topic) => {
                        const gap = Math.max(0, Math.round(termExpectedCoverage - topic.coveragePercent));
                        return (
                          <div key={topic.id}>
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="font-medium text-slate-800">{topic.topic}</span>
                              <span>{gap}% gap</span>
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="relative h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-indigo-500"
                                  style={{ width: `${topic.coveragePercent}%` }}
                                />
                                <span
                                  className="absolute top-0 -translate-y-1 h-4 w-0.5 bg-amber-500"
                                  style={{ left: `${termExpectedCoverage}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Coverage</span>
                                <span>
                                  {topic.coveragePercent}% • Target {termExpectedCoverage}%
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{ width: `${topic.masteryPercent}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Mastery</span>
                                <span>{topic.masteryPercent}%</span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-rose-500/70"
                                  style={{
                                    width: `${Math.round((topic.laggingStudents / termLaggingMax) * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                                <span>Lagging students intensity</span>
                                <span>{topic.laggingStudents}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </ReportLayout>
  );
};

export default ReportForecastAnalyticsPage;
