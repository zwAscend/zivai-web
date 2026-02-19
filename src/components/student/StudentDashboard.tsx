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
} from 'lucide-react';
import { Student, DevelopmentPlan, Subject, StepType } from '../../types';
import { studentService, developmentService, subjectService } from '../../services/api';
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
  <div className="min-h-screen bg-slate-100 p-6 space-y-4">
    <div className="h-16 bg-blue-100 rounded-2xl animate-pulse" />
    <div className="h-12 bg-blue-50 rounded-xl animate-pulse" />
    <div className="h-[480px] bg-white rounded-2xl border border-slate-200 animate-pulse" />
  </div>
);

const StudentDashboard: React.FC = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectPlans, setSubjectPlans] = useState<DevelopmentPlan[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [activePlan, setActivePlan] = useState<DevelopmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavItemKey>('overview');
  const [tutorPrefill, setTutorPrefill] = useState<string>('');
  const [peerStudyModalOpen, setPeerStudyModalOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<'analytics' | 'results'>('analytics');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (activeView !== 'peer-study') {
      setPeerStudyModalOpen(false);
    }
    if (activeView !== 'results') {
      setResultsTab('analytics');
    }
    setAccountMenuOpen(false);
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

  const openPlan = (subjectId: string, plan: DevelopmentPlan) => {
    if (subjectId.startsWith('mock-subject-')) {
      setSelectedSubjectId('all');
    } else {
      setSelectedSubjectId(subjectId);
    }
    setActivePlan(plan);
    setActiveView('plan');
  };

  const handleOpenTutor = (prompt?: string) => {
    if (prompt) {
      setTutorPrefill(prompt);
    }
    setActiveView('tutor');
  };

  const handleOpenProfile = () => {
    setActiveView('profile');
    setAccountMenuOpen(false);
  };

  const handleOpenSettings = () => {
    setActiveView('profile');
    setAccountMenuOpen(false);
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <section className="bg-white px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <p className="text-xl font-semibold text-slate-900">You are on a {streakWeeks}-week streak. Keep going.</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-2 text-slate-700">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold">{streakWeeks} week streak</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="min-w-[220px]">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">Level {(Math.floor(averageProgress / 20) + 1).toString()}</span>
                <span>{averageProgress}% progress</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] min-h-[640px]">
          <aside className="border-r border-slate-200 p-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">My Stuff</p>
            <button className="w-full mt-3 text-left rounded-md bg-blue-50 text-blue-700 font-semibold px-4 py-2.5 text-sm">
              My Subjects
            </button>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-7">My Account</p>
            <div className="mt-3 space-y-1.5">
              <button className="w-full text-left rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Progress</button>
              <button className="w-full text-left rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Profile</button>
              <button className="w-full text-left rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Teachers</button>
            </div>
          </aside>

          <div className="p-6 space-y-8">
            {usingMockSubjects && (
              <div className="flex justify-end">
                <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  Mock plans
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-x-10 gap-y-10">
              {overviewSubjects.map(({ subject, plan }) => {
                if (!plan) return null;

                const sortedSteps = (plan.plan.steps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
                const totalSteps = sortedSteps.length;
                const safeProgress = Math.max(0, Math.min(100, plan.currentProgress));
                const completedSteps = Math.floor((safeProgress / 100) * (totalSteps || 1));
                const currentStepIndex = Math.min(completedSteps, Math.max(totalSteps - 1, 0));
                const planAction = safeProgress > 0 ? 'Resume plan' : 'Start plan';
                const visibleSteps = sortedSteps.slice(0, 4);
                const visibleStepCount = visibleSteps.length;
                const completedVisibleSteps = Math.min(completedSteps, visibleStepCount);
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
                  <article key={subject.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold text-slate-900">{subject.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPlan(subject.id, plan)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {safeProgress > 0 ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {planAction}
                      </button>
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
                        const isCurrent = !isCompleted && index === currentStepIndex;

                        return (
                          <div key={`${subject.id}-${step.title}-${index}`} className="flex items-start gap-3 py-0.5">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                                isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700'
                              }`}>
                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : getStepIcon(step.type)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{step.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                  {isCompleted ? 'Completed' : isCurrent ? 'In progress' : 'Not started'} • {step.type}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : isCurrent
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                              } shrink-0 mt-0.5`}
                            >
                              {isCompleted ? 'Completed' : isCurrent ? 'In progress' : 'Pending'}
                            </span>
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
          </div>
        </div>
      </section>
    </div>
  );

  const renderContent = () => {
    if (!student) return null;

    switch (activeView) {
      case 'plan':
        return activePlan ? (
          <StudentPlanView plan={activePlan} />
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
            student={student}
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
            <div className="flex items-center gap-3 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap pr-2">
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveView(key)}
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
                <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shrink-0 ml-auto relative z-0">
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
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
