import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Target,
  MessageCircle,
  LogOut,
  BarChart2,
  FileText,
  Users,
  User,
  CheckCircle2,
  Play,
  RotateCcw,
  Video,
  Edit,
  ChevronDown,
  Flame,
  Settings,
  Menu,
  X,
  Mail,
} from 'lucide-react';
import { Student, DevelopmentPlan, Subject, StepType } from '../../types';
import { studentService, developmentService, subjectService } from '../../services/api';
import { StudentTeacher } from '../../services/studentService';
import StudentPlanView from './StudentPlanView';
import StudentStats from './StudentStats';
import StudentMessages from './StudentMessages';
import StudentAssignments from './StudentAssignments';
import StudentResults from './StudentResults';
import StudentTutor from './StudentTutor';
import StudentPeerStudy from './StudentPeerStudy';
import StudentMasteryGaps from './StudentMasteryGaps';
import StudentProfileSettings from './StudentProfileSettings';
import StudentSubjectsView from './StudentSubjectsView';

type NavItemKey =
  | 'overview'
  | 'plan'
  | 'subjects'
  | 'messages'
  | 'assessments'
  | 'results'
  | 'tutor'
  | 'peer-study'
  | 'mastery-gaps'
  | 'profile';

type HomePanelKey = 'subjects' | 'progress' | 'profile' | 'teachers';

interface HomeProgressRow {
  id: string;
  title: string;
  subjectName: string;
  type: StepType;
  progressPercent: number;
  date: Date;
  correctTotal: string;
  timeMinutes: number;
}

const STEP_TYPE_SEQUENCE: StepType[] = ['document', 'assignment', 'quiz', 'discussion', 'video'];

const getStepIcon = (type: StepType) => {
  switch (type) {
    case 'document':
      return <FileText className="w-4 h-4" />;
    case 'assignment':
      return <Edit className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    default:
      return <BookOpen className="w-4 h-4" />;
  }
};

const getMockStepTitles = (subjectName: string): string[] => {
  const name = subjectName.toLowerCase();
  if (name.includes('english')) {
    return [
      'Read short story',
      'Write a paragraph response',
      'Vocabulary reinforcement quiz',
      'Peer discussion reflection',
      'Weekly tutor feedback',
    ];
  }
  if (name.includes('math')) {
    return [
      'Review concept notes',
      'Solve guided examples',
      'Timed practice set',
      'Reasoning checkpoint',
      'Mastery quiz',
    ];
  }
  if (name.includes('physics')) {
    return [
      'Read topic overview',
      'Explain formulas in words',
      'Problem solving set',
      'Experiment reflection',
      'Topic checkpoint quiz',
    ];
  }
  return [
    'Read concept overview',
    'Write understanding summary',
    'Practice exercises',
    'Reasoning dialogue',
    'Mastery checkpoint',
  ];
};

