// src/components/resources/ResourcesDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import {
    AlignJustify,
    ArrowUp,
    Bold,
    BookOpen,
    Bot,
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
import { workspaceAiService } from '../../services/workspaceAiService';
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

interface TeachingSubjectResponse {
    id: string;
    name: string;
    code?: string;
}

interface ResourceCountSummary {
    count?: number;
    lastUpdated?: string;
    documents?: number;
    images?: number;
    videos?: number;
    others?: number;
}

interface CollaboratorThreadEntry {
    id: string;
    role: 'user' | 'assistant';
    type: 'prompt' | 'summary';
    text: string;
    details?: string[];
    status?: 'success' | 'error' | 'info';
}

interface ResourcePreviewState {
    resourceId: string;
    title: string;
    mode: 'html' | 'image' | 'video' | 'iframe';
    src?: string;
    contentHtml?: string;
    helperText?: string;
}

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

const buildResourceFilename = (resource: Pick<ResourceItem, 'name' | 'originalName' | 'mimeType'>) => {
    const baseName = (resource.originalName || resource.name || 'resource').trim();
    if (/\.[a-z0-9]{2,8}$/i.test(baseName)) {
        return baseName;
    }

    const mimeType = (resource.mimeType || '').toLowerCase();
    if (mimeType.includes('html')) return `${baseName}.html`;
    if (mimeType.includes('markdown')) return `${baseName}.md`;
    if (mimeType.includes('pdf')) return `${baseName}.pdf`;
    if (mimeType.includes('plain')) return `${baseName}.txt`;
    return baseName;
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

const getResourceFileExtension = (resource: Pick<ResourceItem, 'name' | 'originalName' | 'url'>) => {
    const candidate = resource.originalName || resource.name || resource.url || '';
    const cleanCandidate = candidate.split('?')[0].split('#')[0];
    const match = cleanCandidate.match(/\.([a-z0-9]{2,8})$/i);
    return match ? match[1].toLowerCase() : '';
};

const getResourcePreviewMode = (resource: Pick<ResourceItem, 'mimeType' | 'name' | 'originalName' | 'url'>): ResourcePreviewState['mode'] => {
    const mimeType = (resource.mimeType || '').toLowerCase();
    const extension = getResourceFileExtension(resource);

    if (
        mimeType.startsWith('image/')
        || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)
    ) {
        return 'image';
    }

    if (
        mimeType.startsWith('video/')
        || ['mp4', 'webm', 'ogg', 'mov'].includes(extension)
    ) {
        return 'video';
    }

    return 'iframe';
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
    const [lessonPlanSearch, setLessonPlanSearch] = useState('');
    const [draftSearch, setDraftSearch] = useState('');
    const [draftSubjectFilter, setDraftSubjectFilter] = useState('all');
    const [draftGradeFilter, setDraftGradeFilter] = useState('all');
    const [draftTypeFilter, setDraftTypeFilter] = useState('all');
    const [contentSearch, setContentSearch] = useState('');
    const [contentSubjectFilter, setContentSubjectFilter] = useState('all');
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialSubjectFilter, setMaterialSubjectFilter] = useState('all');
    const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentionOpen, setIsMentionOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isWorkspaceConfigOpen, setIsWorkspaceConfigOpen] = useState(false);
    const [aiThread, setAiThread] = useState<CollaboratorThreadEntry[]>([]);
    const [selectionActionOverlay, setSelectionActionOverlay] = useState<{ top: number; left: number; text: string } | null>(null);
    const [selectionActionHint, setSelectionActionHint] = useState<string | null>(null);
    const [persistedResourceId, setPersistedResourceId] = useState<string | null>(null);
    const [isContentLinkModalOpen, setIsContentLinkModalOpen] = useState(false);
    const [contentLinkValue, setContentLinkValue] = useState('');
    const [resourcePreview, setResourcePreview] = useState<ResourcePreviewState | null>(null);

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
                fetchData<TeachingSubjectResponse[]>('/subjects/teaching', { forceRefresh: true }),
                fetchData<Record<string, ResourceCountSummary>>('/resources/counts', { forceRefresh: true }),
                fetchData<RecentUpload[]>('/resources/recent?limit=5', { forceRefresh: true }),
            ]);
            const updatedSubjects = subjectData.map((subject) => ({
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

    const downloadInlineContent = useCallback((resource: Pick<ResourceItem, 'name' | 'originalName' | 'mimeType' | 'contentBody'>) => {
        const blob = new Blob([resource.contentBody || ''], {
            type: resource.mimeType || 'text/html;charset=utf-8',
        });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = buildResourceFilename(resource);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    }, []);

    const resolveDownloadUrl = useCallback(async (resourceId: string) => {
        const response = await fetchData<{ url?: string }>(`/resources/download/${resourceId}`, {
            forceRefresh: true,
        });
        const url = response?.url;
        if (!url) {
            throw new Error('No downloadable file is available for this resource.');
        }
        return url;
    }, []);

    const handleViewResource = useCallback(async (resourceId: string) => {
        try {
            const resource = await resourceService.get(resourceId);
            if (resource.contentBody && resource.contentBody.trim().length > 0) {
                setResourcePreview({
                    resourceId: resource.id,
                    title: resource.name || 'Resource preview',
                    mode: 'html',
                    contentHtml: normalizeEditorHtmlContent(resource.contentBody),
                });
                return;
            }

            const downloadUrl = await resolveDownloadUrl(resourceId);
            const previewMode = getResourcePreviewMode(resource);
            setResourcePreview({
                resourceId: resource.id,
                title: resource.name || resource.originalName || 'Resource preview',
                mode: previewMode,
                src: downloadUrl,
                helperText: previewMode === 'iframe'
                    ? 'If this file cannot render in the preview panel, use Download.'
                    : undefined,
            });
        } catch (error) {
            console.error('Failed to preview resource:', error);
            const message = error instanceof Error ? error.message : 'Failed to open the resource.';
            toast.error(message);
        }
    }, [resolveDownloadUrl]);

    const handleDownloadResource = useCallback(async (resourceId: string) => {
        try {
            const resource = await resourceService.get(resourceId);
            if (resource.contentBody && resource.contentBody.trim().length > 0) {
                downloadInlineContent(resource);
                return;
            }

            const downloadUrl = await resolveDownloadUrl(resourceId);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = resource.originalName || resource.name;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download resource:', error);
            const message = error instanceof Error ? error.message : 'Failed to download the resource.';
            toast.error(message);
        }
    }, [downloadInlineContent, resolveDownloadUrl]);

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

    const filteredLessonPlanSubjects = useMemo(() => {
        const query = lessonPlanSearch.trim().toLowerCase();
        if (!query) return subjects;

        return subjects.filter((subject) => (
            subject.name.toLowerCase().includes(query)
            || subject.code?.toLowerCase().includes(query)
        ));
    }, [lessonPlanSearch, subjects]);

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

    const resolveDraftGrade = useCallback((draft: ResourceItem) => (
        (draft.tags || []).find((tag) => /^form\s+\d+/i.test(tag)) || ''
    ), []);

    const resolveDraftSubjectName = useCallback((draft: ResourceItem) => {
        const subjectValue = (draft as ResourceItem & {
            subject?: string | { id?: string; name?: string };
        }).subject;

        if (subjectValue && typeof subjectValue === 'object') {
            if (typeof subjectValue.name === 'string' && subjectValue.name.trim().length > 0) {
                return subjectValue.name;
            }
            if (typeof subjectValue.id === 'string') {
                return subjects.find((subject) => subject.id === subjectValue.id)?.name || 'No subject';
            }
        }

        if (typeof subjectValue === 'string') {
            return subjects.find((subject) => subject.id === subjectValue)?.name || 'No subject';
        }

        return 'No subject';
    }, [subjects]);

    const availableDraftGrades = useMemo(() => (
        Array.from(new Set(
            draftResources
                .map((draft) => resolveDraftGrade(draft))
                .filter((grade): grade is string => Boolean(grade))
        )).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    ), [draftResources, resolveDraftGrade]);

    const availableDraftTypes = useMemo(() => (
        Array.from(new Set(
            draftResources
                .map((draft) => draft.contentType)
                .filter((type): type is string => Boolean(type))
        ))
    ), [draftResources]);

    const filteredDraftResources = useMemo(() => {
        const query = draftSearch.trim().toLowerCase();

        return draftResources.filter((draft) => {
            const draftName = (draft.name || '').toLowerCase();
            const subjectName = resolveDraftSubjectName(draft).toLowerCase();
            const grade = resolveDraftGrade(draft);
            const draftType = draft.contentType || '';

            const matchesSearch = !query || draftName.includes(query) || subjectName.includes(query);
            const matchesSubject = draftSubjectFilter === 'all'
                || (typeof (draft as ResourceItem & { subject?: unknown }).subject === 'string'
                    && (draft as ResourceItem & { subject?: string }).subject === draftSubjectFilter)
                || (typeof (draft as ResourceItem & { subject?: unknown }).subject === 'object'
                    && (draft as ResourceItem & { subject?: { id?: string } }).subject?.id === draftSubjectFilter);
            const matchesGrade = draftGradeFilter === 'all' || grade === draftGradeFilter;
            const matchesType = draftTypeFilter === 'all' || draftType === draftTypeFilter;

            return matchesSearch && matchesSubject && matchesGrade && matchesType;
        });
    }, [
        draftResources,
        draftSearch,
        draftSubjectFilter,
        draftGradeFilter,
        draftTypeFilter,
        resolveDraftGrade,
        resolveDraftSubjectName,
    ]);

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
        if (!resourcePreview) return;

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setResourcePreview(null);
            }
        };

        window.addEventListener('keydown', onEscape);
        return () => window.removeEventListener('keydown', onEscape);
    }, [resourcePreview]);

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

    const handleGenerateOnCanvas = async () => {
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
        try {
            const resourceReferenceResults = await Promise.allSettled(
                selectedReferenceResources.map(async (resource) => {
                    const detail = await resourceService.get(resource.id);
                    const bodyText = stripHtmlToText(detail.contentBody || '');
                    const markdown = bodyText || `Resource title: ${detail.name || resource.name}`;
                    return {
                        documentName: detail.name || resource.name,
                        markdown,
                    };
                })
            );

            const resourceReferenceDocuments = resourceReferenceResults
                .filter((result): result is PromiseFulfilledResult<{ documentName: string; markdown: string }> => result.status === 'fulfilled')
                .map((result) => result.value)
                .filter((document) => document.markdown.trim().length > 0);

            const attachmentReferenceDocuments = contentFiles.length > 0
                ? await workspaceAiService.processDocumentsWithOCR(contentFiles)
                : [];

            const selectedTopic = curriculumTopics.find((topic) => topic.id === noteForm.topicId);
            const generatedDraft = await workspaceAiService.generateTeacherResource({
                subjectName: selectedSubjectName,
                topicTitle: selectedTopic?.name || noteForm.title.trim(),
                gradeLevel: noteForm.grade,
                contentType: 'resource',
                title: noteForm.title.trim(),
                objective: selectedTopic?.objectives || selectedTopic?.description || '',
                teacherPrompt: promptText,
                existingContent: noteForm.content,
                relatedRecords: selectedReferenceNames,
                referenceDocuments: [...resourceReferenceDocuments, ...attachmentReferenceDocuments],
            });

            setNoteForm((prev) => ({
                ...prev,
                title: generatedDraft.title || prev.title,
                content: generatedDraft.contentHtml,
            }));
            setAiThread((prev) => ([
                ...prev,
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    role: 'assistant',
                    type: 'summary',
                    status: 'success',
                    text: `Done. ${generatedDraft.teacherMessage || 'I generated the resource and updated the content canvas.'}`,
                    details: [
                        `Title: ${generatedDraft.title || noteForm.title}`,
                        `Content type: ${getResourceContentTypeLabel(contentType)}`,
                        resourceReferenceDocuments.length > 0 ? `Library references used: ${resourceReferenceDocuments.length}` : '',
                        attachmentReferenceDocuments.length > 0 ? `Attachment references used: ${attachmentReferenceDocuments.length}` : '',
                    ].filter(Boolean),
                },
            ]));
            toast.success('AI draft added to canvas. Review and edit freely.');
        } catch (error) {
            console.error('Failed to generate resource with AI:', error);
            const message = error instanceof Error ? error.message : 'AI generation failed';
            setAiThread((prev) => ([
                ...prev,
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    role: 'assistant',
                    type: 'summary',
                    status: 'error',
                    text: 'I could not update the content canvas from that request.',
                    details: [message],
                },
            ]));
            toast.error(message);
        } finally {
            setIsContentGenerating(false);
        }
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
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handleViewResource(item.id)}
                                                                            className="text-blue-600 hover:text-blue-700"
                                                                        >
                                                                            View
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handleDownloadResource(item.id)}
                                                                            className="text-slate-600 hover:text-slate-700"
                                                                        >
                                                                            Download
                                                                        </button>
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
                                            <button type="button" onClick={() => applyContentEditorCommand('insertHTML', '<table border="1" style="width:100%;border-collapse:collapse;"><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>')} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100" aria-label="Insert table" title="Insert table">
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
                                                                Ask for a draft, revision, or variant. Your messages and the AI response will appear here.
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
                                                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                                                    {entry.role === 'user' ? 'You' : 'AI Collaborator'}
                                                                </div>
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
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 shadow-sm shadow-slate-200/50">
                                                                <div className="px-1 py-1.5">
                                                                    <textarea
                                                                        ref={collaboratorPromptRef}
                                                                        className="min-h-[88px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500"
                                                                        placeholder="Ask the AI collaborator to draft or refine this resource. Use @ to attach library references."
                                                                        value={noteForm.instructions}
                                                                        rows={3}
                                                                        disabled={isContentGenerating}
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
                                                                </div>
                                                                <div className="flex items-center justify-between border-t border-slate-200/80 pt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => contextFileInputRef.current?.click()}
                                                                        disabled={isContentGenerating}
                                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                                        aria-label="Attach context"
                                                                        title="Attach context"
                                                                    >
                                                                        <Paperclip className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleGenerateOnCanvas}
                                                                        disabled={isContentGenerating}
                                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                        aria-label={isContentGenerating ? 'Generating resource draft' : 'Generate on canvas'}
                                                                        title={isContentGenerating ? 'Generating resource draft' : 'Generate on canvas'}
                                                                    >
                                                                        {isContentGenerating ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <ArrowUp className="h-4 w-4" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
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
                                                        </div>
                                                        <input
                                                            ref={contextFileInputRef}
                                                            type="file"
                                                            className="hidden"
                                                            multiple
                                                            accept=".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json,image/png,image/jpeg"
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
                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Lesson Plans</h1>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Choose a subject and open its lesson plan workspace.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCreateLessonPlan}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    <BookOpen size={18} />
                                    Create Lesson Plan
                                </button>
                            </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Subjects</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {subjects.length} subject{subjects.length === 1 ? '' : 's'} available for planning
                                    </p>
                                </div>
                                <div className="relative w-full sm:w-72">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        value={lessonPlanSearch}
                                        onChange={(event) => setLessonPlanSearch(event.target.value)}
                                        placeholder="Search subjects..."
                                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="divide-y divide-slate-200">
                                {subjects.length === 0 ? (
                                    <div className="px-6 py-12 text-center">
                                        <p className="text-sm font-medium text-slate-700">No subjects are available for lesson planning yet.</p>
                                        <p className="mt-2 text-sm text-slate-500">
                                            Add subjects first, then return here to create lesson plans.
                                        </p>
                                    </div>
                                ) : filteredLessonPlanSubjects.length === 0 ? (
                                    <div className="px-6 py-12 text-center">
                                        <p className="text-sm font-medium text-slate-700">No subjects match your search.</p>
                                    </div>
                                ) : (
                                    filteredLessonPlanSubjects.map((subject) => (
                                        <div key={subject.id} className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-base font-semibold text-slate-900">{subject.name}</p>
                                                    {subject.code && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                            {subject.code}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">Resources: {subject.resourceCount}</span>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">Documents: {subject.documents}</span>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                                        {subject.lastUpdated ? `Updated: ${new Date(subject.lastUpdated).toLocaleDateString()}` : 'No recent update'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleViewLessonPlan(subject)}
                                                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
                                            >
                                                Open Plan
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeAction === 'drafts' && (
                    <div className="space-y-6">
                        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-4 xl:flex-row xl:items-center">
                            <div className="relative flex-1">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={draftSearch}
                                    onChange={(event) => setDraftSearch(event.target.value)}
                                    placeholder="Search drafts by title or subject..."
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Subject</span>
                                    <select
                                        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                                        value={draftSubjectFilter}
                                        onChange={(event) => setDraftSubjectFilter(event.target.value)}
                                    >
                                        <option value="all">All subjects</option>
                                        {subjects.map((subject) => (
                                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Grade</span>
                                    <select
                                        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                                        value={draftGradeFilter}
                                        onChange={(event) => setDraftGradeFilter(event.target.value)}
                                    >
                                        <option value="all">All grades</option>
                                        {availableDraftGrades.map((grade) => (
                                            <option key={grade} value={grade}>{grade}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Type</span>
                                    <select
                                        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                                        value={draftTypeFilter}
                                        onChange={(event) => setDraftTypeFilter(event.target.value)}
                                    >
                                        <option value="all">All types</option>
                                        {availableDraftTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {isResourceContentType(type) ? getResourceContentTypeLabel(type) : type}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
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
                                        ) : filteredDraftResources.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No drafts match the selected filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredDraftResources.map((draft) => {
                                                const isRowBusy = activeDraftResourceId === draft.id;
                                                const gradeTag = resolveDraftGrade(draft);
                                                const subjectName = resolveDraftSubjectName(draft);

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
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleViewResource(item.id)}
                                                                className="text-blue-600 hover:text-blue-700"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleDownloadResource(item.id)}
                                                                className="text-slate-600 hover:text-slate-700"
                                                            >
                                                                Download
                                                            </button>
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
            {resourcePreview && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4"
                    onClick={() => setResourcePreview(null)}
                >
                    <div
                        className="flex h-[min(88vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-slate-900">{resourcePreview.title}</p>
                                <p className="text-xs text-slate-500">Previewing this resource inside the app.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleDownloadResource(resourcePreview.resourceId)}
                                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    Download
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setResourcePreview(null)}
                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100"
                                    aria-label="Close preview"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden bg-slate-50">
                            {resourcePreview.mode === 'html' && (
                                <div className="h-full overflow-y-auto px-6 py-5">
                                    <div
                                        className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-[15px] leading-7 text-slate-800 shadow-sm [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_li]:mb-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                                        dangerouslySetInnerHTML={{
                                            __html: resourcePreview.contentHtml || '<p>No content available.</p>',
                                        }}
                                    />
                                </div>
                            )}
                            {resourcePreview.mode === 'image' && resourcePreview.src && (
                                <div className="flex h-full items-center justify-center overflow-auto p-6">
                                    <img
                                        src={resourcePreview.src}
                                        alt={resourcePreview.title}
                                        className="max-h-full max-w-full rounded-xl border border-slate-200 bg-white object-contain shadow-sm"
                                    />
                                </div>
                            )}
                            {resourcePreview.mode === 'video' && resourcePreview.src && (
                                <div className="flex h-full items-center justify-center p-6">
                                    <video
                                        src={resourcePreview.src}
                                        controls
                                        className="max-h-full w-full max-w-4xl rounded-xl border border-slate-200 bg-black shadow-sm"
                                    />
                                </div>
                            )}
                            {resourcePreview.mode === 'iframe' && resourcePreview.src && (
                                <div className="flex h-full flex-col">
                                    {resourcePreview.helperText && (
                                        <div className="border-b border-slate-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                                            {resourcePreview.helperText}
                                        </div>
                                    )}
                                    <iframe
                                        title={resourcePreview.title}
                                        src={resourcePreview.src}
                                        className="h-full w-full bg-white"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
