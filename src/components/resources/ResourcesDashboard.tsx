// src/components/resources/ResourcesDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, Folder, Search as SearchIcon, FileText, FileImage, FileVideo, FilePlus, BarChart, Star, MoreVertical, Settings, UploadCloud, Eye, Link as LinkIcon, Sparkles, BookOpen, CalendarDays, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Sidebar from './Sidebar';
import UploadModal from './UploadModal';
import ResourcesView from './ResourcesView';

// --- Type Definitions ---
export interface Subject {
    id: string;
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
    id: string; name: string; type: string; createdAt: string;
    subject: { id: string; name: string; code?: string; };
    uploadedBy: { id: string; firstName: string; lastName: string; };
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
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
    const [selectedClass, setSelectedClass] = useState<Subject | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<Analytics>({ totalResources: 0, averageDownloads: 0, mostPopularResource: 'N/A', topClassEngagement: 'N/A' });
    const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);
    const [activeAction, setActiveAction] = useState<'view-notes' | 'generate-notes' | 'lesson-plans' | 'drafts'>('view-notes');
    const [noteMode, setNoteMode] = useState<'ai' | 'manual'>('ai');
    const [noteStep, setNoteStep] = useState<'details' | 'generate' | 'review'>('details');
    const [noteForm, setNoteForm] = useState({
        subjectId: '',
        grade: 'Form 1',
        title: '',
        instructions: '',
        content: '',
        status: 'draft',
        scheduledFor: ''
    });
    const [draftNotes, setDraftNotes] = useState<typeof noteForm[]>([]);

    // Modals State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState<Subject | null>(null);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        const API_URL = 'http://localhost:5000';
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }
        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const [subjectsRes, countsRes, recentRes] = await Promise.all([
                axios.get(`${API_URL}/api/subjects/teaching`, config),
                axios.get(`${API_URL}/api/resources/counts`, config),
                axios.get(`${API_URL}/api/resources/recent?limit=5`, config)
            ]);
            const subjectData = subjectsRes.data || [];
            const countsData = countsRes.data || {};
            const updatedSubjects = subjectData.map((subject: any) => ({
                ...subject,
                resourceCount: countsData[subject.id]?.count || 0,
                lastUpdated: countsData[subject.id]?.lastUpdated ? new Date(countsData[subject.id].lastUpdated).toISOString() : '',
                documents: countsData[subject.id]?.documents || 0,
                images: countsData[subject.id]?.images || 0,
                videos: countsData[subject.id]?.videos || 0,
                others: countsData[subject.id]?.others || 0,
            }));
            setSubjects(updatedSubjects);
            setRecentUploads(recentRes.data || []);
        } catch (error) { console.error('Error fetching dashboard data:', error);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useMemo(() => {
        if (subjects.length === 0) return;
        const totalResources = subjects.reduce((sum, subject) => sum + subject.resourceCount, 0);
        const topClass = subjects.reduce((prev, current) => (prev.resourceCount > current.resourceCount) ? prev : current, subjects[0]);
        setAnalytics({
            totalResources: totalResources,
            averageDownloads: 0,
            mostPopularResource: 'N/A',
            topClassEngagement: topClass?.name || 'N/A',
        });
        const sortedSubjects = [...subjects].sort((a, b) => {
            if (a.lastUpdated && b.lastUpdated) {
                return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
            }
            return b.resourceCount - a.resourceCount;
        });
        setQuickAccess(sortedSubjects.slice(0, 3).map(subject => ({
            id: subject.id,
            name: `Resources for ${subject.name}`,
            class: subject.name,
            classId: subject.id,
        })));
    }, [subjects]);

    // --- Event Handlers ---
    const handleClassNavigation = (classId: string) => {
        const subjectToNavigate = subjects.find(c => c.id === classId);
        if (subjectToNavigate) {
            setSelectedClass(subjectToNavigate);
            setActiveAction('view-notes');
        }
    };
    
    const handleUploadClick = (subject?: Subject) => {
        setSelectedSubjectForUpload(subject || null);
        setShowUploadModal(true);
    };

    const handleFileUploadSuccess = () => {
        setShowUploadModal(false);
        fetchDashboardData();
    };
    
    const handleViewNotes = () => {
        setSelectedClass(null);
        setActiveAction('view-notes');
    };

    const handleLessonPlans = () => {
        setSelectedClass(null);
        setActiveAction('lesson-plans');
    };
    
    const handleDrafts = () => {
        setSelectedClass(null);
        setActiveAction('drafts');
    };

    const filteredSubjects = subjects.filter(subject =>
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subject.code && subject.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleGenerateNotes = () => {
        setSelectedClass(null);
        setActiveAction('generate-notes');
        setNoteStep('details');
    };

    const handleNotesNext = () => {
        if (noteStep === 'details') {
            if (!noteForm.title.trim()) {
                toast.error('Please add a title for the notes.');
                return;
            }
            if (noteMode === 'ai') {
                setNoteStep('generate');
                setTimeout(() => {
                    setNoteForm((prev) => ({
                        ...prev,
                        content: prev.content || `Draft notes for ${prev.title}. Update this content before publishing.`
                    }));
                    setNoteStep('review');
                }, 700);
                return;
            }
            setNoteStep('review');
            return;
        }
    };

    const handleSaveDraft = () => {
        if (!noteForm.title.trim()) {
            toast.error('Please provide a title before saving.');
            return;
        }
        setDraftNotes((prev) => [{ ...noteForm, status: 'draft' }, ...prev]);
        toast.success('Draft saved.');
    };

    const handlePublish = () => {
        toast.success('Notes published to students.');
        setNoteStep('details');
        setNoteForm((prev) => ({ ...prev, content: '', instructions: '', title: '' }));
    };

    const handleSchedule = () => {
        if (!noteForm.scheduledFor) {
            toast.error('Select a date/time to schedule.');
            return;
        }
        toast.success('Notes scheduled.');
    };

    const handleEditDraft = (draftIndex: number) => {
        const draft = draftNotes[draftIndex];
        if (!draft) return;
        setNoteForm(draft);
        setNoteMode(draft.instructions ? 'ai' : 'manual');
        setNoteStep('review');
        setActiveAction('generate-notes');
    };

    const handleDeleteDraft = (draftIndex: number) => {
        setDraftNotes((prev) => prev.filter((_, idx) => idx !== draftIndex));
        toast.success('Draft deleted.');
    };

    const handlePublishDraft = (draftIndex: number) => {
        const draft = draftNotes[draftIndex];
        if (!draft) return;
        toast.success('Draft published to students.');
        setDraftNotes((prev) => prev.filter((_, idx) => idx !== draftIndex));
    };

    if (loading) {
        return (
            <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
                <div className="w-72 bg-white border-r border-slate-200 p-6 space-y-6">
                    <div className="h-10 bg-slate-200 rounded animate-pulse" />
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-10 bg-slate-200 rounded animate-pulse" />
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="h-8 bg-slate-200 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
                            <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
                        </div>
                        <div className="h-10 w-28 bg-slate-200 rounded animate-pulse" />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-2 space-y-6">
                            <div className="h-12 bg-slate-200 rounded animate-pulse" />
                            <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="h-36 bg-slate-200 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="h-24 bg-slate-200 rounded-lg animate-pulse" />
                            <div className="h-24 bg-slate-200 rounded-lg animate-pulse" />
                            <div className="h-24 bg-slate-200 rounded-lg animate-pulse" />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (selectedClass && activeAction === 'view-notes') {
        return <ResourcesView classId={selectedClass.id} className={selectedClass.name} classCode={selectedClass.code} onBack={() => setSelectedClass(null)} onUploadClick={() => handleUploadClick(selectedClass)} />;
    }

    return (
        <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
            <Sidebar
                mode="resources"
                onUploadClick={() => handleUploadClick()}
                onGenerateNotes={handleGenerateNotes}
                onViewNotes={handleViewNotes}
                onLessonPlans={handleLessonPlans}
                onDrafts={handleDrafts}
                activeAction={activeAction}
                recentUploads={recentUploads}
            />
            <main className="flex-1 p-8 overflow-y-auto">
                {activeAction === 'view-notes' && (
                    <>
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
                                        {filteredSubjects.map((subject) => (
                                            <SubjectCard 
                                                key={subject.id} 
                                                subject={subject} 
                                                onNavigate={(subject) => handleClassNavigation(subject.id)} 
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
                    </>
                )}

                {activeAction === 'generate-notes' && (
                    <div className="space-y-6">
                        <header className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold">Generate Notes</h1>
                                <p className="text-sm text-slate-500">Create learning notes with AI assistance or upload your own material.</p>
                            </div>
                            <button onClick={() => handleUploadClick()} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <UploadCloud size={18} /> Upload Material
                            </button>
                        </header>

                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => { setNoteMode('ai'); setNoteStep('details'); }}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                        noteMode === 'ai' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    AI-Assisted
                                </button>
                                <button
                                    onClick={() => { setNoteMode('manual'); setNoteStep('details'); }}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                        noteMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    Manual
                                </button>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-50 border-b border-slate-200 p-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-slate-800">Create Notes</h2>
                                        <span className="text-sm text-slate-500">Step {noteStep === 'details' ? 1 : noteStep === 'generate' ? 2 : 3} of 3</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        {['details', 'generate', 'review'].map((step, index) => (
                                            <React.Fragment key={step}>
                                                <div className={`flex items-center gap-2 ${
                                                    (noteStep === step || ['generate', 'review'].includes(noteStep) && index <= (noteStep === 'generate' ? 1 : 2)) ? 'text-blue-600' : 'text-gray-400'
                                                }`}>
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                                                        noteStep === step || index < (noteStep === 'review' ? 2 : noteStep === 'generate' ? 1 : 0)
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-sm font-medium hidden sm:block">
                                                        {index === 0 ? 'Details' : index === 1 ? 'Generate' : 'Review'}
                                                    </span>
                                                </div>
                                                {index < 2 && <div className="flex-1 h-0.5 bg-gray-200" />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {noteStep === 'details' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500">Subject</label>
                                                    <select
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                        value={noteForm.subjectId}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                                                    >
                                                        <option value="">Select subject</option>
                                                        {subjects.map(subject => (
                                                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500">Grade/Form</label>
                                                    <select
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                        value={noteForm.grade}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, grade: e.target.value }))}
                                                    >
                                                        <option>Form 1</option>
                                                        <option>Form 2</option>
                                                        <option>Form 3</option>
                                                        <option>Form 4</option>
                                                        <option>Form 5</option>
                                                        <option>Form 6</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500">Notes Title</label>
                                                <input
                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                    placeholder="e.g., Algebraic Expressions Overview"
                                                    value={noteForm.title}
                                                    onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
                                                />
                                            </div>
                                            {noteMode === 'ai' ? (
                                                <div>
                                                    <label className="text-xs text-slate-500">Instructions for AI</label>
                                                    <textarea
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[140px]"
                                                        placeholder="Describe the notes you want, include depth, examples, and any constraints."
                                                        value={noteForm.instructions}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, instructions: e.target.value }))}
                                                    />
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="text-xs text-slate-500">Write Notes</label>
                                                    <textarea
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[180px]"
                                                        placeholder="Start typing your notes..."
                                                        value={noteForm.content}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {noteStep === 'generate' && (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                                            <Sparkles size={32} className="text-blue-500 mb-4" />
                                            <p className="text-sm">Generating notes. Please wait...</p>
                                        </div>
                                    )}

                                    {noteStep === 'review' && (
                                        <>
                                            <div>
                                                <label className="text-xs text-slate-500">Review & Edit Notes</label>
                                                <textarea
                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[240px]"
                                                    value={noteForm.content}
                                                    onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500">Status</label>
                                                    <select
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                        value={noteForm.status}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, status: e.target.value }))}
                                                    >
                                                        <option value="draft">Draft</option>
                                                        <option value="publish">Publish Now</option>
                                                        <option value="schedule">Schedule</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500">Schedule For</label>
                                                    <input
                                                        type="datetime-local"
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                        value={noteForm.scheduledFor}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, scheduledFor: e.target.value }))}
                                                        disabled={noteForm.status !== 'schedule'}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex flex-wrap justify-between gap-3">
                                        <button
                                            onClick={() => setNoteStep('details')}
                                            className="border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                        >
                                            Back
                                        </button>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={handleSaveDraft}
                                                className="border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                            >
                                                Save Draft
                                            </button>
                                            {noteStep !== 'review' ? (
                                                <button
                                                    onClick={handleNotesNext}
                                                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    {noteMode === 'ai' ? 'Generate Notes' : 'Continue'}
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={handlePublish}
                                                        className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Publish Now
                                                    </button>
                                                    <button
                                                        onClick={handleSchedule}
                                                        className="border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                                    >
                                                        Schedule
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeAction === 'lesson-plans' && (
                    <div className="space-y-6">
                        <header className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold">Lesson Plans</h1>
                                <p className="text-sm text-slate-500">Plan weekly lessons and share structured outlines with your students.</p>
                            </div>
                            <button className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <BookOpen size={18} /> Create Lesson Plan
                            </button>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                                    <h2 className="text-lg font-semibold text-slate-800 mb-2">Upcoming Lessons</h2>
                                    <div className="space-y-3">
                                        {subjects.slice(0, 3).map((subject) => (
                                            <div key={subject.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{subject.name}</p>
                                                    <p className="text-xs text-slate-500">Next session: To be scheduled</p>
                                                </div>
                                                <button className="text-blue-600 text-sm font-medium hover:text-blue-700">View Plan</button>
                                            </div>
                                        ))}
                                        {subjects.length === 0 && (
                                            <p className="text-sm text-slate-500">No lesson plans yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Plan Schedule</h3>
                                    <div className="flex items-center gap-3 text-slate-600 text-sm">
                                        <CalendarDays size={18} />
                                        <span>Align lesson plans with your academic calendar.</span>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Share with Students</h3>
                                    <div className="flex items-center gap-3 text-slate-600 text-sm">
                                        <Send size={18} />
                                        <span>Send lesson outlines to students from each plan.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeAction === 'drafts' && (
                    <div className="space-y-6">
                        <header className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold">Resource Drafts</h1>
                                <p className="text-sm text-slate-500">Manage saved drafts before publishing.</p>
                            </div>
                        </header>

                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
                            {draftNotes.length === 0 ? (
                                <p className="text-sm text-slate-500">No drafts yet. Create notes and save them as drafts.</p>
                            ) : (
                                draftNotes.map((draft, index) => (
                                    <div key={`${draft.title}-${index}`} className="border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-800">{draft.title || 'Untitled Draft'}</p>
                                            <p className="text-xs text-slate-500">{draft.grade} • {draft.subjectId ? 'Subject selected' : 'No subject'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <button onClick={() => handleEditDraft(index)} className="text-sm text-blue-600 hover:text-blue-700">Edit</button>
                                            <button onClick={() => handleDeleteDraft(index)} className="text-sm text-slate-600 hover:text-slate-700">Delete</button>
                                            <button onClick={() => handlePublishDraft(index)} className="text-sm text-blue-600 hover:text-blue-700">Publish</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>
            
            <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onUploadSuccess={handleFileUploadSuccess} selectedSubject={selectedSubjectForUpload} subjects={subjects} onSubjectSelect={setSelectedSubjectForUpload} />
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

interface SubjectCardProps {
    subject: Subject;
    onNavigate: (subject: Subject) => void;
    onUpload: (subject: Subject) => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onNavigate, onUpload }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    return(
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between overflow-hidden">
            <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800 pr-4">{subject.name}</h3>
                    <div className="relative">
                         <button onClick={() => setMenuOpen(!menuOpen)} onBlur={() => setTimeout(() => setMenuOpen(false), 100)} className="p-1 rounded-full hover:bg-slate-100">
                             <MoreVertical size={20} className="text-slate-500" />
                         </button>
                         <AnimatePresence>
                         {menuOpen && (
                             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                 className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-10">
                                 <button onClick={() => { onNavigate(subject); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Eye size={14}/> View Resources</button>
                                 <button onClick={() => { onUpload(subject); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><UploadCloud size={14}/> Upload File</button>
                                 <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Settings size={14}/> Subject Settings</button>
                             </motion.div>
                         )}
                         </AnimatePresence>
                    </div>
                </div>
                <p className="text-sm text-slate-500 mb-4">{subject.code || 'No code'}</p>
                <div className="flex items-center text-sm font-medium text-slate-600 gap-1">
                    <Folder size={16} className="text-blue-500" />
                    <span>{subject.resourceCount} total resources</span>
                </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600"><FileText size={14} className="text-blue-500"/> Docs: <strong>{subject.documents}</strong></div>
                <div className="flex items-center gap-2 text-xs text-slate-600"><FileImage size={14} className="text-green-500"/> Images: <strong>{subject.images}</strong></div>
                <div className="flex items-center gap-2 text-xs text-slate-600"><FileVideo size={14} className="text-purple-500"/> Videos: <strong>{subject.videos}</strong></div>
                <div className="flex items-center gap-2 text-xs text-slate-600"><FilePlus size={14} className="text-slate-500"/> Others: <strong>{subject.others}</strong></div>
            </div>
        </motion.div>
    )
};

export default ResourcesDashboard;
