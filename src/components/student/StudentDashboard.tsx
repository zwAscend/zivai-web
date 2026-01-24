import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Target,
  TrendingUp,
  Calendar,
  MessageCircle,
  LogOut,
  ChevronRight,
  BarChart2,
  FileText,
} from 'lucide-react';
import { Student, DevelopmentPlan, Course } from '../../types';
import { studentService, developmentService, courseService } from '../../services/api';
import StudentPlanView from './StudentPlanView';
import StudentStats from './StudentStats';
import StudentMessages from './StudentMessages';
import StudentAssignments from './StudentAssignments';
import StudentResults from './StudentResults';

// ---------------------------------------------------------------- //
// A new type and a mock service for Course, as it's not in api.ts
// In a real app, this would be in your services/api.ts
// type Course = {
//   _id: string;
//   name: string;
//   // ... other course properties
// };

// The original mock `courseService` is removed as we now use the one from api.ts.
// The `getCourse` method is not needed as `studentData.courses` is an array of course objects,
// not just IDs, as per the typical structure of a populated Mongoose object from a REST API.
// ---------------------------------------------------------------- //

type NavItemKey = 'overview' | 'plan' | 'stats' | 'messages' | 'assignments' | 'results';

const StatCard = ({ icon: Icon, title, value, color, change }) => (
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
      <div className="h-10 bg-slate-200 rounded mb-8 animate-pulse"></div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-200 rounded animate-pulse"></div>
        ))}
      </div>
      <div className="absolute bottom-4 w-56">
        <div className="h-12 bg-slate-200 rounded animate-pulse"></div>
      </div>
    </div>
    <div className="flex-1 p-8">
      <div className="h-12 bg-slate-200 rounded mb-8 w-1/3 animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-white rounded-2xl p-6 animate-pulse">
            <div className="h-6 w-1/2 bg-slate-200 rounded mb-4"></div>
            <div className="h-10 w-1/3 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
      <div className="h-64 bg-white rounded-2xl p-6 animate-pulse">
        <div className="h-8 w-1/4 bg-slate-200 rounded mb-6"></div>
        <div className="h-10 w-full bg-slate-200 rounded mb-4"></div>
        <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
      </div>
    </div>
  </div>
);

const StudentDashboard: React.FC = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [activePlan, setActivePlan] = useState<DevelopmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavItemKey>('overview');

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

        // Fetch course data for each course ID using a more efficient method if possible
        const fetchedCourses = await Promise.all(
          studentData?.courses?.map(courseId => courseService.getCourseById(courseId)) || []
        );
        setCourses(fetchedCourses);
        console.log("this is all the courses", fetchedCourses);

        if (studentData?._id) {
          try {
            const plans = await developmentService.getAllPlansForStudent(studentData._id, 'Active');
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

  const handleLogout = () => {
    console.log('🔒 Logout initiated by student.');
    localStorage.clear();
    window.location.href = '/login';
  };

  const navItems = [
    { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'plan', label: 'My Plan', icon: BookOpen },
    { key: 'assignments', label: 'Assignments', icon: FileText },
    { key: 'results', label: 'Results', icon: BarChart2 },
    { key: 'stats', label: 'Statistics', icon: BarChart2 },
    { key: 'messages', label: 'Messages', icon: MessageCircle },
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

    switch (activeView) {
      case 'plan':
        return activePlan ? (
          <StudentPlanView plan={activePlan} student={student} />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center animate-fadeIn">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Active Plan</h3>
            <p className="text-slate-500">You don't have an active development plan assigned yet.</p>
          </div>
        );
      case 'stats':
        return <StudentStats student={student} selectedCourseId={selectedCourseId} />;
      case 'messages':
        return <StudentMessages studentId={student.id} />;
      case 'assignments':
        return <StudentAssignments studentId={student.id} selectedCourseId={selectedCourseId} />;
      case 'results':
        return <StudentResults studentId={student.id} selectedCourseId={selectedCourseId} />;
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
                          className="bg-indigo-600 h-3 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${activePlan.currentProgress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-lg font-bold text-indigo-600">{activePlan.currentProgress}%</span>
                    </div>
                    <button
                      onClick={() => setActiveView('plan')}
                      className="mt-6 inline-flex items-center text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
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
          <button onClick={handleLogout} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white shadow-md flex-shrink-0 flex flex-col">
        <div className="p-6 text-2xl font-bold text-indigo-600 border-b border-slate-200">
          Student Portal
        </div>
        <nav className="flex-grow p-4">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={`w-full flex items-center px-4 py-3 my-1 rounded-lg text-left font-semibold transition-all duration-200 ${
                activeView === key
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-lg text-slate-600 font-semibold bg-slate-100 hover:bg-red-100 hover:text-red-700 transition-colors duration-200"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-slate-800">
                Welcome back, {student.firstName}!
              </h1>
              <p className="text-slate-500 mt-1">Here's your academic and development snapshot.</p>
            </div>
            {/* Course Selection Dropdown */}
            {courses.length > 0 && (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="all">All Courses</option>
                {courses.map(course => (
                  <option key={course._id} value={course._id}>
                    {`${course.code}: ${course.name}`}
                  </option>
                ))}
              </select>
            )}
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