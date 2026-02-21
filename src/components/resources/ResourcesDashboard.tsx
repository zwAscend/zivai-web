// src/components/resources/ResourcesDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowUp, Folder, Search as SearchIcon, BarChart, Star, UploadCloud, Link as LinkIcon, Sparkles, BookOpen, CalendarDays, Send, Maximize2, Minimize2, GripVertical, Wand2, Paperclip, Settings2, X, type LucideIcon } from 'lucide-react';
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

interface UploadModalSubject {
    id: string;
    name: string;
    code?: string;
}

interface CollaboratorThreadEntry {
    id: string;
    role: 'user' | 'assistant';
    type: 'prompt' | 'summary';
    text: string;
    details?: string[];
    status?: 'success' | 'error' | 'info';
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
    const [isContentGenerating, setIsContentGenerating] = useState(false);
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState(false);
    const [aiPanelWidth, setAiPanelWidth] = useState(360);
    const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
    const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1280 : true));
    const [contentType, setContentType] = useState('Notes');
    const [contentFiles, setContentFiles] = useState<File[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedReferenceResourceIds, setSelectedReferenceResourceIds] = useState<string[]>([]);
    const workspaceRef = useRef<HTMLDivElement | null>(null);
    const contextFileInputRef = useRef<HTMLInputElement | null>(null);
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
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentionOpen, setIsMentionOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [referenceSearch, setReferenceSearch] = useState('');
    const [aiThread, setAiThread] = useState<CollaboratorThreadEntry[]>([]);

    // Modals State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState<Subject | null>(null);
    const collaboratorPromptRef = useRef<HTMLTextAreaElement | null>(null);
    const threadEndRef = useRef<HTMLDivElement | null>(null);
    const configButtonRef = useRef<HTMLButtonElement | null>(null);
    const configMenuRef = useRef<HTMLDivElement | null>(null);

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

    useEffect(() => {
        if (!isResizingAiPanel) return;

        const handleMouseMove = (event: MouseEvent) => {
            const bounds = workspaceRef.current?.getBoundingClientRect();
            if (!bounds) return;
            const minPanelWidth = 280;
            const maxPanelWidth = 640;
            const nextWidth = bounds.right - event.clientX;
            const clampedWidth = Math.max(minPanelWidth, Math.min(maxPanelWidth, nextWidth));
            setAiPanelWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizingAiPanel(false);
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingAiPanel]);

    useEffect(() => {
        const onResize = () => {
            setIsDesktop(window.innerWidth >= 1280);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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

    const availableReferenceResources = useMemo(() => {
        if (!noteForm.subjectId) return recentUploads.slice(0, 12);
        return recentUploads
            .filter((upload) => upload.subject?.id === noteForm.subjectId)
            .slice(0, 12);
    }, [recentUploads, noteForm.subjectId]);

    const selectedSubjectName = useMemo(() => (
        subjects.find((subject) => subject.id === noteForm.subjectId)?.name || 'Not selected'
    ), [subjects, noteForm.subjectId]);

    const mentionSuggestions = useMemo(() => {
        const query = mentionQuery.trim().toLowerCase();
        return availableReferenceResources
            .filter((resource) => (
                (!query || resource.name.toLowerCase().includes(query))
                && !selectedReferenceResourceIds.includes(resource.id)
            ))
            .slice(0, 8);
    }, [availableReferenceResources, mentionQuery, selectedReferenceResourceIds]);

    const selectedReferenceResources = useMemo(() => (
        availableReferenceResources.filter((resource) => selectedReferenceResourceIds.includes(resource.id))
    ), [availableReferenceResources, selectedReferenceResourceIds]);

    const filteredReferenceResources = useMemo(() => {
        const query = referenceSearch.trim().toLowerCase();
        if (!query) return availableReferenceResources;
        return availableReferenceResources.filter((resource) => resource.name.toLowerCase().includes(query));
    }, [availableReferenceResources, referenceSearch]);

    const uploadSubjects = useMemo<UploadModalSubject[]>(() => (
        subjects.map(({ id, name, code }) => ({ id, name, code }))
    ), [subjects]);

    const selectedUploadSubject = useMemo<UploadModalSubject | null>(() => {
        if (!selectedSubjectForUpload) return null;
        const { id, name, code } = selectedSubjectForUpload;
        return { id, name, code };
    }, [selectedSubjectForUpload]);

    useEffect(() => {
        setSelectedReferenceResourceIds((prev) =>
            prev.filter((id) => availableReferenceResources.some((resource) => resource.id === id))
        );
    }, [availableReferenceResources]);

    useEffect(() => {
        if (!isConfigOpen) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (configMenuRef.current?.contains(target)) return;
            if (configButtonRef.current?.contains(target)) return;
            setIsConfigOpen(false);
        };

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsConfigOpen(false);
            }
        };

        window.addEventListener('mousedown', onPointerDown);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', onEscape);
        };
    }, [isConfigOpen]);

    useEffect(() => {
        if (isAiPanelCollapsed) {
            setIsConfigOpen(false);
        }
    }, [isAiPanelCollapsed]);

    useEffect(() => {
        if (isAiPanelCollapsed) return;
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [aiThread, isContentGenerating, isAiPanelCollapsed]);

    const handleCollaboratorPromptChange = (value: string, cursorPosition: number) => {
        setNoteForm((prev) => ({ ...prev, instructions: value }));
        const beforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = /(?:^|\s)@([^\s@]*)$/.exec(beforeCursor);
        if (mentionMatch) {
            setMentionQuery(mentionMatch[1] || '');
            setIsMentionOpen(true);
        } else {
            setMentionQuery('');
            setIsMentionOpen(false);
        }
    };

    const insertReferenceMention = (resource: RecentUpload) => {
        const textarea = collaboratorPromptRef.current;
        const currentPrompt = noteForm.instructions;
        const cursorPosition = textarea?.selectionStart ?? currentPrompt.length;
        const beforeCursor = currentPrompt.slice(0, cursorPosition);
        const afterCursor = currentPrompt.slice(cursorPosition);
        const mentionToken = `@[${resource.name}]`;
        const nextBefore = beforeCursor.replace(/(?:^|\s)@([^\s@]*)$/, (match) => {
            if (match.startsWith(' ')) return ` ${mentionToken}`;
            return mentionToken;
        });
        const nextPrompt = `${nextBefore}${afterCursor}`;

        setNoteForm((prev) => ({ ...prev, instructions: nextPrompt }));
        setSelectedReferenceResourceIds((prev) => (
            prev.includes(resource.id) ? prev : [...prev, resource.id]
        ));
        setIsMentionOpen(false);
        setMentionQuery('');

        requestAnimationFrame(() => {
            if (!textarea) return;
            const nextCursor = nextBefore.length;
            textarea.focus();
            textarea.setSelectionRange(nextCursor, nextCursor);
        });
    };

    const handleGenerateNotes = () => {
        setSelectedClass(null);
        setActiveAction('generate-notes');
    };

    const handleGenerateOnCanvas = () => {
        if (!noteForm.title.trim()) {
            toast.error('Please add a title for the content.');
            return;
        }
        if (!noteForm.instructions.trim()) {
            toast.error('Add a collaborator prompt for AI.');
            return;
        }
        const promptText = noteForm.instructions.trim();
        const selectedReferenceNames = availableReferenceResources
            .filter((resource) => selectedReferenceResourceIds.includes(resource.id))
            .map((resource) => resource.name);
        setAiThread((prev) => ([
            ...prev,
            {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'user',
                type: 'prompt',
                text: promptText,
            },
        ]));
        setNoteForm((prev) => ({ ...prev, instructions: '' }));
        setMentionQuery('');
        setIsMentionOpen(false);
        setIsContentGenerating(true);
        setTimeout(() => {
            const referencesBlock = selectedReferenceNames.length > 0
                ? `\n\n## Referenced material\n${selectedReferenceNames.map((name) => `- ${name}`).join('\n')}`
                : '';
            setNoteForm((prev) => ({
                ...prev,
                content: `${prev.content ? `${prev.content}\n\n` : ''}# ${prev.title}\n\n${promptText}\n\n## Suggested outline\n- Learning objective\n- Key concept explanation\n- Worked example\n- Retrieval check questions\n- Reflection prompt${referencesBlock}`,
            }));
            setAiThread((prev) => ([
                ...prev,
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    role: 'assistant',
                    type: 'summary',
                    status: 'success',
                    text: 'Done. I generated a draft and inserted it into the content canvas.',
                    details: [
                        `Title: ${noteForm.title}`,
                        `Content type: ${contentType}`,
                        selectedReferenceNames.length > 0 ? `References attached: ${selectedReferenceNames.length}` : '',
                        contentFiles.length > 0 ? `Context files used: ${contentFiles.length}` : '',
                    ].filter(Boolean),
                },
            ]));
            setIsContentGenerating(false);
            toast.success('AI draft added to canvas. Review and edit freely.');
        }, 700);
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
        setNoteForm((prev) => ({ ...prev, content: '', instructions: '', title: '' }));
    };

    const handleSchedule = () => {
        if (!noteForm.scheduledFor) {
            toast.error('Select a date/time to schedule.');
            return;
        }
        toast.success('Content scheduled.');
    };

    const handleEditDraft = (draftIndex: number) => {
        const draft = draftNotes[draftIndex];
        if (!draft) return;
        setNoteForm(draft);
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
            <main className={`flex-1 p-8 ${activeAction === 'generate-notes' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
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
                    <div className="flex-1 min-h-0">
                        {isContentExpanded && <div className="fixed inset-0 bg-black/30 z-40" />}
                        <div className={`${isContentExpanded ? 'fixed top-4 left-4 right-4 bottom-6 z-50' : 'h-full'}`}>
                            <div className={`${isContentExpanded ? 'bg-white rounded-lg shadow-2xl border border-slate-200 h-full max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col' : 'bg-white rounded-lg shadow-sm border border-slate-200 h-full overflow-hidden flex flex-col'}`}>
                                {isContentExpanded && (
                                    <button
                                        onClick={() => setIsContentExpanded(false)}
                                        className="absolute top-3 right-3 z-10 p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                        aria-label="Collapse canvas"
                                    >
                                        <Minimize2 size={18} />
                                    </button>
                                )}
                                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Wand2 className="w-4 h-4 text-blue-600" />
                                        Unified teacher + AI authoring workspace
                                    </div>
                                    <button
                                        onClick={() => setIsContentExpanded((prev) => !prev)}
                                        className="p-2 rounded-full hover:bg-gray-100"
                                        aria-label={isContentExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        {isContentExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                    </button>
                                </div>
                                <div ref={workspaceRef} className="flex-1 min-h-0 flex flex-col xl:flex-row gap-0">
                                    <div className="min-w-0 flex-1 p-6 space-y-6 overflow-y-auto">
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

                                        <div>
                                            <label className="text-xs text-slate-500">Content Canvas</label>
                                            <textarea
                                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[280px]"
                                                value={noteForm.content}
                                                onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                                                placeholder="Write the lesson material here. AI drafts will be inserted directly into this canvas."
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
                                    </div>

                                    {!isAiPanelCollapsed && (
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                setIsResizingAiPanel(true);
                                            }}
                                            className="hidden xl:flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-slate-100 bg-slate-50 hover:bg-blue-50 transition-colors"
                                            aria-label="Resize AI collaborator panel"
                                        >
                                            <GripVertical className="w-3 h-8 text-slate-400" />
                                        </button>
                                    )}

                                    <aside
                                        className={`bg-slate-50 overflow-hidden border-t xl:border-t-0 xl:border-l border-slate-100 transition-all duration-200 ${isAiPanelCollapsed ? 'p-3' : 'p-6'} flex flex-col gap-4`}
                                        style={isDesktop ? { width: isAiPanelCollapsed ? 56 : aiPanelWidth } : undefined}
                                    >
                                        <div className={`flex items-center ${isAiPanelCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
                                            {!isAiPanelCollapsed && (
                                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                    <Sparkles size={16} className="text-blue-600" />
                                                    AI Collaborator
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsAiPanelCollapsed((prev) => !prev)}
                                                className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:border-slate-300"
                                                aria-label={isAiPanelCollapsed ? 'Expand AI collaborator panel' : 'Collapse AI collaborator panel'}
                                            >
                                                {isAiPanelCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                                            </button>
                                        </div>

                                        {isAiPanelCollapsed ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsAiPanelCollapsed(false)}
                                                className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white py-2 text-slate-600 hover:text-slate-800"
                                                aria-label="Expand AI collaborator panel"
                                            >
                                                <Sparkles size={16} />
                                            </button>
                                        ) : (
                                            <>
                                                <div className="flex-1 min-h-0 border border-slate-200 rounded-lg bg-white p-3 overflow-y-auto space-y-3">
                                                    {aiThread.length === 0 && !isContentGenerating && (
                                                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                                                            Prompts and AI completion summaries will appear here.
                                                        </div>
                                                    )}
                                                    {aiThread.map((entry) => (
                                                        <div
                                                            key={entry.id}
                                                            className={entry.role === 'user'
                                                                ? 'ml-auto max-w-[92%] rounded-xl bg-blue-600 px-3 py-2 text-sm text-white'
                                                                : clsx(
                                                                    'mr-auto max-w-[95%] rounded-xl border px-3 py-2 text-sm',
                                                                    entry.status === 'error' && 'border-rose-200 bg-rose-50 text-rose-700',
                                                                    entry.status === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                                                                    !entry.status && 'border-slate-200 bg-white text-slate-700'
                                                                )}
                                                        >
                                                            {entry.role === 'assistant' && entry.type === 'summary' && (
                                                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">Completion summary</div>
                                                            )}
                                                            <p className="whitespace-pre-wrap">{entry.text}</p>
                                                            {entry.details && entry.details.length > 0 && (
                                                                <div className="mt-2 space-y-1 text-xs">
                                                                    {entry.details.map((detail) => (
                                                                        <div key={`${entry.id}-${detail}`}>- {detail}</div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {isContentGenerating && (
                                                        <div className="mr-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                                                        </div>
                                                    )}
                                                    <div ref={threadEndRef} />
                                                </div>

                                                <div className="mt-auto border border-slate-200 rounded-lg bg-white p-3 space-y-3">
                                                    <div className="relative">
                                                        <textarea
                                                            ref={collaboratorPromptRef}
                                                            className="w-full border border-slate-200 rounded-md px-3 py-2 pr-16 pb-12 text-sm min-h-[140px]"
                                                            placeholder="Prompt AI here. Use @ to attach library references."
                                                            value={noteForm.instructions}
                                                            onChange={(e) => handleCollaboratorPromptChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && isMentionOpen && mentionSuggestions.length > 0) {
                                                                    e.preventDefault();
                                                                    insertReferenceMention(mentionSuggestions[0]);
                                                                }
                                                            }}
                                                        />
                                                        {isMentionOpen && mentionSuggestions.length > 0 && (
                                                            <div className="absolute left-0 right-0 mt-1 z-20 border border-slate-200 bg-white rounded-md shadow-lg max-h-44 overflow-y-auto">
                                                                {mentionSuggestions.map((resource) => (
                                                                    <button
                                                                        key={resource.id}
                                                                        type="button"
                                                                        onClick={() => insertReferenceMention(resource)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                                    >
                                                                        @{resource.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateOnCanvas}
                                                            disabled={isContentGenerating}
                                                            className="absolute right-2 bottom-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-60"
                                                            aria-label={isContentGenerating ? 'AI is thinking' : 'Generate on canvas'}
                                                        >
                                                            {isContentGenerating ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.2s]" />
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.1s]" />
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                                                                </span>
                                                            ) : (
                                                                <ArrowUp size={14} />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <input
                                                        ref={contextFileInputRef}
                                                        type="file"
                                                        className="hidden"
                                                        multiple
                                                        onChange={(event) => {
                                                            const nextFiles = event.target.files ? Array.from(event.target.files) : [];
                                                            if (!nextFiles.length) return;
                                                            setContentFiles((prev) => {
                                                                const merged = [...prev];
                                                                nextFiles.forEach((file) => {
                                                                    const exists = merged.some(
                                                                        (existing) => existing.name === file.name
                                                                            && existing.size === file.size
                                                                            && existing.lastModified === file.lastModified
                                                                    );
                                                                    if (!exists) merged.push(file);
                                                                });
                                                                return merged;
                                                            });
                                                            event.target.value = '';
                                                        }}
                                                    />
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => contextFileInputRef.current?.click()}
                                                                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-700"
                                                            >
                                                                <Paperclip size={14} />
                                                                Attach context
                                                            </button>
                                                            <div className="relative z-20">
                                                                <button
                                                                    ref={configButtonRef}
                                                                    type="button"
                                                                    onClick={() => setIsConfigOpen((prev) => !prev)}
                                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                                                                >
                                                                    <Settings2 size={14} />
                                                                    Configure
                                                                </button>
                                                                {isConfigOpen && (
                                                                    <div
                                                                        ref={configMenuRef}
                                                                        className="absolute right-0 top-full mt-2 z-40 w-[320px] max-w-[80vw] border border-slate-200 rounded-lg bg-white shadow-xl p-3 space-y-3"
                                                                    >
                                                                        <label className="text-xs text-slate-600">Reference Material In Library (Optional)</label>
                                                                        <input
                                                                            value={referenceSearch}
                                                                            onChange={(e) => setReferenceSearch(e.target.value)}
                                                                            className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs"
                                                                            placeholder="Search..."
                                                                        />
                                                                        {availableReferenceResources.length === 0 ? (
                                                                            <p className="text-xs text-slate-500">No uploaded material available for this subject yet.</p>
                                                                        ) : filteredReferenceResources.length === 0 ? (
                                                                            <p className="text-xs text-slate-500">No matching material.</p>
                                                                        ) : (
                                                                            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-md bg-white p-2 space-y-2">
                                                                                {filteredReferenceResources.map((resource) => (
                                                                                    <label key={resource.id} className="flex items-start gap-2 text-xs text-slate-700">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={selectedReferenceResourceIds.includes(resource.id)}
                                                                                            onChange={(event) => {
                                                                                                setSelectedReferenceResourceIds((prev) => (
                                                                                                    event.target.checked
                                                                                                        ? [...prev, resource.id]
                                                                                                        : prev.filter((id) => id !== resource.id)
                                                                                                ));
                                                                                            }}
                                                                                            className="mt-0.5"
                                                                                        />
                                                                                        <span>{resource.name}</span>
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {contentFiles.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setContentFiles([])}
                                                                className="text-xs text-slate-500 hover:text-red-600"
                                                            >
                                                                Clear all
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-slate-500">Type @ to attach reference</span>
                                                    {selectedReferenceResources.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedReferenceResources.map((resource) => (
                                                                <span key={resource.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                                                                    @{resource.name}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedReferenceResourceIds((prev) => prev.filter((id) => id !== resource.id))}
                                                                        className="text-slate-400 hover:text-slate-700"
                                                                        aria-label={`Remove ${resource.name}`}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {contentFiles.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {contentFiles.map((file, index) => (
                                                                <span key={`${file.name}-${file.lastModified}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                                                                    {file.name}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setContentFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                                                                        className="text-slate-400 hover:text-slate-700"
                                                                        aria-label={`Remove ${file.name}`}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </aside>
                                </div>

                                <div className="bg-gray-50 border-t border-gray-200 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsPreviewOpen(true)}
                                            className="px-4 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        >
                                            Preview Content
                                        </button>
                                        <div className="flex flex-wrap justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={handleSaveDraft}
                                                className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            >
                                                Save Draft
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSchedule}
                                                className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            >
                                                Schedule
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePublish}
                                                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                            >
                                                Publish Now
                                            </button>
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

            {isPreviewOpen && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Content Preview</h2>
                                <p className="text-xs text-slate-600">{contentType} • {selectedSubjectName} • {noteForm.grade}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPreviewOpen(false)}
                                className="px-3 py-1.5 rounded-md text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5 space-y-5">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                                <div className="text-sm font-semibold text-slate-900">{noteForm.title || 'Untitled content'}</div>
                                <div className="text-xs text-slate-600">
                                    Status: {noteForm.status === 'publish' ? 'Publish Now' : noteForm.status === 'schedule' ? 'Schedule' : 'Draft'}
                                </div>
                                {noteForm.instructions && (
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{noteForm.instructions}</p>
                                )}
                            </div>

                            {noteForm.content ? (
                                <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                                    <h3 className="text-sm font-semibold text-slate-800">Canvas Content</h3>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{noteForm.content}</p>
                                </div>
                            ) : (
                                <div className="border border-dashed border-slate-300 rounded-lg p-6 text-sm text-slate-500">
                                    No content in canvas yet.
                                </div>
                            )}

                            {selectedReferenceResourceIds.length > 0 && (
                                <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                                    <h3 className="text-sm font-semibold text-slate-800">Reference Material</h3>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        {availableReferenceResources
                                            .filter((resource) => selectedReferenceResourceIds.includes(resource.id))
                                            .map((resource) => (
                                                <li key={`preview-reference-${resource.id}`}>- {resource.name}</li>
                                            ))}
                                    </ul>
                                </div>
                            )}

                            {contentFiles.length > 0 && (
                                <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                                    <h3 className="text-sm font-semibold text-slate-800">Attached Context Files</h3>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        {contentFiles.map((file, index) => (
                                            <li key={`preview-file-${file.name}-${index}`}>- {file.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUploadSuccess={handleFileUploadSuccess}
                selectedSubject={selectedUploadSubject}
                subjects={uploadSubjects}
                onSubjectSelect={(subject) => {
                    const matchedSubject = subjects.find((item) => item.id === subject.id) || null;
                    setSelectedSubjectForUpload(matchedSubject);
                }}
            />
        </div>
    );
};

// --- Child Components ---

interface StatCardProps {
    icon: LucideIcon;
    value: string | number;
    label: string;
    color: 'blue' | 'green' | 'purple' | 'amber';
    isText?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, value, label, color, isText = false }) => (
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
