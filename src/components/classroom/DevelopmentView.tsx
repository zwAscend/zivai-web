import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { developmentService, studentService, subjectService } from '../../services/api';
import { DevelopmentPlan, Skill, SkillColor, Step, Student, Subject } from '../../types';
import { useToast } from '@/components/ui/use-toast';
import {
  Bold,
  Bot,
  Code2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Redo2,
  Search,
  SendHorizontal,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';

interface DevelopmentViewProps {
  studentId?: string;
}

const isValidUuid = (value: string) => /^[0-9a-fA-F-]{36}$/.test(value);

const getStudentPrimarySubjectId = (student: Student | null): string => {
  if (!student?.subjects?.length) return '';
  const first = student.subjects[0];
  return typeof first === 'string' ? first : first.id;
};

const formatStepType = (value?: string) => {
  if (!value) return 'Document';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getOverallGrade = (overall?: number): string => {
  if (typeof overall !== 'number' || Number.isNaN(overall)) return 'N/A';
  if (overall >= 80) return 'A';
  if (overall >= 70) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 50) return 'D';
  return 'E';
};

const DevelopmentView: React.FC<DevelopmentViewProps> = ({ studentId: propStudentId }) => {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const initialStudentId = (propStudentId && propStudentId !== 'undefined')
    ? propStudentId
    : ((paramStudentId && paramStudentId !== 'undefined') ? paramStudentId : '');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allStudentDevelopmentPlans, setAllStudentDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [currentDisplayPlan, setCurrentDisplayPlan] = useState<DevelopmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<{ skillIndex: number | null; subskillIndex: number | null }>({
    skillIndex: null,
    subskillIndex: null,
  });
  const [isPlanSidebarCollapsed, setIsPlanSidebarCollapsed] = useState(false);
  const [isStudentsPanelCollapsed, setIsStudentsPanelCollapsed] = useState(false);

  const [subjectOptions, setSubjectOptions] = useState<Subject[]>([]);
  const [studentsSubjectFilter, setStudentsSubjectFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isStepWorkspaceOpen, setIsStepWorkspaceOpen] = useState(false);
  const [isStepWorkspaceMaximized, setIsStepWorkspaceMaximized] = useState(false);
  const [isStepAiCollapsed, setIsStepAiCollapsed] = useState(false);
  const [isPersistingPlan, setIsPersistingPlan] = useState(false);
  const [isCreatingStarterPlan, setIsCreatingStarterPlan] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepWorkspaceDraft, setStepWorkspaceDraft] = useState<Step>({
    title: '',
    type: 'document',
    content: '',
    order: 1,
    link: '',
    additionalResources: [],
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'assistant' | 'teacher'; content: string }>>([
    { role: 'assistant', content: 'I can help draft or refine this step. Ask me for a clearer activity, quiz, or rubric.' },
  ]);
  const stepEditorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const { toast } = useToast();

  const getActiveSubjectContext = () => {
    const subjectId = studentsSubjectFilter || getStudentPrimarySubjectId(selectedStudent);
    const selectedSubjectOption = subjectOptions.find((subject) => subject.id === subjectId);
    const subjectFromStudent = selectedStudent?.subjects?.find((subject) =>
      typeof subject === 'string' ? subject === subjectId : subject.id === subjectId
    );
    const subjectName =
      selectedSubjectOption?.name ||
      (subjectFromStudent && typeof subjectFromStudent !== 'string' ? subjectFromStudent.name : '') ||
      'Selected subject';

    return { subjectId, subjectName };
  };

  const middleColClass = isStepWorkspaceMaximized
    ? 'lg:col-span-12'
    : isStepWorkspaceOpen
      ? 'lg:col-span-12'
    : isPlanSidebarCollapsed
      ? (isStudentsPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-9')
      : (isStudentsPanelCollapsed ? 'lg:col-span-9' : 'lg:col-span-6');

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return allStudents;
    return allStudents.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        (student.email || '').toLowerCase().includes(query)
      );
    });
  }, [allStudents, studentSearch]);

  const getCurrentSkills = (): { mainSkills: Skill[] } => {
    if (!currentDisplayPlan?.plan?.skills) return { mainSkills: [] };
    return {
      mainSkills: currentDisplayPlan.plan.skills.map((skill) => {
        const progress = currentDisplayPlan.skillProgress?.find((item) => item.skill === skill.name);
        return {
          ...skill,
          score: progress?.currentScore || skill.score,
          subskills: skill.subskills.map((sub) => ({
            ...sub,
            color: (sub.score > 70 ? 'cyan' : 'yellow') as SkillColor,
          })),
        };
      }),
    };
  };

  const currentSkills = getCurrentSkills();
  const sortedStepEntries = useMemo(() => {
    if (!currentDisplayPlan?.plan?.steps?.length) {
      return [] as Array<{ step: Step; index: number; order: number }>;
    }
    return currentDisplayPlan.plan.steps
      .map((step, index) => ({ step, index, order: step.order || index + 1 }))
      .sort((a, b) => a.order - b.order);
  }, [currentDisplayPlan]);

  useEffect(() => {
    setIsStepWorkspaceOpen(false);
    setEditingStepIndex(null);
    setIsStepWorkspaceMaximized(false);
    setIsStepAiCollapsed(false);
  }, [currentDisplayPlan?.id]);

  useEffect(() => {
    if (!isStepWorkspaceOpen || !stepEditorRef.current) return;
    if (stepEditorRef.current.innerHTML !== (stepWorkspaceDraft.content || '')) {
      stepEditorRef.current.innerHTML = stepWorkspaceDraft.content || '';
    }
  }, [isStepWorkspaceOpen, stepWorkspaceDraft.content]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const subjects = await subjectService.getTeachingSubjects();
        setSubjectOptions(subjects || []);
      } catch (err) {
        console.error('Failed to load teaching subjects:', err);
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const students = await studentService.getStudents(studentsSubjectFilter || undefined);
        setAllStudents(students || []);
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }
    };
    loadStudents();
  }, [studentsSubjectFilter]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const studentData = await studentService.getStudent(initialStudentId);
        setSelectedStudent(studentData);

        const plansData = await developmentService.getAllPlansForStudent(initialStudentId);
        setAllStudentDevelopmentPlans(plansData);

        const activePlan = plansData.find((plan) => plan.status === 'Active');
        setCurrentDisplayPlan(activePlan || plansData[0] || null);

        if (!studentsSubjectFilter) {
          const primarySubjectId = getStudentPrimarySubjectId(studentData);
          if (primarySubjectId) {
            setStudentsSubjectFilter(primarySubjectId);
          }
        }
      } catch (err: any) {
        console.error('Error fetching student or development plans:', err);
        setError(err.message || 'Failed to load student development data.');
      } finally {
        setLoading(false);
      }
    };

    if (initialStudentId) {
      if (!isValidUuid(initialStudentId)) {
        setError('Invalid student id in route.');
        setLoading(false);
        return;
      }
      fetchData();
    }
  }, [initialStudentId]);

  const handleStudentSelect = async (newStudentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const studentData = await studentService.getStudent(newStudentId);
      setSelectedStudent(studentData);

      const plansData = await developmentService.getAllPlansForStudent(newStudentId);
      setAllStudentDevelopmentPlans(plansData);

      const activePlan = plansData.find((plan) => plan.status === 'Active');
      setCurrentDisplayPlan(activePlan || plansData[0] || null);
    } catch (err: any) {
      console.error('Error fetching student or development plans on select:', err);
      setError(err.message || 'Failed to load data for selected student.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanCreated = async (studentId: string, newPlan: DevelopmentPlan) => {
    try {
      const updatedPlans = await developmentService.getAllPlansForStudent(studentId);
      setAllStudentDevelopmentPlans(updatedPlans);

      const newPlanItem = updatedPlans.find((plan) =>
        plan.id === newPlan.id || plan.plan.id === newPlan.plan.id
      );
      const activePlan = updatedPlans.find((plan) => plan.status === 'Active');
      setCurrentDisplayPlan(newPlanItem || activePlan || updatedPlans[0] || null);
      toast.success('Development plan created successfully');
    } catch (err) {
      console.error('Error handling new plan:', err);
      toast.error('Failed to load the new plan');
    }
  };

  const createManualStarterPlan = async () => {
    if (!selectedStudent) return;

    const { subjectId, subjectName } = getActiveSubjectContext();
    if (!subjectId) {
      toast.error('Select a subject before creating a development plan');
      return;
    }

    const fullName = `${selectedStudent.firstName} ${selectedStudent.lastName}`.trim();

    try {
      setIsCreatingStarterPlan(true);
      const createdPlan = await developmentService.createSubjectPlan({
        name: `${fullName} ${subjectName} Development Plan`,
        description: `Manual development plan for ${fullName} in ${subjectName}.`,
        progress: 0,
        potentialOverall: Math.max(70, Number(selectedStudent.overall || 0)),
        eta: 14,
        performance: 'Tracking',
        skills: [],
        steps: [],
        subjectId,
      });

      const assignedPlan = await developmentService.assignPlanToStudent(selectedStudent.id, createdPlan.id, subjectId);
      await handlePlanCreated(selectedStudent.id, assignedPlan);

      setEditingStepIndex(null);
      setStepWorkspaceDraft({
        title: '',
        type: 'document',
        content: '',
        order: 1,
        link: '',
        additionalResources: [],
      });
      setIsStepWorkspaceOpen(true);
      toast.success('Development plan created. Add the first step to get started.');
    } catch (err) {
      console.error('Failed to create starter development plan:', err);
      toast.error('Failed to create development plan');
    } finally {
      setIsCreatingStarterPlan(false);
    }
  };

  const openAiPlanBuilder = () => {
    if (!selectedStudent) return;

    const { subjectId } = getActiveSubjectContext();
    if (!subjectId) {
      toast.error('Select a subject before opening the AI builder');
      return;
    }

    navigate(`/development/create/${selectedStudent.id}/${subjectId}`);
  };

  const syncUpdatedPlanInState = (updatedPlan: DevelopmentPlan) => {
    setAllStudentDevelopmentPlans((previous) =>
      previous.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan))
    );
    setCurrentDisplayPlan((previous) => (previous?.id === updatedPlan.id ? updatedPlan : previous));
  };

  const persistStudentPlanUpdate = async (payload: Record<string, unknown>) => {
    if (!currentDisplayPlan) return null;
    const updatedPlan = await developmentService.updateStudentPlan(currentDisplayPlan.id, payload);
    syncUpdatedPlanInState(updatedPlan);
    return updatedPlan;
  };

  const openStepWorkspace = (index?: number) => {
    if (!currentDisplayPlan) return;
    if (typeof index === 'number') {
      const step = currentDisplayPlan.plan.steps[index];
      setEditingStepIndex(index);
      setStepWorkspaceDraft({
        ...step,
        type: (step.type || 'document') as Step['type'],
        content: step.content || `<p><strong>${step.title}</strong></p>${step.link ? `<p>${step.link}</p>` : ''}`,
        order: step.order || index + 1,
        link: step.link || '',
        additionalResources: step.additionalResources || [],
      });
    } else {
      setEditingStepIndex(null);
      setStepWorkspaceDraft({
        title: '',
        type: 'document',
        content: '',
        order: (currentDisplayPlan.plan.steps?.length || 0) + 1,
        link: '',
        additionalResources: [],
      });
    }
    setIsStepWorkspaceOpen(true);
  };

  const closeStepWorkspace = () => {
    setIsStepWorkspaceOpen(false);
    setEditingStepIndex(null);
    setIsStepWorkspaceMaximized(false);
  };

  const saveStepWorkspace = async () => {
    if (!currentDisplayPlan) return;
    if (!stepWorkspaceDraft.title.trim()) {
      toast.error('Step title is required');
      return;
    }

    const normalizedStep: Step = {
      ...stepWorkspaceDraft,
      title: stepWorkspaceDraft.title.trim(),
      content: stepWorkspaceDraft.content || '',
      link: stepWorkspaceDraft.link || '',
    };

    const existingSteps = [...(currentDisplayPlan.plan.steps || [])];
    if (editingStepIndex === null) {
      existingSteps.push(normalizedStep);
    } else {
      existingSteps[editingStepIndex] = normalizedStep;
    }
    const normalized = existingSteps
      .map((step, idx) => ({ ...step, order: idx + 1, content: step.content || '' }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    try {
      setIsPersistingPlan(true);
      await persistStudentPlanUpdate({
        steps: normalized.map((step, idx) => ({
          title: step.title,
          type: step.type,
          content: step.content || '',
          link: step.link || '',
          order: step.order || idx + 1,
          additionalResources: step.additionalResources || [],
        })),
      });
      setIsStepWorkspaceOpen(false);
      toast.success(editingStepIndex === null ? 'Step added' : 'Step updated');
    } catch (err) {
      console.error('Failed to save step:', err);
      toast.error('Failed to save step');
    } finally {
      setIsPersistingPlan(false);
    }
  };

  const applyStepEditorCommand = (command: string, value?: string) => {
    if (!stepEditorRef.current) return;
    stepEditorRef.current.focus();
    document.execCommand(command, false, value);
    setStepWorkspaceDraft((prev) => ({ ...prev, content: stepEditorRef.current?.innerHTML || '' }));
  };

  const handleStepBlockStyle = (value: string) => {
    if (value === 'bulleted-list') {
      applyStepEditorCommand('insertUnorderedList');
      return;
    }
    if (value === 'numbered-list') {
      applyStepEditorCommand('insertOrderedList');
      return;
    }
    if (value === 'blockquote') {
      applyStepEditorCommand('formatBlock', 'BLOCKQUOTE');
      return;
    }
    if (value === 'code') {
      applyStepEditorCommand('formatBlock', 'PRE');
      return;
    }
    applyStepEditorCommand('formatBlock', value);
  };

  const handleInsertStepLink = () => {
    const url = window.prompt('Enter URL');
    if (!url) return;
    applyStepEditorCommand('createLink', url);
  };

  const handleStepImageSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      applyStepEditorCommand('insertImage', result);
    };
    reader.readAsDataURL(file);
  };

  const handleSendAiPrompt = () => {
    const text = aiPrompt.trim();
    if (!text) return;
    setAiMessages((prev) => [
      ...prev,
      { role: 'teacher', content: text },
      { role: 'assistant', content: 'Suggestion added. Review and save this step if it matches your objective.' },
    ]);
    setStepWorkspaceDraft((prev) => ({
      ...prev,
      content: `${prev.content || ''}<p><strong>AI Suggestion:</strong> ${text}</p>`,
    }));
    setAiPrompt('');
  };

  const deleteStep = async (index: number) => {
    if (!currentDisplayPlan) return;
    const nextSteps = [...(currentDisplayPlan.plan.steps || [])]
      .filter((_, idx) => idx !== index)
      .map((step, idx) => ({ ...step, order: idx + 1, content: step.content || '' }));

    try {
      setIsPersistingPlan(true);
      await persistStudentPlanUpdate({
        steps: nextSteps.map((step, idx) => ({
          title: step.title,
          type: step.type,
          content: step.content || '',
          link: step.link || '',
          order: step.order || idx + 1,
          additionalResources: step.additionalResources || [],
        })),
      });
      if (editingStepIndex === index) {
        closeStepWorkspace();
      }
      toast.success('Step removed');
    } catch (err) {
      console.error('Failed to delete step:', err);
      toast.error('Failed to delete step');
    } finally {
      setIsPersistingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[60vh] p-0">
        <div className="lg:col-span-3 col-span-12 bg-white rounded-lg shadow p-2 space-y-2">
          <div className="h-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-72 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="lg:col-span-6 col-span-12 bg-white rounded-lg shadow p-2">
          <div className="h-96 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="lg:col-span-3 col-span-12 bg-white rounded-lg shadow p-2">
          <div className="h-96 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex justify-center items-center h-full text-red-600 text-sm">Error: {error}</div>;
  }

  if (!selectedStudent) {
    return <div className="flex justify-center items-center h-full text-sm">No student found.</div>;
  }

  const fullName = `${selectedStudent.firstName} ${selectedStudent.lastName}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-x-0 h-full overflow-hidden p-0">
      {!isPlanSidebarCollapsed && !isStepWorkspaceMaximized && !isStepWorkspaceOpen && (
      <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 flex flex-col overflow-hidden">
        <div className="bg-white rounded-lg p-2 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-700 text-white text-sm font-bold rounded-full flex items-center justify-center mx-auto mb-1">
            {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
          </div>
          <div className="text-right mb-1">
            <div className="text-gray-600 text-xs">OVR</div>
            <div className="text-lg font-bold">{selectedStudent.overall}</div>
            <div className="text-[11px] font-medium text-slate-600">Grade: {getOverallGrade(selectedStudent.overall)}</div>
          </div>
          <div className="text-center">
            <h2 className="text-sm font-bold mb-0.5">{fullName}</h2>
            <p className="text-gray-600 text-xs">Plan | {currentDisplayPlan?.plan.name || 'Not assigned'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-2 flex min-h-0 flex-1 flex-col">
          <h3 className="font-bold text-center mb-1.5 text-sm">Growth Area</h3>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {allStudentDevelopmentPlans.map((planItem) => (
              <button
                key={planItem.id}
                onClick={() => setCurrentDisplayPlan(planItem)}
                className={`w-full p-2 rounded-lg text-sm font-medium transition-all duration-300 flex justify-between items-center ${
                  planItem.id === currentDisplayPlan?.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                <span className="truncate pr-2 text-left">{planItem.plan.name}</span>
                <span className="text-xs bg-green-200 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {planItem.status}
                </span>
              </button>
            ))}
          </div>
          <button
            className="w-full mt-2 bg-blue-900 text-white py-2 px-2 rounded-lg hover:bg-blue-800 transition-colors text-sm"
            onClick={openAiPlanBuilder}
          >
            AI Plan Builder
          </button>
        </div>
      </div>
      )}

      <div
        className={`${
          isStepWorkspaceOpen
            ? (isStepWorkspaceMaximized
                ? 'fixed inset-4 z-40 col-span-12 overflow-hidden p-0'
                : `${middleColClass} relative col-span-12 overflow-hidden p-0`)
            : (isStepWorkspaceMaximized
                ? 'fixed inset-4 z-40 col-span-12 bg-gray-50 rounded-lg shadow-2xl py-3 pl-10 pr-10 overflow-y-auto'
                : `${middleColClass} relative col-span-12 bg-gray-50 rounded-lg shadow py-3 pl-10 pr-10 overflow-y-auto`)
        }`}
      >
        {!isStepWorkspaceOpen ? (
          <button
            type="button"
            className="absolute left-2 top-1/2 z-20 inline-flex -translate-y-1/2 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-100"
            onClick={() => setIsPlanSidebarCollapsed((prev) => !prev)}
            aria-label={isPlanSidebarCollapsed ? 'Expand growth area panel' : 'Collapse growth area panel'}
            title={isPlanSidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {isPlanSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        ) : null}
        {!isStepWorkspaceMaximized && !isStepWorkspaceOpen ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 z-20 inline-flex -translate-y-1/2 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-100"
            onClick={() => setIsStudentsPanelCollapsed((prev) => !prev)}
            aria-label={isStudentsPanelCollapsed ? 'Expand students panel' : 'Collapse students panel'}
            title={isStudentsPanelCollapsed ? 'Expand students panel' : 'Collapse students panel'}
          >
            {isStudentsPanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : null}
        {!currentDisplayPlan ? (
          <div className="flex h-full min-h-[280px] items-center justify-center">
            <div className="max-w-2xl rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
              <h2 className="text-base font-semibold text-slate-900">No development plan assigned</h2>
              <p className="mt-2 text-sm text-slate-600">
                Start a plan directly in the normal step workflow, or open the AI builder if you want help generating the initial structure for {fullName}.
              </p>
              <div className="mt-5 grid gap-3 text-left md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Manual creation</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Create an empty plan, then add plan steps, resources, practices, and guidance yourself in the existing workspace.
                  </p>
                  <button
                    className="mt-4 inline-flex rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={createManualStarterPlan}
                    disabled={isCreatingStarterPlan}
                  >
                    {isCreatingStarterPlan ? 'Creating plan...' : 'Create Manually'}
                  </button>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">AI-assisted creation</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Use AI to draft the starting plan from learner signals, then refine the plan before publishing.
                  </p>
                  <button
                    className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    onClick={openAiPlanBuilder}
                  >
                    Use AI Assistance
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : isStepWorkspaceOpen ? (
          <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_56px]">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleStepImageSelected(file);
                  e.currentTarget.value = '';
                }
              }}
            />

            <div className="col-span-full min-h-0 overflow-hidden">
              <div className="mx-auto flex h-full max-w-7xl min-h-0 flex-col overflow-hidden">
                <div className="min-h-0 flex-1">
                  <div className="flex h-full min-h-[640px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={closeStepWorkspace}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          Back to plan
                        </button>
                        <button
                          type="button"
                          onClick={saveStepWorkspace}
                          disabled={isPersistingPlan}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Save step
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={editingStepIndex === null ? '__new' : String(editingStepIndex)}
                          onChange={(e) => {
                            const selected = e.target.value;
                            if (selected === '__new') {
                              openStepWorkspace();
                              return;
                            }
                            const selectedIndex = Number(selected);
                            if (!Number.isNaN(selectedIndex)) {
                              openStepWorkspace(selectedIndex);
                            }
                          }}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        >
                          {sortedStepEntries.map(({ step, index, order }) => (
                            <option key={`${step.title}-${index}`} value={String(index)}>
                              {`Step ${order}: ${step.title || 'Untitled step'}`}
                            </option>
                          ))}
                          <option value="__new">New step</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsStepWorkspaceMaximized((prev) => !prev)}
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                          aria-label={isStepWorkspaceMaximized ? 'Restore editor size' : 'Expand editor size'}
                          title={isStepWorkspaceMaximized ? 'Restore' : 'Expand'}
                        >
                          {isStepWorkspaceMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
                      <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
                        <div className="rounded-lg border border-slate-200 bg-white">
                  <div className="space-y-3 border-b border-slate-200 p-3">
                    <input
                      value={stepWorkspaceDraft.title}
                      onChange={(e) => setStepWorkspaceDraft((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900"
                      placeholder="Step title"
                    />
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <select
                        value={stepWorkspaceDraft.type}
                        onChange={(e) =>
                          setStepWorkspaceDraft((prev) => ({ ...prev, type: e.target.value as Step['type'] }))
                        }
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                      >
                        <option value="document">Document</option>
                        <option value="video">Video</option>
                        <option value="assessment">Assessment</option>
                        <option value="assignment">Assignment</option>
                        <option value="quiz">Quiz</option>
                        <option value="discussion">Discussion</option>
                      </select>
                      <input
                        value={stepWorkspaceDraft.link || ''}
                        onChange={(e) => setStepWorkspaceDraft((prev) => ({ ...prev, link: e.target.value }))}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
                        placeholder="Optional external link"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('undo')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Undo"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('redo')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Redo"
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </button>
                    <select
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                      onChange={(e) => {
                        handleStepBlockStyle(e.target.value);
                        e.currentTarget.value = 'P';
                      }}
                      defaultValue="P"
                    >
                      <option value="P">Paragraph</option>
                      <option value="H1">Title</option>
                      <option value="H2">Heading</option>
                      <option value="H3">Subheading</option>
                      <option value="blockquote">Block quote</option>
                      <option value="bulleted-list">Bulleted list</option>
                      <option value="numbered-list">Numbered list</option>
                      <option value="code">Code block</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('bold')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Bold"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('italic')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Italic"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('underline')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Underline"
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('insertUnorderedList')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Bulleted list"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('insertOrderedList')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Numbered list"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertStepLink()}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Insert link"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Insert image"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStepEditorCommand('formatBlock', 'PRE')}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      title="Code block"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="relative p-3">
                    <div
                      ref={stepEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) =>
                        setStepWorkspaceDraft((prev) => ({
                          ...prev,
                          content: (e.currentTarget as HTMLDivElement).innerHTML,
                        }))
                      }
                      className="min-h-[440px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {!stepWorkspaceDraft.content ? (
                      <span className="pointer-events-none absolute left-6 top-5 text-sm text-slate-400">
                        Start writing step content here...
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {!isStepAiCollapsed ? (
                <button
                  type="button"
                  className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-slate-100 bg-slate-50 transition-colors hover:bg-blue-50 xl:flex"
                  aria-label="Resize AI collaborator panel"
                >
                  <GripVertical className="h-8 w-3 text-slate-400" />
                </button>
              ) : null}

              <aside
                className={`relative z-10 overflow-hidden border-slate-100 bg-slate-50 transition-all duration-200 ${
                  isStepAiCollapsed
                    ? 'flex h-full flex-col items-center gap-2 border-t p-2.5 xl:w-14 xl:border-l xl:border-t-0'
                    : 'flex min-h-0 w-full flex-col border-t p-3 xl:w-80 xl:border-l xl:border-t-0'
                }`}
              >
                {isStepAiCollapsed ? (
                  <>
                    <Bot className="mt-1 h-4 w-4 text-slate-600" />
                    <button
                      type="button"
                      onClick={() => setIsStepAiCollapsed(false)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      aria-label="Expand AI collaborator panel"
                      title="Expand"
                    >
                      <PanelRightOpen className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-slate-600" />
                        <p className="text-sm font-semibold text-slate-900">AI Collaborator</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsStepAiCollapsed(true)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Collapse AI collaborator panel"
                        title="Collapse"
                      >
                        <PanelRightClose className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-200 bg-white p-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistant chat</p>
                      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {aiMessages.map((msg, idx) => (
                          <div
                            key={`${msg.role}-${idx}`}
                            className={`rounded-md px-2 py-1.5 text-xs ${
                              msg.role === 'assistant' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {msg.content}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-end gap-2 border-t border-slate-200 pt-2">
                        <textarea
                          rows={1}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Ask AI to improve this step..."
                          className="min-h-[32px] max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-md border border-slate-200 px-2 py-1.5 text-xs leading-5"
                        />
                        <button
                          type="button"
                          onClick={handleSendAiPrompt}
                          className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-100"
                          aria-label="Send message"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </aside>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-slate-900">{currentDisplayPlan.plan.name}</h1>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Progress</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${currentDisplayPlan.currentProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{currentDisplayPlan.currentProgress}%</span>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <p className="text-xs text-slate-500">ETA</p>
                  <p className="text-sm font-semibold text-slate-900">{currentDisplayPlan.plan.eta} Days</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <p className="text-xs text-slate-500">Performance</p>
                  <p className="text-sm font-semibold text-slate-900">{currentDisplayPlan.plan.performance}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Skill Canvas</h2>
                <span className="text-xs text-slate-500">{currentSkills.mainSkills.length} skills</span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {currentSkills.mainSkills.map((skill, skillIndex) => (
                  <div
                    key={skillIndex}
                    className={`rounded-lg border border-slate-200 p-3 transition ${
                      expandedSkill.skillIndex === skillIndex ? 'ring-1 ring-blue-300 border-blue-300' : 'hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        setExpandedSkill((prev) => ({
                          skillIndex: prev.skillIndex === skillIndex ? null : skillIndex,
                          subskillIndex: null,
                        }))
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                          <p className="text-xs text-slate-500">Score {skill.score}</p>
                        </div>
                        <span className={`text-xs transition-transform ${expandedSkill.skillIndex === skillIndex ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        expandedSkill.skillIndex === skillIndex ? 'max-h-[360px] mt-2' : 'max-h-0'
                      }`}
                    >
                      <div className="space-y-2">
                        {skill.subskills.map((subskill, subIndex) => (
                          <div key={subIndex} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{subskill.name}</span>
                              <span className="font-semibold text-slate-900">{subskill.score}</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${subskill.color === 'yellow' ? 'bg-amber-400' : 'bg-cyan-500'}`}
                                style={{ width: `${subskill.score}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Plan Workflow</h2>
                <button
                  type="button"
                  onClick={() => openStepWorkspace()}
                  disabled={isPersistingPlan}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </button>
              </div>
              <div className="space-y-2">
                {sortedStepEntries.map(({ step, index, order }) => (
                    <button
                      type="button"
                      key={`${step.title}-${index}`}
                      onClick={() => openStepWorkspace(index)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
                            {order}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                              <span className="rounded-full bg-slate-200 px-2 py-0.5">{formatStepType(step.type as string)}</span>
                              {step.link ? <span className="truncate max-w-[280px]">{step.link}</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteStep(index);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                deleteStep(index);
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                            aria-label="Delete step"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isStudentsPanelCollapsed && !isStepWorkspaceMaximized && !isStepWorkspaceOpen && (
      <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 overflow-y-auto">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800 px-1">Students</h3>
            <span className="text-xs text-slate-500">{filteredStudents.length}</span>
          </div>
        </div>
        <div className="space-y-2 mb-2">
          <select
            value={studentsSubjectFilter}
            onChange={(e) => setStudentsSubjectFilter(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700"
          >
            <option value="">All subjects</option>
            {subjectOptions.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search students..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-2 text-xs text-slate-700"
            />
          </div>
        </div>

        <div className="space-y-1">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => handleStudentSelect(student.id)}
              className={`cursor-pointer bg-white rounded p-2 shadow-sm transition-all duration-300 border ${
                student.id === selectedStudent.id
                  ? 'border-cyan-500 ring-1 ring-cyan-300'
                  : 'hover:shadow-md hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{student.firstName} {student.lastName}</div>
                  <div className="mt-1 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="inline-flex items-center text-gray-600">
                      <span className="w-1 h-1 rounded-full bg-blue-500 mr-0.5" />
                      OVR: {student.overall || 'N/A'}
                    </span>
                    <span className="text-gray-500">Engagement: {student.engagement || 'Unknown'}</span>
                  </div>
                </div>
                <div className="ml-1 flex-shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-xs">
                    {student.firstName?.[0]}{student.lastName?.[0]}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

export default DevelopmentView;
