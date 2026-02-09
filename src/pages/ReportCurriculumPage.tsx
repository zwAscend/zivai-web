import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Filter, Search } from 'lucide-react';
import ReportLayout from '../components/report/ReportLayout';
import { reportService, CurriculumTopicForecast } from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import { subjectService } from '../services/subjectService';

const ReportCurriculumPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<CurriculumTopicForecast[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [topicQuery, setTopicQuery] = useState('');
  const [affectedFilter, setAffectedFilter] = useState('all');

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
        const subjectId = selectedSubjectId || selectedSubject?.id;
        const response = await reportService.getCurriculumForecast(subjectId || undefined);
        setTopics(response?.topics ?? []);
      } catch (error) {
        console.error('Curriculum forecast unavailable:', error);
        setTopics([]);
      } finally {
        setLoading(false);
      }
    };
    loadForecast();
  }, [selectedSubjectId, selectedSubject]);

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      const matchesPriority = priorityFilter === 'all' || topic.priority === priorityFilter;
      const matchesQuery = topicQuery === '' || topic.topic.toLowerCase().includes(topicQuery.toLowerCase());
      const matchesAffected =
        affectedFilter === 'all' ||
        (affectedFilter === 'high' && topic.laggingStudents >= 5) ||
        (affectedFilter === 'medium' && topic.laggingStudents >= 3) ||
        (affectedFilter === 'low' && topic.laggingStudents > 0);
      return matchesPriority && matchesQuery && matchesAffected;
    });
  }, [topics, priorityFilter, topicQuery, affectedFilter]);

  const totalTopics = topics.length;
  const completion = totalTopics
    ? Math.round(topics.reduce((sum, topic) => sum + topic.coveragePercent, 0) / totalTopics)
    : 0;
  const mastery = totalTopics
    ? Math.round(topics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / totalTopics)
    : 0;
  const laggingCount = topics.reduce((sum, topic) => sum + topic.laggingStudents, 0);
  const mostLacking = topics
    .slice()
    .sort((a, b) => a.masteryPercent - b.masteryPercent)[0];

  return (
    <ReportLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Curriculum Forecast</h1>
              <p className="text-sm text-slate-500">
                Track curriculum coverage, mastery gaps, and lagging learners by topic.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BookOpen className="h-4 w-4" />
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-4">
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
                <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-slate-500">Completion level</p>
              <p className="text-2xl font-semibold text-slate-900">{completion}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-slate-500">Mastery level</p>
              <p className="text-2xl font-semibold text-slate-900">{mastery}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-slate-500">Lagging students</p>
              <p className="text-2xl font-semibold text-slate-900">{laggingCount}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-slate-500">Most lacking topic</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {mostLacking ? mostLacking.topic : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4 text-slate-500" /> Filters
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  value={topicQuery}
                  onChange={(event) => setTopicQuery(event.target.value)}
                  placeholder="Search topic"
                  className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                <option value="all">All priorities</option>
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
              <select
                value={affectedFilter}
                onChange={(event) => setAffectedFilter(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                <option value="all">All affected</option>
                <option value="high">Most affected</option>
                <option value="medium">Moderate impact</option>
                <option value="low">Low impact</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Topic</th>
                  <th className="px-4 py-3 text-left">Coverage</th>
                  <th className="px-4 py-3 text-left">Mastery</th>
                  <th className="px-4 py-3 text-left">Lagging Students</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTopics.map((topic) => (
                  <tr key={topic.id}>
                    <td className="px-4 py-3 text-slate-900 font-medium">{topic.topic}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="w-40 bg-slate-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${topic.coveragePercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{topic.coveragePercent}%</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{topic.masteryPercent}%</td>
                    <td className="px-4 py-3 text-slate-700">{topic.laggingStudents}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          topic.status === 'critical'
                            ? 'bg-red-50 text-red-600'
                            : topic.status === 'risk'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {topic.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && filteredTopics.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No curriculum data yet. The admin needs to publish the subject curriculum to see progress.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && topics.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            Curriculum data is not yet available for this subject. Ask the admin to publish the ZIMSEC syllabus.
          </div>
        )}
      </div>
    </ReportLayout>
  );
};

export default ReportCurriculumPage;
