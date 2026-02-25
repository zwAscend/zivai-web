import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentService, developmentService, subjectService } from '../../services/api';
import { Student } from '../../types';
import ClassroomLayout from './ClassroomLayout';

type StudentWithInsights = Student & {
  planName: string;
  planProgress: number | null;
  weakness: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
};

type TeachingSubject = {
  id: string;
  code?: string;
  name: string;
};

const ClassroomStudentsSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
  <tbody>
    {Array.from({ length: 8 }).map((_, rowIdx) => (
      <tr key={rowIdx}>
        {Array.from({ length: columns }).map((__, colIdx) => (
          <td key={colIdx} className="px-4 py-1.5 border-b">
            <div className="h-4 rounded bg-slate-200 animate-pulse" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

const getGradeFromOverall = (overall: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'U' => {
  if (overall >= 75) return 'A';
  if (overall >= 65) return 'B';
  if (overall >= 50) return 'C';
  if (overall >= 45) return 'D';
  if (overall >= 35) return 'E';
  return 'U';
};

const toPerformanceFilterKey = (value: string) => value.trim().toLowerCase();

const ClassroomView: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithInsights[]>([]);
  const [subjects, setSubjects] = useState<TeachingSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [weaknessFilter, setWeaknessFilter] = useState('all');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(Array.isArray(data) ? data : []);
      } catch {
        setSubjects([]);
      }
    };

    fetchSubjects();
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const selectedSubjectId = subjectFilter !== 'all' ? subjectFilter : undefined;
      const rawStudents = await studentService.getStudents(selectedSubjectId);

      const studentsWithInsights = await Promise.all(
        (Array.isArray(rawStudents) ? rawStudents : []).map(async (student: Student) => {
          try {
            const plans = await developmentService.getAllPlansForStudent(student.id);
            const activePlan = plans.find((plan) => plan.status === 'Active') || plans[0];
            const planName = activePlan?.plan?.name || 'No plan';
            const planProgress =
              typeof activePlan?.currentProgress === 'number' ? activePlan.currentProgress : null;

            let weakestSkill = 'N/A';
            if (Array.isArray(activePlan?.skillProgress) && activePlan!.skillProgress!.length > 0) {
              const lowest = activePlan!.skillProgress!.reduce((lowestItem, current) =>
                current.currentScore < lowestItem.currentScore ? current : lowestItem
              );
              weakestSkill = lowest.skill || 'N/A';
            }

            return {
              ...student,
              planName,
              planProgress,
              weakness: weakestSkill,
              grade: getGradeFromOverall(Number(student.overall) || 0),
            } as StudentWithInsights;
          } catch {
            return {
              ...student,
              planName: 'No plan',
              planProgress: null,
              weakness: 'N/A',
              grade: getGradeFromOverall(Number(student.overall) || 0),
            } as StudentWithInsights;
          }
        })
      );

      setStudents(studentsWithInsights);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const weaknessOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        students
          .map((student) => (student.weakness || '').trim())
          .filter((value) => value.length > 0 && value !== 'N/A')
      )
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const email = (student.email || '').toLowerCase();
      const matchesQuery = !query || fullName.includes(query) || email.includes(query);

      const matchesPerformance =
        performanceFilter === 'all' ||
        toPerformanceFilterKey(student.performance || '').includes(performanceFilter);

      const matchesEngagement =
        engagementFilter === 'all' ||
        toPerformanceFilterKey(student.engagement || '') === engagementFilter;

      const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter;

      const matchesWeakness =
        weaknessFilter === 'all' || (student.weakness || '').toLowerCase() === weaknessFilter.toLowerCase();

      return matchesQuery && matchesPerformance && matchesEngagement && matchesGrade && matchesWeakness;
    });
  }, [students, searchQuery, performanceFilter, engagementFilter, gradeFilter, weaknessFilter]);

  if (error) {
    return (
      <ClassroomLayout>
        <div className="p-4 text-red-500">Error: {error}</div>
      </ClassroomLayout>
    );
  }

  return (
    <ClassroomLayout>
      <div className="h-full space-y-2 relative transition-all duration-300 ease-in-out">
        <div className="bg-white rounded-lg shadow p-2">
          <div className="bg-white rounded-lg shadow p-4 mb-3">
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex basis-full flex-wrap gap-2 min-w-0">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or email"
                  className="w-full min-w-0 sm:flex-1 sm:min-w-[260px] px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
                <select
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value)}
                  className="w-full min-w-0 sm:flex-none sm:w-[280px] px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="all">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code ? `${subject.code}: ${subject.name}` : subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex basis-full flex-wrap gap-2 min-w-0">
                <select
                  value={performanceFilter}
                  onChange={(event) => setPerformanceFilter(event.target.value)}
                  className="w-full min-w-0 sm:w-auto sm:min-w-[150px] sm:flex-none px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="all">All performance</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="average">Average</option>
                  <option value="needs">Needs improvement</option>
                </select>
                <select
                  value={engagementFilter}
                  onChange={(event) => setEngagementFilter(event.target.value)}
                  className="w-full min-w-0 sm:w-auto sm:min-w-[150px] sm:flex-none px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="all">All engagement</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={gradeFilter}
                  onChange={(event) => setGradeFilter(event.target.value)}
                  className="w-full min-w-0 sm:w-auto sm:min-w-[150px] sm:flex-none px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="all">All grades</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="U">U</option>
                </select>
                <select
                  value={weaknessFilter}
                  onChange={(event) => setWeaknessFilter(event.target.value)}
                  className="w-full min-w-0 sm:w-auto sm:min-w-[150px] sm:flex-none px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="all">All weaknesses</option>
                  {weaknessOptions.map((weakness) => (
                    <option key={weakness} value={weakness}>
                      {weakness}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[560px]">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-1.5 border-b text-left">Full Name</th>
                  <th className="px-4 py-1.5 border-b text-left">Overall</th>
                  <th className="px-4 py-1.5 border-b text-left">Grade</th>
                  <th className="px-4 py-1.5 border-b text-left">Strength</th>
                  <th className="px-4 py-1.5 border-b text-left">Weakness</th>
                  <th className="px-4 py-1.5 border-b text-left">Performance</th>
                  <th className="px-4 py-1.5 border-b text-left">Plan</th>
                  <th className="px-4 py-1.5 border-b text-left">Plan Performance</th>
                  <th className="px-4 py-1.5 border-b text-left">Profile</th>
                </tr>
              </thead>
              {loading ? (
                <ClassroomStudentsSkeleton columns={9} />
              ) : filteredStudents.length > 0 ? (
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr
                      key={student.id}
                      className={`${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-blue-50 transition-colors duration-300`}
                    >
                      <td className="px-4 py-1.5 border-b text-sm">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-4 py-1.5 border-b text-sm">{student.overall}</td>
                      <td className="px-4 py-1.5 border-b text-sm">{student.grade}</td>
                      <td className="px-4 py-1.5 border-b text-sm">{student.strength || 'N/A'}</td>
                      <td className="px-4 py-1.5 border-b text-sm">{student.weakness || 'N/A'}</td>
                      <td className="px-4 py-1.5 border-b text-sm">{student.performance || 'N/A'}</td>
                      <td className="px-4 py-1.5 border-b text-sm">{student.planName}</td>
                      <td className="px-4 py-1.5 border-b text-sm">
                        {student.planProgress === null ? 'N/A' : `${Math.round(student.planProgress)}%`}
                      </td>
                      <td className="px-4 py-1.5 border-b text-sm">
                        <button
                          type="button"
                          onClick={() => navigate(`/students/profile?studentId=${encodeURIComponent(student.id)}`)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ) : (
                <tbody>
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-sm text-center text-slate-500 border-b">
                      No students match the selected filters.
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </ClassroomLayout>
  );
};

export default ClassroomView;
