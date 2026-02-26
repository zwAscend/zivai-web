import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import Sidebar from '../components/resources/Sidebar';
import { API_URL, fetchData } from '../services/http';
import { authService } from '../services/authService';
import { subjectService } from '../services/subjectService';
import { schoolService, SchoolItem } from '../services/schoolService';
import { aiService } from '../services/aiService';
import { Subject, SubjectAttribute } from '../types';
import { ArrowUp, GripVertical, Maximize2, Minimize2, Paperclip, Settings2, X } from 'lucide-react';

type ManualQuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay';

interface ManualQuestion {
  id: string;
  stem: string;
  questionTypeCode: ManualQuestionType;
  maxMark: number;
  difficulty: number;
  options: string[];
  correctAnswer: string;
  markingGuide: string;
  diagramFile: File | null;
  diagramPreviewUrl: string;
}

interface ReferenceResource {
  id: string;
  name: string;
  subject?: string;
}

interface CollaboratorThreadEntry {
  id: string;
  role: 'user' | 'assistant';
  type: 'prompt' | 'summary';
  text: string;
  details?: string[];
  status?: 'success' | 'error' | 'info';
}

const mapAiQuestionType = (value: string | undefined): ManualQuestionType => {
  switch ((value || '').toLowerCase()) {
    case 'multiple_choice':
    case 'mcq':
      return 'mcq';
    case 'true_false':
      return 'true_false';
    case 'short_answer':
      return 'short_answer';
    case 'essay':
      return 'essay';
    default:
      return 'mcq';
  }
};

const mapDifficulty = (value: string | undefined): number => {
  switch ((value || '').toLowerCase()) {
    case 'easy':
      return 1;
    case 'hard':
      return 3;
    default:
      return 2;
  }
};

const CreateAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [subjectAttributes, setSubjectAttributes] = useState<SubjectAttribute[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
  const [manualQuestions, setManualQuestions] = useState<ManualQuestion[]>([]);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(360);
  const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1280 : true));
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [attributeSearch, setAttributeSearch] = useState('');
  const [availableReferenceResources, setAvailableReferenceResources] = useState<ReferenceResource[]>([]);
  const [selectedReferenceResourceIds, setSelectedReferenceResourceIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [aiThread, setAiThread] = useState<CollaboratorThreadEntry[]>([]);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const questionsRef = useRef<ManualQuestion[]>([]);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const assessmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const configButtonRef = useRef<HTMLButtonElement | null>(null);
  const configMenuRef = useRef<HTMLDivElement | null>(null);
  const [configMenuPosition, setConfigMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const [manualForm, setManualForm] = useState({
    schoolId: '',
    subjectId: '',
    name: '',
    description: '',
    assessmentType: 'quiz',
    maxScore: 100,
    weightPct: 0,
    timeLimitMin: 0,
    attemptsAllowed: 1,
    status: 'draft',
    visibility: 'private',
  });

  const [aiForm, setAiForm] = useState({
    prompt: '',
    questionCount: 5,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    selectedAttributeIds: [] as string[],
  });

  const subjectId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('subjectId') || undefined;
  }, [location.search]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [subjectData, schoolData] = await Promise.all([
          subjectService.getTeachingSubjects().catch(() => []),
          schoolService.getSchools().catch(() => []),
        ]);
        setSubjects(subjectData || []);
        setSchools(schoolData || []);
      } catch (error) {
        console.error('Failed to load assessment context data:', error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    setManualForm((prev) => ({
      ...prev,
      subjectId: subjectId || prev.subjectId,
    }));
  }, [subjectId]);

  useEffect(() => {
    if (!manualForm.schoolId && schools.length > 0) {
      setManualForm((prev) => ({ ...prev, schoolId: schools[0].id }));
    }
  }, [schools, manualForm.schoolId]);

  useEffect(() => {
    if (!manualForm.subjectId && subjects.length > 0) {
      setManualForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    }
  }, [subjects, manualForm.subjectId]);

  useEffect(() => {
    const loadAttributes = async () => {
      if (!manualForm.subjectId) {
        setSubjectAttributes([]);
        return;
      }
      try {
        const attrs = await aiService.getSubjectAttributes(manualForm.subjectId);
        setSubjectAttributes(attrs || []);
      } catch (error) {
        console.error('Failed to load subject attributes:', error);
        setSubjectAttributes([]);
      }
    };

    loadAttributes();
  }, [manualForm.subjectId]);

  useEffect(() => {
    const loadReferenceResources = async () => {
      if (!manualForm.subjectId) {
        setAvailableReferenceResources([]);
        return;
      }
      try {
        const bySubject = await fetchData<ReferenceResource[]>(`/resources/subject/${manualForm.subjectId}`);
        setAvailableReferenceResources(Array.isArray(bySubject) ? bySubject : []);
      } catch (error) {
        console.error('Failed to load reference resources:', error);
        setAvailableReferenceResources([]);
      }
    };

    loadReferenceResources();
  }, [manualForm.subjectId]);

  useEffect(() => {
    setSelectedReferenceResourceIds((prev) => (
      prev.filter((id) => availableReferenceResources.some((resource) => resource.id === id))
    ));
  }, [availableReferenceResources]);

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

  const positionConfigMenu = () => {
    const anchor = configButtonRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = 320;
    const gap = 8;
    const minMargin = 12;
    const left = Math.max(minMargin, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - minMargin));
    const top = rect.bottom + gap;
    setConfigMenuPosition({ top, left });
  };

  useEffect(() => {
    if (!isConfigOpen) return;

    positionConfigMenu();

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

    const onViewportChange = () => {
      positionConfigMenu();
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
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
  }, [aiThread, isGenerating, isAiPanelCollapsed]);

  useEffect(() => {
    questionsRef.current = manualQuestions;
  }, [manualQuestions]);

  useEffect(() => {
    return () => {
      questionsRef.current.forEach((question) => {
        if (question.diagramPreviewUrl) {
          URL.revokeObjectURL(question.diagramPreviewUrl);
        }
      });
    };
  }, []);

  const setQuestionDiagram = (id: string, file: File | null) => {
    setManualQuestions((prev) => prev.map((question) => {
      if (question.id !== id) return question;

      if (question.diagramPreviewUrl) {
        URL.revokeObjectURL(question.diagramPreviewUrl);
      }

      if (!file) {
        return {
          ...question,
          diagramFile: null,
          diagramPreviewUrl: '',
        };
      }

      return {
        ...question,
        diagramFile: file,
        diagramPreviewUrl: URL.createObjectURL(file),
      };
    }));
  };

  const uploadAssessmentAsset = async (file: File, subjectId: string) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', subjectId);

    const response = await fetch(`${API_URL}/resources/upload`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to upload file.' }));
      throw new Error(error.message || 'Failed to upload file.');
    }

    return response.json();
  };

  const addQuestion = () => {
    setManualQuestions((prev) => ([
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        stem: '',
        questionTypeCode: 'mcq',
        maxMark: 1,
        difficulty: 2,
        options: [''],
        correctAnswer: '',
        markingGuide: '',
        diagramFile: null,
        diagramPreviewUrl: '',
      },
    ]));
  };

  const updateQuestion = (id: string, updates: Partial<ManualQuestion>) => {
    setManualQuestions((prev) => prev.map((question) => (
      question.id === id ? { ...question, ...updates } : question
    )));
  };

  const addOption = (id: string) => {
    setManualQuestions((prev) => prev.map((question) => (
      question.id === id ? { ...question, options: [...question.options, ''] } : question
    )));
  };

  const updateOption = (id: string, index: number, value: string) => {
    setManualQuestions((prev) => prev.map((question) => {
      if (question.id !== id) return question;
      const nextOptions = [...question.options];
      nextOptions[index] = value;
      return { ...question, options: nextOptions };
    }));
  };

  const removeQuestion = (id: string) => {
    setManualQuestions((prev) => {
      const target = prev.find((question) => question.id === id);
      if (target?.diagramPreviewUrl) {
        URL.revokeObjectURL(target.diagramPreviewUrl);
      }
      return prev.filter((question) => question.id !== id);
    });
  };

  const filteredAttributes = useMemo(() => {
    const query = attributeSearch.trim().toLowerCase();
    if (!query) return subjectAttributes;
    return subjectAttributes.filter((attribute) => attribute.name.toLowerCase().includes(query));
  }, [attributeSearch, subjectAttributes]);

  const selectedReferenceResources = useMemo(() => (
    availableReferenceResources.filter((resource) => selectedReferenceResourceIds.includes(resource.id))
  ), [availableReferenceResources, selectedReferenceResourceIds]);

  const mentionSuggestions = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    return availableReferenceResources
      .filter((resource) => (
        (!query || resource.name.toLowerCase().includes(query))
        && !selectedReferenceResourceIds.includes(resource.id)
      ))
      .slice(0, 8);
  }, [availableReferenceResources, mentionQuery, selectedReferenceResourceIds]);

  const handlePromptChange = (value: string, cursorPosition: number) => {
    setAiForm((prev) => ({ ...prev, prompt: value }));
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

  const insertReferenceMention = (resource: ReferenceResource) => {
    const textarea = promptRef.current;
    const currentPrompt = aiForm.prompt;
    const cursorPosition = textarea?.selectionStart ?? currentPrompt.length;
    const beforeCursor = currentPrompt.slice(0, cursorPosition);
    const afterCursor = currentPrompt.slice(cursorPosition);
    const mentionToken = `@[${resource.name}]`;
    const nextBefore = beforeCursor.replace(/(?:^|\s)@([^\s@]*)$/, (match) => {
      if (match.startsWith(' ')) return ` ${mentionToken}`;
      return mentionToken;
    });
    const nextPrompt = `${nextBefore}${afterCursor}`;

    setAiForm((prev) => ({ ...prev, prompt: nextPrompt }));
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

  const handleAIGenerate = async () => {
    if (!manualForm.subjectId) {
      toast.error('Select a subject first.');
      return;
    }
    if (aiForm.selectedAttributeIds.length === 0) {
      toast.error('Select at least one curriculum attribute for AI guidance.');
      return;
    }

    const promptText = aiForm.prompt.trim() || `Generate questions for ${manualForm.name || 'this assessment'}`;
    setAiThread((prev) => ([
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        type: 'prompt',
        text: promptText,
      },
    ]));
    setAiForm((prev) => ({ ...prev, prompt: '' }));
    setIsMentionOpen(false);
    setMentionQuery('');

    try {
      setIsGenerating(true);
      const referenceLine = selectedReferenceResources.length > 0
        ? `\nReference material in library: ${selectedReferenceResources.map((resource) => resource.name).join(', ')}.`
        : '';
      const attachedFileLine = assessmentFile
        ? `\nAttached assessment file: ${assessmentFile.name}.`
        : '';
      const generated = await aiService.generateQuestions({
        subjectId: manualForm.subjectId,
        attributes: aiForm.selectedAttributeIds,
        questionCount: aiForm.questionCount,
        difficulty: aiForm.difficulty,
        questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
        context: `${promptText}${referenceLine}${attachedFileLine}`,
      });

      if (!generated?.length) {
        toast.error('AI did not return any questions.');
        setAiThread((prev) => ([
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            type: 'summary',
            status: 'error',
            text: 'I could not generate questions from that prompt.',
            details: ['Try refining the prompt or selecting different attributes.'],
          },
        ]));
        return;
      }

      const mapped: ManualQuestion[] = generated.map((q, index) => {
        const questionTypeCode = mapAiQuestionType((q as any).type);
        const options = Array.isArray((q as any).options)
          ? (q as any).options
          : questionTypeCode === 'true_false'
            ? ['True', 'False']
            : [''];

        return {
          id: `${Date.now()}-ai-${index}`,
          stem: (q as any).text || '',
          questionTypeCode,
          maxMark: Number((q as any).points || 1),
          difficulty: mapDifficulty((q as any).difficulty),
          options,
          correctAnswer: (q as any).correctAnswer || '',
          markingGuide: (q as any).explanation || '',
          diagramFile: null,
          diagramPreviewUrl: '',
        };
      });

      setManualQuestions((prev) => [...prev, ...mapped]);
      const selectedAttributeNames = subjectAttributes
        .filter((attr) => aiForm.selectedAttributeIds.includes(attr.id))
        .map((attr) => attr.name);
      const summaryDetails = [
        `${mapped.length} question(s) added to canvas`,
        `Difficulty: ${aiForm.difficulty}`,
        selectedAttributeNames.length > 0 ? `Attributes: ${selectedAttributeNames.slice(0, 3).join(', ')}${selectedAttributeNames.length > 3 ? ` +${selectedAttributeNames.length - 3} more` : ''}` : '',
        selectedReferenceResources.length > 0 ? `References: ${selectedReferenceResources.length}` : '',
        assessmentFile ? `Attachment used: ${assessmentFile.name}` : '',
      ].filter(Boolean);
      setAiThread((prev) => ([
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          type: 'summary',
          status: 'success',
          text: 'Done. I drafted questions and inserted them into the canvas.',
          details: summaryDetails,
        },
      ]));
      toast.success(`Added ${mapped.length} AI-generated question(s) to canvas.`);
    } catch (error: any) {
      console.error('Failed to generate questions with AI:', error);
      setAiThread((prev) => ([
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          type: 'summary',
          status: 'error',
          text: 'Generation failed before I could update the canvas.',
          details: [error?.message || 'AI generation failed'],
        },
      ]));
      toast.error(error?.message || 'AI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!manualForm.schoolId) {
      toast.error('Please select a school');
      return;
    }
    if (!manualForm.subjectId) {
      toast.error('Please select a subject');
      return;
    }
    if (!manualForm.name.trim()) {
      toast.error('Assessment name is required');
      return;
    }

    if (!assessmentFile && manualQuestions.length === 0) {
      toast.error('Add at least one question or upload an assessment file.');
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser?.id) {
      toast.error('You need to be logged in to create an assessment.');
      return;
    }

    try {
      setIsSubmitting(true);
      let resourceId: string | null = null;
      const diagramMetaByQuestionId: Record<string, { id: string | null; name: string | null; url: string | null; mimeType: string | null }> = {};

      if (assessmentFile) {
        const uploadData = await uploadAssessmentAsset(assessmentFile, manualForm.subjectId);
        resourceId = uploadData?.resource?.id || null;
      }

      const diagramQuestions = manualQuestions.filter((question) => question.diagramFile);
      if (diagramQuestions.length > 0) {
        for (const question of diagramQuestions) {
          const uploadData = await uploadAssessmentAsset(question.diagramFile as File, manualForm.subjectId);
          diagramMetaByQuestionId[question.id] = {
            id: uploadData?.resource?.id || null,
            name: question.diagramFile?.name || null,
            url: uploadData?.resource?.url || null,
            mimeType: question.diagramFile?.type || null,
          };
        }
      }

      const payload = {
        schoolId: manualForm.schoolId,
        subjectId: manualForm.subjectId,
        name: manualForm.name.trim(),
        description: manualForm.description.trim(),
        assessmentType: manualForm.assessmentType,
        visibility: manualForm.visibility,
        timeLimitMin: manualForm.timeLimitMin || null,
        attemptsAllowed: manualForm.attemptsAllowed || null,
        maxScore: manualForm.maxScore,
        weightPct: manualForm.weightPct,
        aiEnhanced: aiForm.prompt.trim().length > 0,
        resourceId,
        status: manualForm.status,
        createdBy: currentUser.id,
        lastModifiedBy: currentUser.id,
        questions: manualQuestions.map((question, index) => ({
          stem: question.stem,
          questionTypeCode: question.questionTypeCode,
          maxMark: question.maxMark,
          difficulty: question.difficulty,
          rubricJson: {
            options: question.options,
            correctAnswer: question.correctAnswer,
            markingGuide: question.markingGuide,
            diagram: diagramMetaByQuestionId[question.id] || null,
          },
          sequenceIndex: index + 1,
          points: question.maxMark,
        })),
      };

      await fetchData('/assessments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Assessment created successfully');
      navigate('/assessments/view');
    } catch (error: any) {
      console.error('Failed to create assessment:', error);
      toast.error(error?.message || 'Failed to create assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onCreateAssessment={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onViewAssessments={() => navigate('/assessments/view')}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="create-assessment"
        recentUploads={[]}
      />

      <main className="flex-1 p-8 overflow-hidden">
        <div className="max-w-7xl h-full flex flex-col min-h-0">
          {isWorkspaceExpanded && <div className="fixed inset-0 bg-black/30 z-40" />}
          <div className={isWorkspaceExpanded ? 'fixed top-4 left-4 right-4 bottom-6 z-50' : 'flex-1 min-h-0'}>
            <div className={`${isWorkspaceExpanded ? 'bg-white rounded-lg shadow-2xl border border-gray-200 h-full max-h-[calc(100vh-2rem)]' : 'bg-white rounded-lg shadow h-full'} overflow-hidden flex flex-col`}>
              {isWorkspaceExpanded && (
                <button
                  onClick={() => setIsWorkspaceExpanded(false)}
                  className="absolute top-3 right-3 z-10 p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  aria-label="Collapse canvas"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  Assessment Workspace
                </div>
                <button
                  onClick={() => setIsWorkspaceExpanded((prev) => !prev)}
                  className="p-2 rounded-full hover:bg-gray-100"
                  aria-label={isWorkspaceExpanded ? 'Collapse' : 'Expand'}
                >
                  {isWorkspaceExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              <div ref={workspaceRef} className="flex-1 min-h-0 flex flex-col xl:flex-row">
                <div className="min-w-0 flex-1 overflow-y-auto p-6 space-y-6 relative z-0">
                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Assessment Brief</h2>
                    <div>
                      <label className="text-xs text-gray-500">Assessment Name</label>
                      <input
                        value={manualForm.name}
                        onChange={(e) => setManualForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                        placeholder="Enter assessment name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Subject</label>
                        <select
                          value={manualForm.subjectId}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                        >
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Assessment Type</label>
                        <select
                          value={manualForm.assessmentType}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, assessmentType: e.target.value }))}
                          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                        >
                          <option value="quiz">Quiz</option>
                          <option value="assignment">Assignment</option>
                          <option value="test">Test</option>
                          <option value="project">Project</option>
                          <option value="exam">Exam</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Description</label>
                      <textarea
                        value={manualForm.description}
                        onChange={(e) => setManualForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[100px]"
                        placeholder="Define the outcome and scope for learners"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Max Score</label>
                        <input type="number" min="1" value={manualForm.maxScore} onChange={(e) => setManualForm((prev) => ({ ...prev, maxScore: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Weight %</label>
                        <input type="number" min="0" value={manualForm.weightPct} onChange={(e) => setManualForm((prev) => ({ ...prev, weightPct: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Time Limit (min)</label>
                        <input type="number" min="0" value={manualForm.timeLimitMin} onChange={(e) => setManualForm((prev) => ({ ...prev, timeLimitMin: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Attempts Allowed</label>
                        <input type="number" min="1" value={manualForm.attemptsAllowed} onChange={(e) => setManualForm((prev) => ({ ...prev, attemptsAllowed: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Question Canvas</h2>
                      <button type="button" onClick={addQuestion} className="text-sm text-blue-600 hover:text-blue-700">+ Add question</button>
                    </div>

                    {manualQuestions.length === 0 ? (
                      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-500">
                        No questions yet. Type manually or ask AI collaborator to draft on the canvas.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {manualQuestions.map((question, index) => (
                          <div key={question.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">Question {index + 1}</h4>
                              <button type="button" onClick={() => removeQuestion(question.id)} className="text-xs text-red-600 hover:text-red-700">Remove</button>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Question text</label>
                              <textarea value={question.stem} onChange={(e) => updateQuestion(question.id, { stem: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[80px]" placeholder="Enter the question prompt" />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs text-gray-500">Diagram / image (optional)</label>
                              <input
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                                onChange={(e) => setQuestionDiagram(question.id, e.target.files?.[0] || null)}
                                className="block w-full text-sm text-gray-600"
                              />
                              {question.diagramPreviewUrl && (
                                <div className="border border-slate-200 rounded-md p-3 bg-slate-50 space-y-2">
                                  <img
                                    src={question.diagramPreviewUrl}
                                    alt={`Question ${index + 1} diagram`}
                                    className="max-h-56 w-auto rounded-md border border-slate-200 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setQuestionDiagram(question.id, null)}
                                    className="text-xs text-red-600 hover:text-red-700"
                                  >
                                    Remove image
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-xs text-gray-500">Type</label>
                                <select value={question.questionTypeCode} onChange={(e) => {
                                  const nextType = e.target.value as ManualQuestionType;
                                  if (nextType === 'true_false') {
                                    updateQuestion(question.id, { questionTypeCode: nextType, options: ['True', 'False'], correctAnswer: question.correctAnswer === 'True' || question.correctAnswer === 'False' ? question.correctAnswer : '' });
                                    return;
                                  }
                                  if (nextType === 'mcq') {
                                    updateQuestion(question.id, { questionTypeCode: nextType, options: question.options.length > 0 ? question.options : [''], correctAnswer: question.correctAnswer || '' });
                                    return;
                                  }
                                  updateQuestion(question.id, { questionTypeCode: nextType, options: [], correctAnswer: '' });
                                }} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
                                  <option value="mcq">Multiple choice</option>
                                  <option value="true_false">True/False</option>
                                  <option value="short_answer">Short answer</option>
                                  <option value="essay">Essay</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Max mark</label>
                                <input type="number" min="1" value={question.maxMark} onChange={(e) => updateQuestion(question.id, { maxMark: Number(e.target.value) })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Difficulty</label>
                                <select value={question.difficulty} onChange={(e) => updateQuestion(question.id, { difficulty: Number(e.target.value) })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
                                  <option value={1}>Easy</option>
                                  <option value={2}>Medium</option>
                                  <option value={3}>Hard</option>
                                </select>
                              </div>
                            </div>

                            {(question.questionTypeCode === 'mcq' || question.questionTypeCode === 'true_false') && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs text-gray-500">Options</label>
                                  {question.questionTypeCode === 'mcq' && (
                                    <button type="button" onClick={() => addOption(question.id)} className="text-xs text-blue-600 hover:text-blue-700">+ Add option</button>
                                  )}
                                </div>
                                {question.questionTypeCode === 'true_false' ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {['True', 'False'].map((option) => (
                                      <button key={option} type="button" onClick={() => updateQuestion(question.id, { options: ['True', 'False'], correctAnswer: option })} className={`px-3 py-2 rounded-md text-sm border ${question.correctAnswer === option ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {question.options.map((option, optionIndex) => (
                                      <div key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                        <input value={option} onChange={(e) => updateOption(question.id, optionIndex, e.target.value)} className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm" placeholder={`Option ${optionIndex + 1}`} />
                                        <button type="button" onClick={() => updateQuestion(question.id, { correctAnswer: option })} className={`text-xs px-2 py-1 rounded-md border ${question.correctAnswer === option ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-500'}`}>
                                          Correct
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div>
                              <label className="text-xs text-gray-500">Marking guide / model answer</label>
                              <textarea value={question.markingGuide} onChange={(e) => updateQuestion(question.id, { markingGuide: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[70px]" placeholder="Provide marking guidance for this question" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Status</label>
                      <select value={manualForm.status} onChange={(e) => setManualForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Visibility</label>
                      <select value={manualForm.visibility} onChange={(e) => setManualForm((prev) => ({ ...prev, visibility: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </section>
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
                  className={`relative z-10 overflow-hidden bg-slate-50 border-t xl:border-t-0 xl:border-l border-slate-100 transition-all duration-200 ${isAiPanelCollapsed ? 'p-3' : 'p-6'} flex flex-col gap-4`}
                  style={isDesktop ? { width: isAiPanelCollapsed ? 56 : aiPanelWidth } : undefined}
                >
                  <div className={`flex items-center ${isAiPanelCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
                    {!isAiPanelCollapsed && (
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        AI Collaborator
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAiPanelCollapsed((prev) => !prev)}
                      className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:border-slate-300"
                      aria-label={isAiPanelCollapsed ? 'Expand AI collaborator panel' : 'Collapse AI collaborator panel'}
                    >
                      {isAiPanelCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {isAiPanelCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setIsAiPanelCollapsed(false)}
                      className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white py-2 text-slate-600 hover:text-slate-800"
                      aria-label="Expand AI collaborator panel"
                    >
                      AI
                    </button>
                  ) : (
                    <>
                      <div className="flex-1 min-h-0 border border-slate-200 rounded-lg bg-white p-3 overflow-y-auto space-y-3">
                        {aiThread.length === 0 && !isGenerating && (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            Prompts and AI completion summaries will appear here.
                          </div>
                        )}
                        {aiThread.map((entry) => (
                          <div
                            key={entry.id}
                            className={entry.role === 'user'
                              ? 'ml-auto max-w-[92%] rounded-xl bg-blue-600 px-3 py-2 text-sm text-white'
                              : `mr-auto max-w-[95%] rounded-xl border px-3 py-2 text-sm ${entry.status === 'error'
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : entry.status === 'success'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-700'}` }
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
                        {isGenerating && (
                          <div className="mr-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                          </div>
                        )}
                        <div ref={threadEndRef} />
                      </div>

                      <div className="mt-auto space-y-2">
                        <div className="relative">
                          <textarea
                            ref={promptRef}
                            value={aiForm.prompt}
                            onChange={(e) => handlePromptChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isMentionOpen && mentionSuggestions.length > 0) {
                                e.preventDefault();
                                insertReferenceMention(mentionSuggestions[0]);
                              }
                            }}
                            className="w-full border border-slate-200 rounded-md px-3 py-2 pr-16 pb-12 text-sm min-h-[140px]"
                            placeholder="Prompt AI here. Use @ to attach library references."
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
                            onClick={handleAIGenerate}
                            disabled={isGenerating}
                            className="absolute right-2 bottom-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-60"
                            aria-label={isGenerating ? 'AI is thinking' : 'Generate on canvas'}
                          >
                            {isGenerating ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.2s]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.1s]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                              </span>
                            ) : (
                              <ArrowUp className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <input
                          ref={assessmentFileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => setAssessmentFile(e.target.files?.[0] || null)}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        />

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => assessmentFileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              Attach file
                            </button>
                            <div className="relative z-20">
                              <button
                                ref={configButtonRef}
                                type="button"
                                onClick={() => {
                                  if (isConfigOpen) {
                                    setIsConfigOpen(false);
                                    return;
                                  }
                                  positionConfigMenu();
                                  setIsConfigOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                                Configure
                              </button>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500">Type @ to attach reference</span>
                        </div>

                        {assessmentFile && (
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                              {assessmentFile.name}
                              <button
                                type="button"
                                onClick={() => setAssessmentFile(null)}
                                className="text-slate-400 hover:text-slate-700"
                                aria-label="Remove attached file"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          </div>
                        )}

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
                                  <X className="w-3 h-3" />
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
                    Preview Assessment
                  </button>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate('/assessments/view')} className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">
                    Cancel
                    </button>
                    <button type="button" onClick={handleSubmitAssessment} disabled={isSubmitting || isGenerating} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                      {isSubmitting ? 'Saving...' : 'Create Assessment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Assessment Preview</h2>
                <p className="text-xs text-slate-600">
                  {manualQuestions.length} question(s) • Total marks: {manualQuestions.reduce((sum, question) => sum + (question.maxMark || 0), 0)}
                </p>
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
                <div className="text-sm font-semibold text-slate-900">{manualForm.name || 'Untitled assessment'}</div>
                <div className="text-xs text-slate-600">
                  {manualForm.assessmentType} • Max score: {manualForm.maxScore} • Time limit: {manualForm.timeLimitMin || 0} min
                </div>
                {manualForm.description && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{manualForm.description}</p>
                )}
              </div>

              {manualQuestions.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-lg p-6 text-sm text-slate-500">
                  No questions to preview yet.
                </div>
              ) : (
                manualQuestions.map((question, index) => (
                  <div key={`preview-${question.id}`} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">Question {index + 1}</div>
                      <div className="text-xs text-slate-600">
                        {question.questionTypeCode.replace('_', ' ')} • {question.maxMark} mark(s)
                      </div>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{question.stem || 'No question text yet.'}</p>
                    {question.diagramPreviewUrl && (
                      <img
                        src={question.diagramPreviewUrl}
                        alt={`Preview diagram for question ${index + 1}`}
                        className="max-h-64 w-auto rounded-md border border-slate-200 bg-white"
                      />
                    )}
                    {(question.questionTypeCode === 'mcq' || question.questionTypeCode === 'true_false') && (
                      <div className="space-y-1">
                        {question.options.filter((option) => option.trim().length > 0).map((option, optionIndex) => (
                          <div key={`${question.id}-preview-option-${optionIndex}`} className="text-sm text-slate-700">
                            {String.fromCharCode(65 + optionIndex)}. {option}
                          </div>
                        ))}
                      </div>
                    )}
                    {question.markingGuide && (
                      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900 whitespace-pre-wrap">
                        <span className="font-semibold">Marking guide: </span>
                        {question.markingGuide}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isConfigOpen && configMenuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={configMenuRef}
          className="fixed z-[220] w-[320px] max-w-[80vw] border border-slate-200 rounded-lg bg-white shadow-xl p-3 space-y-3"
          style={{ top: configMenuPosition.top, left: configMenuPosition.left }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Question count</label>
              <input
                type="number"
                min="1"
                max="20"
                value={aiForm.questionCount}
                onChange={(e) => setAiForm((prev) => ({ ...prev, questionCount: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Difficulty</label>
              <select
                value={aiForm.difficulty}
                onChange={(e) => setAiForm((prev) => ({ ...prev, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-500">Curriculum attributes</label>
              <input
                value={attributeSearch}
                onChange={(e) => setAttributeSearch(e.target.value)}
                className="w-36 border border-slate-200 rounded-md px-2 py-1 text-xs"
                placeholder="Search..."
              />
            </div>
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-md bg-white p-2 space-y-2">
              {filteredAttributes.length === 0 ? (
                <p className="text-xs text-slate-500 p-1">No matching attributes.</p>
              ) : filteredAttributes.map((attr) => (
                <label key={attr.id} className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={aiForm.selectedAttributeIds.includes(attr.id)}
                    onChange={(e) => setAiForm((prev) => ({
                      ...prev,
                      selectedAttributeIds: e.target.checked
                        ? [...prev.selectedAttributeIds, attr.id]
                        : prev.selectedAttributeIds.filter((id) => id !== attr.id),
                    }))}
                    className="mt-0.5"
                  />
                  <span>{attr.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CreateAssessmentPage;
