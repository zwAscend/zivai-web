// src/components/layout/Header.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '../../types';
import { Home, LayoutGrid, Mail, Calendar, LogOut, ChevronDown, X, Bell } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { authService, notificationService, studentService } from '../../services/api';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationCenter from '../teacher/NotificationCenter';
import { Student } from '../../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const currentUser = authService.getCurrentUser();
  const navigate = useNavigate();

  interface Subject {
    _id: string;
    id: string;
    code: string;
    name: string;
  }

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { selectedSubject, setSelectedSubject } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);

  // Fetch subjects from API
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found');
          return;
        }

        const response = await axios.get('http://localhost:5000/api/subjects/teaching', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data && Array.isArray(response.data)) {
          const subjectsWithIds = response.data.map(subject => ({
            ...subject,
            id: subject.id || subject._id
          }));

          setSubjects(subjectsWithIds);
          
          if (subjectsWithIds.length > 0) {
            // Only set the selected subject if it's not already set
            if (!selectedSubject) {
              setSelectedSubject(subjectsWithIds[0]);
            }
          } else {
            console.warn('No subjects found in the API response.'); // Keeping this for important warnings
          }
        } else {
            console.warn('API response data is not an array or is empty:', response.data); // Keeping this for important warnings
        }
      } catch (error) {
        console.error('Error fetching subjects:', error); // Keeping error logs
      }
    };

    fetchSubjects();
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await notificationService.getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    const fetchStudents = async () => {
      try {
        // Get the current subject ID from the URL or use the first available subject
        const pathParts = window.location.pathname.split('/');
        const subjectId = pathParts[pathParts.length - 1];
        
        // Fetch students for the current subject
        const studentsData = await studentService.getStudents(subjectId);
        setStudents(studentsData);
        
        // Calculate grade distribution
        const summary = calculateGradeDistribution(studentsData);
        setClassSummary(summary);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };

    fetchUnreadCount();
    fetchStudents();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchStudents();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const navLinks: NavLink[] = [
    { name: 'Home', path: 'dashboard', active: activeTab === 'dashboard', icon: 'home' },
    { name: 'Classroom', path: 'classroom', active: activeTab === 'classroom', icon: 'grid' },
    { name: 'Staffroom', path: 'staffroom', active: activeTab === 'staffroom', icon: 'mail' },
    { name: 'Calendar', path: 'calendar', active: activeTab === 'calendar', icon: 'calendar' },
  ];

  // Calculate grade distribution from student data
  const calculateGradeDistribution = (students: Student[]) => {
    // Initialize grade counters
    const gradeRanges = [
      { name: 'A', minScore: 75, maxScore: 100, count: 0, color: '#22c55e' },
      { name: 'B', minScore: 65, maxScore: 74, count: 0, color: '#3b82f6' },
      { name: 'C', minScore: 55, maxScore: 64, count: 0, color: '#eab308' },
      { name: 'D', minScore: 40, maxScore: 54, count: 0, color: '#f97316' },
      { name: 'F', minScore: 0, maxScore: 39, count: 0, color: '#ef4444' },
    ];

    // Count students in each grade range
    students.forEach(student => {
      const overall = student.overall || 0; // Default to 0 if overall is not set
      const gradeRange = gradeRanges.find(
        range => overall >= range.minScore && overall <= range.maxScore
      );
      if (gradeRange) {
        gradeRange.count++;
      }
    });

    return {
      totalStudents: students.length,
      categories: gradeRanges.map(({ name, count, minScore, color }) => ({
        name,
        count,
        minScore,
        color,
      })),
    };
  };

  // Initialize with empty data
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

  const [classSummary, setClassSummary] = useState<ClassSummary>({
    totalStudents: 0,
    categories: []
  });

  const totalStudents = classSummary.totalStudents;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'home': return <Home size={16} />;
      case 'grid': return <LayoutGrid size={16} />;
      case 'mail': return <Mail size={16} />;
      case 'calendar': return <Calendar size={16} />;
      default: return null;
    }
  };

  return (
    <header className="bg-transparent w-full mb-3">
      <div className="flex justify-between items-start w-full">
        <div>
          {activeTab === 'classroom' ? (
            <div className="bg-[#ececed] p-2 shadow-md mb-2 h-[70px] w-[280px] flex items-center justify-between rounded-md">
              <div className="relative w-[90px] h-[70px] flex items-center justify-center">
                <PieChart width={60} height={60}>
                  <Pie
                    data={classSummary.categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={30}
                    dataKey="count"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {classSummary.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute text-xs font-bold">
                  {totalStudents}
                </div>
              </div>
              <div className="flex flex-col justify-center ml-2 text-sm flex-1">
                <div className="flex flex-wrap gap-2">
                  {classSummary.categories.map((cat, index) => (
                    <div key={index} className="flex items-center space-x-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      ></span>
                      <span>{cat.name} ({cat.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                  <div>
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center text-sm hover:bg-gray-100 px-2 py-1 rounded-md w-full text-left"
                    >
                      <span className="flex-1">
                        {selectedSubject ? selectedSubject.code : 'Select Subject'}
                      </span>
                      <ChevronDown size={16} className="ml-1" />
                    </button>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-3xl font-bold">81</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notification and Logout Buttons Group */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
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

          {/* Logout Button */}
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

      <nav className="flex mt-2">
        {navLinks.map((link) => (
          <button
            key={link.path}
            onClick={() => {
              setActiveTab(link.path);
              navigate(`/${link.path}`);
            }}
            className={`flex items-center justify-center py-2 px-4 ${
              link.active
                ? 'bg-blue-500 text-white'
                : 'bg-[#ececed] text-gray-700 hover:bg-gray-100'
            } transition-colors duration-200`}
          >
            <span className="mr-2">{getIcon(link.icon)}</span>
            <span>{link.name}</span>
          </button>
        ))}
      </nav>

      {/* Subject Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium">Select Subject</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {subjects.length > 0 ? (
                <div className="space-y-2">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => {
                        setSelectedSubject(subject);
                        setIsModalOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedSubject?.id === subject.id 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="font-medium">{subject.code}</div>
                      <div className="text-sm text-gray-500">{subject.name}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No subjects available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </header>
  );
};

export default Header;