import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  BarChart2,
  FileText,
  User,
  CheckCircle2,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Flame,
  Settings,
  Menu,
  X,
  Bell,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { Student, DevelopmentPlan, Subject } from '../../types';
import { studentService, developmentService, subjectService, calendarService, notificationService, authService } from '../../services/api';
import { StudentActivityFeedItem, StudentTeacher } from '../../services/studentService';
import StudentPlanView from './StudentPlanView';
import StudentAssignments from './StudentAssignments';
import StudentReportCard from './StudentReportCard';
import StudentPeerStudy from './StudentPeerStudy';
import StudentProfileSettings from './StudentProfileSettings';
import StudentSubjectsView from './StudentSubjectsView';
import { HomePanelKey, HomeProgressRow, NavItemKey } from './dashboard/types';
import { getStepIcon } from './dashboard/icons';
import {
  filterHomeProgressRows,
  formatProgressDate,
  getProgressExerciseMinutes,
  getProgressTotalLearningMinutes,
  mapActivityFeedToProgressRows,
} from './dashboard/progress';
import HomeTeachersPanel from './dashboard/HomeTeachersPanel';
import { reportService, StudentReportCardResponse } from '../../services/reportService';
import { NotificationItem } from '../../services/notificationService';
import { CalendarEvent } from '../../types/calendar';
import { MasterySignalsSummary, StudentStreakSummary } from '../../services/developmentService';
import { getActiveAuthToken } from '../../services/authSession';

type StudentRouteViewKey = Exclude<NavItemKey, 'messages'>;

const STUDENT_VIEW_PATHS: Record<StudentRouteViewKey, string> = {
  overview: '/student/home',
  plan: '/student/my-plans',
  subjects: '/student/my-subjects',
  assessments: '/student/assessments',
  results: '/student/my-report',
  tutor: '/student/ai-coach',
  'peer-study': '/student/peer-study',
  profile: '/student/profile',
};

const STUDENT_PATH_VIEW_LOOKUP = Object.entries(STUDENT_VIEW_PATHS).reduce<Record<string, StudentRouteViewKey>>(
  (accumulator, [view, path]) => {
    accumulator[path] = view as StudentRouteViewKey;
    return accumulator;
  },
  {}
);

const normalizeStudentPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

const getRouteViewFromPathname = (pathname: string): StudentRouteViewKey | null =>
  STUDENT_PATH_VIEW_LOOKUP[normalizeStudentPath(pathname)] ?? null;

const isRoutableStudentView = (view: NavItemKey): view is StudentRouteViewKey =>
  Object.prototype.hasOwnProperty.call(STUDENT_VIEW_PATHS, view);

