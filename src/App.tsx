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

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              (() => {
                const userStr = localStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : null;
                const isAdmin = user?.isAdmin ?? false;
                const isTeacher = user?.isTeacher ?? false;
                const isStudent = user?.role === 'student' && !!user?.studentId;

                if (isAdmin || isTeacher) {
                  return <Navigate to="/dashboard" replace />;
                } else if (isStudent) {
                  return <Navigate to="/student/dashboard" replace />;
                } else {
                  // Default to main dashboard for users without a linked student profile
                  return <Navigate to="/dashboard" replace />;
                }
              })()
            ) : (
              <Login onLogin={() => {
                setIsAuthenticated(true);
                const userStr = localStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : null;
                const isAdmin = user?.isAdmin ?? false;
                const isTeacher = user?.isTeacher ?? false;
                const isStudent = user?.role === 'student' && !!user?.studentId;

                if (isAdmin || isTeacher) {
                  navigate('/dashboard', { replace: true });
                } else if (isStudent) {
                  navigate('/student/dashboard', { replace: true });
                } else {
                  navigate('/dashboard', { replace: true });
                }
              }} />
            )
          }
        />

        <Route
          path="/student/dashboard"
          element={
            isAuthenticated ? (
              <StudentDashboard />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {isAuthenticated && (
          <Route
            path="/"
            element={<MainLayout activeTab={activeTab} setActiveTab={setActiveTab} />}
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staffroom" element={<Inbox />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="classroom" element={<ClassroomView />} />
            <Route path="development/:studentId" element={<DevelopmentPage />} />
            <Route path="resources" element={<ResourcesDashboard />} />
            <Route path="grading" element={<GradingDashboard />} />
          </Route>
        )}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;