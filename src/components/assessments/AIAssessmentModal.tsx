import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles,
  CheckCircle,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Question, Assessment, SubjectAttribute, AssessmentType } from '@/types';
import { aiService } from '@/services/aiService';
import { DetailsStep } from './AIAssessmentSteps/DetailsStep';
import { GenerateStep } from './AIAssessmentSteps/GenerateStep';
import { ReviewStep } from './AIAssessmentSteps/ReviewStep';
import { Subject } from '@/types';

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'code';
type Difficulty = 'easy' | 'medium' | 'hard';
type Step = 'details' | 'generate' | 'review';

interface AIAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId?: string;
  onAssessmentCreated: (assessment: Assessment) => void;
  assessmentToEdit?: Assessment | null;
  inline?: boolean;
  forceExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onSwitchToManual?: () => void;
  showModeSwitch?: boolean;
}

export function AIAssessmentModal({ 
  isOpen, 
  onClose, 
  subjectId, 
  onAssessmentCreated: _onAssessmentCreated,
  assessmentToEdit,
  inline = false,
  forceExpanded,
  onExpandedChange,
  onSwitchToManual,
  showModeSwitch
}: AIAssessmentModalProps) {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('details');
  const [isExpanded, setIsExpanded] = useState(false);
  const [attributes, setAttributes] = useState<SubjectAttribute[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'Quiz' as AssessmentType,
    questionCount: 5,
    difficulty: 'medium' as Difficulty,
    questionTypes: ['multiple_choice', 'true_false'] as QuestionType[],
    selectedAttributes: [] as string[],
    maxScore: 100,
    weight: 100,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Step configuration
  const steps = [
    { key: 'details', title: 'Assessment Details', description: 'Configure your assessment parameters' },
    { key: 'generate', title: 'Generating Questions', description: 'AI is creating your questions' },
    { key: 'review', title: 'Review & Edit', description: 'Review and customize generated questions' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);
  const currentStepConfig = steps[currentStepIndex];
  const isVisible = inline || isOpen;
  const activeSubjectId = selectedSubject?.id || subjectId;

  // Initialize data on modal open
  useEffect(() => {
    if (isVisible) {
      fetchSubjects();
      if (assessmentToEdit) {
        initializeEditMode();
      }
    }
  }, [isVisible, assessmentToEdit]);

  useEffect(() => {
    if (typeof forceExpanded === 'boolean') {
      setIsExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  const fetchSubjects = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await axios.get('http://localhost:5000/api/subjects/teaching', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data && Array.isArray(response.data)) {
        const subjectsWithIds = response.data.map((subject: any) => ({
          ...subject,
          id: subject.id,
          code: subject.code || '',
          name: subject.name || 'Untitled Subject'
        }));

        setSubjects(subjectsWithIds);

        if (assessmentToEdit) {
          const currentSubject = subjectsWithIds.find((c: any) => c.id === subjectId);
          if (currentSubject) {
            setSelectedSubject(currentSubject);
            setStep('details');
          }
          return;
        }

        if (subjectId) {
          const currentSubject = subjectsWithIds.find((c: any) => c.id === subjectId);
          if (currentSubject) {
            setSelectedSubject(currentSubject);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load subjects');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeEditMode = () => {
    if (!assessmentToEdit) return;
    
    setFormData(prev => ({
      ...prev,
      name: assessmentToEdit.name,
      description: assessmentToEdit.description || '',
      type: assessmentToEdit.type,
      maxScore: assessmentToEdit.maxScore,
      weight: assessmentToEdit.weight,
      dueDate: new Date(assessmentToEdit.dueDate).toISOString().split('T')[0],
    }));
    
    if (typeof assessmentToEdit.questions === 'string') {
      try {
        const parsedQuestions = JSON.parse(assessmentToEdit.questions);
        setQuestions(parsedQuestions);
      } catch (e) {
        console.error('Failed to parse questions:', e);
      }
    } else if (Array.isArray(assessmentToEdit.questions)) {
      setQuestions(assessmentToEdit.questions);
    }
    
    if (assessmentToEdit.resource) {
      setResourceId(assessmentToEdit.resource);
    }
  };

  // Fetch subject attributes when subject is selected
  useEffect(() => {
    const fetchAttributes = async () => {
      if (!selectedSubject) return;
      
      try {
        setIsLoading(true);
        const data = await aiService.getSubjectAttributes(selectedSubject.id);
        setAttributes(data);
      } catch (error) {
        console.error('Error fetching attributes:', error);
        toast.error('Failed to load subject attributes');
      } finally {
        setIsLoading(false);
      }
    };

    if (isVisible && selectedSubject) {
      fetchAttributes();
    }
  }, [isVisible, selectedSubject]);

  const generateQuestions = async () => {
    if (!activeSubjectId) {
      toast.error('Please select a subject');
      return;
    }

    if (formData.selectedAttributes.length === 0) {
      toast.error('Please select at least one subject attribute');
      return;
    }

    try {
      setIsGenerating(true);
      setStep('generate');
      
      let docId = resourceId;
      if (uploadedFile && !resourceId) {
        docId = await uploadDocument();
      }

      const selectedAttributeObjects = attributes.filter(attr => 
        formData.selectedAttributes.includes(attr.id)
      );

      const generatedQuestions = await aiService.generateQuestions({
        subjectId: activeSubjectId,
        attributes: selectedAttributeObjects.map(attr => ({
          id: attr.id,
          name: attr.name,
          description: attr.description
        })),
        documentId: docId || undefined,
        questionCount: formData.questionCount,
        questionTypes: formData.questionTypes,
        difficulty: formData.difficulty,
        uploadedFiles: uploadedFile ? [uploadedFile] : [],
      });

      setQuestions(generatedQuestions);
      setStep('review');
      toast.success('Questions generated successfully');
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions. Please try again.');
      setStep('details');
    } finally {
      setIsGenerating(false);
    }
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!uploadedFile) return null;
    if (!activeSubjectId) {
      toast.error('Please select a subject');
      return null;
    }
    
    try {
      setIsLoading(true);
      const response = await aiService.uploadDocument(uploadedFile, activeSubjectId);
      setResourceId(response.id);
      toast.success('Document uploaded successfully');
      return response.id;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload document');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuestion = (updatedQuestion: Question) => {
    setQuestions(questions.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    ));
  };

  const regenerateQuestions = async (feedback: string) => {
    try {
      setIsGenerating(true);
      
      const attributeIds = formData.selectedAttributes.map((attr: string | { id: string }) => 
        typeof attr === 'string' ? attr : attr.id
      );
      
      const regeneratedQuestions = await aiService.regenerateQuestions({
        prompt: {
          subjectId: activeSubjectId || '',
          attributes: attributeIds,
          documentId: resourceId || undefined,
          questionCount: formData.questionCount,
          questionTypes: formData.questionTypes,
          difficulty: formData.difficulty,
        },
        feedback,
        questionsToKeep: questions,
      });

      setQuestions(regeneratedQuestions);
      toast.success('Questions regenerated with your feedback');
    } catch (error) {
      console.error('Error regenerating questions:', error);
      toast.error('Failed to regenerate questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAssessment = async () => {
    if (!selectedSubject?.id) {
      toast.error('No subject selected');
      return;
    }

    if (questions.length === 0) {
      toast.error('Please generate questions before saving');
      return;
    }

    try {
      setIsSubmitting(true);

      const questionText = questions.map((q, index) => {
        const number = index + 1;
        const options = q.options?.length
          ? q.options.map((opt, i) => `   ${String.fromCharCode(97 + i)}) ${typeof opt === 'string' ? opt : opt.text}`).join('\n')
          : '';

        const correctIndex = typeof q.correctAnswer === 'number'
          ? q.correctAnswer
          : parseInt(q.correctAnswer as string, 10);

        const correctLetter = !isNaN(correctIndex) && q.options?.length
          ? String.fromCharCode(97 + correctIndex)
          : 'N/A';

        return `${number}. ${q.text}\n${options}\n   Answer: ${correctLetter}\n   Explanation: ${q.explanation || 'N/A'}\n`;
      }).join('\n');

      const payload = {
        text: questionText.trim(),
        filename: formData.name?.replace(/\s+/g, '_').toLowerCase() || 'assessment_questions'
      };

      const pdfResponse = await fetch('http://127.0.0.1:8000/api/generate-pdf/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`PDF generation failed: ${errorText}`);
      }

      toast.success('Assessment created and PDF generated successfully!');
      resetForm();
      onClose();

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(`Failed to generate PDF: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'Quiz',
      questionCount: 5,
      difficulty: 'medium',
      questionTypes: ['multiple_choice'],
      selectedAttributes: [],
      maxScore: 100,
      weight: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setQuestions([]);
    setUploadedFile(null);
    setResourceId(null);
    setSelectedSubject(null);
    setStep('details');
  };

  const handleNext = () => {
    if (step === 'details') {
      generateQuestions();
    } else if (step === 'review') {
      saveAssessment();
    }
  };

  const handleBack = () => {
    if (step === 'review') {
      setStep('details');
    }
  };

  const isStepValid = () => {
    if (step === 'details') {
      return (
        selectedSubject !== null &&
        formData.name.trim() !== '' &&
        formData.selectedAttributes.length > 0
      );
    }
    
    return true;
  };

  const renderStepContent = () => {
    switch (step) {
      case 'details':
        return (
          <div className="space-y-6">
            <DetailsStep
              formData={formData}
              setFormData={setFormData}
              attributes={attributes}
              uploadedFile={uploadedFile}
              setUploadedFile={setUploadedFile}
              isLoading={isLoading}
              subjects={subjects}
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
            />
          </div>
        );
        
      case 'generate':
        return <GenerateStep formData={formData} attributes={attributes} uploadedFile={uploadedFile} />;
        
      case 'review':
        return (
          <ReviewStep
            questions={questions}
            onUpdateQuestion={handleUpdateQuestion}
            onRegenerate={regenerateQuestions}
            isGenerating={isGenerating}
          />
        );
        
      default:
        return null;
    }
  };

  const shouldScrollContent = inline || isExpanded;

  const content = (
    <div className="flex flex-col h-full min-h-0 max-h-full">
      <div className="bg-white border-b border-gray-200 p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {inline && showModeSwitch && onSwitchToManual && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Mode</span>
                <span className="text-xs font-medium text-gray-700">AI-Assisted</span>
                <button
                  className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  type="button"
                  onClick={onSwitchToManual}
                >
                  Switch to Manual
                </button>
              </div>
            )}
            {inline && (
              <button
                onClick={() => setIsExpanded((prev) => {
                  const next = !prev;
                  onExpandedChange?.(next);
                  return next;
                })}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                disabled={isGenerating || isSubmitting}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-5 h-5 text-gray-500" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-gray-500" />
                )}
              </button>
            )}
            {!inline && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                disabled={isGenerating || isSubmitting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">{currentStepConfig.title}</h3>
            <span className="text-sm text-gray-500">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((stepConfig, index) => (
              <React.Fragment key={stepConfig.key}>
                <div className={`flex items-center gap-2 ${
                  index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < currentStepIndex 
                      ? 'bg-blue-600 text-white' 
                      : index === currentStepIndex 
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {index < currentStepIndex ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{stepConfig.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className={shouldScrollContent ? 'flex-1 min-h-0 overflow-y-auto p-6' : 'p-6'}>
        {renderStepContent()}
      </div>

      {step !== 'generate' && (
        <div className="bg-gray-50 border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step !== 'details' && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isGenerating || isSubmitting}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {step === 'review' && questions.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>{questions.length} questions ready</span>
                </div>
              )}
              
              <Button
                onClick={handleNext}
                disabled={!isStepValid() || isGenerating || isSubmitting}
                className="flex items-center gap-2 min-w-[140px] bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : step === 'review' ? (
                  <>
                    <Download className="w-4 h-4" />
                    Generate PDF
                  </>
                ) : step === 'details' ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Questions
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (inline) {
    if (isExpanded) {
      return (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" />
          <div className="fixed top-4 left-4 right-4 bottom-6 z-50 bg-white rounded-lg shadow-2xl overflow-hidden max-w-3xl w-[90vw] mx-auto flex flex-col min-h-0">
            {content}
          </div>
        </>
      );
    }
    return <div className="bg-white rounded-lg shadow h-full max-h-full flex flex-col overflow-hidden min-h-0">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
}
