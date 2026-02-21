import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { studentService, developmentService } from '../../services/api';
import { Student } from '../../types';
import StudentChat from './StudentChat';
import DevelopmentAttributesView from './DevelopmentAttributesView';
import ResultsView from './ResultsView';
import ClassroomLayout from './ClassroomLayout';

type StudentWithPlan = Student & { planName?: string };

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

const ClassroomView: React.FC = () => {
  const location = useLocation();
  const queryTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    return tab === 'results' || tab === 'development' ? tab : 'status';
  }, [location.search]);
  const [activeTab, setActiveTab] = useState(queryTab);
  const [students, setStudents] = useState<StudentWithPlan[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithPlan | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [selectedForResults, setSelectedForResults] = useState(false);
  const [selectedForDevelopment, setSelectedForDevelopment] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState('all');

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const email = (student.email || '').toLowerCase();
      const matchesQuery = !query || fullName.includes(query) || email.includes(query);
      const performance = (student.performance || '').toLowerCase();
      const engagement = (student.engagement || '').toLowerCase();
      const matchesPerformance =
        performanceFilter === 'all' || performance.includes(performanceFilter);
      const matchesEngagement =
        engagementFilter === 'all' || engagement.includes(engagementFilter);
      return matchesQuery && matchesPerformance && matchesEngagement;
    });
  }, [students, searchQuery, performanceFilter, engagementFilter]);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await studentService.getStudents();

      if (activeTab === 'development') {
        const studentsWithPlans = await Promise.all(
          data.map(async (student) => {
            try {
              const studentId = student.id;
              if (!studentId) {
                return { ...student, planName: undefined };
              }
              const plans = await developmentService.getAllPlansForStudent(studentId);
              return {
                ...student,
                planName: plans.length > 0 ? plans[0].plan.name : undefined,
              };
            } catch {
              return { ...student, planName: undefined };
            }
          })
        );
        setStudents(studentsWithPlans);
        setSelectedStudent(studentsWithPlans[0]);
      } else {
        setStudents(data);
        setSelectedStudent(data[0]);
      }

      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents, activeTab]);

  useEffect(() => {
    if (queryTab !== activeTab) {
      setActiveTab(queryTab);
      setSelectedForResults(false);
      setSelectedForDevelopment(false);
      setShowChat(false);
    }
  }, [queryTab]);

  useEffect(() => {
    if (filteredStudents.length === 0) {
      setSelectedStudent(null);
      return;
    }
    if (!selectedStudent || !filteredStudents.some((student) => student.id === selectedStudent.id)) {
      setSelectedStudent(filteredStudents[0]);
    }
  }, [filteredStudents, selectedStudent]);

  const handleStudentClick = (student: StudentWithPlan) => {
    setSelectedStudent(student);
    setShowChat(true);
  };

  const handleViewStudent = (student: StudentWithPlan) => {
    setSelectedStudent(student);
    setShowChat(false);
    if (activeTab === 'results') {
      setSelectedForResults(true);
    } else if (activeTab === 'development') {
      setSelectedForDevelopment(true);
    }
  };

  const handleClosePane = () => {
    setSelectedForResults(false);
    setSelectedForDevelopment(false);
  };

  const handlePlanClick = (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    console.log('[DEBUG] handlePlanClick - studentId:', studentId);
    navigate(`/development/${studentId}`);
  };

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  // DevelopmentView is now opened via route /development/:studentId

  return (
    <ClassroomLayout>
      <div className="h-full space-y-2 relative transition-all duration-500 ease-in-out">
        {showChat && selectedStudent ? (
          <div className="relative bg-white rounded-lg shadow p-4">
            <button
              onClick={() => setShowChat(false)}
              className="absolute top-2 left-2 text-sm text-gray-500 hover:text-blue-500"
            >
              ← Back
            </button>
            <StudentChat
              studentId={selectedStudent.id}
              studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
            />
          </div>
        ) : (
          <>

          {(activeTab === 'results' || activeTab === 'development') ? (
            <div className="flex gap-6 transition-all duration-500 ease-in-out">
              <div
                className={`transition-all duration-500 ${
                  (activeTab === 'results' && selectedForResults) || (activeTab === 'development' && selectedForDevelopment)
                    ? 'w-1/2'
                    : 'w-full'
                } bg-white rounded-lg shadow p-2`}
              >
                <div className="bg-white rounded-lg shadow p-4 mb-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by name or email"
                        className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={performanceFilter}
                        onChange={(event) => setPerformanceFilter(event.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-md"
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
                        className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                      >
                        <option value="all">All engagement</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[400px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr>
                        <th className="px-4 py-1.5 border-b text-left">Full Name</th>
                        {activeTab === 'results' ? (
                          <>
                            <th className="px-4 py-1.5 border-b text-left">Attendance</th>
                            <th className="px-4 py-1.5 border-b text-left">Assessments</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-1.5 border-b text-left">Overall</th>
                            <th className="px-4 py-1.5 border-b text-left">Plan</th>
                          </>
                        )}
                        <th className="px-4 py-1.5 border-b text-left">Performance</th>
                      </tr>
                    </thead>
                    {loading ? (
                      <ClassroomStudentsSkeleton columns={4} />
                    ) : (
                      <tbody>
                        {filteredStudents.map((student, index) => (
                          <tr
                            key={student.id}
                            className={`transition-colors duration-300 ${
                              selectedStudent?.id === student.id
                                ? 'bg-blue-300'
                                : index % 2 === 0
                                ? 'bg-white'
                                : 'bg-gray-50'
                            } hover:bg-blue-200 cursor-pointer`}
                            onClick={() => handleViewStudent(student)}
                          >
                            <td className="px-4 py-1.5 border-b text-sm">
                              {student.firstName} {student.lastName}
                            </td>
                            {activeTab === 'results' ? (
                              <>
                                <td className="px-4 py-1.5 border-b text-sm">{student.engagement}</td>
                                <td className="px-4 py-1.5 border-b text-sm">5</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-1.5 border-b text-sm">{student.overall}</td>
                                <td className="px-4 py-1.5 border-b text-sm">
                                  <button
                                    className="text-blue-600 underline hover:text-blue-800"
                                    onClick={(e) => handlePlanClick(e, student.id)}
                                  >
                                    {student.planName || 'View Plan'}
                                  </button>
                                </td>
                              </>
                            )}
                            <td className="px-4 py-1.5 border-b text-sm">{student.performance}</td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
              </div>

              {activeTab === 'results' && selectedForResults && selectedStudent && (
                <div className="w-1/2 bg-white rounded-lg shadow p-4 relative">
                  <button
                    onClick={handleClosePane}
                    className="absolute top-2 right-2 text-sm text-gray-500 hover:text-red-500"
                  >
                    ✕
                  </button>
                  <ResultsView student={selectedStudent} />
                </div>
              )}

              {activeTab === 'development' && selectedForDevelopment && selectedStudent && (
                <div className="w-1/2 bg-white rounded-lg shadow p-4 relative">
                  <button
                    onClick={handleClosePane}
                    className="absolute top-2 right-2 text-sm text-gray-500 hover:text-red-500"
                  >
                    ✕
                  </button>
                  <DevelopmentAttributesView student={selectedStudent} />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-2">
              <div className="bg-white rounded-lg shadow p-4 mb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">Filters</div>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by name or email"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={performanceFilter}
                      onChange={(event) => setPerformanceFilter(event.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
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
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="all">All engagement</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[400px]">
                <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-1.5 border-b text-left">Full Name</th>
                    <th className="px-4 py-1.5 border-b text-left">Overall</th>
                    <th className="px-4 py-1.5 border-b text-left">Strength</th>
                    <th className="px-4 py-1.5 border-b text-left">Performance</th>
                    <th className="px-4 py-1.5 border-b text-left"></th>
                  </tr>
                </thead>
                {loading ? (
                  <ClassroomStudentsSkeleton columns={5} />
                ) : (
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
                        <td className="px-4 py-1.5 border-b text-sm">{student.strength}</td>
                        <td className="px-4 py-1.5 border-b text-sm">{student.performance}</td>
                        <td className="px-4 py-1.5 border-b text-sm">
                          <button
                            className="text-blue-500 hover:text-blue-700"
                            onClick={() => handleStudentClick(student)}
                          >
                            Chat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </ClassroomLayout>
  );
};

export default ClassroomView;
