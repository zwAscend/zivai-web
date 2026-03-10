// src/components/resources/ResourcesDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import {
    AlignJustify,
    ArrowUp,
    Bold,
    BookOpen,
    Bot,
    CalendarDays,
    Code2,
    ImagePlus,
    Italic,
    Link2,
    List,
    ListOrdered,
    Maximize2,
    MessageSquare,
    Minimize2,
    PanelRightClose,
    PanelRightOpen,
    Paperclip,
    Pencil,
    Printer,
    RefreshCw,
    Save,
    Search as SearchIcon,
    Send,
    Settings2,
    Table,
    Underline,
    Undo2,
    Redo2,
    UploadCloud,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from './Sidebar';
import UploadModal from './UploadModal';
import ResourcesView from './ResourcesView';
import { authService } from '../../services/authService';
import { curriculumService, CurriculumTopic } from '../../services/curriculumService';
import { resourceService, ResourceItem } from '../../services/resourceService';
import { schoolService, SchoolItem } from '../../services/schoolService';
import { fetchData } from '../../services/http';
import {
    RESOURCE_CONTENT_TYPES,
    ResourceContentType,
    getResourceContentTypeLabel,
} from '../../constants/resourceContentTypes';

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

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const textToHtml = (value: string) => escapeHtml(value).replace(/\n/g, '<br />');

