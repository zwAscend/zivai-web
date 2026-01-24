import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { upcomingActivities, students as mockStudents } from '../../data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarWidget from '../calendar/CalendarWidget';
import EventModal from '../calendar/EventModal';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { courseService } from '../../services/api';

interface Assessment {
  _id: string;
  name: string;
  description: string;
  type: string;
  maxScore: number;
  courseId: string;
  weight: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface AssessmentResult {
  _id: string;
  student: {
    _id: string;
    id: string;
    firstName: string;
    lastName: string;
  };
  assessment: string;
  expectedMark: number;
  actualMark: number;
  grade: string;
  feedback: string;
  submittedDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Student {
  _id: string;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overall: number;
  engagement: string;
  strength: string;
  performance: string;
  courses: string[];
  activePlan: string;
  createdAt: string;
  updatedAt: string;
}

interface DevelopmentPlan {
  _id: string;
  student: string;
  plan: {
    _id: string;
    name: string;
    description: string;
    progress: number;
    potentialOverall: number;
    eta: number;
    performance: string;
    skills: {
      name: string;
      score: number;
      subskills: {
        name: string;
        score: number;
        color: string;
        _id: string;
      }[];
      _id: string;
    }[];
    steps: {
      title: string;
      type: string;
      order: number;
    }[];
    courseId: string;
    createdAt: string;
    updatedAt: string;
  };
  courseId: string;
  currentProgress: number;
  status: string;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

interface StudentPerformance {
  studentId: string;
  firstName: string;
  lastName: string;
  score: number;
}

interface StudentAttribute {
  _id: string;
  student: string;
  attribute: {
    _id: string;
    name: string;
    description: string;
    category: string;
    courseId: string;
    createdAt: string;
    updatedAt: string;
  };
  current: number;
  potential: number;
  lastAssessed: string;
  createdAt: string;
  updatedAt: string;
}

interface StudentDevelopment {
  studentId: string;
  firstName: string;
  lastName: string;
  overall: number;
  potentialOverall: number;
  eta: number | string;
  sessions: number;
  attributes: {
    name: string;
    value: number;
  }[];
  hasActivePlan: boolean;
}

const fetchStudentAttributes = async (studentId: string, courseId: string): Promise<StudentAttribute[]> => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `http://localhost:5000/api/development/attributes/student/${studentId}/course/${courseId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching student attributes:', error);
    return [];
  }
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [latestAssessment, setLatestAssessment] = useState<Assessment | null>(null);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [studentsWithPlans, setStudentsWithPlans] = useState<StudentDevelopment[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedCourse } = useAuth();
  
  // Calendar states
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const baseUrl = 'http://localhost:5000';

  // Load courses for calendar
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const coursesData = await courseService.getCourses();
        setCourses(coursesData);
      } catch (error) {
        console.error('Error loading courses:', error);
      }
    };
    loadCourses();
  }, []);

  // Mock calendar events
  useEffect(() => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Network Security Lecture',
        description: 'OSPF Routing Protocols',
        start: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end: new Date(Date.now() + 3.5 * 60 * 60 * 1000),
        type: 'lecture',
        courseId: selectedCourse?.id || 'course1',
        courseName: selectedCourse?.name || 'Network Security',
        location: 'Room 101',
        color: '#3b82f6',
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        textColor: '#ffffff',
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        title: 'Assignment Due',
        description: 'Network Configuration Lab',
        start: new Date(Date.now() + 24 * 60 * 60 * 1000),
        type: 'assignment_due',
        courseId: selectedCourse?.id || 'course1',
        courseName: selectedCourse?.name || 'Network Security',
        allDay: true,
        color: '#ef4444',
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        textColor: '#ffffff',
        createdBy: 'teacher1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];
    setCalendarEvents(mockEvents);
  }, [selectedCourse]);
  
  const fetchStudentsByCourse = async (courseId: string): Promise<Student[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${baseUrl}/api/students?courseId=${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    }
  };

  const fetchAssessmentsByCourse = async (courseId: string): Promise<Assessment[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${baseUrl}/api/assessments?courseId=${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching assessments:", error);
      return [];
    }
  };

  const fetchAssessmentResults = async (assessmentId: string): Promise<AssessmentResult[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${baseUrl}/api/assessments/${assessmentId}/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching assessment results:", error);
      return [];
    }
  };

  const fetchStudentDevelopmentPlan = async (studentId: string, courseId: string): Promise<DevelopmentPlan | null> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${baseUrl}/api/development/plans/student/${studentId}/course/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching development plan:", error);
      return null;
    }
  };

  const getStudentAttributes = async (
    studentId: string,
    courseId: string,
    planSkills: any[] = []
  ): Promise<{ name: string; value: number }[]> => {
    let attributes: { name: string; value: number }[] = [];

    if (planSkills.length > 0) {
      attributes = planSkills.flatMap(skill =>
        skill.subskills.map((subskill: any) => ({
          name: subskill.name,
          value: subskill.score,
        }))
      );
    }

    if (attributes.length < 6) {
      const studentAttributes = await fetchStudentAttributes(studentId, courseId);
      const existingNames = new Set(attributes.map(attr => attr.name.toLowerCase()));
      const additionalAttributes = studentAttributes
        .filter(attr => !existingNames.has(attr.attribute.name.toLowerCase()))
        .map(attr => ({
          name: attr.attribute.name,
          value: attr.current,
        }))
        .sort((a, b) => a.value - b.value)
        .slice(0, 6 - attributes.length);
      attributes = [...attributes, ...additionalAttributes];
    }

    return attributes.slice(0, 6);
  };

  // Calendar event handlers
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowEventModal(true);
  };

  const handleCreateEvent = async (eventData: EventFormData) => {
    try {
      const newEvent: CalendarEvent = {
        id: `temp-${Date.now()}`,
        title: eventData.title,
        description: eventData.description,
        start: new Date(eventData.start),
        end: eventData.end ? new Date(eventData.end) : undefined,
        allDay: eventData.allDay,
        type: eventData.type,
        courseId: eventData.courseId || undefined,
        courseName: eventData.courseId ? courses.find(c => c._id === eventData.courseId)?.name : undefined,
        location: eventData.location,
        color: '#3b82f6',
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        textColor: '#ffffff',
        createdBy: 'current-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setCalendarEvents(prev => [...prev, newEvent]);
      setShowEventModal(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };
  
  useEffect(() => {
    console.log('Selected course in Dashboard:', selectedCourse);
  }, [selectedCourse]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedCourse || !selectedCourse.id) {
        console.log("No valid course selected, skipping data fetch.", { selectedCourse });
        setStudentsWithPlans([]);
        setLatestAssessment(null);
        setStudentPerformance([]);
        setLoading(false);
        return;
      }
  
      try {
        setLoading(true);
        console.log(`Fetching data for course: ${selectedCourse.name} (ID: ${selectedCourse.id})`);
  
        const students = await fetchStudentsByCourse(selectedCourse.id);
        console.log("Students fetched:", students);
  
        const courseStudents = students.filter(student => 
          student.courses && student.courses.includes(selectedCourse.id)
        );
        console.log("Filtered course students:", courseStudents);
  
        const assessments = await fetchAssessmentsByCourse(selectedCourse.id);
        console.log("Assessments fetched:", assessments);
  
        if (assessments.length > 0) {
          const sortedAssessments = [...assessments].sort((a, b) =>
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
          );
          const latest = sortedAssessments[0];
          setLatestAssessment(latest);
          console.log("Latest assessment:", latest);
  
          const results = await fetchAssessmentResults(latest._id);
          console.log("Assessment results:", results);
  
          const courseResults = results.filter(result => 
            courseStudents.some(student => student._id === result.student._id)
          );
  
          const performance: StudentPerformance[] = courseResults.map(result => ({
            studentId: result.student._id,
            firstName: result.student.firstName,
            lastName: result.student.lastName,
            score: result.actualMark
          }));
  
          setStudentPerformance(performance);
        } else {
          console.log("No assessments found for the selected course.");
          setLatestAssessment(null);
          setStudentPerformance([]);
        }
  
        const allStudentsDevelopment: StudentDevelopment[] = [];
  
        for (const student of courseStudents) {
          let developmentData: StudentDevelopment;
  
          if (student.activePlan) {
            const developmentPlan = await fetchStudentDevelopmentPlan(student._id, selectedCourse.id);
            if (developmentPlan && developmentPlan.status === 'Active') {
              const attributes = await getStudentAttributes(student._id, selectedCourse.id, developmentPlan.plan.skills);
              const sessionsAvailable = Math.ceil(developmentPlan.plan.eta / 3);
  
              developmentData = {
                studentId: student._id,
                firstName: student.firstName,
                lastName: student.lastName,
                overall: student.overall,
                potentialOverall: developmentPlan.plan.potentialOverall,
                eta: developmentPlan.plan.eta,
                sessions: sessionsAvailable,
                attributes: attributes,
                hasActivePlan: true
              };
            } else {
              const attributes = await getStudentAttributes(student._id, selectedCourse.id);
              developmentData = {
                studentId: student._id,
                firstName: student.firstName,
                lastName: student.lastName,
                overall: student.overall,
                potentialOverall: student.overall,
                eta: "No Plan",
                sessions: 0,
                attributes: attributes,
                hasActivePlan: false
              };
            }
          } else {
            const attributes = await getStudentAttributes(student._id, selectedCourse.id);
            developmentData = {
              studentId: student._id,
              firstName: student.firstName,
              lastName: student.lastName,
              overall: student.overall,
              potentialOverall: student.overall,
              eta: "No Plan",
              sessions: 0,
              attributes: attributes,
              hasActivePlan: false
            };
          }
  
          allStudentsDevelopment.push(developmentData);
        }
  
        setStudentsWithPlans(allStudentsDevelopment);
        console.log("All students development data for course:", allStudentsDevelopment);
  
      } catch (error) {
        console.error('Error fetching data:', error);
        setStudentsWithPlans([]);
        setLatestAssessment(null);
        setStudentPerformance([]);
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, [selectedCourse]);

  useEffect(() => {
    if (studentsWithPlans.length > 0) {
      const timer = setInterval(() => {
        setCurrentStudentIndex((prevIndex) => (prevIndex + 1) % studentsWithPlans.length);
      }, 7000);

      return () => clearInterval(timer);
    }
  }, [studentsWithPlans]);

  const currentStudent = studentsWithPlans[currentStudentIndex];
  const studentScore = currentStudent?.overall ?? 75;
  const potentialScore = currentStudent?.potentialOverall ?? 90;
  const daysRemaining = currentStudent?.eta ?? 10;
  const sessionsAvailable = currentStudent?.sessions ?? 0;
  const studentAttributes = currentStudent?.attributes ?? [];
  const hasActivePlan = currentStudent?.hasActivePlan ?? false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[72vh] p-0 relative">
      {/* MAIN LEFT */}
      <div className="flex flex-col h-full">
        {/* Calendar */}
        <div className="flex-1 basis-1/4">
          <CalendarWidget
            events={calendarEvents}
            onDateSelect={handleDateSelect}
            onCreateEvent={handleDateSelect}
            className="h-full"
          />
        </div>

        {/* Staff Room + Performance */}
        <div className="flex-1 basis-3/4 flex gap-4 mt-4 overflow-auto">
          {/* Staff Room */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-4 rounded-lg shadow h-full">
              <h2 className="text-xl font-bold mb-4">STAFF ROOM</h2>
              <div className="space-y-4">
                {mockStudents.slice(0, 4).map((student, index) => (
                  <div key={index} className="flex items-center pb-2 border-b">
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3">
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-gray-500">Good day sir, I can't see my...</p>
                    </div>
                    <div className="ml-auto text-xs text-gray-500">
                      {['10:25', '09:55', '08:17', '07:48'][index]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Student Performance */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-4 rounded-lg shadow h-full flex flex-col">
              <h2 className="text-xl font-bold mb-4">STUDENT PERFORMANCE</h2>
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <p>Loading assessment data...</p>
                </div>
              ) : latestAssessment ? (
                <>
                  <p className="mb-2">{latestAssessment.name}</p>
                  <div className="flex-1 overflow-y-auto max-h-96 pr-2">
                    {studentPerformance.length > 0 ? (
                      studentPerformance.map((student) => (
                        <div key={student.studentId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex items-center min-w-0">
                            <div className="w-8 h-8 bg-black rounded-full flex-shrink-0 flex items-center justify-center mr-3">
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                            </div>
                            <p className="font-medium truncate">
                              {student.firstName} {student.lastName}
                            </p>
                          </div>
                          <div className="font-bold ml-2 whitespace-nowrap">
                            {student.score}%
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No submission data available
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  No assessments found for this course
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN RIGHT */}
      <div className="flex flex-col h-full">
        {/* Student Development */}
        <div className="flex-1 basis-[50%] overflow-auto">
          <div 
            className="bg-gray-50 p-3 rounded-lg shadow h-full cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => currentStudent && navigate(`/classroom/development/${currentStudent.studentId}`)}
          >
            <h2 className="text-lg font-bold mb-2">STUDENT DEVELOPMENT</h2>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm">Loading development data...</p>
              </div>
            ) : studentsWithPlans.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStudent?.studentId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex items-start mb-2">
                    <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-base font-semibold">{currentStudent?.firstName}</h3>
                      <p className="text-sm">{currentStudent?.lastName}</p>
                      <div className="flex mt-2 items-center">
                        <span className="text-3xl font-bold mr-2">{studentScore}</span>
                        <span className="text-sm">OVR</span>
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs mb-1">Days Remaining: <span className="font-bold">{daysRemaining}</span></p>
                      {hasActivePlan && (
                        <p className="text-xs">Sessions Available: <span className="font-bold">{sessionsAvailable}</span></p>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    {(() => {
                      let safeStudentScore = studentScore;
                      if (studentScore > potentialScore) {
                        safeStudentScore = studentScore - 10;
                      }

                      const progressPercentage =
                        potentialScore > 0
                          ? Math.min((safeStudentScore / potentialScore) * 100, 100)
                          : 0;

                      return (
                        <>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{studentScore}</span>
                            <span>{potentialScore}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3 overflow-hidden">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                        </>
                      );
                    })()}
                    <div className="grid grid-cols-6 gap-1 text-center">
                      {studentAttributes.slice(0, 6).map((attribute, index) => (
                        <div key={index} className="text-[10px]">
                          <p className="mb-0.5 truncate" title={attribute.name}>{attribute.name}</p>
                          <p className="text-base font-bold">{attribute.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                No students found for this course
              </div>
            )}
          </div>
        </div>

        {/* Class Resources + Grading Center */}
        <div className="flex-1 basis-1/2 flex gap-4 mt-4 overflow-auto">
          <div 
            className="w-1/2 cursor-pointer hover:bg-gray-100 transition-colors rounded-lg" 
            onClick={() => navigate('/resources')}
          >
            <div className="bg-gray-50 p-4 rounded-lg shadow h-full">
              <h2 className="text-xl font-bold mb-6">CLASS RESOURCES</h2>
              <div className="flex justify-center text-center text-gray-600">
                <p>Create Assignments and<br />Upload Reading Material</p>
              </div>
            </div>
          </div>

          <div className="w-1/2 cursor-pointer hover:bg-gray-100 transition-colors rounded-lg" onClick={() => navigate('/grading')}>
            <div className="bg-gray-50 p-4 rounded-lg shadow h-full">
              <h2 className="text-xl font-bold mb-6">GRADING CENTER</h2>
              <div className="flex justify-center text-center text-gray-600">
                <p>Review Auto-Graded<br />Assignments</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedDate(null);
        }}
        onSave={handleCreateEvent}
        courses={courses}
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default Dashboard;