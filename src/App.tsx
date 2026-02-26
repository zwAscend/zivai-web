import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './components/home/Dashboard';
import Inbox from './components/staffroom/Inbox';
import CalendarView from './components/calendar/CalendarView';
import ClassroomView from './components/classroom/ClassroomView';
import ClassroomSubjectsPage from './pages/ClassroomSubjectsPage';
import ResourcesDashboard from './components/resources/ResourcesDashboard';
import ReportOverviewPage from './pages/ReportOverviewPage';
import ReportSubmissionsPage from './pages/ReportSubmissionsPage';
import ReportCurriculumPage from './pages/ReportCurriculumPage';
import ReportTermForecastPage from './pages/ReportTermForecastPage';
import ReportForecastAnalyticsPage from './pages/ReportForecastAnalyticsPage';
import Login from './components/pages/Login';
import MainLayout from './components/layout/MainLayout';
import StudentDashboard from './components/student/StudentDashboard';
import NotFound from './components/pages/NotFound';
import DevelopmentPage from './pages/DevelopmentPage';
import DevelopmentOverviewPage from './pages/DevelopmentOverviewPage';
import DevelopmentPlansPage from './pages/DevelopmentPlansPage';
import DevelopmentReteachPage from './pages/DevelopmentReteachPage';
import DevelopmentPracticePage from './pages/DevelopmentPracticePage';
import DevelopmentReteachDetailPage from './pages/DevelopmentReteachDetailPage';
import PerformancePage from './pages/PerformancePage';
import PerformanceOverviewPage from './pages/PerformanceOverviewPage';
import StudentDirectoryPage from './pages/StudentDirectoryPage';
import StudentProfilePage from './pages/StudentProfilePage';
import AssessmentsDashboardPage from './pages/AssessmentsDashboardPage';
import MarkAssessmentPage from './pages/MarkAssessmentPage';
import CreateAssessmentPage from './pages/CreateAssessmentPage';
import AssessmentAnalysisPage from './pages/AssessmentAnalysisPage';
import AssessmentDetailPage from './pages/AssessmentDetailPage';
import StudentAnalysisPage from './pages/StudentAnalysisPage';
import AdminUsersPage from './components/admin/pages/AdminUsersPage';
import AdminDashboardPage from './components/admin/pages/AdminDashboardPage';
import AdminSubjectsPage from './components/admin/pages/AdminSubjectsPage';
import AdminClassesPage from './components/admin/pages/AdminClassesPage';
import AdminEdgeNodesPage from './components/admin/pages/AdminEdgeNodesPage';
import AdminCurriculumPage from './components/admin/pages/AdminCurriculumPage';
import AdminTermForecastsPage from './components/admin/pages/AdminTermForecastsPage';
import { authService } from './services/authService';
import { isSessionAuthenticated } from './services/authSession';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(isSessionAuthenticated());
  const navigate = useNavigate();
  const location = useLocation();

  const user = authService.getCurrentUser();
  const isAdmin = !!user?.isAdmin || user?.role === 'admin';
  const isTeacher = !!user?.isTeacher || user?.role === 'teacher';
  const isStudent = user?.role === 'student' && !!user?.studentId;
  const studentDashboardElement = isAuthenticated && isStudent ? <StudentDashboard /> : <Navigate to="/login" replace />;

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(isSessionAuthenticated());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    setIsAuthenticated(isSessionAuthenticated());
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    const normalized = location.pathname.replace(/^\//, '');
    if (normalized) {
      setActiveTab(normalized);
    }
  }, [location.pathname]);

  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              isAdmin ? (
                <Navigate to="/admin/dashboard" replace />
              ) : isTeacher ? (
                <Navigate to="/dashboard" replace />
              ) : isStudent ? (
                <Navigate to="/student/home" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
                <Login
                  onLogin={() => {
                  setIsAuthenticated(isSessionAuthenticated());
                  const current = authService.getCurrentUser();
                  const currentIsAdmin = !!current?.isAdmin || current?.role === 'admin';
                  const currentIsTeacher = !!current?.isTeacher || current?.role === 'teacher';
                  const currentIsStudent = current?.role === 'student' && !!current?.studentId;

                  if (currentIsAdmin) {
                    navigate('/admin/dashboard', { replace: true });
                  } else if (currentIsTeacher) {
                    navigate('/dashboard', { replace: true });
                  } else if (currentIsStudent) {
                    navigate('/student/home', { replace: true });
                  } else {
                    navigate('/dashboard', { replace: true });
                  }
                }}
              />
            )
          }
        />

        <Route path="/student" element={<Navigate to="/student/home" replace />} />
        <Route path="/student/home" element={studentDashboardElement} />
        <Route path="/student/my-plans" element={studentDashboardElement} />
        <Route path="/student/my-subjects" element={studentDashboardElement} />
        <Route path="/student/assessments" element={studentDashboardElement} />
        <Route path="/student/my-report" element={studentDashboardElement} />
        <Route path="/student/peer-study" element={studentDashboardElement} />
        <Route path="/student/profile" element={studentDashboardElement} />
        <Route path="/student/ai-coach" element={studentDashboardElement} />
        <Route path="/student/dashboard" element={<Navigate to="/student/home" replace />} />

        {isAuthenticated && !isAdmin && (
          <Route path="/" element={<MainLayout activeTab={activeTab} setActiveTab={setActiveTab} portalType="teacher" />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staffroom" element={<Inbox />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="classroom" element={<ClassroomView />} />
            <Route path="subjects-workspace" element={<ClassroomSubjectsPage />} />
            <Route path="classroom/subjects" element={<Navigate to="/subjects-workspace" replace />} />
            <Route path="students" element={<StudentDirectoryPage />} />
            <Route path="students/profile" element={<StudentProfilePage />} />
            <Route path="assessments" element={<Navigate to="/assessments/create" replace />} />
            <Route path="assessments/view" element={<AssessmentsDashboardPage />} />
            <Route path="assessments/create" element={<CreateAssessmentPage />} />
            <Route path="assessments/mark" element={<MarkAssessmentPage />} />
            <Route path="assessments/analysis" element={<AssessmentAnalysisPage />} />
            <Route path="assessments/view/:id" element={<AssessmentDetailPage />} />
            <Route path="assessments/student-analysis" element={<StudentAnalysisPage />} />
            <Route path="performance" element={<Navigate to="/performance/overview" replace />} />
            <Route path="performance/overview" element={<PerformanceOverviewPage />} />
            <Route path="performance/student" element={<PerformancePage />} />
            <Route path="development" element={<Navigate to="/development/profile" replace />} />
            <Route path="development/profile" element={<DevelopmentOverviewPage />} />
            <Route path="development/plans" element={<DevelopmentPlansPage />} />
            <Route path="development/reteach" element={<DevelopmentReteachPage />} />
            <Route path="development/reteach/:id" element={<DevelopmentReteachDetailPage />} />
            <Route path="development/practice" element={<DevelopmentPracticePage />} />
            <Route path="development/:studentId" element={<DevelopmentPage />} />
            <Route path="resources" element={<ResourcesDashboard />} />
            <Route path="reports" element={<Navigate to="/reports/class" replace />} />
            <Route path="reports/class" element={<ReportOverviewPage />} />
            <Route path="reports/student" element={<ReportSubmissionsPage />} />
            <Route path="reports/curriculum" element={<ReportCurriculumPage />} />
            <Route path="reports/term" element={<ReportTermForecastPage />} />
            <Route path="reports/analytics" element={<ReportForecastAnalyticsPage />} />
            <Route path="grading" element={<Navigate to="/reports/class" replace />} />
            <Route path="grading/class" element={<Navigate to="/reports/class" replace />} />
            <Route path="grading/student" element={<Navigate to="/reports/student" replace />} />
            <Route path="grading/curriculum" element={<Navigate to="/reports/curriculum" replace />} />
            <Route path="grading/term" element={<Navigate to="/reports/term" replace />} />
            <Route path="grading/analytics" element={<Navigate to="/reports/analytics" replace />} />
          </Route>
        )}

        {isAuthenticated && isAdmin && (
          <>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin" element={<MainLayout activeTab={activeTab} setActiveTab={setActiveTab} portalType="admin" />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="subjects" element={<AdminSubjectsPage />} />
              <Route path="curriculum" element={<AdminCurriculumPage />} />
              <Route path="term-forecasts" element={<AdminTermForecastsPage />} />
              <Route path="classes" element={<AdminClassesPage />} />
              <Route path="edge-nodes" element={<AdminEdgeNodesPage />} />
            </Route>
          </>
        )}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
