import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Eye, Filter, RefreshCw, Trash2 } from 'lucide-react';
import AdminSectionHeader from '../components/AdminSectionHeader';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import { reportService } from '../../../services/reportService';
import { subjectService } from '../../../services/api';
import { termForecastService, TermForecastRecord } from '../../../services/termForecastService';
import { useToast } from '../../ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

interface SubjectOption {
  id: string;
  name: string;
}

const TERM_OPTIONS = ['All terms', 'Term 1', 'Term 2', 'Term 3'];

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

const AdminTermForecastsPage: React.FC = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [termFilter, setTermFilter] = useState('All terms');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [forecasts, setForecasts] = useState<TermForecastRecord[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewForecast, setViewForecast] = useState<TermForecastRecord | null>(null);
  const [viewTopics, setViewTopics] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewExpectedCoverage, setViewExpectedCoverage] = useState<number | null>(null);

  const loadSubjects = async () => {
    try {
      const data = await subjectService.getSubjects();
      const list = (Array.isArray(data) ? data : []).map((subject: any) => ({
        id: subject.id,
        name: subject.name || '',
      }));
      setSubjects(list);
      if (!selectedSubjectId && list.length > 0) {
        setSelectedSubjectId(list[0].id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load subjects.');
    }
  };

  const loadForecasts = async () => {
    if (!selectedSubjectId) {
      setForecasts([]);
      return;
    }
    setLoading(true);
    try {
      const term = termFilter === 'All terms' ? undefined : termFilter;
      const data = await termForecastService.list(selectedSubjectId, term);
      const filtered = (Array.isArray(data) ? data : [])
        .filter((forecast) => !yearFilter || forecast.academicYear === yearFilter)
        .map((forecast) => ({
          ...forecast,
          expectedTopicIds: normalizeExpectedTopicIds(forecast.expectedTopicIds),
        }));
      setForecasts(filtered);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load term forecasts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    loadForecasts();
  }, [selectedSubjectId, termFilter, yearFilter]);

  useEffect(() => {
    const loadView = async () => {
      if (!viewForecast) return;
      try {
        setViewLoading(true);
        const subjectId = viewForecast.classSubject?.subject?.id || selectedSubjectId;
        const response = await reportService.getTermForecast(
          subjectId,
          viewForecast.term,
          viewForecast.academicYear,
          viewForecast.id
        );
        const responseTopics = response?.topics ?? [];
        const responseExpectedIds = normalizeExpectedTopicIds(response?.expectedTopicIds);
        const fallbackExpectedIds = normalizeExpectedTopicIds(viewForecast.expectedTopicIds);
        const activeExpectedIds = responseExpectedIds.length ? responseExpectedIds : fallbackExpectedIds;
        const filteredTopics = activeExpectedIds.length
          ? responseTopics.filter((topic) => activeExpectedIds.includes(topic.id))
          : responseTopics;
        setViewTopics(filteredTopics);
        setViewExpectedCoverage(typeof response?.expectedCoveragePercent === 'number' ? response.expectedCoveragePercent : null);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load term forecast.');
        setViewTopics([]);
        setViewExpectedCoverage(null);
      } finally {
        setViewLoading(false);
      }
    };
    loadView();
  }, [viewForecast, selectedSubjectId]);

  const subjectName = useMemo(() => {
    return subjects.find((subject) => subject.id === selectedSubjectId)?.name || 'Select subject';
  }, [subjects, selectedSubjectId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await termForecastService.delete(deleteId);
      toast.success('Term forecast deleted.');
      setDeleteId(null);
      await loadForecasts();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete term forecast.');
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <AdminSectionHeader
        title="Term Forecasts"
        description="Review and remove term forecasts across subjects."
        icon={CalendarRange}
      />

      <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4 text-slate-500" /> Filters
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md"
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <select
              value={termFilter}
              onChange={(event) => setTermFilter(event.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md"
            >
              {TERM_OPTIONS.map((term) => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
            <input
              type="text"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              placeholder="Academic year"
              className="px-3 py-2 text-sm border border-slate-200 rounded-md w-32"
            />
            <button
              onClick={loadForecasts}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-slate-200 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500">Showing forecasts for {subjectName}</div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading term forecasts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b text-slate-500">
                  <th className="py-2 pr-4">Term</th>
                  <th className="py-2 pr-4">Academic year</th>
                  <th className="py-2 pr-4">Coverage target</th>
                  <th className="py-2 pr-4">Topics</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-slate-500">
                      No forecasts found for this filter.
                    </td>
                  </tr>
                )}
                {forecasts.map((forecast) => (
                  <tr key={forecast.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 text-slate-700">{forecast.term}</td>
                    <td className="py-3 pr-4 text-slate-700">{forecast.academicYear}</td>
                    <td className="py-3 pr-4 text-slate-700">{forecast.expectedCoveragePct ?? 0}%</td>
                    <td className="py-3 pr-4 text-slate-600">{forecast.expectedTopicIds?.length ?? 0}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => setDeleteId(forecast.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                      <button
                        onClick={() => setViewForecast(forecast)}
                        className="ml-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminConfirmDialog
        open={!!deleteId}
        title="Delete term forecast"
        description="This will remove the term forecast for the selected subject."
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        confirmLabel="Delete"
      />

      <Dialog open={!!viewForecast} onOpenChange={(open) => !open && setViewForecast(null)}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Term Forecast Details</DialogTitle>
            <DialogDescription>
              {viewForecast
                ? `${viewForecast.term} • Academic year ${viewForecast.academicYear}`
                : 'Forecast details'}
            </DialogDescription>
          </DialogHeader>
          {viewForecast && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Subject: {viewForecast.classSubject?.subject?.name || subjectName}</span>
                <span>Coverage target: {viewForecast.expectedCoveragePct ?? 0}%</span>
                <span>Topics selected: {viewForecast.expectedTopicIds?.length ?? 0}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b text-slate-500">
                      <th className="py-2 pr-4">Topic</th>
                      <th className="py-2 pr-4">Coverage</th>
                      <th className="py-2 pr-4">Gap</th>
                      <th className="py-2 pr-4">Mastery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewLoading && (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500">
                          Loading term topics...
                        </td>
                      </tr>
                    )}
                    {!viewLoading && viewTopics.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500">
                          No topics selected for this forecast.
                        </td>
                      </tr>
                    )}
                    {!viewLoading && viewTopics.map((topic) => {
                      const expectedCoverage =
                        viewExpectedCoverage !== null
                          ? viewExpectedCoverage
                          : viewForecast.expectedCoveragePct ?? 0;
                      const gap = Math.max(0, Math.round(expectedCoverage - topic.coveragePercent));
                      return (
                        <tr key={topic.id} className="border-b last:border-b-0">
                          <td className="py-3 pr-4 text-slate-900 font-medium">{topic.topic}</td>
                          <td className="py-3 pr-4 text-slate-700">
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
                          <td className="py-3 pr-4 text-slate-700">{gap}%</td>
                          <td className="py-3 pr-4 text-slate-700">
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTermForecastsPage;