const normalizeEditorHtmlContent = (value: string) => {
    let normalized = value;
    for (let index = 0; index < 5; index += 1) {
        const decoded = normalized.replace(/&amp;([a-zA-Z#0-9]+;)/g, '&$1');
        if (decoded === normalized) {
            break;
        }
        normalized = decoded;
    }
    return normalized;
};

const stripHtmlToText = (value: string) => value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildFallbackResourceTitle = (contentType: ResourceContentType) =>
    `${getResourceContentTypeLabel(contentType)} ${new Date().toLocaleString()}`;

const isResourceContentType = (value?: string | null): value is ResourceContentType => {
    if (!value) return false;
    return (RESOURCE_CONTENT_TYPES as readonly string[]).includes(value);
};

// --- Component Starts ---
const ResourcesDashboard: React.FC = () => {

    // --- State Management ---
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [schools, setSchools] = useState<SchoolItem[]>([]);
    const [curriculumTopics, setCurriculumTopics] = useState<CurriculumTopic[]>([]);
    const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
    const [selectedClass, setSelectedClass] = useState<Subject | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeAction, setActiveAction] = useState<'view-notes' | 'generate-notes' | 'lesson-plans' | 'drafts' | 'material'>('generate-notes');
    const [isContentGenerating, setIsContentGenerating] = useState(false);
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState(false);
    const [contentType, setContentType] = useState<ResourceContentType>('notes');
    const [contentFiles, setContentFiles] = useState<File[]>([]);
    const [selectedReferenceResourceIds, setSelectedReferenceResourceIds] = useState<string[]>([]);
    const contextFileInputRef = useRef<HTMLInputElement | null>(null);
    const resourceEditorRef = useRef<HTMLDivElement | null>(null);
    const resourceOverlayHostRef = useRef<HTMLDivElement | null>(null);
    const resourceImageInputRef = useRef<HTMLInputElement | null>(null);
    const savedSelectionRef = useRef<Range | null>(null);
    const [noteForm, setNoteForm] = useState({
        resourceId: '',
        subjectId: '',
        topicId: '',
        grade: 'Form 1',
        title: '',
        instructions: '',
        content: '',
        status: 'draft',
        scheduledFor: ''
    });
    const [draftResources, setDraftResources] = useState<ResourceItem[]>([]);
    const [isDraftsLoading, setIsDraftsLoading] = useState(false);
    const [activeDraftResourceId, setActiveDraftResourceId] = useState<string | null>(null);
    const [contentSearch, setContentSearch] = useState('');
    const [contentSubjectFilter, setContentSubjectFilter] = useState('all');
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialSubjectFilter, setMaterialSubjectFilter] = useState('all');
    const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentionOpen, setIsMentionOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isWorkspaceConfigOpen, setIsWorkspaceConfigOpen] = useState(false);
    const [referenceSearch, setReferenceSearch] = useState('');
    const [aiThread, setAiThread] = useState<CollaboratorThreadEntry[]>([]);
    const [selectionActionOverlay, setSelectionActionOverlay] = useState<{ top: number; left: number; text: string } | null>(null);
    const [selectionActionHint, setSelectionActionHint] = useState<string | null>(null);
    const [persistedResourceId, setPersistedResourceId] = useState<string | null>(null);
    const [isContentLinkModalOpen, setIsContentLinkModalOpen] = useState(false);
    const [contentLinkValue, setContentLinkValue] = useState('');

    // Modals State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState<Subject | null>(null);
    const collaboratorPromptRef = useRef<HTMLTextAreaElement | null>(null);
    const threadEndRef = useRef<HTMLDivElement | null>(null);
    const configButtonRef = useRef<HTMLButtonElement | null>(null);
    const configMenuRef = useRef<HTMLDivElement | null>(null);
    const workspaceConfigButtonRef = useRef<HTMLButtonElement | null>(null);
    const workspaceConfigMenuRef = useRef<HTMLDivElement | null>(null);
    const scheduleInputRef = useRef<HTMLInputElement | null>(null);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const [subjectData, countsData, recentData] = await Promise.all([
                fetchData<any[]>('/subjects/teaching', { forceRefresh: true }),
                fetchData<Record<string, any>>('/resources/counts', { forceRefresh: true }),
                fetchData<RecentUpload[]>('/resources/recent?limit=5', { forceRefresh: true }),
            ]);
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
            setRecentUploads(Array.isArray(recentData) ? recentData : []);
        } catch (error) { console.error('Error fetching dashboard data:', error);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        const loadSchools = async () => {
            try {
                const data = await schoolService.getSchools();
                setSchools(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Error fetching schools:', error);
                setSchools([]);
            }
        };

        loadSchools();
    }, []);

    useEffect(() => {
        const loadCurriculumTopics = async () => {
            if (!noteForm.subjectId) {
                setCurriculumTopics([]);
                setNoteForm((prev) => ({ ...prev, topicId: '' }));
                return;
            }

            try {
                const data = await curriculumService.listTopics(noteForm.subjectId);
                const topics = Array.isArray(data) ? data : [];
                setCurriculumTopics(topics);
                setNoteForm((prev) => ({
                    ...prev,
                    topicId: topics.some((topic) => topic.id === prev.topicId) ? prev.topicId : '',
                }));
            } catch (error) {
                console.error('Error fetching curriculum topics:', error);
                setCurriculumTopics([]);
            }
        };

        loadCurriculumTopics();
    }, [noteForm.subjectId]);

    useEffect(() => {
        if (noteForm.subjectId || subjects.length === 0) return;
        setNoteForm((prev) => ({
            ...prev,
            subjectId: subjects[0].id,
        }));
    }, [noteForm.subjectId, subjects]);

    const fetchDraftResources = useCallback(async () => {
        setIsDraftsLoading(true);
        try {
            const rows = await resourceService.list({ status: 'draft' });
            const contentDrafts = (Array.isArray(rows) ? rows : [])
                .filter((resource) => Boolean(resource.contentType))
                .sort((left, right) => {
                    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
                    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
                    return rightTime - leftTime;
                });
            setDraftResources(contentDrafts);
        } catch (error) {
            console.error('Failed to load resource drafts:', error);
            setDraftResources([]);
        } finally {
            setIsDraftsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeAction !== 'drafts') return;
        void fetchDraftResources();
    }, [activeAction, fetchDraftResources]);

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

    const handleCreateLessonPlan = () => {
        setSelectedClass(null);
        setActiveAction('generate-notes');
        setContentType('lesson_plan');
        setPersistedResourceId(null);
        setNoteForm((prev) => ({
            ...prev,
            resourceId: '',
            title: prev.title || 'New Lesson Plan',
            status: 'draft',
        }));
        toast.success('Lesson plan workspace is ready.');
    };

    const handleViewLessonPlan = (subject: Subject) => {
        setSelectedClass(null);
        setActiveAction('generate-notes');
        setContentType('lesson_plan');
        setPersistedResourceId(null);
        setNoteForm((prev) => ({
            ...prev,
            resourceId: '',
            subjectId: subject.id,
            topicId: '',
            title: prev.title || `${subject.name} Lesson Plan`,
            status: 'draft',
        }));
        toast.success(`Opened lesson plan for ${subject.name}.`);
    };
    
    const handleDrafts = () => {
        setSelectedClass(null);
        setActiveAction('drafts');
        void fetchDraftResources();
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
        if (!isWorkspaceConfigOpen) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (workspaceConfigMenuRef.current?.contains(target)) return;
            if (workspaceConfigButtonRef.current?.contains(target)) return;
            setIsWorkspaceConfigOpen(false);
        };

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsWorkspaceConfigOpen(false);
            }
        };

        window.addEventListener('mousedown', onPointerDown);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', onEscape);
        };
    }, [isWorkspaceConfigOpen]);

    useEffect(() => {
        if (isAiPanelCollapsed) {
            setIsConfigOpen(false);
        }
    }, [isAiPanelCollapsed]);

    const handlePrintContent = () => {
        const printWindow = window.open('', '_blank', 'width=960,height=720');
        if (!printWindow) {
            toast.error('Unable to open print window.');
            return;
        }

        const subjectName = selectedSubjectName === 'Not selected' ? '' : selectedSubjectName;
        const title = noteForm.title || 'Untitled content';
        const content = noteForm.content || '<p>No content in canvas yet.</p>';

        printWindow.document.write(`
            <!doctype html>
            <html>
              <head>
                <title>${title}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
                  .meta { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
                  .meta h1 { margin: 0 0 8px; font-size: 24px; }
                  .meta p { margin: 4px 0; font-size: 13px; color: #475569; }
                  .content { font-size: 14px; line-height: 1.6; }
                  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                  td, th { border: 1px solid #cbd5e1; padding: 8px; }
                  img { max-width: 100%; height: auto; }
                  pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; overflow-x: auto; }
                  blockquote { border-left: 4px solid #cbd5e1; margin: 16px 0; padding-left: 12px; color: #475569; }
                </style>
              </head>
              <body>
                <div class="meta">
                  <h1>${escapeHtml(title)}</h1>
                  <p>${escapeHtml(getResourceContentTypeLabel(contentType))}${subjectName ? ` • ${escapeHtml(subjectName)}` : ''} • ${escapeHtml(noteForm.grade)}</p>
                  <p>Status: ${escapeHtml(noteForm.status === 'publish' ? 'Publish Now' : noteForm.status === 'schedule' ? 'Schedule' : 'Draft')}</p>
                </div>
                <div class="content">${content}</div>
              </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    useEffect(() => {
        if (isAiPanelCollapsed) return;
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [aiThread, isContentGenerating, isAiPanelCollapsed]);

    const resizeCollaboratorTextarea = useCallback(() => {
        const textarea = collaboratorPromptRef.current;
        if (!textarea) return;

        const minHeight = 120;
        const maxHeight = 260;
        textarea.style.height = '0px';
        const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, []);

    useEffect(() => {
        resizeCollaboratorTextarea();
    }, [noteForm.instructions, isAiPanelCollapsed, resizeCollaboratorTextarea]);

    useEffect(() => {
        if (!resourceEditorRef.current) return;
        if (resourceEditorRef.current.innerHTML === noteForm.content) return;
        resourceEditorRef.current.innerHTML = noteForm.content;
    }, [noteForm.content, activeAction]);

    const captureResourceSelection = useCallback(() => {
        if (!resourceEditorRef.current) {
            setSelectionActionOverlay(null);
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            setSelectionActionOverlay(null);
            return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const rootNode = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
        const selectedText = selection.toString().replace(/\s+/g, ' ').trim();

        if (rootNode && resourceEditorRef.current.contains(rootNode)) {
            savedSelectionRef.current = range.cloneRange();
            if (!range.collapsed && selectedText.length > 0 && resourceOverlayHostRef.current) {
                const hostRect = resourceOverlayHostRef.current.getBoundingClientRect();
                const rangeRect = range.getBoundingClientRect();
                if (rangeRect.width > 0 || rangeRect.height > 0) {
                    const railWidth = 44;
                    const left = Math.max(8, Math.min(rangeRect.right - hostRect.left + 10, hostRect.width - railWidth - 8));
                    const top = Math.max(
                        8,
                        Math.min(
                            rangeRect.top - hostRect.top + (rangeRect.height > 0 ? rangeRect.height / 2 - 22 : 0),
                            Math.max(8, hostRect.height - 88)
                        )
                    );
                    setSelectionActionOverlay({ top, left, text: selectedText });
                    return;
                }
            }
        }

        setSelectionActionOverlay(null);
        setSelectionActionHint(null);
    }, []);

    const preserveResourceSelectionOnMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        captureResourceSelection();
    };

    const handleResourceSelectionAction = (action: 'change' | 'different' | 'chat') => {
        if (!selectionActionOverlay?.text) return;
        const excerpt = selectionActionOverlay.text;
        setIsAiPanelCollapsed(false);

        if (action === 'change') {
            setNoteForm((prev) => ({
                ...prev,
                instructions: `Make targeted edits to this highlighted section while preserving meaning:\n"${excerpt}"`,
            }));
            toast.success('Highlighted text sent to AI for targeted changes.');
            return;
        }

        if (action === 'different') {
            setNoteForm((prev) => ({
                ...prev,
                instructions: `Rewrite this highlighted section using a different approach:\n"${excerpt}"`,
            }));
            toast.success('Highlighted text sent to AI for an alternative rewrite.');
            return;
        }

        setNoteForm((prev) => ({
            ...prev,
            instructions: `Help me improve this selected section:\n"${excerpt}"`,
        }));
        toast.success('Highlighted text sent to the AI collaborator.');
    };

    useEffect(() => {
        const handleSelectionChange = () => {
            captureResourceSelection();
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [captureResourceSelection]);

    const applyContentEditorCommand = (command: string, value?: string) => {
        resourceEditorRef.current?.focus();
        document.execCommand(command, false, value);
        if (resourceEditorRef.current) {
            const content = normalizeEditorHtmlContent(resourceEditorRef.current?.innerHTML || '');
            setNoteForm((prev) => ({
                ...prev,
                content,
            }));
        }
    };

    const handleResourceEditorBodyChange = (rawContent: string) => {
        const content = normalizeEditorHtmlContent(rawContent);
        setNoteForm((prev) => ({
            ...prev,
            content,
        }));
    };

    const handleResourceEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Tab') {
            event.preventDefault();
            applyContentEditorCommand('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
        }
    };

    const handleInsertContentLink = () => {
        setContentLinkValue('');
        setIsContentLinkModalOpen(true);
    };

    const handleConfirmInsertContentLink = () => {
        const url = contentLinkValue.trim();
        if (!url) {
            toast.error('Please enter a link URL.');
            return;
        }
        applyContentEditorCommand('createLink', url);
        setIsContentLinkModalOpen(false);
        setContentLinkValue('');
    };

    const handleInsertContentImage = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== 'string') return;
            applyContentEditorCommand('insertImage', reader.result);
        };
        reader.readAsDataURL(file);
    };

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
            resizeCollaboratorTextarea();
        });
    };

    const handleGenerateNotes = () => {
        setSelectedClass(null);
        setActiveAction('generate-notes');
        setPersistedResourceId(null);
        setContentType('notes');
        setSelectedReferenceResourceIds([]);
        setContentFiles([]);
        setNoteForm((prev) => ({
            ...prev,
            resourceId: '',
            topicId: '',
            title: '',
            instructions: '',
            content: '',
            status: 'draft',
            scheduledFor: '',
        }));
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
            const generatedDraft = `# ${noteForm.title}\n\n${promptText}\n\n## Suggested outline\n- Learning objective\n- Key concept explanation\n- Worked example\n- Retrieval check questions\n- Reflection prompt${referencesBlock}`;
            setNoteForm((prev) => ({
                ...prev,
                content: `${prev.content ? `${prev.content}<br /><br />` : ''}${textToHtml(generatedDraft)}`,
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
                        `Content type: ${getResourceContentTypeLabel(contentType)}`,
                        selectedReferenceNames.length > 0 ? `References attached: ${selectedReferenceNames.length}` : '',
                        contentFiles.length > 0 ? `Context files used: ${contentFiles.length}` : '',
                    ].filter(Boolean),
                },
            ]));
            setIsContentGenerating(false);
            toast.success('AI draft added to canvas. Review and edit freely.');
        }, 700);
    };

    const persistResource = async (mode: 'draft' | 'publish' | 'schedule') => {
        const resolvedSubjectId = noteForm.subjectId || subjects[0]?.id || '';
        if (!resolvedSubjectId) {
            toast.error('Select a subject before saving.');
            return null;
        }

        const plainTextContent = stripHtmlToText(noteForm.content || '');
        if (!plainTextContent) {
            toast.error('Add resource content before saving.');
            return null;
        }

        const derivedTitle = plainTextContent.slice(0, 80);
        const resolvedTitle = (noteForm.title || '').trim()
            || derivedTitle
            || buildFallbackResourceTitle(contentType);

        const currentUser = authService.getCurrentUser();
        if (!currentUser?.id) {
            toast.error('You need to be logged in to save resources.');
            return null;
        }

        const activeSchoolId = schools[0]?.id;
        if (!activeSchoolId) {
            toast.error('No school context is available for this resource.');
            return null;
        }

        if ((mode === 'publish' || mode === 'schedule') && !noteForm.topicId) {
            toast.error('Select a curriculum topic so students can see this resource under the syllabus.');
            return null;
        }

        if (mode === 'schedule' && !noteForm.scheduledFor) {
            toast.error('Select a date/time to schedule.');
            return null;
        }

        const payload = {
            schoolId: activeSchoolId,
            subjectId: resolvedSubjectId,
            uploadedBy: currentUser.id,
            name: resolvedTitle,
            originalName: resolvedTitle,
            mimeType: 'text/html',
            resType: 'content',
            sizeBytes: new Blob([noteForm.content || '']).size,
            contentType,
            contentBody: noteForm.content || '',
            publishAt: mode === 'schedule'
                ? new Date(noteForm.scheduledFor).toISOString()
                : mode === 'publish'
                    ? new Date().toISOString()
                    : null,
            status: mode === 'draft' ? 'draft' : 'published',
            topicIds: noteForm.topicId ? [noteForm.topicId] : [],
            tags: [noteForm.grade, contentType].filter(Boolean),
        };

        const saved = persistedResourceId
            ? await resourceService.update(persistedResourceId, payload)
            : await resourceService.create(payload);

        setPersistedResourceId(saved.id);
        setNoteForm((prev) => ({
            ...prev,
            resourceId: saved.id,
            subjectId: resolvedSubjectId,
            title: resolvedTitle,
        }));
        fetchDashboardData();
        return saved;
    };

    const handleSaveDraft = async () => {
        const saved = await persistResource('draft');
        if (!saved) return;
        await fetchDraftResources();
        toast.success('Draft saved.');
    };

    const handlePublish = async () => {
        const saved = await persistResource('publish');
        if (!saved) return;
        await fetchDraftResources();
        toast.success('Content published to students.');
        setNoteForm((prev) => ({
            ...prev,
            resourceId: '',
            topicId: '',
            content: '',
            instructions: '',
            title: '',
            scheduledFor: '',
            status: 'draft',
        }));
        setPersistedResourceId(null);
    };

    const handleSchedule = async () => {
        if (!noteForm.scheduledFor) {
            setIsWorkspaceConfigOpen(true);
            setNoteForm((prev) => ({
                ...prev,
                status: 'schedule',
            }));
            window.requestAnimationFrame(() => {
                scheduleInputRef.current?.focus();
            });
            toast.info('Choose a date/time before scheduling.');
            return;
        }

        const saved = await persistResource('schedule');
        if (!saved) return;
        toast.success('Content scheduled.');
    };

    const handleEditDraft = async (resourceId: string) => {
        if (!resourceId) return;
        setActiveDraftResourceId(resourceId);
        try {
            const draft = await resourceService.get(resourceId);
            const gradeTag = (draft.tags || []).find((tag) => /^form\s+\d+/i.test(tag));
            const resolvedContentType = isResourceContentType(draft.contentType) ? draft.contentType : 'notes';
            setContentType(resolvedContentType);
            setNoteForm((prev) => ({
                ...prev,
                resourceId: draft.id,
                subjectId: draft.subject || prev.subjectId,
                topicId: draft.topicIds?.[0] || '',
                grade: gradeTag || prev.grade || 'Form 1',
                title: draft.name || '',
                instructions: '',
                content: draft.contentBody || '',
                status: 'draft',
                scheduledFor: draft.publishAt ? new Date(draft.publishAt).toISOString().slice(0, 16) : '',
            }));
            setPersistedResourceId(draft.id);
            setActiveAction('generate-notes');
            toast.success('Draft loaded into the content workspace.');
        } catch (error) {
            console.error('Failed to load draft resource:', error);
            toast.error('Failed to open draft.');
        } finally {
            setActiveDraftResourceId(null);
        }
    };

    const handleDeleteDraft = async (resourceId: string) => {
        if (!resourceId) return;
        setActiveDraftResourceId(resourceId);
        try {
            await resourceService.delete(resourceId);
            await Promise.all([fetchDraftResources(), fetchDashboardData()]);
            if (persistedResourceId === resourceId || noteForm.resourceId === resourceId) {
                setPersistedResourceId(null);
                setNoteForm((prev) => ({
                    ...prev,
                    resourceId: '',
                    title: '',
                    content: '',
                    instructions: '',
                }));
            }
            toast.success('Draft deleted.');
        } catch (error) {
            console.error('Failed to delete draft:', error);
            toast.error('Failed to delete draft.');
        } finally {
            setActiveDraftResourceId(null);
        }
    };

    const handlePublishDraft = async (resourceId: string) => {
        if (!resourceId) return;
        setActiveDraftResourceId(resourceId);
        try {
            const listedDraft = draftResources.find((draft) => draft.id === resourceId);
            const existingTopicIds = Array.isArray(listedDraft?.topicIds) ? listedDraft?.topicIds.filter(Boolean) : [];
            const resolvedTopicIds = existingTopicIds.length > 0
                ? existingTopicIds
                : ((await resourceService.get(resourceId)).topicIds || []).filter(Boolean);

            if (resolvedTopicIds.length === 0) {
                toast.error('Assign a curriculum topic before publishing so students can see it under the right syllabus topic.');
                return;
            }

            await resourceService.update(resourceId, {
                status: 'published',
                publishAt: new Date().toISOString(),
            });
            await Promise.all([fetchDraftResources(), fetchDashboardData()]);
            if (persistedResourceId === resourceId) {
                setPersistedResourceId(null);
            }
            toast.success('Draft published to students.');
        } catch (error) {
            console.error('Failed to publish draft:', error);
            toast.error('Failed to publish draft.');
        } finally {
            setActiveDraftResourceId(null);
        }
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
                        <div className="grid grid-cols-1 gap-8">
                            {/* --- Left Column (Main Content) --- */}
                            <div className="space-y-6">
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
                                    <button
                                        type="button"
                                        onClick={() => handleUploadClick()}
                                        className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <UploadCloud size={18} /> Upload
                                    </button>
                                </div>
                                <section className="space-y-4">
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploaded By</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredContent.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                                No content found. Generate content or upload material to get started.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredContent.map((item) => (
                                                            <tr key={item.id} className="border-t border-slate-200">
                                                                <td className="px-4 py-3 text-sm text-slate-800">{item.name}</td>
                                                                <td className="px-4 py-3 text-sm text-slate-700">{item.subject?.name || 'N/A'}</td>
                                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                                    {item.uploadedBy?.firstName} {item.uploadedBy?.lastName}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-slate-700 capitalize">{item.type || 'other'}</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className="flex items-center gap-3">
                                                                        <button className="text-blue-600 hover:text-blue-700">View</button>
                                                                        <button className="text-slate-600 hover:text-slate-700">Download</button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
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
                            <div className={`${isContentExpanded ? 'bg-white rounded-lg shadow-2xl border border-slate-200 h-full max-h-[calc(100vh-2rem)] overflow-hidden' : 'h-full overflow-hidden'}`}>
                                <div className={`grid h-full min-h-0 grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 ${isAiPanelCollapsed ? 'xl:grid-cols-[minmax(0,1fr)_64px]' : 'xl:grid-cols-[minmax(0,1fr)_340px]'}`}>
                                    <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSaveDraft}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                            >
                                                <Save className="h-3.5 w-3.5" />
                                                Save draft
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePrintContent}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                Print
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSchedule}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                            >
                                                Schedule
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePublish}
                                                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                            >
                                                Publish now
                                            </button>
                                            <div className="relative">
                                                <button
                                                    ref={workspaceConfigButtonRef}
                                                    type="button"
                                                    onClick={() => setIsWorkspaceConfigOpen((prev) => !prev)}
                                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                                >
                                                    <Settings2 className="h-3.5 w-3.5" />
                                                    Configure
                                                </button>
                                                {isWorkspaceConfigOpen && (
                                                    <div
                                                        ref={workspaceConfigMenuRef}
                                                        className="fixed inset-x-3 top-24 z-[90] max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:max-h-[min(80vh,720px)] sm:w-[min(720px,calc(100vw-3rem))]"
                                                    >
                                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                            <div>
                                                                <label className="text-xs text-slate-500">Subject</label>
                                                                <select
                                                                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                                    value={noteForm.subjectId}
                                                                    onChange={(e) => setNoteForm((prev) => ({ ...prev, subjectId: e.target.value, topicId: '' }))}
                                                                >
                                                                    <option value="">Select subject</option>
                                                                    {subjects.map((subject) => (
                                                                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-500">Curriculum Topic</label>
                                                                <select
                                                                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                                    value={noteForm.topicId}
                                                                    onChange={(e) => setNoteForm((prev) => ({ ...prev, topicId: e.target.value }))}
                                                                    disabled={!noteForm.subjectId}
                                                                >
                                                                    <option value="">{curriculumTopics.length > 0 ? 'Select topic' : 'No topics available'}</option>
                                                                    {curriculumTopics.map((topic) => (
                                                                        <option key={topic.id} value={topic.id}>{topic.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-500">Grade/Form</label>
                                                                <select
                                                                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
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
                                                            <div>
                                                                <label className="text-xs text-slate-500">Content Type</label>
                                                                <select
                                                                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                                    value={contentType}
                                                                    onChange={(e) => setContentType(e.target.value as ResourceContentType)}
                                                                >
                                                                    {RESOURCE_CONTENT_TYPES.map((type) => (
                                                                        <option key={type} value={type}>
                                                                            {getResourceContentTypeLabel(type)}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="md:col-span-2 xl:col-span-3">
                                                                <label className="text-xs text-slate-500">Title for resource</label>
                                                                <input
                                                                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900"
                                                                    placeholder="Title for resource"
                                                                    value={noteForm.title}
                                                                    onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-500">Status</label>
                                                                <select
                                                                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
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
                                                                    ref={scheduleInputRef}
                                                                    type="datetime-local"
                                                                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                                                    value={noteForm.scheduledFor}
                                                                    onChange={(e) => setNoteForm((prev) => ({
                                                                        ...prev,
                                                                        scheduledFor: e.target.value,
                                                                        status: e.target.value ? 'schedule' : prev.status,
                                                                    }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsContentExpanded((prev) => !prev)}
                                            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                            aria-label={isContentExpanded ? 'Collapse editor workspace' : 'Expand editor workspace'}
                                            title={isContentExpanded ? 'Collapse' : 'Expand'}
                                        >
                                            {isContentExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>

                                    <div className="rounded-lg border border-slate-200 bg-white min-h-0 overflow-hidden">
                                        <input
                                            ref={resourceImageInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                handleInsertContentImage(file);
                                                event.target.value = '';
                                            }}
                                        />
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">Resources</span>
                                                <span className="text-xs text-slate-500">Resource Workspace</span>
                                            </div>
                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                                {getResourceContentTypeLabel(contentType)}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                                            <button type="button" onClick={() => applyContentEditorCommand('undo')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Undo" title="Undo">
                                                <Undo2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('redo')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Redo" title="Redo">
                                                <Redo2 className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="mx-1 h-5 w-px bg-slate-200" />
                                            <select
                                                defaultValue="P"
                                                onChange={(e) => applyContentEditorCommand('formatBlock', e.target.value)}
                                                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                                            >
                                                <option value="P">Paragraph</option>
                                                <option value="H1">Title</option>
                                                <option value="H2">Heading</option>
                                                <option value="H3">Subheading</option>
                                                <option value="BLOCKQUOTE">Block quote</option>
                                                <option value="PRE">Code block</option>
                                            </select>
                                            <span className="mx-1 h-5 w-px bg-slate-200" />
                                            <button type="button" onClick={() => applyContentEditorCommand('bold')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Bold" title="Bold">
                                                <Bold className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('italic')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Italic" title="Italic">
                                                <Italic className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('underline')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Underline" title="Underline">
                                                <Underline className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('formatBlock', 'PRE')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Code block" title="Code block">
                                                <Code2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={handleInsertContentLink} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Insert link" title="Insert link">
                                                <Link2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => resourceImageInputRef.current?.click()} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Insert image" title="Insert image">
                                                <ImagePlus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="mx-1 h-5 w-px bg-slate-200" />
                                            <button type="button" onClick={() => applyContentEditorCommand('insertUnorderedList')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Bulleted list" title="Bulleted list">
                                                <List className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('insertOrderedList')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Numbered list" title="Numbered list">
                                                <ListOrdered className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('justifyFull')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Justify" title="Justify">
                                                <AlignJustify className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" onClick={() => applyContentEditorCommand('insertHTML', '<table border=\"1\" style=\"width:100%;border-collapse:collapse;\"><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Insert table" title="Insert table">
                                                <Table className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <div className="space-y-3 p-3">
                                            <input
                                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900"
                                                placeholder="Title for resource"
                                                value={noteForm.title}
                                                onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
                                            />
                                            <div className="relative" ref={resourceOverlayHostRef}>
                                                <div
                                                    ref={resourceEditorRef}
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onKeyDown={handleResourceEditorKeyDown}
                                                    onInput={(e) => {
                                                        handleResourceEditorBodyChange((e.currentTarget as HTMLDivElement).innerHTML);
                                                    }}
                                                    className="min-h-[440px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                {!noteForm.content && (
                                                    <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
                                                        Start writing resource content here...
                                                    </span>
                                                )}
                                                {selectionActionOverlay && (
                                                    <div
                                                        className="absolute z-20"
                                                        style={{ top: selectionActionOverlay.top, left: selectionActionOverlay.left }}
                                                    >
                                                        <div className="relative flex items-center">
                                                            <div className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-md">
                                                                <button
                                                                    type="button"
                                                                    onMouseDown={preserveResourceSelectionOnMouseDown}
                                                                    onMouseEnter={() => setSelectionActionHint('Make changes to this')}
                                                                    onMouseLeave={() => setSelectionActionHint(null)}
                                                                    onClick={() => handleResourceSelectionAction('change')}
                                                                    className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100"
                                                                    aria-label="Make changes to highlighted text"
                                                                    title="Make changes"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onMouseDown={preserveResourceSelectionOnMouseDown}
                                                                    onMouseEnter={() => setSelectionActionHint('Try something different')}
                                                                    onMouseLeave={() => setSelectionActionHint(null)}
                                                                    onClick={() => handleResourceSelectionAction('different')}
                                                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                                                    aria-label="Try something different on highlighted text"
                                                                    title="Try differently"
                                                                >
                                                                    <RefreshCw className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onMouseDown={preserveResourceSelectionOnMouseDown}
                                                                    onMouseEnter={() => setSelectionActionHint('Ask AI collaborator')}
                                                                    onMouseLeave={() => setSelectionActionHint(null)}
                                                                    onClick={() => handleResourceSelectionAction('chat')}
                                                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                                                    aria-label="Ask AI collaborator about highlighted text"
                                                                    title="Ask AI"
                                                                >
                                                                    <MessageSquare className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            {selectionActionHint && (
                                                                <div className="ml-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-md">
                                                                    {selectionActionHint}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <aside className={`rounded-lg border border-slate-200 bg-slate-50 ${isAiPanelCollapsed ? 'flex h-full w-16 shrink-0 flex-col items-center gap-2 p-2.5' : 'flex h-full min-w-0 flex-col p-3'}`}>
                                        {isAiPanelCollapsed ? (
                                            <>
                                                <Bot className="mt-1 h-4 w-4 text-slate-600" />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAiPanelCollapsed(false)}
                                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                                    aria-label="Expand AI collaborator"
                                                    title="Expand"
                                                >
                                                    <PanelRightOpen className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-slate-900">AI Collaborator</p>
                                                        <Bot className="h-4 w-4 text-slate-600" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAiPanelCollapsed(true)}
                                                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                                        aria-label="Collapse AI collaborator"
                                                        title="Collapse"
                                                    >
                                                        <PanelRightClose className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="flex h-full min-h-0 flex-col rounded-md border border-slate-200 bg-white p-2">
                                                    <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                                                    <div className="mt-2 space-y-3">
                                                        <div className="relative">
                                                            <textarea
                                                                ref={collaboratorPromptRef}
                                                                className="min-h-[120px] w-full resize-none rounded-md border border-slate-200 px-3 py-2 pr-16 pb-12 text-sm"
                                                                placeholder="Prompt AI here. Use @ to attach library references."
                                                                value={noteForm.instructions}
                                                                onChange={(e) => {
                                                                    handleCollaboratorPromptChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
                                                                    requestAnimationFrame(resizeCollaboratorTextarea);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && isMentionOpen && mentionSuggestions.length > 0) {
                                                                        e.preventDefault();
                                                                        insertReferenceMention(mentionSuggestions[0]);
                                                                    }
                                                                }}
                                                            />
                                                            {isMentionOpen && mentionSuggestions.length > 0 && (
                                                                <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                                                                    {mentionSuggestions.map((resource) => (
                                                                        <button
                                                                            key={resource.id}
                                                                            type="button"
                                                                            onClick={() => insertReferenceMention(resource)}
                                                                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
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
                                                                    <ArrowUp className="h-4 w-4" />
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
                                                                    <Paperclip className="h-3.5 w-3.5" />
                                                                    Attach context
                                                                </button>
                                                                <div className="relative z-[70]">
                                                                    <button
                                                                        ref={configButtonRef}
                                                                        type="button"
                                                                        onClick={() => setIsConfigOpen((prev) => !prev)}
                                                                        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-700"
                                                                    >
                                                                        <Settings2 className="h-3.5 w-3.5" />
                                                                        Configure
                                                                    </button>
                                                                    {isConfigOpen && (
                                                                        <div
                                                                            ref={configMenuRef}
                                                                            className="absolute left-0 top-full mt-2 z-[80] w-[320px] max-w-[80vw] rounded-lg border border-slate-200 bg-white p-3 shadow-xl space-y-3"
                                                                        >
                                                                            <label className="text-xs text-slate-600">Reference Material In Library (Optional)</label>
                                                                            <input
                                                                                value={referenceSearch}
                                                                                onChange={(e) => setReferenceSearch(e.target.value)}
                                                                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                                                                                placeholder="Search..."
                                                                            />
                                                                            {availableReferenceResources.length === 0 ? (
                                                                                <p className="text-xs text-slate-500">No uploaded material available for this subject yet.</p>
                                                                            ) : filteredReferenceResources.length === 0 ? (
                                                                                <p className="text-xs text-slate-500">No matching material.</p>
                                                                            ) : (
                                                                                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
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
                                                            <span className="text-[11px] text-slate-500">Type @ to attach reference</span>
                                                        </div>
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
                                                                            <X className="h-3 w-3" />
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
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </aside>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeAction === 'lesson-plans' && (
                    <div className="space-y-6">
                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.6fr)_360px]">
                                <div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_40%),linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#eff6ff_100%)] px-6 py-7 text-white sm:px-8">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="max-w-2xl space-y-4">
                                            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100">
                                                Lesson Planning Hub
                                            </span>
                                            <div className="space-y-2">
                                                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                                    Build lesson plans by subject, then move directly into delivery.
                                                </h1>
                                                <p className="max-w-xl text-sm leading-6 text-blue-100/90">
                                                    Keep every subject on one planning board, review what still needs a lesson sequence, and open a plan without digging through multiple screens.
                                                </p>
                                            </div>
                                            <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">Tracked subjects</p>
                                                    <p className="mt-2 text-3xl font-semibold text-white">{subjects.length}</p>
                                                    <p className="mt-1 text-xs text-blue-100/85">Subjects available for planning</p>
                                                </div>
                                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">Ready to plan</p>
                                                    <p className="mt-2 text-3xl font-semibold text-white">{Math.max(subjects.length - 1, 0)}</p>
                                                    <p className="mt-1 text-xs text-blue-100/85">Can be sequenced this week</p>
                                                </div>
                                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">Recent resources</p>
                                                    <p className="mt-2 text-3xl font-semibold text-white">{recentUploads.length}</p>
                                                    <p className="mt-1 text-xs text-blue-100/85">Materials already in the workspace</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:flex-col lg:items-stretch">
                                            <button
                                                type="button"
                                                onClick={handleCreateLessonPlan}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-blue-50"
                                            >
                                                <BookOpen size={18} />
                                                Create Lesson Plan
                                            </button>
                                            {subjects[0] && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewLessonPlan(subjects[0])}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                                                >
                                                    View Latest Subject
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planning flow</p>
                                            <h2 className="mt-2 text-lg font-semibold text-slate-900">Keep planning disciplined.</h2>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
                                                        <CalendarDays size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">Map lessons to the academic calendar</p>
                                                        <p className="mt-1 text-sm leading-6 text-slate-600">
                                                            Set the sequence first so each plan aligns with term pacing, assessments, and revision windows.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                                        <Send size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">Share lesson direction clearly</p>
                                                        <p className="mt-1 text-sm leading-6 text-slate-600">
                                                            Once a plan is ready, reuse it to brief students, attach resources, and push the outline into delivery.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended</p>
                                                <p className="mt-2 text-sm text-slate-700">
                                                    Start with your highest-priority subject, complete the lesson sequence, then open the resource workspace from the same plan.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.95fr)]">
                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lesson board</p>
                                        <h3 className="mt-1 text-lg font-semibold text-slate-900">Subjects waiting for planning attention</h3>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                        {subjects.length} subjects
                                    </span>
                                </div>

                                <div className="p-4 sm:p-6">
                                    {subjects.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                                            <p className="text-sm font-medium text-slate-700">No subjects are available for lesson planning yet.</p>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Add subjects first, then return here to create lesson plans and sequence them properly.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {subjects.slice(0, 6).map((subject, index) => (
                                                <div
                                                    key={subject.id}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-300 hover:bg-blue-50/50"
                                                >
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                        <div className="flex min-w-0 items-start gap-4">
                                                            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                                                                {String(index + 1).padStart(2, '0')}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="text-base font-semibold text-slate-900">{subject.name}</p>
                                                                    {subject.code && (
                                                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                                            {subject.code}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="mt-1 text-sm text-slate-600">
                                                                    Next session: To be scheduled
                                                                </p>
                                                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                    <span className="rounded-full bg-white px-2.5 py-1">Resources: {subject.resourceCount}</span>
                                                                    <span className="rounded-full bg-white px-2.5 py-1">Documents: {subject.documents}</span>
                                                                    <span className="rounded-full bg-white px-2.5 py-1">Updated: {subject.lastUpdated}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                                                Needs scheduling
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewLessonPlan(subject)}
                                                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                                                            >
                                                                Open plan
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>

                            <aside className="space-y-6">
                                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">This week</p>
                                    <div className="mt-4 space-y-4">
                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-sm font-semibold text-slate-900">Primary planning target</p>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {subjects[0]?.name ?? 'No subject selected yet'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-sm font-semibold text-slate-900">Lesson handoff</p>
                                            <p className="mt-1 text-sm text-slate-600">
                                                Use the completed plan to publish notes and prepare the matching resource pack.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Execution note</p>
                                    <h3 className="mt-2 text-lg font-semibold">A plan should end in delivery, not just storage.</h3>
                                    <p className="mt-3 text-sm leading-6 text-slate-300">
                                        Keep the sequence lean: define the lesson objective, add the activity flow, then connect the supporting materials already in resources.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleCreateLessonPlan}
                                        className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                                    >
                                        Start a new plan
                                    </button>
                                </section>
                            </aside>
                        </div>
                    </div>
                )}

                {activeAction === 'drafts' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isDraftsLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    Loading drafts...
                                                </td>
                                            </tr>
                                        ) : draftResources.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No drafts yet. Create content and save it as drafts.
                                                </td>
                                            </tr>
                                        ) : (
                                            draftResources.map((draft) => {
                                                const isRowBusy = activeDraftResourceId === draft.id;
                                                const gradeTag = (draft.tags || []).find((tag) => /^form\s+\d+/i.test(tag));
                                                const subjectName = subjects.find((subject) => subject.id === draft.subject)?.name || 'No subject';

                                                return (
                                                    <tr key={draft.id} className="border-t border-slate-200">
                                                        <td className="px-4 py-3 text-sm text-slate-800">{draft.name || 'Untitled Draft'}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">{gradeTag || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">{subjectName}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-700 capitalize">{draft.status || 'draft'}</td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <div className="flex flex-wrap gap-3">
                                                                <button
                                                                    type="button"
                                                                    disabled={isRowBusy}
                                                                    onClick={() => void handleEditDraft(draft.id)}
                                                                    className="text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                >
                                                                    {isRowBusy ? 'Working...' : 'Edit'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={isRowBusy}
                                                                    onClick={() => void handleDeleteDraft(draft.id)}
                                                                    className="text-slate-600 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                >
                                                                    Delete
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={isRowBusy}
                                                                    onClick={() => void handlePublishDraft(draft.id)}
                                                                    className="text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                >
                                                                    Publish
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
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

                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploaded By</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMaterials.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No material uploaded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMaterials.map((item) => (
                                                <tr key={item.id} className="border-t border-slate-200">
                                                    <td className="px-4 py-3 text-sm text-slate-800">{item.name}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">{item.subject?.name || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">
                                                        {item.uploadedBy?.firstName} {item.uploadedBy?.lastName}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700 capitalize">{item.type || 'other'}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <div className="flex items-center gap-3">
                                                            <button className="text-blue-600 hover:text-blue-700">View</button>
                                                            <button className="text-slate-600 hover:text-slate-700">Download</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

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
            {isContentLinkModalOpen && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 p-4"
                    onClick={() => {
                        setIsContentLinkModalOpen(false);
                        setContentLinkValue('');
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-slate-900">Insert link</p>
                            <p className="text-xs text-slate-500">Add the URL to the selected content text.</p>
                        </div>
                        <input
                            type="url"
                            value={contentLinkValue}
                            onChange={(event) => setContentLinkValue(event.target.value)}
                            placeholder="https://example.com"
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsContentLinkModalOpen(false);
                                    setContentLinkValue('');
                                }}
                                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmInsertContentLink}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                            >
                                Insert
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourcesDashboard;
