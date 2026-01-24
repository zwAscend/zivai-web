// src/components/resources/ResourcesDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, Folder, Search as SearchIcon, FileText, FileImage, FileVideo, FilePlus, BarChart, Users, Star, MoreVertical, Settings, UploadCloud, Eye, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import UploadModal from './UploadModal';
import ResourcesView from './ResourcesView';
import { AIAssessmentModal } from '../assessments/AIAssessmentModal';

// --- Type Definitions ---
export interface Course {
    _id: string;
    name: string;
    code?: string;
    resourceCount: number;
    lastUpdated: string;
    documents: number;
    images: number;
    videos: number;
    others: number;
}
export interface RecentUpload {
    _id: string; name: string; type: string; createdAt: string;
    course: { _id: string; name: string; code?: string; };
    uploadedBy: { _id: string; firstName: string; lastName: string; };
}
export interface QuickAccessItem {
    id: string; name: string; class: string; classId: string;
}
export interface Analytics {
    totalResources: number;
    averageDownloads: number;
    mostPopularResource: string;
    topClassEngagement: string;
}

// --- Component Starts ---
const ResourcesDashboard: React.FC = () => {
    const navigate = useNavigate();
    
    // --- State Management ---
    const [courses, setCourses] = useState<Course[]>([]);
    const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
    const [selectedClass, setSelectedClass] = useState<Course | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<Analytics>({ totalResources: 0, averageDownloads: 0, mostPopularResource: 'N/A', topClassEngagement: 'N/A' });
    const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);

    // Modals State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedCourseForUpload, setSelectedCourseForUpload] = useState<Course | null>(null);
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
    const [selectedCourseIdForAssessment, setSelectedCourseIdForAssessment] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        const API_URL = 'http://localhost:5000';
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }
        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const [coursesRes, countsRes, recentRes] = await Promise.all([
                axios.get(`${API_URL}/api/courses/teaching`, config),
                axios.get(`${API_URL}/api/resources/counts`, config),
                axios.get(`${API_URL}/api/resources/recent?limit=5`, config)
            ]);
            const courseData = coursesRes.data || [];
            const countsData = countsRes.data || {};
            const updatedCourses = courseData.map((course: any) => ({
                ...course,
                resourceCount: countsData[course._id]?.count || 0,
                lastUpdated: countsData[course._id]?.lastUpdated ? new Date(countsData[course._id].lastUpdated).toISOString() : '',
                documents: countsData[course._id]?.documents || 0,
                images: countsData[course._id]?.images || 0,
                videos: countsData[course._id]?.videos || 0,
                others: countsData[course._id]?.others || 0,
            }));
            setCourses(updatedCourses);
            setRecentUploads(recentRes.data || []);
        } catch (error) { console.error('Error fetching dashboard data:', error);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useMemo(() => {
        if (courses.length === 0) return;
        const totalResources = courses.reduce((sum, course) => sum + course.resourceCount, 0);
        const topClass = courses.reduce((prev, current) => (prev.resourceCount > current.resourceCount) ? prev : current, courses[0]);
        setAnalytics({
            totalResources: totalResources,
            averageDownloads: 0,
            mostPopularResource: 'N/A',
            topClassEngagement: topClass?.name || 'N/A',
        });
        const sortedCourses = [...courses].sort((a, b) => {
            if (a.lastUpdated && b.lastUpdated) {
                return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
            }
            return b.resourceCount - a.resourceCount;
        });
        setQuickAccess(sortedCourses.slice(0, 3).map(course => ({
            id: course._id,
            name: `Resources for ${course.name}`,
            class: course.name,
            classId: course._id,
        })));
    }, [courses]);

    // --- Event Handlers ---
    const handleClassNavigation = (classId: string) => {
        const courseToNavigate = courses.find(c => c._id === classId);
        if (courseToNavigate) {
            setSelectedClass(courseToNavigate);
        }
    };
    
    const handleUploadClick = (course?: Course) => {
        setSelectedCourseForUpload(course || null);
        setShowUploadModal(true);
    };

    const handleFileUploadSuccess = () => {
        setShowUploadModal(false);
        fetchDashboardData();
    };
    
    const handleCreateAssignment = (courseId: string) => {
        setSelectedCourseIdForAssessment(courseId);
        setIsAssessmentModalOpen(true);
    };

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.code && course.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading Dashboard...</div>;
    }

    if (selectedClass) {
        return <ResourcesView classId={selectedClass._id} className={selectedClass.name} classCode={selectedClass.code} onBack={() => setSelectedClass(null)} onUploadClick={() => handleUploadClick(selectedClass)} />;
    }

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900">
            <Sidebar onUploadClick={() => handleUploadClick()} onCreateAssignment={() => handleCreateAssignment(courses[0]?._id)} recentUploads={recentUploads} />
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                            aria-label="Back to dashboard"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-2xl font-bold">Resources</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => handleUploadClick()} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                           <UploadCloud size={18} /> Upload
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* --- Left Column (Main Content) --- */}
                    <div className="xl:col-span-2 space-y-8">
                        <div className="relative">
                            <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search your classes by name or code..." className="w-full pl-12 pr-4 py-3 border bg-white border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <section>
                            <h2 className="text-xl font-bold text-slate-700 mb-4">Your Classes</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredCourses.map((course) => (
                                    <CourseCard 
                                        key={course._id} 
                                        course={course} 
                                        onNavigate={(course) => handleClassNavigation(course._id)} 
                                        onUpload={handleUploadClick} 
                                    />
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* --- Right Column --- */}
                    <div className="xl:col-span-1 space-y-8">
                        <section>
                            <h2 className="text-xl font-bold text-slate-700 mb-4">Resource Analytics</h2>
                            <div className="space-y-4">
                               <StatCard icon={Folder} value={analytics.totalResources} label="Total Resources" color="blue" />
                               <StatCard icon={BarChart} value={analytics.averageDownloads} label="Avg. Downloads" color="green" />
                               <StatCard icon={LinkIcon} value={analytics.mostPopularResource} label="Most Popular" color="purple" isText />
                               <StatCard icon={Star} value={analytics.topClassEngagement} label="Top Class" color="amber" isText />
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-700 mb-4">Quick Access</h2>
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 space-y-1">
                                {quickAccess.length > 0 ? quickAccess.map(item => (
                                    <button key={item.id} onClick={() => handleClassNavigation(item.classId)} className="w-full text-left flex items-center gap-3 p-3 hover:bg-slate-50 rounded-md transition-colors">
                                        <Folder className="flex-shrink-0 text-amber-500" size={20} />
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800">{item.class}</p>
                                            <p className="text-xs text-slate-500">View resources</p>
                                        </div>
                                    </button>
                                )) : <p className="text-sm text-slate-500 text-center p-4">No quick access items.</p>}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
            
            <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onUploadSuccess={handleFileUploadSuccess} selectedCourse={selectedCourseForUpload} courses={courses} onCourseSelect={setSelectedCourseForUpload} />
            {selectedCourseIdForAssessment && <AIAssessmentModal isOpen={isAssessmentModalOpen} onClose={() => setIsAssessmentModalOpen(false)} courseId={selectedCourseIdForAssessment} onAssessmentCreated={() => {}} />}
        </div>
    );
};

