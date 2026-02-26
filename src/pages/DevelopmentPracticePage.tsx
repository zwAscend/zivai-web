import React, { useEffect, useMemo, useState } from 'react';
import { studentService, subjectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student, Subject } from '../types';
import DevelopmentLayout from '../components/development/DevelopmentLayout';

const DevelopmentPracticePage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (!subjectFilter && selectedSubject?.id) {
          setSubjectFilter(selectedSubject.id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, [selectedSubject?.id]);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const data = await studentService.getStudents(subjectFilter || undefined);
        setStudents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load students for next best practice:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [subjectFilter]);

  const practiceList = useMemo(() => {
    return students
      .filter((student) => (student.overall || 0) < 70)
      .map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        focus: student.strength ? `Reinforce ${student.strength}` : 'Target foundational skills',
        engagement: student.engagement || 'Medium',
        plan: student.activePlan?.plan?.name || 'No active plan',
        overall: student.overall ?? 0,
      }));
  }, [students]);

  return (
    <DevelopmentLayout>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Next Best Practice</h2>
          <p className="text-sm text-slate-500">
            Recommended practice focus areas based on recent performance and mastery gaps.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full sm:w-auto border border-slate-200 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ) : practiceList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {practiceList.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">Overall: {item.overall}% • Engagement: {item.engagement}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">Suggested</span>
                </div>
                <p className="text-xs text-slate-600 mt-3">{item.focus}</p>
                <p className="text-xs text-slate-500 mt-2">Plan: {item.plan}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No practice recommendations available.</div>
        )}
      </div>
    </DevelopmentLayout>
  );
};

export default DevelopmentPracticePage;
