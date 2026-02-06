import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarWidget from '../calendar/CalendarWidget';
import EventModal from '../calendar/EventModal';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { assessmentService, chatService, developmentService, studentService, subjectService } from '../../services/api';
import { calendarService } from '../../services/calendarService';
import { authService } from '../../services/api';

interface Assessment {
  id: string;
  name: string;
  description: string;
  type: string;
  maxScore: number;
  subjectId: string;
  weight: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface AssessmentResult {
  id: string;
  student: {
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
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overall: number;
  engagement: string;
  strength: string;
  performance: string;
  subjects: string[];
  activePlan: string;
  createdAt: string;
  updatedAt: string;
}

interface DevelopmentPlan {
  id: string;
  student: string;
  plan: {
    id: string;
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
        id: string;
      }[];
      id: string;
    }[];
    steps: {
      title: string;
      type: string;
      order: number;
    }[];
    subjectId: string;
    createdAt: string;
    updatedAt: string;
  };
  subjectId: string;
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
  id: string;
  student: string;
  attribute: {
    id: string;
    name: string;
    description: string;
    category: string;
    subjectId: string;
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

const fetchStudentAttributes = async (studentId: string, subjectId: string): Promise<StudentAttribute[]> => {
  try {
    const payload = await developmentService.getStudentAttributes(studentId, subjectId);
    if (Array.isArray(payload)) {
      return payload as StudentAttribute[];
    }
    if (payload && typeof payload === 'object') {
      return Object.entries(payload).map(([attributeId, attributeData]) => {
        const data = attributeData as any;
        return {
          id: attributeId,
          student: studentId,
          attribute: {
            id: attributeId,
            name: data?.name || attributeId,
            description: data?.description || '',
            category: data?.category || 'Core Concepts',
            subjectId,
            createdAt: data?.createdAt || '',
            updatedAt: data?.updatedAt || ''
          },
          current: Number(data?.currentScore ?? data?.current ?? 0),
          potential: Number(data?.potentialScore ?? data?.potential ?? 0),
          lastAssessed: data?.lastAssessed || '',
          createdAt: data?.createdAt || '',
          updatedAt: data?.updatedAt || ''
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Error fetching student attributes:', error);
    return [];
  }
};

const Dashboard: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const navigate = useNavigate();

  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [latestAssessment, setLatestAssessment] = useState<Assessment | null>(null);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [studentsWithPlans, setStudentsWithPlans] = useState<StudentDevelopment[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedSubject } = useAuth();
  
  // Calendar states
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [staffRoomItems, setStaffRoomItems] = useState<Array<{ id: string; name: string; preview: string; time: string; unread: boolean }>>([]);

  // Load subjects for calendar
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const subjectsData = await subjectService.getSubjects();
        setSubjects(subjectsData);
      } catch (error) {
        console.error('Error loading subjects:', error);
      }
    };
    loadSubjects();
  }, []);

  // Calendar events from API
  useEffect(() => {
    const loadCalendarEvents = async () => {
      try {
        const events = await calendarService.getUpcomingEvents(10);
        const filtered = selectedSubject?.id
          ? events.filter(event => event.subjectId === selectedSubject.id)
          : events;
        const typeColors: Record<string, { color: string; border: string; background: string; text: string }> = {
          lesson: { color: '#3b82f6', background: '#3b82f6', border: '#2563eb', text: '#ffffff' },
          lab: { color: '#10b981', background: '#10b981', border: '#059669', text: '#ffffff' },
          assignment_due: { color: '#ef4444', background: '#ef4444', border: '#dc2626', text: '#ffffff' },
          exam: { color: '#8b5cf6', background: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },
          quiz: { color: '#f59e0b', background: '#f59e0b', border: '#d97706', text: '#ffffff' },
          meeting: { color: '#6b7280', background: '#6b7280', border: '#4b5563', text: '#ffffff' },
          office_hours: { color: '#06b6d4', background: '#06b6d4', border: '#0891b2', text: '#ffffff' },
          workshop: { color: '#6366f1', background: '#6366f1', border: '#4f46e5', text: '#ffffff' },
          seminar: { color: '#ec4899', background: '#ec4899', border: '#db2777', text: '#ffffff' },
          presentation: { color: '#eab308', background: '#eab308', border: '#ca8a04', text: '#000000' },
          project_due: { color: '#dc2626', background: '#dc2626', border: '#b91c1c', text: '#ffffff' },
          holiday: { color: '#059669', background: '#059669', border: '#047857', text: '#ffffff' },
        };

        const normalized = filtered.map(event => {
          const colors = typeColors[event.type];
          return {
            ...event,
            color: event.color || colors?.color,
            backgroundColor: event.backgroundColor || colors?.background,
            borderColor: event.borderColor || colors?.border,
            textColor: event.textColor || colors?.text,
          };
        });

        setCalendarEvents(normalized);
      } catch (error) {
        console.error('Error loading calendar events:', error);
        setCalendarEvents([]);
      }
    };

    loadCalendarEvents();
  }, [selectedSubject]);

  useEffect(() => {
    const loadStaffRoom = async () => {
      try {
        const [threads, subjectStudents] = await Promise.all([
          chatService.getUnreadCounts().catch(() => []),
          selectedSubject?.id ? studentService.getStudents(selectedSubject.id).catch(() => []) : Promise.resolve([])
        ]);

        const allowedIds = selectedSubject?.id
          ? new Set((subjectStudents || []).map(student => student.id))
          : null;

        const filteredThreads = allowedIds
          ? threads.filter(thread => allowedIds.has(thread.studentId))
          : threads;

        const items = (filteredThreads || []).map((thread) => {
          const time = thread.lastMessageTime ? new Date(thread.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return {
            id: thread.studentId,
            name: thread.studentName || 'Student',
            preview: thread.lastMessage || 'No messages yet.',
            time,
            unread: thread.unreadCount > 0,
          };
        });
        setStaffRoomItems(items);
      } catch (error) {
        console.error('Error loading staff room data:', error);
        setStaffRoomItems([]);
      }
    };
    loadStaffRoom();
  }, [selectedSubject]);
  
  const fetchStudentsBySubject = async (subjectId: string): Promise<Student[]> => {
    try {
      return await studentService.getStudents(subjectId);
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    }
  };

  const fetchAssessmentsBySubject = async (subjectId: string): Promise<Assessment[]> => {
    try {
      return await assessmentService.getAssessmentsBySubjectId(subjectId);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      return [];
    }
  };

  const fetchAssessmentResults = async (assessmentId: string): Promise<AssessmentResult[]> => {
    try {
      return await assessmentService.getResults(assessmentId);
    } catch (error) {
      console.error("Error fetching assessment results:", error);
      return [];
    }
  };

  const fetchStudentDevelopmentPlan = async (studentId: string, subjectId: string): Promise<DevelopmentPlan | null> => {
    try {
      return await developmentService.getStudentPlan(studentId, subjectId);
    } catch (error) {
      console.error("Error fetching development plan:", error);
      return null;
    }
  };

  const getStudentAttributes = async (
    studentId: string,
    subjectId: string,
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
      const studentAttributes = await fetchStudentAttributes(studentId, subjectId);
      const existingNames = new Set(attributes.map(attr => attr.name.toLowerCase()));
      const additionalAttributes = (Array.isArray(studentAttributes) ? studentAttributes : [])
        .filter(attr => attr?.attribute?.name && !existingNames.has(attr.attribute.name.toLowerCase()))
        .map(attr => ({
          name: attr.attribute.name,
          value: Number(attr.current) || 0,
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
      const createdEvent = await calendarService.createEvent({
        ...eventData,
        createdBy: currentUser?.id,
      });
      const typeColors: Record<string, { color: string; border: string; background: string; text: string }> = {
        lesson: { color: '#3b82f6', background: '#3b82f6', border: '#2563eb', text: '#ffffff' },
        lab: { color: '#10b981', background: '#10b981', border: '#059669', text: '#ffffff' },
        assignment_due: { color: '#ef4444', background: '#ef4444', border: '#dc2626', text: '#ffffff' },
        exam: { color: '#8b5cf6', background: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },
        quiz: { color: '#f59e0b', background: '#f59e0b', border: '#d97706', text: '#ffffff' },
        meeting: { color: '#6b7280', background: '#6b7280', border: '#4b5563', text: '#ffffff' },
        office_hours: { color: '#06b6d4', background: '#06b6d4', border: '#0891b2', text: '#ffffff' },
        workshop: { color: '#6366f1', background: '#6366f1', border: '#4f46e5', text: '#ffffff' },
        seminar: { color: '#ec4899', background: '#ec4899', border: '#db2777', text: '#ffffff' },
        presentation: { color: '#eab308', background: '#eab308', border: '#ca8a04', text: '#000000' },
        project_due: { color: '#dc2626', background: '#dc2626', border: '#b91c1c', text: '#ffffff' },
        holiday: { color: '#059669', background: '#059669', border: '#047857', text: '#ffffff' },
      };
      const colors = typeColors[createdEvent.type] || typeColors.lesson;
      const normalizedEvent: CalendarEvent = {
        ...createdEvent,
        start: new Date(createdEvent.start),
        end: createdEvent.end ? new Date(createdEvent.end) : undefined,
        color: createdEvent.color || colors.color,
        backgroundColor: createdEvent.backgroundColor || colors.background,
        borderColor: createdEvent.borderColor || colors.border,
        textColor: createdEvent.textColor || colors.text,
      };

      setCalendarEvents(prev => [...prev, normalizedEvent]);
      setShowEventModal(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };
  
  useEffect(() => {
    console.log('Selected subject in Dashboard:', selectedSubject);
  }, [selectedSubject]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSubject || !selectedSubject.id) {
        console.log("No valid subject selected, skipping data fetch.", { selectedSubject });
        setStudentsWithPlans([]);
        setLatestAssessment(null);
        setStudentPerformance([]);
        setLoading(false);
        return;
      }
  
      try {
        setLoading(true);
        console.log(`Fetching data for subject: ${selectedSubject.name} (ID: ${selectedSubject.id})`);
  
        const students = await fetchStudentsBySubject(selectedSubject.id);
        console.log("Students fetched:", students);
  
        const subjectStudents = students.filter(student => 
          student.subjects && student.subjects.includes(selectedSubject.id)
        );
        console.log("Filtered subject students:", subjectStudents);
  
        const assessments = await fetchAssessmentsBySubject(selectedSubject.id);
        console.log("Assessments fetched:", assessments);
  
        if (assessments.length > 0) {
          const sortedAssessments = [...assessments].sort((a, b) =>
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
          );
          const latest = sortedAssessments[0];
          setLatestAssessment(latest);
          console.log("Latest assessment:", latest);
  
          const results = await fetchAssessmentResults(latest.id);
          console.log("Assessment results:", results);
  
          const subjectResults = results.filter(result => 
            subjectStudents.some(student => student.id === result.student.id)
          );
  
          const performance: StudentPerformance[] = subjectResults.map(result => ({
            studentId: result.student.id,
            firstName: result.student.firstName,
            lastName: result.student.lastName,
            score: result.actualMark
          }));
  
          setStudentPerformance(performance);
        } else {
          console.log("No assessments found for the selected subject.");
          setLatestAssessment(null);
          setStudentPerformance([]);
        }
  
        const allStudentsDevelopment: StudentDevelopment[] = [];
  
        for (const student of subjectStudents) {
          let developmentData: StudentDevelopment;
  
          if (student.activePlan) {
            const developmentPlan = await fetchStudentDevelopmentPlan(student.id, selectedSubject.id);
            if (developmentPlan && developmentPlan.status === 'Active') {
              const attributes = await getStudentAttributes(student.id, selectedSubject.id, developmentPlan.plan.skills);
              const sessionsAvailable = Math.ceil(developmentPlan.plan.eta / 3);
  
              developmentData = {
                studentId: student.id,
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
              const attributes = await getStudentAttributes(student.id, selectedSubject.id);
              developmentData = {
                studentId: student.id,
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
            const attributes = await getStudentAttributes(student.id, selectedSubject.id);
            developmentData = {
              studentId: student.id,
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
        console.log("All students development data for subject:", allStudentsDevelopment);
  
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
  }, [selectedSubject]);

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
            onEventClick={() => navigate('/calendar')}
            className="h-full"
          />
        </div>

        {/* Chat + Performance */}
        <div className="flex-1 basis-3/4 flex gap-4 mt-4 overflow-auto">
          {/* Chat */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-4 rounded-lg shadow h-full">
              <h2 className="text-xl font-bold mb-4">CHAT</h2>
              <div className="space-y-4">
                {(staffRoomItems.length > 0 ? staffRoomItems.slice(0, 4) : []).map((student, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(`/staffroom?studentId=${student.id}`)}
                    className="flex items-center pb-2 border-b w-full text-left hover:bg-gray-100 rounded-md px-2 -mx-2"
                  >
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3">
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <div>
                      <p className={`font-medium ${student.unread ? 'font-semibold' : ''}`}>{student.name}</p>
                      <p className="text-xs text-gray-500">{student.preview}</p>
                    </div>
                    <div className="ml-auto text-xs text-gray-500">
                      {student.time}
                    </div>
                  </button>
                ))}
                {staffRoomItems.length === 0 && (
                  <div className="text-sm text-gray-500">No messages yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Student Performance */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-4 rounded-lg shadow h-full flex flex-col">
              <h2 className="text-xl font-bold mb-4">STUDENT PERFORMANCE</h2>
              {loading ? (
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
                        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-10 bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : latestAssessment ? (
                <>
                  <p className="mb-2">{latestAssessment.name}</p>
                  <div className="flex-1 overflow-y-auto max-h-96 pr-2">
                    {studentPerformance.length > 0 ? (
                      studentPerformance.map((student) => (
                        <button
                          key={student.studentId}
                          onClick={() => navigate(`/performance?studentId=${student.studentId}`)}
                          className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 w-full text-left hover:bg-gray-100 rounded-md px-2 -mx-2"
                        >
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
                        </button>
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
                  No assessments found for this subject
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
            onClick={() => currentStudent && navigate(`/development/${currentStudent.studentId}`)}
          >
            <h2 className="text-lg font-bold mb-2">STUDENT DEVELOPMENT</h2>
            {loading ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-6 w-20 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="space-y-1">
                      <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-5 w-6 bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
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
                No students found for this subject
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
        subjects={subjects}
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default Dashboard;