// --- Child Components ---

const StatCard = ({ icon: Icon, value, label, color, isText = false }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-center gap-5">
        <div className={`w-12 h-12 flex items-center justify-center rounded-full bg-${color}-100`}>
            <Icon size={24} className={`text-${color}-600`} />
        </div>
        <div>
            <p className={clsx("font-bold text-slate-800 line-clamp-1", isText ? 'text-lg' : 'text-2xl')}>{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
        </div>
    </div>
);

interface CourseCardProps {
    course: Course;
    onNavigate: (course: Course) => void;
    onUpload: (course: Course) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onNavigate, onUpload }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    return(
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between overflow-hidden">
            <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800 pr-4">{course.name}</h3>
                    <div className="relative">
                         <button onClick={() => setMenuOpen(!menuOpen)} onBlur={() => setTimeout(() => setMenuOpen(false), 100)} className="p-1 rounded-full hover:bg-slate-100">
                             <MoreVertical size={20} className="text-slate-500" />
                         </button>
                         <AnimatePresence>
                         {menuOpen && (
                             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                 className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-10">
                                 <button onClick={() => { onNavigate(course); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Eye size={14}/> View Resources</button>
                                 <button onClick={() => { onUpload(course); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><UploadCloud size={14}/> Upload File</button>
                                 <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Settings size={14}/> Course Settings</button>
                             </motion.div>
                         )}
                         </AnimatePresence>
                    </div>
                </div>
                <p className="text-sm text-slate-500 mb-4">{course.code || 'No code'}</p>
                <div className="flex items-center text-sm font-medium text-slate-600 gap-1">
                    <Folder size={16} className="text-blue-500" />
                    <span>{course.resourceCount} total resources</span>
                </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600"><FileText size={14} className="text-blue-500"/> Docs: <strong>{course.documents}</strong></div>
                <div className="flex items-center gap-2 text-xs text-slate-600"><FileImage size={14} className="text-green-500"/> Images: <strong>{course.images}</strong></div>
                <div className="flex items-center gap-2 text-xs text-slate-600"><FileVideo size={14} className="text-purple-500"/> Videos: <strong>{course.videos}</strong></div>
                <div className="flex items-center gap-2 text-xs text-slate-600"><FilePlus size={14} className="text-slate-500"/> Others: <strong>{course.others}</strong></div>
            </div>
        </motion.div>
    )
};

export default ResourcesDashboard;