const buildMockPlan = (subject: Subject, index: number): DevelopmentPlan => {
  const stepTitles = getMockStepTitles(subject.name);
  const progress = 22 + ((index * 17) % 53);
  const steps = stepTitles.map((title, stepIndex) => ({
    title,
    type: STEP_TYPE_SEQUENCE[stepIndex % STEP_TYPE_SEQUENCE.length],
    order: stepIndex + 1,
    link: '',
    additionalResources: [],
  }));

  return {
    id: `mock-plan-${subject.id}`,
    student: 'mock-student',
    plan: {
      id: `mock-plan-template-${subject.id}`,
      name: `${subject.name} Mastery Plan`,
      description: `Structured weekly plan for ${subject.name} with guided practice and coaching.`,
      progress,
      potentialOverall: 85,
      eta: 28,
      performance: 'Good',
      skills: [],
      steps,
      subjectId: subject.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      link: '',
      additionalResources: [],
    },
    startDate: new Date(),
    currentProgress: progress,
    status: 'Active',
    skillProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

const MOCK_SUBJECTS: Subject[] = [
  {
    id: 'mock-subject-math',
    code: 'MTH-01',
    name: 'Mathematics',
    description: 'Numeracy, algebra, and problem solving.',
    teacher: 'mock-teacher',
  },
  {
    id: 'mock-subject-english',
    code: 'ENG-01',
    name: 'English Language',
    description: 'Reading, writing, and communication skills.',
    teacher: 'mock-teacher',
  },
  {
    id: 'mock-subject-physics',
    code: 'PHY-01',
    name: 'Physics',
    description: 'Mechanics, waves, and scientific reasoning.',
    teacher: 'mock-teacher',
  },
  {
    id: 'mock-subject-biology',
    code: 'BIO-01',
    name: 'Biology',
    description: 'Life sciences, systems, and data interpretation.',
    teacher: 'mock-teacher',
  },
];

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
        <section className="relative left-1/2 w-screen -translate-x-1/2 border-y border-orange-100 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50">
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavItemKey>('overview');
  const [tutorPrefill, setTutorPrefill] = useState<string>('');
  const [peerStudyModalOpen, setPeerStudyModalOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<'analytics' | 'results'>('analytics');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [loadingTargetView, setLoadingTargetView] = useState<NavItemKey>('overview');
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [planEntryStepIndex, setPlanEntryStepIndex] = useState<number | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const viewSwitchTimerRef = useRef<number | null>(null);

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

  const viewMeta = useMemo(() => {
    switch (activeView) {
      case 'plan':
        return { title: 'My Development Plan', subtitle: 'Guided practice and reasoning checkpoints for each step.' };
      case 'subjects':
        return { title: 'My Subjects', subtitle: 'Track curriculum coverage, mastery, and recommended resources.' };
      case 'assessments':
        return { title: 'Assessments', subtitle: 'Complete tasks independently and reflect on feedback.' };
      case 'results':
        return { title: 'Results & Analytics', subtitle: 'See performance trends, feedback, and next steps.' };
      case 'messages':
        return { title: 'Messages', subtitle: 'Collaborate with teachers and classmates.' };
      case 'tutor':
        return { title: 'AI Study Coach', subtitle: 'Collaborate in a guided workspace: plan, reason, and reflect.' };
      case 'peer-study':
        return { title: 'Peer Study', subtitle: 'Collaborate with classmates on weak topics.' };
      case 'mastery-gaps':
        return { title: 'Mastery Gaps', subtitle: 'See what to fix next and practice retrieval.' };
      case 'profile':
        return { title: 'Profile & Settings', subtitle: 'Update your details, avatar, and preferences.' };
      default:
        return { title: `Welcome back, ${student?.firstName || ''}!`, subtitle: 'My subjects and development plans.' };
    }
  }, [activeView, student?.firstName]);

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

  const displaySubjects = useMemo(() => (subjects.length > 0 ? subjects : MOCK_SUBJECTS), [subjects]);
  const usingMockSubjects = subjects.length === 0;

  const mockPlanBySubjectId = useMemo(() => {
    const mockMap = new Map<string, DevelopmentPlan>();
    displaySubjects.forEach((subject, index) => {
      mockMap.set(subject.id, buildMockPlan(subject, index));
    });
    return mockMap;
  }, [displaySubjects]);

  const displayPlanBySubjectId = useMemo(() => {
    const merged = new Map<string, DevelopmentPlan>();
    displaySubjects.forEach((subject) => {
      merged.set(subject.id, realPlanBySubjectId.get(subject.id) || mockPlanBySubjectId.get(subject.id)!);
    });
    return merged;
  }, [displaySubjects, realPlanBySubjectId, mockPlanBySubjectId]);

  const overviewSubjects = useMemo(
    () => displaySubjects.map((subject) => ({ subject, plan: displayPlanBySubjectId.get(subject.id) || null })),
    [displaySubjects, displayPlanBySubjectId]
  );

  const averageProgress = useMemo(() => {
    if (overviewSubjects.length === 0) return 0;
    const totalProgress = overviewSubjects.reduce((sum, item) => sum + (item.plan?.currentProgress || 0), 0);
    return Math.round(totalProgress / overviewSubjects.length);
  }, [overviewSubjects]);

  const streakWeeks = useMemo(() => Math.max(1, Math.ceil((averageProgress || 10) / 12)), [averageProgress]);

  const homeProgressRows = useMemo<HomeProgressRow[]>(() => {
    const rows: HomeProgressRow[] = [];

    overviewSubjects.forEach(({ subject, plan }, subjectIndex) => {
      if (!plan?.plan?.steps?.length) return;

      const sortedSteps = [...plan.plan.steps].sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 5);
      const progressUnits = (Math.max(0, Math.min(100, plan.currentProgress || 0)) / 100) * Math.max(sortedSteps.length, 1);

      sortedSteps.forEach((step, stepIndex) => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - (subjectIndex * 145 + stepIndex * 38 + 12));

        const progressPercent = Math.max(0, Math.min(100, Math.round((progressUnits - stepIndex) * 100)));
        const isScored = step.type === 'quiz' || step.type === 'assignment';
        const scoredCorrect = Math.max(0, Math.min(4, Math.round((progressPercent / 100) * 4)));
        const baseTime = step.type === 'video' ? 0 : step.type === 'document' ? 1 : step.type === 'discussion' ? 2 : 3;

        rows.push({
          id: `${subject.id}-${step.title}-${stepIndex}`,
          title: step.title,
          subjectName: subject.name,
          type: step.type,
          progressPercent,
          date,
          correctTotal: isScored ? `${scoredCorrect}/4` : '–',
          timeMinutes: Math.max(0, baseTime + Math.round(progressPercent / 50)),
        });
      });
    });

    return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
  }, [overviewSubjects]);

  const filteredHomeProgressRows = useMemo(() => {
    const now = new Date();
    return homeProgressRows.filter((row) => {
      if (progressWindow === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        if (row.date < weekAgo) return false;
      } else if (progressWindow === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(now.getDate() - 30);
        if (row.date < monthAgo) return false;
      }

      if (progressContentFilter !== 'all' && row.subjectName !== progressContentFilter) {
        return false;
      }

      if (progressActivityFilter === 'learn' && (row.type === 'quiz' || row.type === 'assignment')) {
        return false;
      }

      if (progressActivityFilter === 'practice' && (row.type === 'document' || row.type === 'video' || row.type === 'discussion')) {
        return false;
      }

      return true;
    });
  }, [homeProgressRows, progressWindow, progressContentFilter, progressActivityFilter]);

  const progressExerciseMinutes = useMemo(
    () => Math.max(12, filteredHomeProgressRows.reduce((total, row) => total + row.timeMinutes, 0)),
    [filteredHomeProgressRows]
  );

  const progressTotalLearningMinutes = useMemo(
    () => Math.max(38, filteredHomeProgressRows.reduce((total, row) => total + Math.max(1, row.timeMinutes + (row.progressPercent > 0 ? 1 : 0)), 0)),
    [filteredHomeProgressRows]
  );

  const homeProgressPageSize = 10;
  const homeProgressTotalPages = Math.max(1, Math.ceil(filteredHomeProgressRows.length / homeProgressPageSize));
  const safeHomeProgressPage = Math.min(homeProgressPage, homeProgressTotalPages);
  const paginatedHomeProgressRows = filteredHomeProgressRows.slice(
    (safeHomeProgressPage - 1) * homeProgressPageSize,
    safeHomeProgressPage * homeProgressPageSize
  );

  const formatProgressDate = (date: Date) => {
    const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
  };

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setLoading(true);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('token');

        if (!currentUser?.studentId || !token) {
          throw new Error('User is not authorized or student ID is missing.');
        }

        const studentData = await studentService.getStudent(currentUser.studentId);
        setStudent(studentData);

        const fetchedSubjects = await Promise.all(
          studentData?.subjects
            ?.map((subject: any) => (typeof subject === 'string' ? subject : subject?.id))
            .filter(Boolean)
            .map((subjectId: string) => subjectService.getSubjectById(subjectId)) || []
        );
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
    if (activeView !== 'peer-study') {
      setPeerStudyModalOpen(false);
    }
    if (activeView !== 'results') {
      setResultsTab('analytics');
    }
    setAccountMenuOpen(false);
    setMobileNavOpen(false);
  }, [activeView]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
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
    { key: 'plan', label: 'My Plan', icon: BookOpen },
    { key: 'subjects', label: 'My Subjects', icon: BookOpen },
    { key: 'assessments', label: 'Assessments', icon: FileText },
    { key: 'results', label: 'Results', icon: BarChart2 },
    { key: 'mastery-gaps', label: 'Mastery Gaps', icon: Target },
    { key: 'peer-study', label: 'Peer Study', icon: Users },
    { key: 'messages', label: 'Messages', icon: MessageCircle },
  ];

  const activeNavItemLabel = navItems.find((item) => item.key === activeView)?.label || 'Navigation';

  const setViewWithTransition = (nextView: NavItemKey, options?: { resetPlanEntry?: boolean }) => {
    if (options?.resetPlanEntry) {
      setPlanEntryStepIndex(null);
    }

    setMobileNavOpen(false);

    if (nextView === activeView) {
      return;
    }

    if (viewSwitchTimerRef.current !== null) {
      window.clearTimeout(viewSwitchTimerRef.current);
    }

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
    if (subjectId.startsWith('mock-subject-')) {
      setSelectedSubjectId('all');
    } else {
      setSelectedSubjectId(subjectId);
    }
    setActivePlan(plan);
    setPlanEntryStepIndex(typeof stepIndex === 'number' ? stepIndex : null);
    setViewWithTransition('plan');
  };

  const handleOpenTutor = (prompt?: string) => {
    if (prompt) {
      setTutorPrefill(prompt);
    }
    setViewWithTransition('tutor');
  };

  const handleOpenProfile = () => {
    setViewWithTransition('profile');
    setAccountMenuOpen(false);
  };

  const handleOpenSettings = () => {
    setViewWithTransition('profile');
    setAccountMenuOpen(false);
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <section className="relative left-1/2 w-screen -translate-x-1/2 border-y border-orange-100 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <p className="text-lg sm:text-xl font-semibold text-slate-900">You are on a {streakWeeks}-week streak. Keep going.</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2 text-slate-700">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold">{streakWeeks} week streak</span>
              </div>
              <div className="h-8 w-px bg-orange-200" />
              <div className="w-full sm:w-auto sm:min-w-[220px]">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700">Level {(Math.floor(averageProgress / 20) + 1).toString()}</span>
                  <span>{averageProgress}% progress</span>
                </div>
                <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
              My Subjects
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
                {usingMockSubjects && (
                  <div className="flex justify-end">
                    <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      Mock plans
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 xl:gap-x-10 gap-y-8 xl:gap-y-10">
                  {overviewSubjects.map(({ subject, plan }) => {
                    if (!plan) return null;

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
                            <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">{subject.name}</h3>
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
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-slate-900">My teachers</h2>
                    <p className="text-sm text-slate-500">Teachers currently assigned to your classes and subjects.</p>
                  </div>

                  {teachersLoading ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-pulse">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                          <div className="h-5 w-40 rounded bg-slate-200" />
                          <div className="h-4 w-56 rounded bg-slate-100" />
                          <div className="h-3 w-28 rounded bg-slate-100" />
                          <div className="h-3 w-32 rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : teachersError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{teachersError}</div>
                  ) : teachers.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
                      No teachers assigned yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {teachers.map((teacher) => {
                        const initials = `${teacher.firstName?.[0] || ''}${teacher.lastName?.[0] || ''}`.toUpperCase() || 'T';
                        return (
                          <article key={teacher.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900 truncate">
                                  {teacher.firstName} {teacher.lastName}
                                </h3>
                                <div className="inline-flex items-center gap-1.5 text-sm text-slate-600 mt-1 min-w-0">
                                  <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{teacher.email}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Subjects</p>
                                <p className="text-sm text-slate-700">
                                  {teacher.subjectNames.length > 0 ? teacher.subjectNames.join(', ') : 'No subject allocations yet'}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Classes</p>
                                <p className="text-sm text-slate-700">
                                  {teacher.classNames.length > 0 ? teacher.classNames.join(', ') : 'No class allocations yet'}
                                </p>
                              </div>

                              {teacher.homeroomClassNames.length > 0 && (
                                <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">
                                  <Users className="w-3.5 h-3.5" />
                                  Homeroom: {teacher.homeroomClassNames.join(', ')}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
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
          <section className="h-24 rounded-xl border border-slate-200 bg-slate-100" />
          <section className="grid grid-cols-1 lg:grid-cols-[220px_1fr] min-h-[560px] rounded-xl border border-slate-200 bg-white overflow-hidden">
            <aside className="hidden lg:block border-r border-slate-200 p-5 space-y-3">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-200 mt-5" />
              <div className="h-9 w-full rounded bg-slate-200" />
              <div className="h-9 w-full rounded bg-slate-200" />
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
          </section>
        </div>
      );
    }

    if (view === 'plan') {
      return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[640px]">
            <aside className="hidden md:block border-r border-slate-200 p-4 space-y-3">
              <div className="h-6 w-44 rounded bg-slate-200" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 w-full rounded bg-slate-100" />
              ))}
            </aside>
            <div className="p-6 space-y-4">
              <div className="h-9 w-72 rounded bg-slate-200" />
              <div className="h-28 w-full rounded bg-slate-100" />
              <div className="h-28 w-full rounded bg-slate-100" />
            </div>
          </div>
        </div>
      );
    }

    if (view === 'subjects') {
      return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] min-h-[640px]">
            <aside className="hidden xl:block border-r border-slate-200 p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 w-full rounded bg-slate-100" />
              ))}
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
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="h-6 w-56 rounded bg-slate-200" />
              <div className="h-4 w-3/4 rounded bg-slate-100" />
              <div className="h-10 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      );
    }

    if (view === 'results') {
      return (
        <div className="space-y-6 animate-pulse">
          <div className="flex gap-2">
            <div className="h-10 w-44 rounded bg-slate-200" />
            <div className="h-10 w-44 rounded bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="h-72 rounded-xl border border-slate-200 bg-white" />
        </div>
      );
    }

    if (view === 'messages') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 animate-pulse">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded bg-slate-100" />
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-slate-100" />
            ))}
          </div>
        </div>
      );
    }

    if (view === 'peer-study' || view === 'mastery-gaps' || view === 'tutor' || view === 'profile') {
      return (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-56 rounded bg-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-72 rounded-xl border border-slate-200 bg-white" />
            <div className="h-72 rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      );
    }

    return <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />;
  };

  const renderContent = () => {
    if (!student) return null;
    if (viewLoading) return renderViewSkeleton(loadingTargetView);

    switch (activeView) {
      case 'plan':
        return activePlan ? (
          <StudentPlanView plan={activePlan} initialStepIndex={planEntryStepIndex ?? undefined} />
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
            selectedSubjectId={selectedSubjectId}
            subjects={displaySubjects}
          />
        );
      case 'messages':
        return <StudentMessages studentId={student.id} />;
      case 'assessments':
        return (
          <StudentAssignments
            studentId={student.id}
            selectedSubjectId={selectedSubjectId}
            onOpenTutor={handleOpenTutor}
          />
        );
      case 'results':
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setResultsTab('analytics')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  resultsTab === 'analytics'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Performance Analytics
              </button>
              <button
                type="button"
                onClick={() => setResultsTab('results')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  resultsTab === 'results'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Assessment Results
              </button>
            </div>
            {resultsTab === 'analytics' ? (
              <StudentStats student={student} selectedSubjectId={selectedSubjectId} />
            ) : (
              <StudentResults
                studentId={student.id}
                selectedSubjectId={selectedSubjectId}
                onOpenTutor={handleOpenTutor}
              />
            )}
          </div>
        );
      case 'tutor':
        return (
          <StudentTutor
            studentId={student.id}
            selectedSubjectId={selectedSubjectId}
            subjects={subjects}
            activePlan={activePlan}
            prefillMessage={tutorPrefill}
            onPrefillApplied={() => setTutorPrefill('')}
          />
        );
      case 'peer-study':
        return (
          <StudentPeerStudy
            selectedSubjectId={selectedSubjectId}
            subjects={subjects}
            isCreateOpen={peerStudyModalOpen}
            onCloseCreate={() => setPeerStudyModalOpen(false)}
          />
        );
      case 'mastery-gaps':
        return (
          <StudentMasteryGaps
            selectedSubjectId={selectedSubjectId}
            subjects={subjects}
            activePlan={activePlan}
            onOpenTutor={handleOpenTutor}
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

            <div className="flex items-center justify-end">
              <div
                ref={accountMenuRef}
                className="relative z-50"
              >
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
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
                <div className="flex items-center gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap pr-2">
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNavChange(key)}
                      className={`group relative inline-flex items-center gap-2 py-3 text-sm transition ${
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

      <main className="w-full bg-white py-6">
        <div className="max-w-[1400px] mx-auto px-4">
          {activeView === 'peer-study' && (
            <header className="mb-6">
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPeerStudyModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create collaboration request
                </button>
              </div>
            </header>
          )}

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
