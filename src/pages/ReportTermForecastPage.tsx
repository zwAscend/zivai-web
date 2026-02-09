import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Filter } from 'lucide-react';
import ReportLayout from '../components/report/ReportLayout';
import { reportService, CurriculumTopicForecast } from '../services/reportService';
import { subjectService } from '../services/subjectService';
import { termForecastService } from '../services/termForecastService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'];

const ReportTermForecastPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [term, setTerm] = useState('Term 1');
  const [expectedCoverage, setExpectedCoverage] = useState(75);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [notes, setNotes] = useState('');
  const [expectedTopicIds, setExpectedTopicIds] = useState<string[]>([]);
  const [existingForecastId, setExistingForecastId] = useState<string | null>(null);
  const [topics, setTopics] = useState<CurriculumTopicForecast[]>([]);

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
    const loadForecast = async () => {
      try {
        setLoading(true);
        if (!selectedSubjectId) {
          setTopics([]);
          setLoading(false);
          return;
        }

        const [termResponse, curriculumResponse, existingForecasts] = await Promise.all([
          reportService.getTermForecast(selectedSubjectId, term),
          reportService.getCurriculumForecast(selectedSubjectId),
          termForecastService.list(selectedSubjectId, term).catch(() => []),
        ]);

        const existingForecast = existingForecasts?.[0] || null;
        setExistingForecastId(existingForecast?.id ?? null);
        setAcademicYear(existingForecast?.academicYear || academicYear);
        setNotes(existingForecast?.notes || '');
        if (existingForecast?.expectedTopicIds && Array.isArray(existingForecast.expectedTopicIds)) {
          setExpectedTopicIds(existingForecast.expectedTopicIds);
        } else {
          setExpectedTopicIds([]);
        }

        if (existingForecast?.expectedCoveragePct !== undefined) {
          setExpectedCoverage(Math.round(existingForecast.expectedCoveragePct));
        } else {
          setExpectedCoverage(termResponse?.expectedCoveragePercent ?? expectedCoverage);
        }

        setTopics(termResponse?.topics ?? curriculumResponse?.topics ?? []);
      } catch (error) {
        console.error('Term forecast unavailable:', error);
        setTopics([]);
      } finally {
        setLoading(false);
      }
    };
    loadForecast();
  }, [selectedSubjectId, term]);

  const completion = topics.length
    ? Math.round(topics.reduce((sum, topic) => sum + topic.coveragePercent, 0) / topics.length)
    : 0;

  const mastery = topics.length
    ? Math.round(topics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / topics.length)
    : 0;

  const topicStatus = useMemo(() => {
    return topics.map((topic) => ({
      ...topic,
      progressGap: Math.max(0, expectedCoverage - topic.coveragePercent)
    }));
  }, [topics, expectedCoverage]);

  const handleToggleTopic = (topicId: string) => {
    setExpectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  const handleSaveForecast = async () => {
    if (!selectedSubjectId) {
      toast.error('Select a subject to save a term forecast.');
      return;
    }
    const currentUser = authService.getCurrentUser();
    try {
      const payload = {
        subjectId: selectedSubjectId,
        teacherId: currentUser?.id,
        term,
        academicYear,
        expectedCoveragePercent: expectedCoverage,
        expectedTopicIds,
        notes,
      };

      if (existingForecastId) {
        await termForecastService.update(existingForecastId, payload);
        toast.success('Term forecast updated.');
      } else {
        await termForecastService.create(payload);
        toast.success('Term forecast created.');
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
              <h1 className="text-2xl font-bold text-slate-900">Term Forecast</h1>
              <p className="text-sm text-slate-500">
                Track term targets, expected coverage, and student readiness per subject.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarRange className="h-4 w-4" />
              <span>{subjects.find((subject) => subject.id === selectedSubjectId)?.name || 'All subjects'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4 text-slate-500" /> Term Settings
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
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                {TERM_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input
                type="text"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                placeholder="Academic year"
                className="px-3 py-2 text-sm border border-slate-200 rounded-md w-32"
              />
              <div className="flex items-center gap-2 text-sm border border-slate-200 rounded-md px-3 py-2">
                <span className="text-xs text-slate-500">Expected coverage</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={expectedCoverage}
                  onChange={(event) => setExpectedCoverage(Number(event.target.value))}
                  className="w-16 text-sm border border-slate-200 rounded px-2 py-1"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Expected Topics This Term</h3>
              <p className="text-xs text-slate-500">
                Select the curriculum topics you expect to cover in this term forecast.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {topics.length === 0 && (
                  <div className="text-xs text-slate-500">No topics loaded yet.</div>
                )}
                {topics.map((topic) => (
                  <label key={topic.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={expectedTopicIds.includes(topic.id)}
                      onChange={() => handleToggleTopic(topic.id)}
                      className="rounded border-slate-300"
                    />
                    <span>{topic.topic}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Teacher Notes</h3>
              <p className="text-xs text-slate-500">Capture term expectations or constraints.</p>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full min-h-[140px] border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Planned units, milestones, or assessment checkpoints..."
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveForecast}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save Term Forecast
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Term completion</p>
              <p className="text-2xl font-semibold text-slate-900">{completion}%</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Mastery level</p>
              <p className="text-2xl font-semibold text-slate-900">{mastery}%</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Expected coverage</p>
              <p className="text-2xl font-semibold text-slate-900">{expectedCoverage}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-slate-900">Term Topic Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">
            Monitor term targets versus actual delivery and mastery.
          </p>
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
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      Loading term forecast...
                    </td>
                  </tr>
                )}
                {!loading && topicStatus.map((topic) => (
                  <tr key={topic.id}>
                    <td className="px-4 py-3 text-slate-900 font-medium">{topic.topic}</td>
                    <td className="px-4 py-3 text-slate-700">{topic.coveragePercent}%</td>
                    <td className="px-4 py-3 text-slate-700">{topic.progressGap}%</td>
                    <td className="px-4 py-3 text-slate-700">{topic.masteryPercent}%</td>
                  </tr>
                ))}
                {!loading && topicStatus.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No term forecast data yet. Define term expectations to begin tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
};

export default ReportTermForecastPage;
