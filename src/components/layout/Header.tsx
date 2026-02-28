import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Mail, Calendar, LogOut, ChevronDown, Bell, Shield, Users, BookOpen, GraduationCap, Cpu, TrendingUp, Target, FileText } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { authService, notificationService, studentService, subjectService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import NotificationCenter from '../teacher/NotificationCenter';
import { Student } from '../../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portalType?: 'teacher' | 'admin';
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface NavLink {
  name: string;
  path: string;
  key: string;
  icon:
    | 'home'
    | 'grid'
    | 'mail'
    | 'calendar'
    | 'shield'
    | 'users'
    | 'subject'
    | 'class'
    | 'edge'
    | 'performance'
    | 'resources'
    | 'report'
    | 'development'
    | 'students'
    | 'assessment'
    | 'curriculum'
    | 'forecast';
}

interface GradeCategory {
  name: string;
  count: number;
  minScore: number;
  color: string;
}

interface ClassSummary {
  totalStudents: number;
  categories: GradeCategory[];
}

const Header: React.FC<HeaderProps> = ({ activeTab: _activeTab, setActiveTab, portalType = 'teacher' }) => {
  const currentUser = authService.getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { selectedSubject, setSelectedSubject } = useAuth();
  const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [classSummary, setClassSummary] = useState<ClassSummary>({ totalStudents: 0, categories: [] });
  const subjectMenuRef = useRef<HTMLDivElement | null>(null);

  const isTeacherPortal = portalType === 'teacher';
  const pieData: GradeCategory[] =
    classSummary.totalStudents > 0
      ? classSummary.categories
      : [{ name: 'No data', count: 1, minScore: 0, color: '#1d4ed8' }];

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await notificationService.getUnreadCount();
        setUnreadCount(typeof count === 'number' ? count : 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isTeacherPortal) return;

    const fetchSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        const items = Array.isArray(data) ? data as Subject[] : [];
        setSubjects(items);
        if (!selectedSubject && items.length > 0) {
          const computerScience = items.find((subject) => {
            const code = (subject.code || '').toLowerCase();
            const name = (subject.name || '').toLowerCase();
            return code === 'cs' || code === 'comp' || code === 'csc' || name.includes('computer science');
          });
          setSelectedSubject(computerScience || items[0]);
        }
      } catch (error) {
        console.error('Error fetching subjects:', error);
      }
    };

    fetchSubjects();
  }, [isTeacherPortal, selectedSubject, setSelectedSubject]);

  useEffect(() => {
    if (!isTeacherPortal) return;

    const fetchStudents = async () => {
      try {
        const subjectId = selectedSubject?.id;
        const studentsData = await studentService.getStudents(subjectId);
        const summary = calculateGradeDistribution(studentsData || []);
        setClassSummary(summary);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };

    fetchStudents();
    const interval = setInterval(fetchStudents, 30000);
    return () => clearInterval(interval);
  }, [isTeacherPortal, selectedSubject?.id]);

  useEffect(() => {
    if (!isSubjectMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (subjectMenuRef.current?.contains(target)) return;
      setIsSubjectMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSubjectMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isSubjectMenuOpen]);

  const calculateGradeDistribution = (students: Student[]): ClassSummary => {
    const gradeRanges = [
      { name: 'A', minScore: 75, maxScore: 100, count: 0, color: '#22c55e' },
      { name: 'B', minScore: 65, maxScore: 74, count: 0, color: '#3b82f6' },
      { name: 'C', minScore: 55, maxScore: 64, count: 0, color: '#eab308' },
      { name: 'D', minScore: 40, maxScore: 54, count: 0, color: '#f97316' },
      { name: 'F', minScore: 0, maxScore: 39, count: 0, color: '#ef4444' },
    ];

    students.forEach((student) => {
      const overall = student.overall || 0;
      const gradeRange = gradeRanges.find((r) => overall >= r.minScore && overall <= r.maxScore);
      if (gradeRange) gradeRange.count += 1;
    });

    return {
      totalStudents: students.length,
      categories: gradeRanges.map(({ name, count, minScore, color }) => ({ name, count, minScore, color })),
    };
  };

  const navLinks: NavLink[] = isTeacherPortal
    ? [
        { name: 'Home', path: '/dashboard', key: 'dashboard', icon: 'home' },
        { name: 'Classroom', path: '/classroom', key: 'classroom', icon: 'grid' },
        { name: 'Workspace', path: '/subjects-workspace', key: 'subjects-workspace', icon: 'subject' },
        { name: 'Resources', path: '/resources', key: 'resources', icon: 'resources' },
        { name: 'Assessments', path: '/assessments/create', key: 'assessments', icon: 'assessment' },
        { name: 'Development', path: '/development/profile', key: 'development', icon: 'development' },
        { name: 'Performance', path: '/performance', key: 'performance', icon: 'performance' },
        { name: 'Report', path: '/reports', key: 'reports', icon: 'report' },
        { name: 'Chat', path: '/staffroom', key: 'staffroom', icon: 'mail' },
        { name: 'Calendar', path: '/calendar', key: 'calendar', icon: 'calendar' },
      ]
    : [
        { name: 'Admin Home', path: '/admin/dashboard', key: 'admin/dashboard', icon: 'shield' },
        { name: 'Users', path: '/admin/users', key: 'admin/users', icon: 'users' },
        { name: 'Subjects', path: '/admin/subjects', key: 'admin/subjects', icon: 'subject' },
        { name: 'Curriculum', path: '/admin/curriculum', key: 'admin/curriculum', icon: 'curriculum' },
        { name: 'Term Forecasts', path: '/admin/term-forecasts', key: 'admin/term-forecasts', icon: 'forecast' },
        { name: 'Classes', path: '/admin/classes', key: 'admin/classes', icon: 'class' },
        { name: 'Edge Nodes', path: '/admin/edge-nodes', key: 'admin/edge-nodes', icon: 'edge' },
      ];

  const isLinkActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
    if (path === '/classroom') {
      return (
        location.pathname === '/classroom' ||
        location.pathname.startsWith('/classroom/') ||
        location.pathname === '/students' ||
        location.pathname.startsWith('/students/')
      );
    }
    if (path.startsWith('/admin')) {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }
    const base = `/${path.split('/')[1]}`;
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  };

  const getIcon = (iconName: NavLink['icon']) => {
    switch (iconName) {
      case 'home':
        return <Home size={16} />;
      case 'grid':
        return <LayoutGrid size={16} />;
      case 'mail':
        return <Mail size={16} />;
      case 'calendar':
        return <Calendar size={16} />;
      case 'shield':
        return <Shield size={16} />;
      case 'users':
        return <Users size={16} />;
      case 'subject':
        return <BookOpen size={16} />;
      case 'curriculum':
        return <BookOpen size={16} />;
      case 'class':
        return <GraduationCap size={16} />;
      case 'edge':
        return <Cpu size={16} />;
      case 'forecast':
        return <Calendar size={16} />;
      case 'performance':
        return <TrendingUp size={16} />;
      case 'resources':
        return <BookOpen size={16} />;
      case 'report':
        return <GraduationCap size={16} />;
      case 'development':
        return <Target size={16} />;
      case 'students':
        return <Users size={16} />;
      case 'assessment':
        return <FileText size={16} />;
      default:
        return null;
    }
  };

  return (
    <header className="bg-transparent w-full mb-3">
      <div className="flex justify-between items-start w-full">
        <div>
          {isTeacherPortal ? (
            location.pathname.startsWith('/classroom') ? (
              <div className="bg-[#ececed] p-2 shadow-md mb-2 h-[72px] w-[280px] flex items-center justify-between rounded-md">
                <div className="relative flex h-[72px] w-[72px] items-center justify-center">
                  <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white ring-1 ring-slate-300 shadow-sm">
                    <PieChart width={56} height={56}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={17}
                        outerRadius={28}
                        dataKey="count"
                        startAngle={90}
                        endAngle={-270}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="absolute rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-slate-900 shadow-sm">
                    {classSummary.totalStudents}
                  </div>
                </div>
                <div className="flex flex-col justify-center ml-2 text-sm flex-1">
                  <div className="flex flex-wrap gap-2">
                    {classSummary.categories.map((cat, index) => (
                      <div key={index} className="flex items-center space-x-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span>{cat.name} ({cat.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 mb-2 w-fit" ref={subjectMenuRef}>
                <div
                  className="w-fit max-w-xs bg-[#ececed] p-1 flex items-center shadow-md rounded-l-lg"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, calc(100% - 50px) 100%, 0% 100%)',
                    paddingRight: '60px',
                  }}
                >
                  <div className="flex items-center flex-1 gap-x-3">
                    <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="text-white text-xs">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <h2 className="text-lg font-bold truncate">
                        Mr. {currentUser?.lastName ? currentUser.lastName.charAt(0).toUpperCase() + currentUser.lastName.slice(1) : 'User'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setIsSubjectMenuOpen((prev) => !prev)}
                        className="flex items-center text-sm hover:bg-gray-100 px-2 py-1 rounded-md w-full text-left"
                        aria-haspopup="menu"
                        aria-expanded={isSubjectMenuOpen}
                      >
                        <span className="flex-1">{selectedSubject ? selectedSubject.code : 'Select Subject'}</span>
                        <ChevronDown size={16} className={`ml-1 transition-transform ${isSubjectMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-3xl font-bold">81</span>
                    </div>
                  </div>
                </div>
                {isSubjectMenuOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                    {subjects.length > 0 ? (
                      <div className="space-y-1">
                        {subjects.map((subject) => (
                          <button
                            key={subject.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubject(subject);
                              setIsSubjectMenuOpen(false);
                            }}
                            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                              selectedSubject?.id === subject.id
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-medium">{subject.code}</div>
                            <div className="text-sm text-slate-500">{subject.name}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-sm text-slate-500">No subjects available</div>
                    )}
                  </div>
                )}
              </div>
            )
          ) : (
            <div
              className="relative w-fit max-w-xs bg-[#ececed] p-1 flex items-center shadow-md mb-2 rounded-l-lg z-10"
              style={{
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 50px) 100%, 0% 100%)',
                paddingRight: '60px',
              }}
            >
              <div className="flex items-center flex-1 gap-x-3">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="text-white w-6 h-6" />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <h2 className="text-lg font-bold truncate">Admin Portal</h2>
                  <div className="text-sm text-gray-600 truncate">{currentUser?.email || 'admin'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotifications(true)}
            className="relative flex items-center gap-2 bg-[#ececed] text-gray-700 px-4 py-2 rounded-md shadow-md hover:bg-gray-100 transition"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              authService.logout();
              window.location.href = '/login';
            }}
            className="flex items-center gap-2 bg-[#ececed] text-gray-700 px-4 py-2 rounded-md shadow-md hover:bg-gray-100 hover:text-red-600 transition"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-0 mt-2 w-full bg-white">
        {navLinks.map((link) => {
          const active = isLinkActive(link.path);
          return (
            <button
              key={link.path}
              onClick={() => {
                setActiveTab(link.key);
                navigate(link.path);
              }}
              className={`flex flex-1 min-w-[120px] items-center justify-center py-2 px-4 ${
                active ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              } transition-colors duration-200`}
            >
              <span className="mr-2">{getIcon(link.icon)}</span>
              <span>{link.name}</span>
            </button>
          );
        })}
      </nav>
      <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </header>
  );
};

export default Header;
