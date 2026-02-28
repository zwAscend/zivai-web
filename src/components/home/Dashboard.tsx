import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarWidget from '../calendar/CalendarWidget';
import EventModal from '../calendar/EventModal';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { assessmentService, chatService, developmentService, studentService, submissionService } from '../../services/api';
import { calendarService } from '../../services/calendarService';
import { authService } from '../../services/api';
import { teacherService, TeacherAssessmentOverview, TeacherDashboardSummary } from '../../services/teacherService';
import { reportService, ClassReportResponse, CurriculumForecastResponse, TermForecastResponse } from '../../services/reportService';

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

const normalizePlanStatus = (status?: string): string | undefined => {
  if (!status) return undefined;
  const cleaned = status.replace(/_/g, ' ').replace(/-/g, ' ').trim().toLowerCase();
  if (cleaned === 'active') return 'active';
  if (cleaned === 'completed') return 'completed';
  if (cleaned === 'on hold') return 'on hold';
  if (cleaned === 'cancelled') return 'cancelled';
  return undefined;
};

const toEpochMs = (value?: string | Date | null): number => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

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
  const [dashboardSummary, setDashboardSummary] = useState<TeacherDashboardSummary | null>(null);
  const [assessmentOverview, setAssessmentOverview] = useState<TeacherAssessmentOverview[]>([]);
  const [classReport, setClassReport] = useState<ClassReportResponse | null>(null);
  const [curriculumForecast, setCurriculumForecast] = useState<CurriculumForecastResponse | null>(null);
  const [termForecast, setTermForecast] = useState<TermForecastResponse | null>(null);
  const [gradingStats, setGradingStats] = useState<{
    totalSubmissions: number;
    autoGradedCount: number;
    teacherReviewedCount: number;
    averageScore: number;
    averageConfidence: number;
  } | null>(null);

  // Load subjects for calendar
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        if (!currentUser?.id) {
          setSubjects([]);
          return;
        }
        const subjectsData = await teacherService.getMySubjects(currentUser.id);
        setSubjects((subjectsData || []).map((subject) => ({
          id: subject.subjectId,
          name: subject.subjectName,
          code: subject.subjectCode,
        })));
      } catch (error) {
        console.error('Error loading subjects:', error);
        setSubjects([]);
      }
    };
    loadSubjects();
  }, [currentUser?.id]);

  // Calendar events from API
  useEffect(() => {
    const loadCalendarEvents = async () => {
      try {
        const rangeStart = new Date();
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 45);
        const events = await calendarService.getEvents(rangeStart, rangeEnd);
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
    const loadDashboardInsights = async () => {
      if (!currentUser?.id) {
        setDashboardSummary(null);
        setAssessmentOverview([]);
        setClassReport(null);
        setCurriculumForecast(null);
        setTermForecast(null);
        setGradingStats(null);
        return;
      }

      const subjectId = selectedSubject?.id;
      const [dashboardResult, assessmentsResult, classReportResult, curriculumResult, termResult, gradingStatsResult] = await Promise.allSettled([
        teacherService.getDashboard(currentUser.id, subjectId),
        teacherService.getAssessmentsOverview(currentUser.id, { subjectId }),
        reportService.getClassReport(subjectId),
        reportService.getCurriculumForecast(subjectId),
        reportService.getTermForecast(subjectId),
        submissionService.getGradingStats(subjectId),
      ]);

      if (dashboardResult.status === 'fulfilled') {
        setDashboardSummary(dashboardResult.value);
      } else {
        console.error('Error loading teacher dashboard summary:', dashboardResult.reason);
        setDashboardSummary(null);
      }

      if (assessmentsResult.status === 'fulfilled') {
        const sorted = [...(assessmentsResult.value || [])].sort((a, b) => {
          const aTime = Date.parse(a.dueTime || '');
          const bTime = Date.parse(b.dueTime || '');
          return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });
        setAssessmentOverview(sorted);
      } else {
        console.error('Error loading assessment overview:', assessmentsResult.reason);
        setAssessmentOverview([]);
      }

      if (classReportResult.status === 'fulfilled') {
        setClassReport(classReportResult.value);
      } else {
        console.error('Error loading class report:', classReportResult.reason);
        setClassReport(null);
      }

      if (curriculumResult.status === 'fulfilled') {
        setCurriculumForecast(curriculumResult.value);
      } else {
        console.error('Error loading curriculum forecast:', curriculumResult.reason);
        setCurriculumForecast(null);
      }

      if (termResult.status === 'fulfilled') {
        setTermForecast(termResult.value);
      } else {
        console.error('Error loading term forecast:', termResult.reason);
        setTermForecast(null);
      }

      if (gradingStatsResult.status === 'fulfilled') {
        setGradingStats(gradingStatsResult.value);
      } else {
        console.error('Error loading grading stats:', gradingStatsResult.reason);
        setGradingStats(null);
      }
    };

    loadDashboardInsights();
  }, [currentUser?.id, selectedSubject?.id]);

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
  
  const fetchAssessmentResults = async (assessmentId: string): Promise<AssessmentResult[]> => {
    try {
      return (await assessmentService.getResults(assessmentId)) as unknown as AssessmentResult[];
    } catch (error) {
      console.error("Error fetching assessment results:", error);
      return [];
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
  
  const selectedSubjectId = selectedSubject?.id;

  useEffect(() => {
    const loadTeacherPortalData = async () => {
      if (!selectedSubjectId) {
        setStudentsWithPlans([]);
        setLatestAssessment(null);
        setStudentPerformance([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [studentSummaryResponse, rawStudents, planPage, teacherAssessmentRows] = await Promise.all([
          currentUser?.id
            ? teacherService.getStudentsSummary(currentUser.id, {
                subjectId: selectedSubjectId,
                page: 0,
                size: 500,
              }).catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] }),
          studentService.getStudents(selectedSubjectId).catch(() => []),
          developmentService.listStudentPlans({
            subjectId: selectedSubjectId,
            size: 500,
          }).catch(() => ({ items: [] })),
          currentUser?.id
            ? teacherService.getAssessmentsOverview(currentUser.id, { subjectId: selectedSubjectId }).catch(() => [])
            : Promise.resolve([]),
        ]);

        const summaryItems = Array.isArray(studentSummaryResponse?.items) ? studentSummaryResponse.items : [];
        const rawStudentItems = Array.isArray(rawStudents) ? rawStudents : [];
        const subjectStudents = summaryItems.length > 0
          ? summaryItems.map((student) => {
              const matchingRaw = rawStudentItems.find((rawStudent) => rawStudent.id === student.studentId);
              return {
                id: student.studentId,
                firstName: student.firstName,
                lastName: student.lastName,
                email: student.email,
                overall: student.overall ?? matchingRaw?.overall ?? 0,
                performance: student.performance ?? matchingRaw?.performance ?? 'Average',
                engagement: student.engagement ?? matchingRaw?.engagement ?? 'Medium',
                strength: student.strength ?? matchingRaw?.strength ?? 'Tracking',
                subjects: matchingRaw?.subjects ?? [],
              };
            })
          : rawStudentItems;

        const planItems = Array.isArray(planPage?.items) ? planPage.items : [];
        const planByStudent = new Map<string, any>();
        planItems.forEach((plan) => {
          if (!plan?.student) return;
          const existing = planByStudent.get(plan.student);
          if (!existing) {
            planByStudent.set(plan.student, plan);
            return;
          }
          const existingStatus = normalizePlanStatus(existing.status);
          const nextStatus = normalizePlanStatus(plan.status);
          if (existingStatus !== 'active' && nextStatus === 'active') {
            planByStudent.set(plan.student, plan);
            return;
          }
          if (existingStatus === 'active' && nextStatus !== 'active') {
            return;
          }
          const existingTime = toEpochMs(existing.updatedAt) || toEpochMs(existing.createdAt);
          const nextTime = toEpochMs(plan.updatedAt) || toEpochMs(plan.createdAt);
          if (nextTime > existingTime) {
            planByStudent.set(plan.student, plan);
          }
        });

        const assessmentRows = Array.isArray(teacherAssessmentRows) ? teacherAssessmentRows : [];

        if (assessmentRows.length > 0) {
          const latest = [...assessmentRows].sort((a, b) => {
            const aTime = toEpochMs(a.dueTime);
            const bTime = toEpochMs(b.dueTime);
            return bTime - aTime;
          })[0];
          setLatestAssessment({
            id: latest.assessmentId,
            name: latest.assessmentName,
            description: '',
            type: latest.assessmentType || 'assessment',
            maxScore: 100,
            subjectId: latest.subjectId,
            weight: 0,
            dueDate: latest.dueTime || '',
            createdAt: '',
            updatedAt: '',
          });

          const results = await fetchAssessmentResults(latest.assessmentId);
          const subjectStudentIds = new Set(subjectStudents.map((student) => student.id));
          const performance: StudentPerformance[] = results
            .filter((result) => subjectStudentIds.has(result.student.id))
            .map((result) => ({
              studentId: result.student.id,
              firstName: result.student.firstName,
              lastName: result.student.lastName,
              score: result.actualMark,
            }))
            .sort((a, b) => b.score - a.score);

          setStudentPerformance(performance);
        } else {
          setLatestAssessment(null);
          setStudentPerformance([]);
        }

        const allStudentsDevelopment: StudentDevelopment[] = [];

        for (const student of subjectStudents) {
          const developmentPlan = planByStudent.get(student.id) || null;
          const isActivePlan = normalizePlanStatus(developmentPlan?.status) === 'active';
          const attributes = await getStudentAttributes(student.id, selectedSubjectId, developmentPlan?.plan?.skills || []);

          const developmentData: StudentDevelopment = {
            studentId: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            overall: student.overall,
            potentialOverall: isActivePlan ? Number(developmentPlan?.plan?.potentialOverall ?? student.overall) : student.overall,
            eta: isActivePlan ? Number(developmentPlan?.plan?.eta ?? 0) : 'No Plan',
            sessions: isActivePlan ? Math.ceil(Number(developmentPlan?.plan?.eta ?? 0) / 3) : 0,
            attributes,
            hasActivePlan: isActivePlan,
          };

          allStudentsDevelopment.push(developmentData);
        }

        setStudentsWithPlans(allStudentsDevelopment);
      } catch (error) {
        console.error('Error fetching data:', error);
        setStudentsWithPlans([]);
        setLatestAssessment(null);
        setStudentPerformance([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeacherPortalData();
  }, [currentUser?.id, selectedSubjectId]);

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
  const latestAssessmentOverview = assessmentOverview[0] || null;
  const subjectLabel = selectedSubject?.name || classReport?.subjectName || curriculumForecast?.subjectName || 'Selected subject';
  const latestAssessmentAverage = latestAssessmentOverview?.averageScore ?? gradingStats?.averageScore ?? dashboardSummary?.averageScore ?? 0;
  const latestAssessmentPassRate = latestAssessmentOverview?.passRate ?? 0;
  const curriculumRiskCount = classReport?.masteryGaps?.length ?? 0;
  const curriculumTopicCount = curriculumForecast?.topics?.length ?? 0;
  const expectedCoveragePercent = termForecast?.expectedCoveragePercent ?? 0;

  return (
    <div className="h-full overflow-hidden">
      <div className="grid min-h-0 grid-cols-1 gap-3 p-0 relative md:h-[72vh] md:grid-cols-2 lg:h-[74vh]">
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
        <div className="mt-3 flex flex-1 basis-3/4 gap-3 min-h-0">
          {/* Chat */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-3 rounded-lg shadow h-full">
              <h2 className="text-lg font-bold mb-3">CHAT</h2>
              <div className="space-y-2.5">
                {(staffRoomItems.length > 0 ? staffRoomItems.slice(0, 4) : []).map((student, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(`/staffroom?studentId=${student.id}`)}
                    className="flex items-center pb-1.5 border-b w-full text-left hover:bg-gray-100 rounded-md px-2 -mx-2"
                  >
                    <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center mr-3">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="bg-gray-50 p-3 rounded-lg shadow h-full flex flex-col">
              <h2 className="text-lg font-bold mb-3">STUDENT PERFORMANCE</h2>
              {loading ? (
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between py-1.5 border-b border-gray-100">
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
                  <p className="mb-2 text-sm">{latestAssessment.name}</p>
                  <div className="flex-1 pr-1">
                    {studentPerformance.length > 0 ? (
                      studentPerformance.slice(0, 5).map((student) => (
                        <button
                          key={student.studentId}
                          onClick={() => navigate(`/performance?studentId=${student.studentId}`)}
                          className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 w-full text-left hover:bg-gray-100 rounded-md px-2 -mx-2"
                        >
                          <div className="flex items-center min-w-0">
                            <div className="w-7 h-7 bg-black rounded-full flex-shrink-0 flex items-center justify-center mr-3">
                              <svg viewBox="0 0 24 24" width="14" height="14" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
                        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                        <div className="font-medium text-slate-800">Latest assessment is live</div>
                        <div className="mt-1 text-xs text-slate-500">{latestAssessment.name}</div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>Scored submissions</span>
                          <span className="font-semibold text-slate-800">0</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Current average</span>
                          <span className="font-semibold text-slate-800">{Math.round(latestAssessmentAverage)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid w-full gap-2.5">
                  <div className="rounded-lg bg-white p-3.5">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Tracked assessments</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{assessmentOverview.length}</div>
                  </div>
                  <div className="rounded-lg bg-white p-3.5">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Average score</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{Math.round(latestAssessmentAverage)}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN RIGHT */}
      <div className="flex flex-col h-full">
        {/* Student Development */}
        <div className="flex-1 basis-[50%]">
          <div 
            className="bg-gray-50 p-2.5 rounded-lg shadow h-full cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => currentStudent && navigate(`/development/${currentStudent.studentId}`)}
          >
            <h2 className="text-base font-bold mb-2">STUDENT DEVELOPMENT</h2>
            {loading ? (
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
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
              <div className="grid gap-3">
                <div className="rounded-lg bg-white p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Tracked learners</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">0</div>
                </div>
                <div className="rounded-lg bg-white p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Active plans</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">0</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Class Resources + Grading Center */}
          <div className="mt-3 flex flex-1 basis-1/2 gap-3 min-h-0">
          <div 
            className="w-1/2 cursor-pointer rounded-lg transition-colors hover:bg-gray-100" 
            onClick={() => navigate('/assessments/create')}
          >
            <div className="flex h-full min-h-[220px] flex-col rounded-lg bg-gray-50 p-3 shadow">
              <h2 className="text-lg font-bold mb-4">ASSESSMENTS</h2>
              <div className="flex h-full flex-col justify-between text-gray-700">
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">{subjectLabel}</div>
                  <div className="text-3xl font-bold text-gray-900">{assessmentOverview.length}</div>
                  <div className="text-sm text-gray-500">tracked assessments</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
                  <div className="rounded-lg bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Average</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{Math.round(latestAssessmentAverage)}%</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Pass rate</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{Math.round(latestAssessmentPassRate)}%</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {latestAssessmentOverview ? `Latest: ${latestAssessmentOverview.assessmentName}` : `${subjectLabel} assessment workspace`}
                </div>
              </div>
            </div>
          </div>

          <div className="w-1/2 cursor-pointer rounded-lg transition-colors hover:bg-gray-100" onClick={() => navigate('/reports')}>
            <div className="flex h-full min-h-[220px] flex-col rounded-lg bg-gray-50 p-3 shadow">
              <h2 className="text-lg font-bold mb-4">REPORTS</h2>
              <div className="flex h-full flex-col justify-between text-gray-700">
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">{subjectLabel}</div>
                  <div className="text-3xl font-bold text-gray-900">{Math.round(classReport?.classAveragePercent ?? 0)}%</div>
                  <div className="text-sm text-gray-500">class average</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
                  <div className="rounded-lg bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Forecast</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{Math.round(expectedCoveragePercent)}%</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Risk gaps</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{curriculumRiskCount}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {curriculumTopicCount > 0 ? `${curriculumTopicCount} curriculum topics tracked` : `${subjectLabel} report stream`}
                </div>
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
    </div>
  );
};

export default Dashboard;
