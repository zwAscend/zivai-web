import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Target,
  TrendingUp,
  Calendar,
  MessageCircle,
  LogOut,
  ChevronRight,
  Menu,
  BarChart2,
  FileText,
  Sparkles,
  Users,
  User,
} from 'lucide-react';
import { Student, DevelopmentPlan, Subject } from '../../types';
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

// ---------------------------------------------------------------- //
// A new type and a mock service for Subject, as it's not in api.ts
// In a real app, this would be in your services/api.ts
// type Subject = {
//   id: string;
//   name: string;
//   // ... other subject properties
// };

// The original mock `subjectService` is removed as we now use the one from api.ts.
// The `getSubject` method is not needed as `studentData.subjects` is an array of subject objects,
// not just IDs, as per the typical structure of a populated Mongoose object from a REST API.
// ---------------------------------------------------------------- //

type NavItemKey =
  | 'overview'
  | 'plan'
  | 'messages'
  | 'assessments'
  | 'results'
  | 'tutor'
  | 'peer-study'
  | 'mastery-gaps'
  | 'profile';

type StatCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: React.ReactNode;
  color: string;
  change?: string;
};

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, color, change }) => (
  <motion.div
    className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between"
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-md font-medium text-slate-500">{title}</h3>
      <div className={`w-10 h-10 flex items-center justify-center rounded-full ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      {change && <p className="text-sm text-slate-500 mt-1">{change}</p>}
    </div>
  </motion.div>
);

const DashboardSkeleton = () => (
  <div className="flex">
    <div className="w-64 bg-white h-screen p-4">
      <div className="h-10 bg-blue-50 rounded mb-8 animate-pulse"></div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-blue-50 rounded animate-pulse"></div>
        ))}
      </div>
      <div className="absolute bottom-4 w-56">
        <div className="h-12 bg-blue-50 rounded animate-pulse"></div>
      </div>
    </div>
    <div className="flex-1 p-8">
      <div className="h-12 bg-blue-100 rounded mb-8 w-1/3 animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-blue-50 rounded-2xl p-6 animate-pulse">
            <div className="h-6 w-1/2 bg-blue-100 rounded mb-4"></div>
            <div className="h-10 w-1/3 bg-blue-100 rounded"></div>
          </div>
        ))}
      </div>
      <div className="h-64 bg-blue-50 rounded-2xl p-6 animate-pulse">
        <div className="h-8 w-1/4 bg-blue-100 rounded mb-6"></div>
        <div className="h-10 w-full bg-blue-100 rounded mb-4"></div>
        <div className="h-4 w-3/4 bg-blue-100 rounded"></div>
      </div>
    </div>
  </div>
);

const StudentDashboard: React.FC = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [activePlan, setActivePlan] = useState<DevelopmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavItemKey>('overview');
  const [tutorPrefill, setTutorPrefill] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [peerStudyModalOpen, setPeerStudyModalOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<'analytics' | 'results'>('analytics');
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
  }, [student, avatarGradients]);

  const viewMeta = useMemo(() => {
    switch (activeView) {
      case 'plan':
        return { title: 'My Development Plan', subtitle: 'Guided practice and reasoning checkpoints for each step.' };
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
        return { title: `Welcome back, ${student?.firstName || ''}!`, subtitle: "Here's your academic and development snapshot." };
    }
  }, [activeView, student?.firstName]);

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
        console.log("this is all the student data", studentData);

        // Fetch subject data for each subject ID using a more efficient method if possible
        const fetchedSubjects = await Promise.all(
          studentData?.subjects
            ?.map(subject => typeof subject === 'string' ? subject : subject?.id)
            .filter(Boolean)
            .map(subjectId => subjectService.getSubjectById(subjectId)) || []
        );
        setSubjects(fetchedSubjects);
        console.log("this is all the subjects", fetchedSubjects);

        const studentId = studentData?.id;
        if (studentId) {
          try {
            const plans = await developmentService.getAllPlansForStudent(studentId, 'Active');
            if (plans.length > 0) setActivePlan(plans[0]);
          } catch {
            console.warn('No active development plan found for this student.');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load student data');
        console.error("Data fetch error:", err);
      } finally {
        setTimeout(() => setLoading(false), 1000);
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
  }, [activeView]);

  const handleLogout = () => {
    console.log('🔒 Logout initiated by student.');
    localStorage.clear();
    window.location.href = '/login';
  };

  const navItems: Array<{ key: NavItemKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'plan', label: 'My Plan', icon: BookOpen },
    { key: 'assessments', label: 'Assessments', icon: FileText },
    { key: 'results', label: 'Results & Analytics', icon: BarChart2 },
    { key: 'mastery-gaps', label: 'Mastery Gaps', icon: Target },
    { key: 'peer-study', label: 'Peer Study', icon: Users },
    { key: 'tutor', label: 'AI Tutor', icon: Sparkles },
    { key: 'messages', label: 'Messages', icon: MessageCircle },
    { key: 'profile', label: 'Profile', icon: User },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const renderContent = () => {
    if (!student) return null;

    const handleOpenTutor = (prompt?: string) => {
      if (prompt) {
        setTutorPrefill(prompt);
      }
      setActiveView('tutor');
    };

    switch (activeView) {
      case 'plan':
        return activePlan ? (
          <StudentPlanView plan={activePlan} student={student} onOpenTutor={handleOpenTutor} />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center animate-fadeIn">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Active Plan</h3>
            <p className="text-slate-500">You don't have an active development plan assigned yet.</p>
          </div>
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
        return (
          <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard icon={TrendingUp} title="Performance" value={student.performance} color="bg-green-500" change={undefined} />
              <StatCard icon={Target} title="Key Strength" value={student.strength} color="bg-sky-500" change={undefined} />
              <StatCard icon={Calendar} title="Engagement" value={student.engagement} color="bg-amber-500" change={undefined} />
            </div>

            {/* Development Plan & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Current Plan Preview */}
              <motion.div
                className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-8 hover:shadow-lg transition-shadow duration-300"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              >
                {activePlan ? (
                  <>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Current Development Plan</h2>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-slate-700">{activePlan.plan.name}</h3>
                      <p className="text-sm text-slate-500">Target: {activePlan.plan.potentialOverall}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <motion.div
                          className="bg-blue-600 h-3 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${activePlan.currentProgress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-lg font-bold text-blue-600">{activePlan.currentProgress}%</span>
                    </div>
                    <button
                      onClick={() => setActiveView('plan')}
                      className="mt-6 inline-flex items-center text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                    >
                      View Full Plan <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Active Plan</h3>
                    <p className="text-slate-500">Your development plan will appear here once assigned.</p>
                  </div>
                )}
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                className="bg-white rounded-2xl shadow-sm p-8"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              >
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Recent Activity</h2>
                <div className="space-y-5">
                  <div className="flex items-start">
                    <div className="w-8 h-8 flex-shrink-0 bg-sky-100 rounded-full flex items-center justify-center mr-4">
                      <BookOpen className="w-4 h-4 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Completed Lab Exercise</p>
                      <p className="text-sm text-slate-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-8 h-8 flex-shrink-0 bg-green-100 rounded-full flex items-center justify-center mr-4">
                      <Target className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Skill Improvement</p>
                      <p className="text-sm text-slate-500">1 day ago</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        );
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
    <div className="h-screen bg-slate-100 flex overflow-hidden">
      {/* Sidebar Navigation */}
      <aside
        className={`bg-white shadow-md flex-shrink-0 flex flex-col h-screen sticky top-0 transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`p-6 border-b border-slate-200 ${sidebarCollapsed ? 'px-4' : ''}`}>
          <div className="flex items-start justify-between">
            {!sidebarCollapsed && (
              <div className="text-2xl font-bold text-blue-600">Student Portal</div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
          <div className={`mt-4 flex items-center gap-3 ${sidebarCollapsed ? 'flex-col' : ''}`}>
            <div
              className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold transition-colors ${
                student.avatar
                  ? 'bg-slate-100 border border-slate-200 text-slate-600'
                  : `bg-gradient-to-br ${avatarGradient} text-white shadow-sm`
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
            {!sidebarCollapsed && (
              <div className="text-sm">
                <p className="font-semibold text-slate-800">
                  {student.firstName} {student.lastName}
                </p>
              </div>
            )}
          </div>
        </div>
        <nav className={`flex-grow p-4 ${sidebarCollapsed ? 'px-2' : ''}`}>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              title={sidebarCollapsed ? label : undefined}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center px-2' : 'px-4'
              } py-3 my-1 rounded-lg text-left font-semibold transition-all duration-200 ${
                activeView === key
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'px-4'
            } py-3 rounded-lg text-slate-600 font-semibold bg-slate-100 hover:bg-red-100 hover:text-red-700 transition-colors duration-200`}
          >
            <LogOut className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
            {!sidebarCollapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className={`${activeView === 'overview' ? 'text-3xl' : 'text-2xl'} font-bold text-slate-900`}>
                    {viewMeta.title}
                  </h1>
                  <p className="text-slate-500 mt-1">{viewMeta.subtitle}</p>
                </div>
              </div>
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {activeView === 'peer-study' && (
                  <button
                    type="button"
                    onClick={() => setPeerStudyModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Create collaboration request
                  </button>
                )}
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Subject</span>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none min-w-[170px]"
                  >
                    <option value="all">All Subjects</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {`${subject.code}: ${subject.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default StudentDashboard;
