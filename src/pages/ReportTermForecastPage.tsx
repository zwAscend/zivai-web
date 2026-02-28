import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Filter, Plus } from 'lucide-react';
import ReportLayout from '../components/report/ReportLayout';
import { reportService, CurriculumTopicForecast } from '../services/reportService';
import { subjectService } from '../services/subjectService';
import { termForecastService, TermForecastRecord } from '../services/termForecastService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import TablePagination from '../components/ui/TablePagination';
import { useClientPagination } from '../hooks/useClientPagination';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'];
const TERM_FILTERS = ['All terms', ...TERM_OPTIONS];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
  CURRENT_YEAR + 2,
].map((year) => year.toString());

const normalizeExpectedTopicIds = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : String(item)));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === 'string' ? item : String(item)));
      }
    } catch (error) {
      return [];
    }
  }
  return [];
};

const ReportTermForecastPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [termFilter, setTermFilter] = useState('All terms');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [forecasts, setForecasts] = useState<TermForecastRecord[]>([]);
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(null);
  const [detailTopics, setDetailTopics] = useState<CurriculumTopicForecast[]>([]);
  const [detailExpectedCoverage, setDetailExpectedCoverage] = useState<number | null>(null);
  const [detailExpectedTopicIds, setDetailExpectedTopicIds] = useState<string[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForecastId, setEditingForecastId] = useState<string | null>(null);
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formTerm, setFormTerm] = useState('Term 1');
  const [formAcademicYear, setFormAcademicYear] = useState(new Date().getFullYear().toString());
  const [formExpectedCoverage, setFormExpectedCoverage] = useState(70);
  const [formNotes, setFormNotes] = useState('');
  const [formExpectedTopicIds, setFormExpectedTopicIds] = useState<string[]>([]);
  const [formTopics, setFormTopics] = useState<CurriculumTopicForecast[]>([]);

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
    const loadForecasts = async () => {
      try {
        setLoading(true);
        if (!selectedSubjectId) {
          setForecasts([]);
          setLoading(false);
          return;
        }

        const filtered = await fetchForecastList(selectedSubjectId, termFilter, yearFilter);
        if (filtered.length > 0) {
          const current = filtered.find((forecast) => forecast.id === selectedForecastId) ?? filtered[0];
          setSelectedForecastId(current.id);
        } else {
          setSelectedForecastId(null);
        }
      } catch (error) {
        console.error('Term forecast unavailable:', error);
        setForecasts([]);
      } finally {
        setLoading(false);
      }
    };
    loadForecasts();
  }, [selectedSubjectId, termFilter, yearFilter]);

  const fetchForecastList = async (subjectId: string, termValue: string, yearValue: string) => {
    const forecastList = await termForecastService
      .list(subjectId, termValue === 'All terms' ? undefined : termValue)
      .catch(() => []);
    const filtered = forecastList
      .filter((forecast) => !yearValue || forecast.academicYear === yearValue)
      .map((forecast) => ({
        ...forecast,
        expectedTopicIds: normalizeExpectedTopicIds(forecast.expectedTopicIds),
      }));
    setForecasts(filtered);
    return filtered;
  };

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedSubjectId || !selectedForecastId) {
        setDetailTopics([]);
        return;
      }
      const forecast = forecasts.find((item) => item.id === selectedForecastId);
      if (!forecast) {
        setDetailTopics([]);
        return;
      }

      try {
        setDetailLoading(true);
        const subjectId = forecast.classSubject?.subject?.id || selectedSubjectId;
        const response = await reportService.getTermForecast(
          subjectId,
          forecast.term,
          forecast.academicYear,
          forecast.id
        );
        const responseTopics = response?.topics ?? [];
        const responseExpectedIds = normalizeExpectedTopicIds(response?.expectedTopicIds);
        const fallbackExpectedIds = normalizeExpectedTopicIds(forecast.expectedTopicIds);
        const activeExpectedIds = responseExpectedIds.length ? responseExpectedIds : fallbackExpectedIds;
        const filteredTopics = activeExpectedIds.length
          ? responseTopics.filter((topic) => activeExpectedIds.includes(topic.id))
          : responseTopics;
        setDetailTopics(filteredTopics);
        setDetailExpectedTopicIds(activeExpectedIds);
        setDetailExpectedCoverage(typeof response?.expectedCoveragePercent === 'number' ? response.expectedCoveragePercent : null);
      } catch (error) {
        console.error('Failed to load term breakdown:', error);
        setDetailTopics([]);
        setDetailExpectedCoverage(null);
        setDetailExpectedTopicIds([]);
      } finally {
        setDetailLoading(false);
      }
    };
    loadDetail();
  }, [selectedForecastId, selectedSubjectId, forecasts]);

  useEffect(() => {
    if (!isCreateOpen) return;
    if (!formSubjectId) return;
    const loadFormTopics = async () => {
      try {
        const response = await reportService.getCurriculumForecast(formSubjectId);
        setFormTopics(response?.topics ?? []);
      } catch (error) {
        console.error('Failed to load topics for form:', error);
        setFormTopics([]);
      }
    };
    loadFormTopics();
  }, [isCreateOpen, formSubjectId]);

  const selectedForecast = useMemo(
    () => forecasts.find((forecast) => forecast.id === selectedForecastId) ?? null,
    [forecasts, selectedForecastId]
  );

  const detailStats = useMemo(() => {
    const completion = detailTopics.length
      ? Math.round(detailTopics.reduce((sum, topic) => sum + topic.coveragePercent, 0) / detailTopics.length)
      : 0;
    const mastery = detailTopics.length
      ? Math.round(detailTopics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / detailTopics.length)
      : 0;
    const expectedCoverage =
      detailExpectedCoverage !== null
        ? detailExpectedCoverage
        : selectedForecast?.expectedCoveragePct ?? 0;
    const topicStatus = detailTopics.map((topic) => ({
      ...topic,
      progressGap: Math.max(0, Math.round(expectedCoverage - topic.coveragePercent))
    }));
    return { completion, mastery, expectedCoverage, topicStatus };
  }, [detailTopics, detailExpectedCoverage, selectedForecast]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedDetailTopics,
    rangeStart,
    rangeEnd,
    setCurrentPage,
    setPageSize,
  } = useClientPagination(detailStats.topicStatus, {
    initialPageSize: 8,
    resetKey: `${selectedForecastId || 'none'}|${detailStats.topicStatus.length}`,
  });

  const formSelectedTopicIds = useMemo(
    () => normalizeExpectedTopicIds(formExpectedTopicIds),
    [formExpectedTopicIds]
  );

  const handleToggleFormTopic = (topicId: string) => {
    setFormExpectedTopicIds((prev) => {
      const normalized = normalizeExpectedTopicIds(prev);
      return normalized.includes(topicId)
        ? normalized.filter((id) => id !== topicId)
        : [...normalized, topicId];
    });
  };

  const handleOpenCreate = () => {
    const defaultSubject = selectedSubjectId || subjects[0]?.id || '';
    setFormSubjectId(defaultSubject);
    setFormTerm(termFilter === 'All terms' ? 'Term 1' : termFilter);
    setFormAcademicYear(yearFilter || new Date().getFullYear().toString());
    setFormExpectedCoverage(70);
    setFormNotes('');
    setFormExpectedTopicIds([]);
    setEditingForecastId(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (forecast: TermForecastRecord) => {
    setFormSubjectId(forecast.classSubject?.subject?.id || selectedSubjectId);
    setFormTerm(forecast.term);
    setFormAcademicYear(forecast.academicYear);
    setFormExpectedCoverage(Math.round(forecast.expectedCoveragePct ?? 0));
    setFormNotes(forecast.notes || '');
    let selectedIds = normalizeExpectedTopicIds(forecast.expectedTopicIds);
    if (selectedIds.length === 0 && forecast.id === selectedForecastId && detailExpectedTopicIds.length > 0) {
      selectedIds = detailExpectedTopicIds;
    } else if (selectedIds.length === 0 && forecast.id === selectedForecastId && detailTopics.length > 0) {
      selectedIds = detailTopics.map((topic) => topic.id);
    }
    setFormExpectedTopicIds(selectedIds);
    setEditingForecastId(forecast.id);
    setIsCreateOpen(true);
  };

  const handleSaveForecast = async () => {
    if (!formSubjectId) {
      toast.error('Select a subject to save a term forecast.');
      return;
    }
    const currentUser = authService.getCurrentUser();
    try {
      if (!editingForecastId) {
        const existing = await termForecastService.list(formSubjectId, formTerm);
        const duplicate = existing.find(
          (forecast) => forecast.academicYear === formAcademicYear
        );
        if (duplicate) {
          toast.error('A term forecast already exists for this subject, term, and academic year.');
          return;
        }
      }
      const payload = {
        subjectId: formSubjectId,
        teacherId: currentUser?.id,
        term: formTerm,
        academicYear: formAcademicYear,
        expectedCoveragePercent: formExpectedCoverage,
        expectedTopicIds: formSelectedTopicIds,
        notes: formNotes,
      };

      const saved = editingForecastId
        ? await termForecastService.update(editingForecastId, payload)
        : await termForecastService.create(payload);
      toast.success(editingForecastId ? 'Term forecast updated.' : 'Term forecast saved.');
      setIsCreateOpen(false);
      setSelectedSubjectId(formSubjectId);
      setTermFilter('All terms');
      setYearFilter(formAcademicYear);
      const refreshed = await fetchForecastList(formSubjectId, 'All terms', formAcademicYear);
      if (refreshed.find((item) => item.id === saved.id)) {
        setSelectedForecastId(saved.id);
      } else if (refreshed.length > 0) {
        setSelectedForecastId(refreshed[0].id);
      }
    } catch (error) {
      console.error('Failed to save term forecast:', error);
      toast.error('Failed to save term forecast.');
    }
  };

  return (
    <ReportLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Term Forecasts</h1>
              <p className="text-sm text-slate-500">
                Create subject-level term forecasts and track topic readiness across the term.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarRange className="h-4 w-4" />
                <span>{subjects.find((subject) => subject.id === selectedSubjectId)?.name || 'Select subject'}</span>
              </div>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create Term Forecast
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4 text-slate-500" /> Forecast Filters
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <select
                value={termFilter}
                onChange={(event) => setTermFilter(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                {TERM_FILTERS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md w-32"
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Term Forecasts</h3>
              <span className="text-xs text-slate-500">{forecasts.length} records</span>
            </div>
            {loading && (
              <div className="text-sm text-slate-500">Loading forecasts...</div>
            )}
            {!loading && forecasts.length === 0 && (
              <div className="text-sm text-slate-500">No forecasts yet for this subject.</div>
            )}
            <div className="space-y-3">
              {forecasts.map((forecast) => {
                const isActive = forecast.id === selectedForecastId;
                return (
                  <button
                    key={forecast.id}
                    onClick={() => setSelectedForecastId(forecast.id)}
                    className={`w-full text-left border rounded-lg p-4 transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{forecast.term}</p>
                        <p className="text-xs text-slate-500">Academic year {forecast.academicYear}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                          {forecast.expectedCoveragePct ?? 0}% target
                        </span>
                        <span
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenEdit(forecast);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        Topics selected:{' '}
                        {forecast.expectedTopicIds?.length ??
                          (forecast.id === selectedForecastId ? detailExpectedTopicIds.length : 0)}
                      </span>
                      <span>Subject: {subjects.find((subject) => subject.id === selectedSubjectId)?.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Term Topic Breakdown</h3>
                <p className="text-xs text-slate-500">Coverage versus mastery for the selected forecast.</p>
              </div>
              {selectedForecast && (
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {selectedForecast.term} • {selectedForecast.academicYear}
                  </span>
                  <button
                    onClick={() => handleOpenEdit(selectedForecast)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Edit forecast
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Term completion</p>
                <p className="text-2xl font-semibold text-slate-900">{detailStats.completion}%</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Mastery level</p>
                <p className="text-2xl font-semibold text-slate-900">{detailStats.mastery}%</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">Expected coverage</p>
                <p className="text-2xl font-semibold text-slate-900">{detailStats.expectedCoverage}%</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Topic</th>
                    <th className="px-4 py-3 text-left">Coverage</th>
                    <th className="px-4 py-3 text-left">Gap to target</th>
                    <th className="px-4 py-3 text-left">Mastery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailLoading && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        Loading term breakdown...
                      </td>
                    </tr>
                  )}
                  {!detailLoading && paginatedDetailTopics.map((topic) => (
                    <tr key={topic.id}>
                      <td className="px-4 py-3 text-slate-900 font-medium">{topic.topic}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{topic.coveragePercent}%</span>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${topic.coveragePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{topic.progressGap}%</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{topic.masteryPercent}%</span>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                topic.masteryPercent >= 70
                                  ? 'bg-emerald-500'
                                  : topic.masteryPercent >= 50
                                    ? 'bg-yellow-400'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${topic.masteryPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!detailLoading && detailStats.topicStatus.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        {selectedForecast
                          ? 'No topics selected for this forecast yet. Edit the forecast to add topics.'
                          : 'Select a term forecast to view the breakdown.'}
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
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>{editingForecastId ? 'Edit Term Forecast' : 'Create Term Forecast'}</DialogTitle>
            <DialogDescription>
              Choose subject, term, and topics to outline term expectations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Subject</label>
                <select
                  value={formSubjectId}
                  onChange={(event) => setFormSubjectId(event.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Term</label>
                <select
                  value={formTerm}
                  onChange={(event) => setFormTerm(event.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  {TERM_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Academic year</label>
                <select
                  value={formAcademicYear}
                  onChange={(event) => setFormAcademicYear(event.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Expected coverage (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formExpectedCoverage}
                  onChange={(event) => setFormExpectedCoverage(Number(event.target.value))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Expected Topics</h3>
              <p className="text-xs text-slate-500">
                Choose the curriculum topics you plan to cover in this term.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {formTopics.length === 0 && (
                  <div className="text-xs text-slate-500">No topics loaded for this subject.</div>
                )}
                {formTopics.map((topic) => (
                  <label key={topic.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formSelectedTopicIds.includes(topic.id)}
                      onChange={() => handleToggleFormTopic(topic.id)}
                      className="rounded border-slate-300"
                    />
                    <span>{topic.topic}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Teacher notes</label>
              <textarea
                value={formNotes}
                onChange={(event) => setFormNotes(event.target.value)}
                className="w-full min-h-[120px] border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Milestones, assessments, or constraints for the term."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveForecast}
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                {editingForecastId ? 'Update Term Forecast' : 'Create Term Forecast'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ReportLayout>
  );
};

export default ReportTermForecastPage;
