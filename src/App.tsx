import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './components/home/Dashboard';
import Inbox from './components/staffroom/Inbox';
import CalendarView from './components/calendar/CalendarView';
import ClassroomView from './components/classroom/ClassroomView';
import ResourcesDashboard from './components/resources/ResourcesDashboard';
import GradingDashboard from './components/teacher/GradingDashboard';
import Login from './components/pages/Login';
import MainLayout from './components/layout/MainLayout';
import StudentDashboard from './components/student/StudentDashboard';
import NotFound from './components/pages/NotFound';
import DevelopmentPage from './pages/DevelopmentPage';
import DevelopmentOverviewPage from './pages/DevelopmentOverviewPage';
import PerformancePage from './pages/PerformancePage';
import AdminUsersPage from './components/admin/pages/AdminUsersPage';
import AdminDashboardPage from './components/admin/pages/AdminDashboardPage';
import AdminSubjectsPage from './components/admin/pages/AdminSubjectsPage';
import AdminClassesPage from './components/admin/pages/AdminClassesPage';
import AdminEdgeNodesPage from './components/admin/pages/AdminEdgeNodesPage';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();
  const location = useLocation();

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = !!user?.isAdmin || user?.role === 'admin';
  const isTeacher = !!user?.isTeacher || user?.role === 'teacher';
  const isStudent = user?.role === 'student' && !!user?.studentId;

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
                <Navigate to="/student/dashboard" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Login
                onLogin={() => {
                  setIsAuthenticated(true);
                  const latest = localStorage.getItem('user');
                  const current = latest ? JSON.parse(latest) : null;
                  const currentIsAdmin = !!current?.isAdmin || current?.role === 'admin';
                  const currentIsTeacher = !!current?.isTeacher || current?.role === 'teacher';
                  const currentIsStudent = current?.role === 'student' && !!current?.studentId;

                  if (currentIsAdmin) {
                    navigate('/admin/dashboard', { replace: true });
                  } else if (currentIsTeacher) {
                    navigate('/dashboard', { replace: true });
                  } else if (currentIsStudent) {
                    navigate('/student/dashboard', { replace: true });
                  } else {
                    navigate('/dashboard', { replace: true });
                  }
                }}
              />
            )
          }
        />

        <Route
          path="/student/dashboard"
          element={isAuthenticated && isStudent ? <StudentDashboard /> : <Navigate to="/login" replace />}
        />

        {isAuthenticated && !isAdmin && (
          <Route path="/" element={<MainLayout activeTab={activeTab} setActiveTab={setActiveTab} portalType="teacher" />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staffroom" element={<Inbox />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="classroom" element={<ClassroomView />} />
            <Route path="performance" element={<PerformancePage />} />
            <Route path="development" element={<DevelopmentOverviewPage />} />
            <Route path="development/:studentId" element={<DevelopmentPage />} />
            <Route path="resources" element={<ResourcesDashboard />} />
            <Route path="grading" element={<GradingDashboard />} />
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
