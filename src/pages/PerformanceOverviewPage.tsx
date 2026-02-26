import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { studentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student } from '../types';
import PerformanceLayout from '../components/performance/PerformanceLayout';

const PerformanceOverviewPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [performerView, setPerformerView] = useState<'top' | 'support'>('top');

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const data = await studentService.getStudents(selectedSubject?.id);
        setStudents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load students for performance overview:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [selectedSubject?.id]);

  const averageOverall = useMemo(() => {
    if (students.length === 0) return 0;
    const total = students.reduce((sum, student) => sum + (student.overall || 0), 0);
    return Math.round(total / students.length);
  }, [students]);

  const needsSupport = useMemo(() => (
    students.filter((student) => (student.overall || 0) < 50 || (student.performance || '').toLowerCase().includes('needs')).length
  ), [students]);

  const overallClassGrade = useMemo(() => {
    if (averageOverall >= 80) return 'A';
    if (averageOverall >= 70) return 'B';
    if (averageOverall >= 60) return 'C';
    if (averageOverall >= 50) return 'D';
    if (averageOverall >= 40) return 'E';
    return 'U';
  }, [averageOverall]);

  const performanceData = useMemo(() => {
    const buckets: Record<string, number> = {
      Excellent: 0,
      Good: 0,
      Average: 0,
      Needs: 0,
    };
    students.forEach((student) => {
      const perf = (student.performance || '').toLowerCase();
      if (perf.includes('excellent')) buckets.Excellent += 1;
      else if (perf.includes('good')) buckets.Good += 1;
      else if (perf.includes('average')) buckets.Average += 1;
      else if (perf.includes('needs')) buckets.Needs += 1;
      else buckets.Average += 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [students]);

  const topStudents = useMemo(() => (
    [...students]
      .sort((a, b) => (b.overall || 0) - (a.overall || 0))
      .slice(0, 4)
  ), [students]);

  const supportStudents = useMemo(() => (
    [...students]
      .sort((a, b) => (a.overall || 0) - (b.overall || 0))
      .slice(0, 4)
  ), [students]);

  const displayedStudents = performerView === 'top' ? topStudents : supportStudents;

  return (
    <PerformanceLayout>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Class Performance Overview</h2>
          <p className="text-sm text-slate-500">Snapshot of class mastery and performance trends.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500">Average mastery</p>
            <p className="text-2xl font-semibold text-slate-900">{averageOverall}%</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500">Overall class grade</p>
            <p className="text-2xl font-semibold text-slate-900">{overallClassGrade}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500">Learners needing support</p>
            <p className="text-2xl font-semibold text-slate-900">{needsSupport}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500">Total students</p>
            <p className="text-2xl font-semibold text-slate-900">{students.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Performance distribution</h3>
            <div className="h-48">
              {loading ? (
                <div className="h-full bg-slate-200 rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} margin={{ left: -20, right: 10 }}>
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {performerView === 'top' ? 'Top performers' : 'Learners to support'}
              </h3>
              <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPerformerView('top')}
                  className={`rounded px-2 py-1 ${
                    performerView === 'top' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Top
                </button>
                <button
                  type="button"
                  onClick={() => setPerformerView('support')}
                  className={`rounded px-2 py-1 ${
                    performerView === 'support' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Support
                </button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-10 bg-slate-200 rounded animate-pulse" />
                ))}
              </div>
            ) : displayedStudents.length > 0 ? (
              <div className="space-y-2">
                {displayedStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium text-slate-800">
                      {student.firstName} {student.lastName}
                    </span>
                    <span>{student.overall ?? 0}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No student data available.</p>
            )}
          </div>
        </div>
      </div>
    </PerformanceLayout>
  );
};

export default PerformanceOverviewPage;
