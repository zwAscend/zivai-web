// src/components/resources/ResourcesDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, Folder, Search as SearchIcon, BarChart, Star, UploadCloud, Link as LinkIcon, Sparkles, BookOpen, CalendarDays, Send, Maximize2, Minimize2 } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<Analytics>({ totalResources: 0, averageDownloads: 0, mostPopularResource: 'N/A', topClassEngagement: 'N/A' });
    const [activeAction, setActiveAction] = useState<'view-notes' | 'generate-notes' | 'lesson-plans' | 'drafts' | 'material'>('generate-notes');
    const [noteMode, setNoteMode] = useState<'ai' | 'manual'>('ai');
    const [noteStep, setNoteStep] = useState<'details' | 'generate' | 'review'>('details');
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [contentType, setContentType] = useState('Notes');
    const [contentFiles, setContentFiles] = useState<File[]>([]);
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
    const [contentSearch, setContentSearch] = useState('');
    const [contentSubjectFilter, setContentSubjectFilter] = useState('all');
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialSubjectFilter, setMaterialSubjectFilter] = useState('all');
    const [materialTypeFilter, setMaterialTypeFilter] = useState('all');

    // Modals State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState<Subject | null>(null);

    const API_URL = 'http://localhost:5000';

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
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
        // Quick access removed; analytics only for now.
    }, [subjects]);

    // --- Event Handlers ---
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

    const handleMaterialTab = () => {
        setSelectedClass(null);
        setActiveAction('material');
    };

    const filteredContent = recentUploads.filter((item) => {
        const matchesSubject = contentSubjectFilter === 'all' || item.subject?.id === contentSubjectFilter;
        const query = contentSearch.toLowerCase().trim();
        if (!query) return matchesSubject;
        const matchesQuery = item.name?.toLowerCase().includes(query) || item.subject?.name?.toLowerCase().includes(query);
        return matchesSubject && matchesQuery;
    });

    const filteredMaterials = recentUploads.filter((item) => {
        const matchesSubject = materialSubjectFilter === 'all' || item.subject?.id === materialSubjectFilter;
        const matchesType = materialTypeFilter === 'all' || item.type === materialTypeFilter;
        const query = materialSearch.toLowerCase().trim();
        if (!query) return matchesSubject && matchesType;
        const matchesQuery = item.name?.toLowerCase().includes(query) || item.subject?.name?.toLowerCase().includes(query);
        return matchesSubject && matchesType && matchesQuery;
    });

    const handleGenerateNotes = () => {
        setSelectedClass(null);
        setActiveAction('generate-notes');
        setNoteStep('details');
    };

    const handleNotesNext = () => {
        if (noteStep === 'details') {
            if (!noteForm.title.trim()) {
                toast.error('Please add a title for the content.');
                return;
            }
            if (noteMode === 'ai') {
                setNoteStep('generate');
                setTimeout(() => {
                    setNoteForm((prev) => ({
                        ...prev,
                        content: prev.content || `Draft content for ${prev.title}. Update this content before publishing.`
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
        toast.success('Content published to students.');
        setNoteStep('details');
        setNoteForm((prev) => ({ ...prev, content: '', instructions: '', title: '' }));
    };

    const handleSchedule = () => {
        if (!noteForm.scheduledFor) {
            toast.error('Select a date/time to schedule.');
            return;
        }
        toast.success('Content scheduled.');
    };

    const contentSteps = noteMode === 'ai' ? ['details', 'generate', 'review'] : ['details', 'review'];
    const activeContentStepIndex = Math.max(contentSteps.indexOf(noteStep), 0);
    const contentStepIndex = activeContentStepIndex + 1;

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
                onMaterial={handleMaterialTab}
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
                                <h1 className="text-2xl font-bold">View Content</h1>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => handleUploadClick()} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                                   <UploadCloud size={18} /> Upload
                                </button>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            {/* --- Left Column (Main Content) --- */}
                            <div className="xl:col-span-2 space-y-6">
                                <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                                    <div className="relative flex-1">
                                        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={contentSearch}
                                            onChange={(e) => setContentSearch(e.target.value)}
                                            placeholder="Search content by title or subject..."
                                            className="w-full pl-10 pr-4 py-2 border bg-white border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Subject</span>
                                        <select
                                            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                                            value={contentSubjectFilter}
                                            onChange={(e) => setContentSubjectFilter(e.target.value)}
                                        >
                                            <option value="all">All subjects</option>
                                            {subjects.map((subject) => (
                                                <option key={subject.id} value={subject.id}>{subject.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <section className="space-y-4">
                                    <h2 className="text-xl font-bold text-slate-700">Content Library</h2>
                                    {filteredContent.length === 0 ? (
                                        <div className="bg-white border border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-500">
                                            No content found. Generate content or upload material to get started.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredContent.map((item) => (
                                                <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{item.name}</p>
                                                        <p className="text-xs text-slate-500">{item.subject?.name} • Uploaded by {item.uploadedBy?.firstName} {item.uploadedBy?.lastName}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button className="text-sm text-blue-600 hover:text-blue-700">View</button>
                                                        <button className="text-sm text-slate-600 hover:text-slate-700">Download</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                            </div>
                        </div>
                    </>
                )}

                {activeAction === 'generate-notes' && (
                    <div className="space-y-6">
                        <header className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold">Generate Content</h1>
                                <p className="text-sm text-slate-500">Create learning content with AI assistance or upload your own material.</p>
                            </div>
                            <div className="flex items-center gap-2">
                            </div>
                        </header>

                        {isContentExpanded && <div className="fixed inset-0 bg-black/30 z-40" />}
                        <div className={`${isContentExpanded ? 'fixed inset-4 z-50' : ''}`}>
                        <div className={`${isContentExpanded ? 'bg-white rounded-lg shadow-2xl border border-slate-200 max-w-5xl mx-auto relative h-full flex flex-col' : 'bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6'}`}>
                            {isContentExpanded && (
                                <button
                                    onClick={() => setIsContentExpanded(false)}
                                    className="absolute top-4 right-4 p-2 rounded-md border border-slate-200 hover:bg-slate-50"
                                    aria-label="Collapse"
                                >
                                    <Minimize2 size={18} />
                                </button>
                            )}
                            {isContentExpanded ? (
                                <div className="p-6 pb-0">
                                    <div className="flex flex-wrap items-center gap-2">
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
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
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
                                    <button
                                        onClick={() => setIsContentExpanded(true)}
                                        className="ml-auto p-2 rounded-md border border-slate-200 hover:bg-slate-50"
                                        aria-label="Expand"
                                    >
                                        <Maximize2 size={18} />
                                    </button>
                                </div>
                            )}

                            <div className="border border-slate-200 rounded-lg overflow-hidden mt-6 flex-1 flex flex-col min-h-0">
                                <div className="bg-slate-50 border-b border-slate-200 p-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-slate-800">Create Content</h2>
                                        <span className="text-sm text-slate-500">
                                            Step {contentStepIndex} of {contentSteps.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        {contentSteps.map((step, index) => (
                                            <React.Fragment key={step}>
                                                <div className={`flex items-center gap-2 ${
                                                    index <= activeContentStepIndex ? 'text-blue-600' : 'text-gray-400'
                                                }`}>
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                                                        index <= activeContentStepIndex
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-sm font-medium hidden sm:block">
                                                        {noteMode === 'ai'
                                                            ? (index === 0 ? 'Details' : index === 1 ? 'Generate' : 'Review')
                                                            : (index === 0 ? 'Details' : 'Review')}
                                                    </span>
                                                </div>
                                                {index < contentSteps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200" />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500">Content Title</label>
                                                    <input
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                        placeholder="e.g., Algebraic Expressions Overview"
                                                        value={noteForm.title}
                                                        onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500">Content Type</label>
                                                    <select
                                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                                        value={contentType}
                                                        onChange={(e) => setContentType(e.target.value)}
                                                    >
                                                        <option>Notes</option>
                                                        <option>Worksheet</option>
                                                        <option>Slides</option>
                                                        <option>Revision Pack</option>
                                                        <option>Lesson Summary</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {noteMode === 'ai' ? (
                                                <>
                                                    <div>
                                                        <label className="text-xs text-slate-500">Instructions for AI</label>
                                                        <textarea
                                                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[140px]"
                                                            placeholder="Describe the content you want, include depth, examples, and any constraints."
                                                            value={noteForm.instructions}
                                                            onChange={(e) => setNoteForm((prev) => ({ ...prev, instructions: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                                                        <div>
                                                            <label className="text-xs text-slate-600">Attach Context Material (Optional)</label>
                                                            <p className="text-xs text-slate-500">Upload or reference existing material to guide the AI output (syllabus, lesson notes, worksheets, or examples).</p>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs text-slate-500">Upload new files</label>
                                                                <input
                                                                    type="file"
                                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                                                                    onChange={(e) => setContentFiles(e.target.files ? Array.from(e.target.files) : [])}
                                                                    multiple
                                                                />
                                                                {contentFiles.length > 0 && (
                                                                    <p className="text-xs text-slate-500 mt-1">{contentFiles.length} file(s) selected.</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-500">Reference existing material</label>
                                                                <select
                                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                                                                >
                                                                    <option value="">Select from uploaded material</option>
                                                                    {recentUploads.map((item) => (
                                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                                    ))}
                                                                </select>
                                                                <p className="text-xs text-slate-500 mt-1">Choose a previously uploaded file to provide context.</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="text-xs text-slate-500">Write Content</label>
                                                        <textarea
                                                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[180px]"
                                                            placeholder="Start typing your content..."
                                                            value={noteForm.content}
                                                            onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                                                        <div>
                                                            <label className="text-xs text-slate-600">Attach Material (Optional)</label>
                                                            <p className="text-xs text-slate-500">Attach supporting files like worksheets, slides, or documents for students.</p>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs text-slate-500">Upload new files</label>
                                                                <input
                                                                    type="file"
                                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                                                                    onChange={(e) => setContentFiles(e.target.files ? Array.from(e.target.files) : [])}
                                                                    multiple
                                                                />
                                                                {contentFiles.length > 0 && (
                                                                    <p className="text-xs text-slate-500 mt-1">{contentFiles.length} file(s) selected.</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-500">Reference existing material</label>
                                                                <select
                                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                                                                >
                                                                    <option value="">Select from uploaded material</option>
                                                                    {recentUploads.map((item) => (
                                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                                    ))}
                                                                </select>
                                                                <p className="text-xs text-slate-500 mt-1">Use an existing upload instead of adding a new file.</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}

                                    {noteStep === 'generate' && (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                                            <Sparkles size={32} className="text-blue-500 mb-4" />
                                            <p className="text-sm">Generating content. Please wait...</p>
                                        </div>
                                    )}

                                    {noteStep === 'review' && (
                                        <>
                                            <div>
                                                <label className="text-xs text-slate-500">Review & Edit Content</label>
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

                                </div>
                                <div className="bg-slate-50 border-t border-slate-200 p-4">
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
                                                    {noteMode === 'ai' ? 'Generate Content' : 'Continue'}
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
                                <h1 className="text-2xl font-bold">Content Drafts</h1>
                                <p className="text-sm text-slate-500">Manage saved drafts before publishing.</p>
                            </div>
                        </header>

                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
                            {draftNotes.length === 0 ? (
                                <p className="text-sm text-slate-500">No drafts yet. Create content and save it as drafts.</p>
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

                {activeAction === 'material' && (
                    <div className="space-y-6">
                        <header className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold">Material</h1>
                                <p className="text-sm text-slate-500">Manage uploaded teaching material.</p>
                            </div>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Upload Material
                            </button>
                        </header>

                        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="relative flex-1">
                                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={materialSearch}
                                    onChange={(e) => setMaterialSearch(e.target.value)}
                                    placeholder="Search material..."
                                    className="w-full pl-10 pr-4 py-2 border bg-white border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Subject</span>
                                <select
                                    className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                                    value={materialSubjectFilter}
                                    onChange={(e) => setMaterialSubjectFilter(e.target.value)}
                                >
                                    <option value="all">All subjects</option>
                                    {subjects.map((subject) => (
                                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Type</span>
                                <select
                                    className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                                    value={materialTypeFilter}
                                    onChange={(e) => setMaterialTypeFilter(e.target.value)}
                                >
                                    <option value="all">All types</option>
                                    <option value="document">Document</option>
                                    <option value="image">Image</option>
                                    <option value="video">Video</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {filteredMaterials.length === 0 ? (
                                <div className="bg-white border border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-500">
                                    No material uploaded yet.
                                </div>
                            ) : (
                                filteredMaterials.map((item) => (
                                    <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-800">{item.name}</p>
                                            <p className="text-xs text-slate-500">{item.subject?.name} • Uploaded by {item.uploadedBy?.firstName} {item.uploadedBy?.lastName}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button className="text-sm text-blue-600 hover:text-blue-700">View</button>
                                            <button className="text-sm text-slate-600 hover:text-slate-700">Download</button>
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

export default ResourcesDashboard;