const getDeadlineEventCategory = (event?: CalendarEvent | null) => {
  if (!event) return 'Deadline';
  const eventType = String(event.type || '').toLowerCase();
  if (eventType === 'assignment_due' || eventType === 'project_due') return 'Work';
  if (eventType === 'exam' || eventType === 'quiz' || eventType === 'presentation') return 'Assessment';
  return 'Activity';
};

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-slate-100">
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="h-8 w-44 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-10 w-48 rounded-md bg-slate-200 animate-pulse" />
      </div>
      <div className="border-t border-slate-200 bg-slate-50/70">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-8 w-24 rounded-md bg-slate-200 animate-pulse shrink-0" />
            ))}
          </div>
          <div className="h-9 w-52 rounded-lg bg-slate-200 animate-pulse hidden md:block" />
        </div>
      </div>
    </header>

    <main className="w-full bg-white py-6">
      <div className="max-w-[1400px] mx-auto px-4 space-y-4">
        <section className="w-full border-y border-orange-100 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="h-6 w-72 rounded-md bg-orange-100 animate-pulse" />
              <div className="h-10 w-72 rounded-md bg-orange-100 animate-pulse" />
            </div>
          </div>
        </section>

        <section className="bg-white overflow-hidden border border-slate-200 rounded-xl">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] min-h-[640px]">
            <aside className="hidden lg:block border-r border-slate-200 p-5 space-y-4">
              <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
              <div className="h-10 w-full rounded-md bg-slate-200 animate-pulse" />
              <div className="h-3 w-24 rounded bg-slate-200 animate-pulse mt-6" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-9 w-full rounded-md bg-slate-200 animate-pulse" />
                ))}
              </div>
            </aside>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 xl:gap-x-10 gap-y-8 xl:gap-y-10">
                {Array.from({ length: 2 }).map((_, cardIndex) => (
                  <article key={cardIndex} className="space-y-4">
                    <div className="h-7 w-44 rounded-md bg-slate-200 animate-pulse" />
                    <div className="border-t border-slate-200 pt-4 space-y-4">
                      {Array.from({ length: 4 }).map((__, rowIndex) => (
                        <div key={rowIndex} className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                            <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
                              <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                            </div>
                          </div>
                          {rowIndex === 1 && <div className="h-8 w-20 rounded-md bg-slate-200 animate-pulse shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
);

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRouteView = getRouteViewFromPathname(location.pathname) || 'overview';

  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectPlans, setSubjectPlans] = useState<DevelopmentPlan[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [homePanel, setHomePanel] = useState<HomePanelKey>('subjects');
  const [homeProgressPage, setHomeProgressPage] = useState(1);
  const [progressWindow, setProgressWindow] = useState<'week' | 'month' | 'all'>('week');
  const [progressContentFilter, setProgressContentFilter] = useState<string>('all');
  const [progressActivityFilter, setProgressActivityFilter] = useState<'all' | 'learn' | 'practice'>('all');
  const [activePlan, setActivePlan] = useState<DevelopmentPlan | null>(null);
  const [teachers, setTeachers] = useState<StudentTeacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [studentReportCard, setStudentReportCard] = useState<StudentReportCardResponse | null>(null);
  const [homeNotifications, setHomeNotifications] = useState<NotificationItem[]>([]);
  const [homeUnreadNotificationCount, setHomeUnreadNotificationCount] = useState(0);
  const [homeUpcomingEvents, setHomeUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [homeSubjectEvents, setHomeSubjectEvents] = useState<CalendarEvent[]>([]);
  const [homeActivityFeed, setHomeActivityFeed] = useState<StudentActivityFeedItem[]>([]);
  const [homeMasterySignals, setHomeMasterySignals] = useState<MasterySignalsSummary | null>(null);
  const [homeLiveLoading, setHomeLiveLoading] = useState(false);
  const [homeLiveError, setHomeLiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavItemKey>(initialRouteView);
  const [isResultsSidebarCollapsed, setIsResultsSidebarCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [loadingTargetView, setLoadingTargetView] = useState<NavItemKey>(initialRouteView);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [planEntryStepIndex, setPlanEntryStepIndex] = useState<number | null>(null);
  const [homeMasterySubjectIndex, setHomeMasterySubjectIndex] = useState(0);
  const [homeDeadlineEventIndex, setHomeDeadlineEventIndex] = useState(0);
  const [homeStreakSummary, setHomeStreakSummary] = useState<StudentStreakSummary | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const viewSwitchTimerRef = useRef<number | null>(null);
  const hasInitializedDefaultSubjectRef = useRef(false);

  const avatarGradients = [
    'from-indigo-500 to-sky-500',
    'from-rose-500 to-amber-500',
    'from-emerald-500 to-teal-500',
    'from-purple-500 to-pink-500',
    'from-blue-600 to-cyan-500',
    'from-orange-500 to-yellow-400',
  ];

  const avatarInitials = useMemo(() => {
    if (!student) return 'S';
    const first = student.firstName?.[0] || '';
    const last = student.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'S';
  }, [student]);

  const avatarGradient = useMemo(() => {
    if (!student) return avatarGradients[0];
    const seed = `${student.id || ''}${student.firstName || ''}${student.lastName || ''}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
    }
    return avatarGradients[hash % avatarGradients.length];
  }, [student]);

  const notificationRecipientId = useMemo(() => {
    const currentUser = authService.getCurrentUser() as any;
    const candidate = currentUser?.id;
    return candidate ? String(candidate) : undefined;
  }, []);

  const realPlanBySubjectId = useMemo(() => {
    const planMap = new Map<string, DevelopmentPlan>();
    subjectPlans.forEach((planItem) => {
      const subjectId = planItem.plan?.subjectId;
      if (!subjectId) return;
      const current = planMap.get(subjectId);
      if (!current) {
        planMap.set(subjectId, planItem);
        return;
      }
      const currentTimestamp = new Date(current.updatedAt || current.startDate || 0).getTime();
      const nextTimestamp = new Date(planItem.updatedAt || planItem.startDate || 0).getTime();
      if (nextTimestamp >= currentTimestamp) {
        planMap.set(subjectId, planItem);
      }
    });
    return planMap;
  }, [subjectPlans]);

  const displaySubjects = useMemo(() => subjects, [subjects]);

  const defaultSubjectId = useMemo(() => {
    if (displaySubjects.length === 0) return 'all';

    const mathSubject = displaySubjects.find((subject) => {
      const name = String(subject.name || '').toLowerCase();
      const code = String(subject.code || '').toLowerCase();
      return (
        name.includes('mathematics') ||
        name === 'math' ||
        name.includes('math') ||
        code === 'math' ||
        code.startsWith('math')
      );
    });

    return mathSubject?.id || displaySubjects[0]?.id || 'all';
  }, [displaySubjects]);

  const displayPlanBySubjectId = useMemo<Map<string, DevelopmentPlan | null>>(() => {
    const merged = new Map<string, DevelopmentPlan | null>();
    displaySubjects.forEach((subject) => {
      merged.set(subject.id, realPlanBySubjectId.get(subject.id) || null);
    });
    return merged;
  }, [displaySubjects, realPlanBySubjectId]);

  const overviewSubjects = useMemo(
    () =>
      displaySubjects.map((subject) => ({
        subject,
        plan: displayPlanBySubjectId.get(subject.id) || null,
      })),
    [displaySubjects, displayPlanBySubjectId]
  );

  const subjectNameById = useMemo(
    () => new Map(displaySubjects.map((subject) => [subject.id, subject.name])),
    [displaySubjects]
  );

  const getGradeFromPercent = (percent: number) => {
    if (percent >= 80) return 'A';
    if (percent >= 70) return 'B';
    if (percent >= 60) return 'C';
    if (percent >= 50) return 'D';
    return 'E';
  };

  const reportCardRows = useMemo(
    () => {
      const subjectById = new Map(displaySubjects.map((subject) => [subject.id, subject]));
      return (studentReportCard?.subjects || []).map((row) => {
        const subjectMeta = subjectById.get(row.subjectId);
        const masteryPercent = Math.max(0, Math.min(100, Math.round(row.masteryPercent || 0)));
        const currentGrade = String(row.currentGrade || '').trim();
        const predictedGrade = String(row.predictedZimsecGrade || '').trim();

        return {
          subjectId: row.subjectId,
          subjectCode: String(row.subjectCode || subjectMeta?.code || '-'),
          subjectName: String(row.subjectName || subjectMeta?.name || 'Subject'),
          masteryPercent,
          currentGrade: currentGrade || getGradeFromPercent(masteryPercent),
          predictedZimsecGrade: predictedGrade || currentGrade || getGradeFromPercent(masteryPercent),
        };
      });
    },
    [displaySubjects, studentReportCard]
  );

  const homeMasteryBySubject = useMemo(
    () =>
      reportCardRows
        .map((row) => ({
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          masteryPercent: Number.isFinite(row.masteryPercent) ? row.masteryPercent : 0,
          currentGrade: row.currentGrade,
        }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    [reportCardRows]
  );

  const activeHomeMasterySubject =
    homeMasteryBySubject.length > 0 ? homeMasteryBySubject[homeMasterySubjectIndex % homeMasteryBySubject.length] : null;

  const homeProgressRows = useMemo<HomeProgressRow[]>(
    () => mapActivityFeedToProgressRows(homeActivityFeed, subjectNameById),
    [homeActivityFeed, subjectNameById]
  );

  const streakWeeks = homeStreakSummary?.streakWeeks ?? 0;
  const streakLevel = homeStreakSummary?.level ?? 1;
  const streakProgressPercent = homeStreakSummary?.progressToNextWeek ?? 0;

  const filteredHomeProgressRows = useMemo(
    () => filterHomeProgressRows(homeProgressRows, progressWindow, progressContentFilter, progressActivityFilter),
    [homeProgressRows, progressWindow, progressContentFilter, progressActivityFilter]
  );

  const progressExerciseMinutes = useMemo(
    () => getProgressExerciseMinutes(filteredHomeProgressRows),
    [filteredHomeProgressRows]
  );

  const progressTotalLearningMinutes = useMemo(
    () => getProgressTotalLearningMinutes(filteredHomeProgressRows),
    [filteredHomeProgressRows]
  );

  const homeProgressPageSize = 10;
  const homeProgressTotalPages = Math.max(1, Math.ceil(filteredHomeProgressRows.length / homeProgressPageSize));
  const safeHomeProgressPage = Math.min(homeProgressPage, homeProgressTotalPages);
  const paginatedHomeProgressRows = filteredHomeProgressRows.slice(
    (safeHomeProgressPage - 1) * homeProgressPageSize,
    safeHomeProgressPage * homeProgressPageSize
  );

  const homeLiveEvents = useMemo(
    () => (selectedSubjectId !== 'all' && homeSubjectEvents.length > 0 ? homeSubjectEvents : homeUpcomingEvents),
    [selectedSubjectId, homeSubjectEvents, homeUpcomingEvents]
  );

  const sortedHomeLiveEvents = useMemo(
    () => [...homeLiveEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [homeLiveEvents]
  );

  const activeHomeDeadlineEvent =
    sortedHomeLiveEvents.length > 0
      ? sortedHomeLiveEvents[homeDeadlineEventIndex % sortedHomeLiveEvents.length]
      : null;

  const homeActivityDeadlines = useMemo(() => {
    const now = Date.now();
    return sortedHomeLiveEvents.map((event) => {
      const startDate = new Date(event.start);
      const startTime = startDate.getTime();
      const hasValidStart = Number.isFinite(startTime);
      const msRemaining = hasValidStart ? startTime - now : null;
      const isOverdue = hasValidStart ? startTime < now : false;
      const isDueToday = hasValidStart
        ? startDate.toDateString() === new Date(now).toDateString()
        : false;
      return {
        id: event.id,
        title: event.title || 'Scheduled activity',
        category: getDeadlineEventCategory(event),
        eventType: String(event.type || '').toLowerCase(),
        subjectId: event.subjectId || null,
        subjectName: event.subjectName || 'General',
        start: event.start,
        msRemaining,
        isOverdue,
        isDueToday,
      };
    });
  }, [sortedHomeLiveEvents]);

  const overdueActivityCount = useMemo(
    () => homeActivityDeadlines.filter((item) => item.isOverdue).length,
    [homeActivityDeadlines]
  );

  const dueTodayActivityCount = useMemo(
    () => homeActivityDeadlines.filter((item) => item.isDueToday && !item.isOverdue).length,
    [homeActivityDeadlines]
  );

  const criticalNotifications = useMemo(
    () =>
      homeNotifications.filter((item) => {
        const priority = String(item.priority || '').toLowerCase();
        const combinedText = `${item.title || ''} ${item.message || ''}`.toLowerCase();
        return (
          priority === 'critical' ||
          priority === 'urgent' ||
          priority === 'high' ||
          combinedText.includes('urgent') ||
          combinedText.includes('overdue') ||
          combinedText.includes('due today')
        );
      }),
    [homeNotifications]
  );

  const nextCriticalDeadline = useMemo(() => {
    if (homeLiveEvents.length === 0) return null;
    const now = Date.now();
    const in48Hours = now + 48 * 60 * 60 * 1000;
    const candidates = homeLiveEvents.filter((event) => {
      const startTime = new Date(event.start).getTime();
      return Number.isFinite(startTime) && startTime >= now && startTime <= in48Hours;
    });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  }, [homeLiveEvents]);

  const criticalAlertsCount = criticalNotifications.length + (nextCriticalDeadline ? 1 : 0);

  useEffect(() => {
    // Primary bootstrap load for student identity, subjects, and active plans.
    const fetchStudentData = async () => {
      try {
        setLoading(true);
        const currentUser = authService.getCurrentUser() as any;
        const token = getActiveAuthToken();

        if (!currentUser?.studentId || !token) {
          throw new Error('User is not authorized or student ID is missing.');
        }

        const studentData = await studentService.getStudent(currentUser.studentId);
        setStudent(studentData);

        const allSubjects = await subjectService.getSubjects().catch(() => []);
        const studentSubjectIds = (studentData?.subjects || [])
          .map((subject: any) => (typeof subject === 'string' ? subject : subject?.id))
          .filter(Boolean) as string[];

        let fetchedSubjects: Subject[] = [];
        if (studentSubjectIds.length > 0) {
          const subjectById = new Map(allSubjects.map((subject) => [subject.id, subject]));
          const missingSubjectIds = studentSubjectIds.filter((subjectId) => !subjectById.has(subjectId));
          const missingSubjects = await Promise.all(
            missingSubjectIds.map((subjectId) =>
              subjectService
                .getSubjectById(subjectId)
                .catch(() => null)
            )
          );
          missingSubjects.filter(Boolean).forEach((subject) => {
            subjectById.set((subject as Subject).id, subject as Subject);
          });
          fetchedSubjects = studentSubjectIds
            .map((subjectId) => subjectById.get(subjectId))
            .filter(Boolean) as Subject[];
        } else {
          fetchedSubjects = allSubjects;
        }

        setSubjects(fetchedSubjects);

        if (studentData?.id) {
          try {
            const plans = await developmentService.getAllPlansForStudent(studentData.id, 'Active');
            setSubjectPlans(plans || []);
          } catch {
            setSubjectPlans([]);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load student data');
      } finally {
        setTimeout(() => setLoading(false), 500);
      }
    };

    fetchStudentData();
  }, []);

  useEffect(() => {
    if (!student?.id) {
      setTeachers([]);
      return;
    }

    // Keep teachers synced with the authenticated student context.
    let cancelled = false;
    const fetchTeachers = async () => {
      try {
        setTeachersLoading(true);
        setTeachersError(null);
        const response = await studentService.getTeachers(student.id);
        if (!cancelled) {
          setTeachers(response || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setTeachers([]);
          const rawMessage = String(err?.message || '');
          const isMissingEndpoint =
            rawMessage.includes('No static resource') ||
            rawMessage.includes('/api/students/') && rawMessage.includes('/teachers');

          setTeachersError(
            isMissingEndpoint
              ? 'Teachers data is currently unavailable. Please restart the backend so the student teachers endpoint is active.'
              : 'Failed to load teachers. Please try again.'
          );
        }
      } finally {
        if (!cancelled) {
          setTeachersLoading(false);
        }
      }
    };

    fetchTeachers();
    return () => {
      cancelled = true;
    };
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) {
      setStudentReportCard(null);
      return;
    }

    let cancelled = false;

    const fetchReportCard = async () => {
      try {
        const response = await reportService.getStudentReportCard(student.id);
        if (!cancelled) {
          setStudentReportCard(response || null);
        }
      } catch {
        if (!cancelled) {
          setStudentReportCard(null);
        }
      }
    };

    void fetchReportCard();

    return () => {
      cancelled = true;
    };
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) {
      setHomeStreakSummary(null);
      return;
    }

    let cancelled = false;
    const touchStreak = async () => {
      const streak = await developmentService.touchStudentStreak(student.id).catch(() => null);
      if (!cancelled && streak) {
        setHomeStreakSummary(streak);
      }
    };

    void touchStreak();
    return () => {
      cancelled = true;
    };
  }, [student?.id]);

  useEffect(() => {
    if (homeMasteryBySubject.length === 0) {
      setHomeMasterySubjectIndex(0);
      return;
    }
    setHomeMasterySubjectIndex((previous) => Math.min(previous, homeMasteryBySubject.length - 1));
  }, [homeMasteryBySubject.length]);

  useEffect(() => {
    if (homeMasteryBySubject.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setHomeMasterySubjectIndex((previous) => (previous + 1) % homeMasteryBySubject.length);
    }, 4800);
    return () => window.clearInterval(intervalId);
  }, [homeMasteryBySubject.length]);

  useEffect(() => {
    if (sortedHomeLiveEvents.length === 0) {
      setHomeDeadlineEventIndex(0);
      return;
    }
    setHomeDeadlineEventIndex((previous) => Math.min(previous, sortedHomeLiveEvents.length - 1));
  }, [sortedHomeLiveEvents.length]);

  useEffect(() => {
    if (sortedHomeLiveEvents.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setHomeDeadlineEventIndex((previous) => (previous + 1) % sortedHomeLiveEvents.length);
    }, 4800);
    return () => window.clearInterval(intervalId);
  }, [sortedHomeLiveEvents.length]);

  useEffect(() => {
    if (!student?.id) {
      setHomeNotifications([]);
      setHomeUnreadNotificationCount(0);
      setHomeUpcomingEvents([]);
      setHomeSubjectEvents([]);
      setHomeActivityFeed([]);
      setHomeMasterySignals(null);
      setHomeStreakSummary(null);
      return;
    }

    let cancelled = false;

    const loadHomeLiveData = async () => {
      try {
        setHomeLiveLoading(true);
        setHomeLiveError(null);

        const now = new Date();
        const thirtyDaysAhead = new Date();
        thirtyDaysAhead.setDate(now.getDate() + 30);

        const [
          notifications,
          unreadCount,
          upcomingEvents,
          allCalendarEvents,
          subjectEvents,
          activityFeed,
          masterySignals,
          streakSummary,
        ] = await Promise.all([
          notificationService.getNotifications(1, 20, false, notificationRecipientId).catch(() => []),
          notificationService.getUnreadCount(notificationRecipientId).catch(() => 0),
          calendarService.getUpcomingEvents(6, student.id).catch(() => []),
          calendarService.getEvents(now, thirtyDaysAhead, student.id).catch(() => []),
          selectedSubjectId !== 'all'
            ? calendarService.getSubjectEvents(selectedSubjectId, student.id).catch(() => [])
            : Promise.resolve([]),
          studentService
            .getActivityFeed(student.id, {
              subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
              limit: 250,
            })
            .catch(() => []),
          developmentService
            .getStudentMasterySignalsSummary(student.id, selectedSubjectId !== 'all' ? selectedSubjectId : undefined)
            .catch(() => null),
          developmentService.getStudentStreak(student.id).catch(() => null),
        ]);

        if (cancelled) return;

        setHomeNotifications((notifications || []).slice(0, 5));
        setHomeUnreadNotificationCount(Number(unreadCount || 0));
        setHomeUpcomingEvents((upcomingEvents || []).slice(0, 6));
        setHomeSubjectEvents((subjectEvents || []).slice(0, 6));
        setHomeActivityFeed(activityFeed || []);
        setHomeMasterySignals(masterySignals);
        setHomeStreakSummary(streakSummary);

        // Ensure /calendar/events data is consumed for the dashboard health checks.
        void allCalendarEvents;
      } catch (liveError: any) {
        if (!cancelled) {
          setHomeLiveError(liveError?.message || 'Failed to load live updates.');
        }
      } finally {
        if (!cancelled) {
          setHomeLiveLoading(false);
        }
      }
    };

    void loadHomeLiveData();
    const intervalId = window.setInterval(() => {
      void loadHomeLiveData();
    }, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [student?.id, selectedSubjectId, notificationRecipientId]);

  useEffect(() => {
    if (activeView !== 'results') {
      setIsResultsSidebarCollapsed(false);
    }
    setAccountMenuOpen(false);
    setNotificationMenuOpen(false);
    setMobileNavOpen(false);
  }, [activeView]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderCompact(window.scrollY > 80);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => () => {
    if (viewSwitchTimerRef.current !== null) {
      window.clearTimeout(viewSwitchTimerRef.current);
      viewSwitchTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const routeView = getRouteViewFromPathname(location.pathname);
    if (!routeView || routeView === activeView) return;

    if (viewSwitchTimerRef.current !== null) {
      window.clearTimeout(viewSwitchTimerRef.current);
    }

    // Keep URL-driven navigation transitions visually consistent with tab clicks.
    setLoadingTargetView(routeView);
    setViewLoading(true);
    viewSwitchTimerRef.current = window.setTimeout(() => {
      setActiveView(routeView);
      setViewLoading(false);
      viewSwitchTimerRef.current = null;
    }, 180);
  }, [location.pathname, activeView]);

  useEffect(() => {
    if (displaySubjects.length === 0) return;

    if (!hasInitializedDefaultSubjectRef.current) {
      hasInitializedDefaultSubjectRef.current = true;
      if (selectedSubjectId === 'all' && defaultSubjectId !== 'all') {
        setSelectedSubjectId(defaultSubjectId);
      }
      return;
    }

    const selectedStillExists = selectedSubjectId !== 'all' && displaySubjects.some((subject) => subject.id === selectedSubjectId);
    if (!selectedStillExists && defaultSubjectId !== 'all') {
      setSelectedSubjectId(defaultSubjectId);
    }
  }, [displaySubjects, defaultSubjectId, selectedSubjectId]);

  useEffect(() => {
    if (displaySubjects.length === 0) {
      setActivePlan(null);
      return;
    }

    if (selectedSubjectId === 'all') {
      const firstSubjectId = displaySubjects[0]?.id;
      setActivePlan(firstSubjectId ? displayPlanBySubjectId.get(firstSubjectId) || null : null);
      return;
    }

    setActivePlan(displayPlanBySubjectId.get(selectedSubjectId) || null);
  }, [selectedSubjectId, displaySubjects, displayPlanBySubjectId]);

  useEffect(() => {
    setHomeProgressPage(1);
  }, [homePanel, progressWindow, progressContentFilter, progressActivityFilter]);

  useEffect(() => {
    if (homeProgressPage > homeProgressTotalPages) {
      setHomeProgressPage(homeProgressTotalPages);
    }
  }, [homeProgressPage, homeProgressTotalPages]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const navItems: Array<{ key: NavItemKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: 'Home', icon: LayoutDashboard },
    { key: 'plan', label: 'My Plans', icon: BookOpen },
    { key: 'subjects', label: 'My Subjects', icon: BookOpen },
    { key: 'assessments', label: 'Assessments', icon: FileText },
    { key: 'results', label: 'My Report', icon: BarChart2 },
  ];

  const activeNavItemLabel = navItems.find((item) => item.key === activeView)?.label || 'Navigation';

  const setViewWithTransition = (nextView: NavItemKey, options?: { resetPlanEntry?: boolean }) => {
    if (options?.resetPlanEntry) {
      setPlanEntryStepIndex(null);
    }

    setMobileNavOpen(false);

    if (isRoutableStudentView(nextView)) {
      const targetPath = STUDENT_VIEW_PATHS[nextView];
      const currentPath = normalizeStudentPath(location.pathname);
      if (currentPath !== targetPath) {
        navigate(targetPath);
        return;
      }
    }

    if (nextView === activeView) return;

    if (viewSwitchTimerRef.current !== null) {
      window.clearTimeout(viewSwitchTimerRef.current);
    }

    // Short skeleton transition avoids abrupt content swaps between major tabs.
    setLoadingTargetView(nextView);
    setViewLoading(true);
    viewSwitchTimerRef.current = window.setTimeout(() => {
      setActiveView(nextView);
      setViewLoading(false);
      viewSwitchTimerRef.current = null;
    }, 180);
  };

  const handleNavChange = (key: NavItemKey) => {
    setViewWithTransition(key, { resetPlanEntry: key === 'plan' });
  };

  const openPlan = (subjectId: string, plan: DevelopmentPlan, stepIndex?: number) => {
    setSelectedSubjectId(subjectId);
    setActivePlan(plan);
    setPlanEntryStepIndex(typeof stepIndex === 'number' ? stepIndex : null);
    setViewWithTransition('plan');
  };

  const openSubjectInMySubjects = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setViewWithTransition('subjects');
  };

  const handleOpenTutor = (prompt?: string) => {
    void prompt;
    setViewWithTransition('tutor');
  };

  const handleOpenActivityDeadline = (deadline: {
    eventType: string;
    subjectId: string | null;
  }) => {
    if (deadline.subjectId) {
      setSelectedSubjectId(deadline.subjectId);
    }
    if (deadline.eventType === 'exam' || deadline.eventType === 'quiz' || deadline.eventType === 'presentation') {
      setViewWithTransition('assessments');
      return;
    }
    setViewWithTransition('subjects');
  };

  const handleOpenProfile = () => {
    setViewWithTransition('profile');
    setAccountMenuOpen(false);
  };

  const handleOpenSettings = () => {
    setViewWithTransition('profile');
    setAccountMenuOpen(false);
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    const target = homeNotifications.find((item) => item.id === notificationId);
    if (!target || target.read) return;

    try {
      await notificationService.markAsRead(notificationId, notificationRecipientId);
      setHomeNotifications((previous) =>
        previous.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
      );
      setHomeUnreadNotificationCount((previous) => Math.max(0, previous - 1));
    } catch {
      // Non-blocking; the next refresh will reconcile state.
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (homeUnreadNotificationCount <= 0) return;
    try {
      await notificationService.markAllAsRead(notificationRecipientId);
      setHomeNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
      setHomeUnreadNotificationCount(0);
    } catch {
      // Ignore transient failures; list refresh will retry.
    }
  };

  const handleOpenNotificationContext = (notification: NotificationItem) => {
    const combinedText = `${notification.notifType || ''} ${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    if (combinedText.includes('assessment') || combinedText.includes('quiz') || combinedText.includes('submission')) {
      setViewWithTransition('assessments');
    } else if (combinedText.includes('plan') || combinedText.includes('development')) {
      setViewWithTransition('plan');
    } else if (combinedText.includes('subject') || combinedText.includes('topic')) {
      setViewWithTransition('subjects');
    } else {
      setViewWithTransition('overview');
    }
    setNotificationMenuOpen(false);
  };

  const formatCalendarEventTime = (value: Date | string | undefined) => {
    if (!value) return 'TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatDeadlineRelative = (msRemaining: number | null) => {
    if (msRemaining === null) return 'Date pending';
    if (msRemaining < 0) {
      const hoursLate = Math.floor(Math.abs(msRemaining) / (60 * 60 * 1000));
      if (hoursLate < 24) return `Overdue by ${hoursLate || 1}h`;
      const daysLate = Math.floor(hoursLate / 24);
      return `Overdue by ${daysLate || 1}d`;
    }
    const hoursLeft = Math.floor(msRemaining / (60 * 60 * 1000));
    if (hoursLeft < 1) return 'Due in under 1h';
    if (hoursLeft < 24) return `Due in ${hoursLeft}h`;
    const daysLeft = Math.floor(hoursLeft / 24);
    return `Due in ${daysLeft}d`;
  };

  const formatNotificationTime = (value: string | undefined) => {
    if (!value) return '';
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return '';
    return timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <section className="w-full border-y border-orange-100 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <p className="text-lg sm:text-xl font-semibold text-slate-900">
              {streakWeeks > 0
                ? `You are on a ${streakWeeks}-week streak. Keep going.`
                : 'Start your learning streak today.'}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2 text-slate-700">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold">
                  {streakWeeks > 0 ? `${streakWeeks} week streak` : 'No active streak'}
                </span>
              </div>
              <div className="h-8 w-px bg-orange-200" />
              <div className="w-full sm:w-auto sm:min-w-[220px]">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700">Level {streakLevel}</span>
                  <span>{streakProgressPercent}% to next week</span>
                </div>
                <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, streakProgressPercent))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {homePanel === 'subjects' && (
        <>
          <section className="hidden md:grid grid-cols-3 gap-4">
            <article className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm font-semibold">Critical alerts</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{criticalAlertsCount}</p>
              <p className="text-xs text-slate-500">
                {nextCriticalDeadline
                  ? `${nextCriticalDeadline.title} • ${formatCalendarEventTime(nextCriticalDeadline.start)}`
                  : criticalNotifications.length > 0
                    ? `${criticalNotifications.length} urgent notification${criticalNotifications.length > 1 ? 's' : ''}`
                    : 'No critical alerts.'}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-700">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold">Upcoming deadlines</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{homeLiveEvents.length}</p>
              <div className="h-8 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeHomeDeadlineEvent?.id || 'deadline-fallback'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <p className="text-xs text-slate-500">
                      {activeHomeDeadlineEvent
                        ? `${getDeadlineEventCategory(activeHomeDeadlineEvent)} • ${activeHomeDeadlineEvent.title} • ${formatCalendarEventTime(activeHomeDeadlineEvent.start)}`
                        : 'No upcoming events.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold">Mastery signals</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {activeHomeMasterySubject
                  ? `${Math.round(activeHomeMasterySubject.masteryPercent)}%`
                  : homeMasterySignals
                    ? `${Math.round(homeMasterySignals.averageOverall || 0)}%`
                    : '--'}
              </p>
              <div className="h-8 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeHomeMasterySubject?.subjectId || 'mastery-fallback'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <p className="text-xs text-slate-500">
                      {activeHomeMasterySubject
                        ? `${activeHomeMasterySubject.subjectName} • Grade ${activeHomeMasterySubject.currentGrade}`
                        : 'Subject mastery unavailable.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </article>
          </section>

          <section className="md:hidden">
            <article className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold">Mastery signals</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {activeHomeMasterySubject
                  ? `${Math.round(activeHomeMasterySubject.masteryPercent)}%`
                  : homeMasterySignals
                    ? `${Math.round(homeMasterySignals.averageOverall || 0)}%`
                    : '--'}
              </p>
              <div className="h-8 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`mobile-${activeHomeMasterySubject?.subjectId || 'mastery-fallback'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <p className="text-xs text-slate-500">
                      {activeHomeMasterySubject
                        ? `${activeHomeMasterySubject.subjectName} • Grade ${activeHomeMasterySubject.currentGrade}`
                        : 'Subject mastery unavailable.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </article>
          </section>
        </>
      )}

      {homeLiveError && !homeLiveLoading && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {homeLiveError}
        </div>
      )}

      <section className="bg-white overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] min-h-[640px]">
          <aside className="hidden lg:block border-r border-slate-200 p-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">My Stuff</p>
            <button
              type="button"
              onClick={() => setHomePanel('subjects')}
              className={`w-full mt-3 text-left rounded-md font-semibold px-4 py-2.5 text-sm ${
                homePanel === 'subjects' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              My Plans
            </button>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-7">My Account</p>
            <div className="mt-3 space-y-1.5">
              <button
                type="button"
                onClick={() => setHomePanel('progress')}
                className={`w-full text-left rounded-md px-4 py-2 text-sm ${
                  homePanel === 'progress' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Progress
              </button>
              <button
                type="button"
                onClick={() => setHomePanel('activities')}
                className={`w-full text-left rounded-md px-4 py-2 text-sm ${
                  homePanel === 'activities' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Activities
              </button>
              <button
                type="button"
                onClick={() => setHomePanel('profile')}
                className={`w-full text-left rounded-md px-4 py-2 text-sm ${
                  homePanel === 'profile' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setHomePanel('teachers')}
                className={`w-full text-left rounded-md px-4 py-2 text-sm ${
                  homePanel === 'teachers' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Teachers
              </button>
            </div>
          </aside>

          <div className="p-4 sm:p-6 space-y-8">
            <AnimatePresence mode="wait">
              {homePanel === 'subjects' ? (
                <motion.div
                  key="home-subjects-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="space-y-8"
                >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 xl:gap-x-10 gap-y-8 xl:gap-y-10">
                  {overviewSubjects.map(({ subject, plan }) => {
                    if (!plan) {
                      return (
                        <article key={subject.id} className="space-y-3 w-full">
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => openSubjectInMySubjects(subject.id)}
                              title={`Open ${subject.name} in My Subjects`}
                              className="text-left text-xl sm:text-2xl font-semibold text-slate-900 hover:text-blue-700 transition"
                            >
                              {subject.name}
                            </button>
                          </div>
                          <div className="border-t border-slate-200 pt-4">
                            <p className="text-sm text-slate-500">
                              No active plan assigned for this subject yet.
                            </p>
                          </div>
                        </article>
                      );
                    }

                    const sortedSteps = (plan.plan.steps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
                    const totalSteps = sortedSteps.length;
                    const safeProgress = Math.max(0, Math.min(100, plan.currentProgress));
                    const completedSteps = Math.floor((safeProgress / 100) * (totalSteps || 1));
                    const currentStepIndex = Math.min(completedSteps, Math.max(totalSteps - 1, 0));
                    const visibleSteps = sortedSteps.slice(0, 4);
                    const visibleStepCount = visibleSteps.length;
                    const completedVisibleSteps = Math.min(completedSteps, visibleStepCount);
                    const progressUnits = (safeProgress / 100) * Math.max(totalSteps, 1);
                    const connectorProgress =
                      visibleStepCount <= 1
                        ? 0
                        : Math.max(
                            0,
                            Math.min(
                              100,
                              ((completedVisibleSteps + (completedVisibleSteps < visibleStepCount && safeProgress > 0 ? 0.5 : 0)) /
                                (visibleStepCount - 1)) *
                                100
                            )
                          );

                    return (
                      <article key={subject.id} className="space-y-3 w-full">
                        <div className="flex items-center">
                          <div>
                            <button
                              type="button"
                              onClick={() => openSubjectInMySubjects(subject.id)}
                              title={`Open ${subject.name} in My Subjects`}
                              className="text-left text-xl sm:text-2xl font-semibold text-slate-900 hover:text-blue-700 transition"
                            >
                              {subject.name}
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-4">
                          <div className="relative">
                            {visibleStepCount > 1 && (
                              <>
                                <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200" />
                                <div
                                  className="absolute left-4 top-2 w-px bg-blue-500"
                                  style={{ height: `${connectorProgress}%` }}
                                />
                              </>
                            )}
                            <div className="space-y-4">
                              {visibleSteps.map((step, index) => {
                                const isCompleted = index < completedSteps;
                                const isActiveStep =
                                  safeProgress >= 100 ? index === Math.max(totalSteps - 1, 0) : index === currentStepIndex;
                                const stepProgressPercent = Math.max(
                                  0,
                                  Math.min(100, Math.round((progressUnits - index) * 100))
                                );
                                const stepActionLabel = safeProgress >= 100 ? 'Review' : safeProgress > 0 ? 'Resume' : 'Start';

                                return (
                                  <div key={`${subject.id}-${step.title}-${index}`} className="flex items-start justify-between gap-3 py-0.5">
                                    <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                                        isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700'
                                      }`}>
                                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : getStepIcon(step.type)}
                                      </div>
                                      <div className="min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => openPlan(subject.id, plan, index)}
                                          className="block max-w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-blue-700"
                                        >
                                          {step.title}
                                        </button>
                                        <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                          {stepProgressPercent}% • {step.type}
                                        </p>
                                      </div>
                                    </div>
                                    {isActiveStep && (
                                      <button
                                        type="button"
                                        onClick={() => openPlan(subject.id, plan, index)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shrink-0 mt-0.5"
                                      >
                                        {stepActionLabel === 'Resume' ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        {stepActionLabel}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                </motion.div>
              ) : homePanel === 'progress' ? (
                <motion.div
                  key="home-progress-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="space-y-5"
                >
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold text-slate-900">My progress</h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={progressWindow}
                    onChange={(event) => setProgressWindow(event.target.value as 'week' | 'month' | 'all')}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="all">All time</option>
                  </select>
                  <select
                    value={progressContentFilter}
                    onChange={(event) => setProgressContentFilter(event.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="all">All content</option>
                    {displaySubjects.map((subject) => (
                      <option key={subject.id} value={subject.name}>{subject.name}</option>
                    ))}
                  </select>
                  <select
                    value={progressActivityFilter}
                    onChange={(event) => setProgressActivityFilter(event.target.value as 'all' | 'learn' | 'practice')}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="all">All activities</option>
                    <option value="learn">Learning</option>
                    <option value="practice">Practice</option>
                  </select>

                  <div className="ml-auto flex items-center gap-3 text-slate-800">
                    <div className="text-right">
                      <p className="text-4xl leading-none font-bold">{progressExerciseMinutes}</p>
                      <p className="text-xs text-slate-500">exercise min</p>
                    </div>
                    <div className="h-10 w-px bg-slate-300" />
                    <div className="text-right">
                      <p className="text-4xl leading-none font-bold">{progressTotalLearningMinutes}</p>
                      <p className="text-xs text-slate-500">total learning min</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full min-w-[920px]">
                    <thead className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Activity</th>
                        <th className="text-left font-semibold px-3 py-2">Date</th>
                        <th className="text-left font-semibold px-3 py-2">Level</th>
                        <th className="text-left font-semibold px-3 py-2">Change</th>
                        <th className="text-right font-semibold px-3 py-2">Correct/Total Problems</th>
                        <th className="text-right font-semibold px-3 py-2">Time (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHomeProgressRows.map((row) => {
                        const levelLabel = row.progressPercent >= 100 ? 'Mastered' : row.progressPercent > 0 ? 'In progress' : '-';
                        const changeLabel = row.progressPercent > 0 ? `+${Math.max(1, Math.round(row.progressPercent / 20))}` : '-';
                        return (
                          <tr key={row.id} className="border-t border-slate-200 text-sm text-slate-800">
                            <td className="px-3 py-3">
                              <div className="flex items-start gap-2">
                                <span className="text-slate-500 mt-0.5">{getStepIcon(row.type)}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{row.title}</p>
                                  <p className="text-xs text-slate-500 truncate">{row.subjectName}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">{formatProgressDate(row.date)}</td>
                            <td className="px-3 py-3">{levelLabel}</td>
                            <td className="px-3 py-3">{changeLabel}</td>
                            <td className="px-3 py-3 text-right">{row.correctTotal}</td>
                            <td className="px-3 py-3 text-right">{row.timeMinutes}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setHomeProgressPage((previous) => Math.max(1, previous - 1))}
                    disabled={safeHomeProgressPage <= 1}
                    className="inline-flex items-center text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500">
                    Page {safeHomeProgressPage} of {homeProgressTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHomeProgressPage((previous) => Math.min(homeProgressTotalPages, previous + 1))}
                    disabled={safeHomeProgressPage >= homeProgressTotalPages}
                    className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                </motion.div>
              ) : homePanel === 'activities' ? (
                <motion.div
                  key="home-activities-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="space-y-5"
                >
                  <div className="space-y-1">
                    <h2 className="text-3xl font-bold text-slate-900">My activities</h2>
                    <p className="text-sm text-slate-500">Track deadlines for assessments, activities, and class work.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <article className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Total deadlines</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{homeActivityDeadlines.length}</p>
                    </article>
                    <article className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-medium tracking-wide text-amber-700 uppercase">Due today</p>
                      <p className="mt-1 text-2xl font-semibold text-amber-800">{dueTodayActivityCount}</p>
                    </article>
                    <article className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                      <p className="text-xs font-medium tracking-wide text-rose-700 uppercase">Overdue</p>
                      <p className="mt-1 text-2xl font-semibold text-rose-800">{overdueActivityCount}</p>
                    </article>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">Activity deadlines</p>
                    </div>
                    {homeActivityDeadlines.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <CalendarClock className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-2 text-sm font-semibold text-slate-700">No upcoming activities</p>
                        <p className="mt-1 text-xs text-slate-500">Your upcoming deadlines will appear here.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {homeActivityDeadlines.map((deadline) => (
                          <button
                            key={deadline.id}
                            type="button"
                            onClick={() => handleOpenActivityDeadline(deadline)}
                            className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{deadline.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {deadline.subjectName} • {formatCalendarEventTime(deadline.start)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                {deadline.category}
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  deadline.isOverdue
                                    ? 'bg-rose-100 text-rose-700'
                                    : deadline.isDueToday
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {formatDeadlineRelative(deadline.msRemaining)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : homePanel === 'profile' ? (
                <motion.div
                  key="home-profile-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                >
                  <StudentProfileSettings
                    student={student!}
                    onStudentUpdated={(updated) => setStudent(updated)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="home-teachers-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                >
                  <HomeTeachersPanel teachers={teachers} loading={teachersLoading} error={teachersError} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );

  const renderViewSkeleton = (view: NavItemKey) => {
    if (view === 'overview') {
      return (
        <div className="space-y-4 animate-pulse">
          <section className="h-24 border border-slate-200 bg-slate-100" />
          <section className="border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] min-h-[640px]">
              <aside className="hidden lg:block border-r border-slate-200 bg-slate-50 p-5">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="mt-3 border-t border-slate-200">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-10 border-b border-slate-200 bg-slate-100" />
                  ))}
                </div>
              </aside>
              <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {Array.from({ length: 2 }).map((_, cardIdx) => (
                <div key={cardIdx} className="space-y-4">
                  <div className="h-7 w-40 rounded bg-slate-200" />
                  {Array.from({ length: 4 }).map((__, stepIdx) => (
                    <div key={stepIdx} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-8 w-8 rounded-full bg-slate-200" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-40 rounded bg-slate-200" />
                          <div className="h-3 w-24 rounded bg-slate-200" />
                        </div>
                      </div>
                      {stepIdx === 1 && <div className="h-8 w-20 rounded bg-slate-200" />}
                    </div>
                  ))}
                </div>
              ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (view === 'plan') {
      return (
        <div className="border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[760px]">
            <aside className="hidden md:flex border-r border-slate-200 bg-slate-50 flex-col">
              <div className="border-b border-slate-200 px-5 py-4 space-y-3">
                <div className="h-6 w-44 rounded bg-slate-200" />
                <div className="h-1.5 w-full rounded bg-slate-200" />
              </div>
              <div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[72px] w-full border-b border-slate-200 bg-slate-100" />
                ))}
              </div>
            </aside>
            <div className="border-l border-slate-200 md:border-l-0 bg-white">
              <div className="h-[74px] border-b border-slate-200 px-6 py-5">
                <div className="h-9 w-72 rounded bg-slate-200" />
              </div>
              <div className="p-6 space-y-4">
              <div className="h-9 w-72 rounded bg-slate-200" />
              <div className="h-28 w-full rounded bg-slate-100" />
              <div className="h-28 w-full rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'subjects') {
      return (
        <div className="border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] min-h-[640px]">
            <aside className="hidden xl:block border-r border-slate-200 bg-slate-50 p-4">
              <div className="border-t border-slate-200">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 w-full border-b border-slate-200 bg-slate-100" />
              ))}
              </div>
            </aside>
            <div className="p-6 space-y-4">
              <div className="h-8 w-80 rounded bg-slate-200" />
              <div className="h-5 w-3/4 rounded bg-slate-100" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 w-full rounded border border-slate-200 bg-slate-50" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (view === 'assessments') {
      return (
        <div className="border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[680px]">
            <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="border-t border-slate-200">
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
              </div>
              <div className="mt-5 space-y-2 rounded-md border border-slate-200 bg-white p-3">
                <div className="h-3 w-full rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-200" />
              </div>
            </aside>
            <div className="p-6 space-y-4">
              <div className="h-16 rounded-lg border border-slate-200 bg-slate-50" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 rounded-lg border border-slate-200 bg-white" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (view === 'results') {
      return (
        <div className="border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[680px]">
            <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="border-t border-slate-200">
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
              </div>
            </aside>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-lg border border-slate-200 bg-white" />
                ))}
              </div>
              <div className="h-72 rounded-lg border border-slate-200 bg-white" />
            </div>
          </div>
        </div>
      );
    }

    if (view === 'peer-study') {
      return (
        <div className="border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[640px]">
            <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="border-t border-slate-200">
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
                <div className="h-10 w-full border-b border-slate-200 bg-slate-100" />
              </div>
            </aside>
            <div className="p-6 space-y-4">
              <div className="h-16 rounded-lg border border-slate-200 bg-slate-50" />
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-4">
                <div className="h-72 rounded-xl border border-slate-200 bg-white" />
                <div className="space-y-3">
                  <div className="h-36 rounded-xl border border-slate-200 bg-white" />
                  <div className="h-36 rounded-xl border border-slate-200 bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'tutor' || view === 'profile') {
      return (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-56 rounded bg-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-72 border border-slate-200 bg-white" />
            <div className="h-72 border border-slate-200 bg-white" />
          </div>
        </div>
      );
    }

    return <div className="h-64 border border-slate-200 bg-white animate-pulse" />;
  };

  const renderContent = () => {
    if (!student) return null;
    if (viewLoading) return renderViewSkeleton(loadingTargetView);

    switch (activeView) {
      case 'plan':
        return activePlan ? (
          <StudentPlanView
            studentId={student.id}
            plan={activePlan}
            initialStepIndex={planEntryStepIndex ?? undefined}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Active Plan</h3>
            <p className="text-slate-500">No plan available for the selected subject.</p>
          </div>
        );
      case 'subjects':
        return (
          <StudentSubjectsView
            studentId={student.id}
            selectedSubjectId={selectedSubjectId}
            subjects={displaySubjects}
          />
        );
      case 'assessments':
        return (
          <StudentAssignments
            studentId={student.id}
            selectedSubjectId={selectedSubjectId}
            onOpenTutor={handleOpenTutor}
          />
        );
      case 'results':
        const reportNeedsAttentionCount = reportCardRows.filter((row) => row.masteryPercent < 50).length;

        return (
          <section className="border border-slate-200 bg-white overflow-hidden">
            <div className={`grid grid-cols-1 min-h-[680px] ${isResultsSidebarCollapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[280px_1fr]'}`}>
              <aside className="relative border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
                <button
                  type="button"
                  onClick={() => setIsResultsSidebarCollapsed((prev) => !prev)}
                  className="hidden lg:inline-flex absolute top-1/2 -translate-y-1/2 -right-4 z-10 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  aria-label={isResultsSidebarCollapsed ? 'Expand my report panel' : 'Collapse my report panel'}
                >
                  {isResultsSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
                </button>
                <p
                  className={`text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold transition-[max-width,opacity,transform] duration-200 ${
                    isResultsSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
                  }`}
                >
                  My Report
                </p>
                <nav className={`${isResultsSidebarCollapsed ? '-mx-4 sm:-mx-5 border-y border-slate-200 bg-white overflow-hidden' : '-mx-4 sm:-mx-5 border-t border-slate-200'}`}>
                  <button
                    type="button"
                    aria-current="page"
                    title="Report Card"
                    className={`w-full inline-flex items-center text-sm transition ${
                      isResultsSidebarCollapsed
                        ? 'justify-center h-11'
                        : 'justify-between rounded-none border-b border-slate-200 px-4 sm:px-5 py-2.5'
                    } ${isResultsSidebarCollapsed ? 'bg-blue-50 text-blue-700' : 'bg-blue-50 border-l-4 border-l-blue-600 pl-2 text-blue-700 font-semibold'}`}
                  >
                    <span className={`inline-flex items-center min-w-0 ${isResultsSidebarCollapsed ? '' : 'gap-2'}`}>
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"
                      >
                        <GraduationCap className="w-4 h-4" />
                      </span>
                      <span
                        className={`truncate transition-[max-width,opacity,transform] duration-200 ${
                          isResultsSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
                        }`}
                      >
                        Report Card
                      </span>
                    </span>
                    {!isResultsSidebarCollapsed && (
                      <span className="text-xs font-semibold text-blue-700">
                        {reportNeedsAttentionCount}
                      </span>
                    )}
                  </button>
                </nav>

              </aside>
              <div className="p-4 sm:p-6 bg-white">
                <StudentReportCard rows={reportCardRows} />
              </div>
            </div>
          </section>
        );
      case 'tutor':
        return (
          <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h3 className="text-xl font-semibold text-slate-800">AI Study Coach Removed</h3>
            <p className="mt-2 text-sm text-slate-500">
              The previous workspace view has been removed from this tab.
            </p>
          </section>
        );
      case 'peer-study':
        return (
          <StudentPeerStudy
            studentId={student.id}
            selectedSubjectId={selectedSubjectId}
            subjects={subjects}
          />
        );
      case 'profile':
        return (
          <StudentProfileSettings
            student={student!}
            onStudentUpdated={(updated) => setStudent(updated)}
          />
        );
      default:
        return renderOverview();
    }
  };

  if (loading) return <DashboardSkeleton />;

  if (error || !student) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-center p-4">
        <div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">An Error Occurred</h2>
          <p className="text-slate-600 mb-6">{error || 'Student data could not be found.'}</p>
          <button onClick={handleLogout} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-100"
      style={{ ['--student-header-offset' as string]: isHeaderCompact ? '4.75rem' : '9rem' }}
    >
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div
          className={`transition-all duration-200 ${
            isHeaderCompact
              ? 'max-h-0 overflow-hidden opacity-0 -translate-y-1 pointer-events-none'
              : 'relative z-30 max-h-28 overflow-visible opacity-100 translate-y-0'
          }`}
        >
          <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-700">ZiVAI Learning</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <div ref={notificationMenuRef} className="relative z-50">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationMenuOpen((previous) => !previous);
                    setAccountMenuOpen(false);
                  }}
                  className="relative inline-flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-haspopup="menu"
                  aria-expanded={notificationMenuOpen}
                  aria-label="Open notifications"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {homeUnreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {homeUnreadNotificationCount > 99 ? '99+' : homeUnreadNotificationCount}
                    </span>
                  )}
                </button>

                {notificationMenuOpen && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 mt-2 w-[340px] max-w-[90vw] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg z-[70]"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800">Notifications</p>
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        disabled={homeUnreadNotificationCount <= 0}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {homeNotifications.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-slate-500">No notifications yet.</p>
                      ) : (
                        homeNotifications.map((item) => (
                          <div key={item.id} className="border-b border-slate-100 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => handleOpenNotificationContext(item)}
                              className={`w-full px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                                item.read ? 'bg-white' : 'bg-blue-50/40'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-800">{item.title || 'Update'}</p>
                              {item.message && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.message}</p>}
                              <p className="mt-1 text-[11px] text-slate-400">{formatNotificationTime(item.createdAt)}</p>
                            </button>
                            {item.read === false && (
                              <div className="px-3 pb-2">
                                <button
                                  type="button"
                                  onClick={() => handleMarkNotificationRead(item.id)}
                                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-800"
                                >
                                  Mark as read
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div
                ref={accountMenuRef}
                className="relative z-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen((prev) => !prev);
                    setNotificationMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                >
                  <div
                    className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold ${
                      student.avatar
                        ? 'bg-slate-100 border border-slate-200 text-slate-600'
                        : `bg-gradient-to-br ${avatarGradient} text-white`
                    }`}
                  >
                    {student.avatar ? (
                      <img
                        src={student.avatar}
                        alt={`${student.firstName} avatar`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      avatarInitials
                    )}
                  </div>
                  <span className="hidden md:block font-medium">{student.firstName} {student.lastName}</span>
                  <ChevronDown className={`w-4 h-4 transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {accountMenuOpen && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-[70]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenProfile();
                        setAccountMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenSettings();
                        setAccountMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`${isHeaderCompact ? '' : 'border-t border-slate-200'} relative z-10 bg-slate-50/70`}>
          <nav className="max-w-[1400px] mx-auto px-4">
            <div className="lg:hidden py-2 relative z-40">
              <button
                type="button"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
                aria-expanded={mobileNavOpen}
                aria-controls="student-mobile-nav-panel"
              >
                <span className="inline-flex items-center gap-2">
                  {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                  {activeNavItemLabel}
                </span>
                <ChevronDown className={`w-4 h-4 transition ${mobileNavOpen ? 'rotate-180' : ''}`} />
              </button>

              {mobileNavOpen && (
                <div id="student-mobile-nav-panel" className="mt-2 rounded-lg border border-slate-200 bg-white p-2 space-y-1 shadow-lg">
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNavChange(key)}
                      className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition ${
                        activeView === key
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}

                  {subjects.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-slate-200">
                      <label className="text-[11px] font-medium text-slate-500">Subject</label>
                      <div className="relative mt-1">
                        <select
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          className="w-full appearance-none rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none px-3 pr-8 py-2"
                        >
                          <option value="all">All Subjects</option>
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {`${subject.code}: ${subject.name}`}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-3 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-0 overflow-x-hidden overflow-y-hidden whitespace-nowrap pr-2">
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNavChange(key)}
                      className={`group relative inline-flex items-center gap-2 py-3 pl-1 pr-4 text-sm transition ${
                        activeView === key
                          ? 'text-slate-900 font-semibold'
                          : 'text-slate-500 font-medium hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`hidden xl:block w-4 h-4 transition ${
                        activeView === key ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'
                      }`} />
                      <span>{label}</span>
                      <span
                        className={`absolute left-0 right-0 bottom-0 h-0.5 rounded-full transition ${
                          activeView === key ? 'bg-blue-600' : 'bg-transparent group-hover:bg-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {subjects.length > 0 && (
                <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shrink-0 ml-auto relative z-0">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Subject</span>
                  <div className="relative">
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="appearance-none bg-transparent text-sm font-semibold text-slate-700 focus:outline-none min-w-[170px] pl-1 pr-6 py-0.5"
                    >
                      <option value="all">All Subjects</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {`${subject.code}: ${subject.name}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-slate-900/15 backdrop-blur-sm"
          aria-label="Close navigation menu"
        />
      )}

      <main className={`w-full bg-white ${activeView === 'subjects' ? 'pt-6 pb-0' : 'py-6'}`}>
        <div className="max-w-[1400px] mx-auto px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
