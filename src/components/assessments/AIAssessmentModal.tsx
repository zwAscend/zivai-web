import React, { useState, useEffect, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  BookOpen, 
  FileText, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  Download
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import AuthContext from '@/context/AuthContext';
import { Question, Assessment, SubjectAttribute, AssessmentType, User } from '@/types';
import { aiService } from '@/services/aiService';
import { DetailsStep } from './AIAssessmentSteps/DetailsStep';
import { GenerateStep } from './AIAssessmentSteps/GenerateStep';
import { ReviewStep } from './AIAssessmentSteps/ReviewStep';
import { Subject } from '@/types';

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'code';
type Difficulty = 'easy' | 'medium' | 'hard';
type Step = 'subject-selection' | 'details' | 'generate' | 'review';

interface AIAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  onAssessmentCreated: (assessment: Assessment) => void;
  assessmentToEdit?: Assessment | null;
}

export function AIAssessmentModal({ 
  isOpen, 
  onClose, 
  subjectId, 
  onAssessmentCreated,
  assessmentToEdit 
}: AIAssessmentModalProps) {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('subject-selection');
  const [attributes, setAttributes] = useState<SubjectAttribute[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.user;

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
    { key: 'subject-selection', title: 'Select Subject', description: 'Choose the subject for your assessment' },
    { key: 'details', title: 'Assessment Details', description: 'Configure your assessment parameters' },
    { key: 'generate', title: 'Generating Questions', description: 'AI is creating your questions' },
    { key: 'review', title: 'Review & Edit', description: 'Review and customize generated questions' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);
  const currentStepConfig = steps[currentStepIndex];

  // Initialize data on modal open
  useEffect(() => {
    if (isOpen) {
      fetchSubjects();
      if (assessmentToEdit) {
        initializeEditMode();
      }
    }
  }, [isOpen, assessmentToEdit]);

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
          _id: subject.id || subject._id,
          code: subject.code || '',
          name: subject.name || 'Untitled Subject'
        }));

        setSubjects(subjectsWithIds);
        
        if (assessmentToEdit) {
          const currentSubject = subjectsWithIds.find((c: any) => c._id === subjectId);
          if (currentSubject) {
            setSelectedSubject(currentSubject);
            setStep('details');
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
        const data = await aiService.getSubjectAttributes(selectedSubject._id);
        setAttributes(data);
      } catch (error) {
        console.error('Error fetching attributes:', error);
        toast.error('Failed to load subject attributes');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && selectedSubject) {
      fetchAttributes();
    }
  }, [isOpen, selectedSubject]);

  const generateQuestions = async () => {
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
        formData.selectedAttributes.includes(attr._id)
      );

      const generatedQuestions = await aiService.generateQuestions({
        subjectId,
        attributes: selectedAttributeObjects.map(attr => ({
          _id: attr._id,
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
    
    try {
      setIsLoading(true);
      const response = await aiService.uploadDocument(uploadedFile, subjectId);
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
      q._id === updatedQuestion._id ? updatedQuestion : q
    ));
  };

  const regenerateQuestions = async (feedback: string) => {
    try {
      setIsGenerating(true);
      
      const attributeIds = formData.selectedAttributes.map((attr: string | { _id: string }) => 
        typeof attr === 'string' ? attr : attr._id
      );
      
      const regeneratedQuestions = await aiService.regenerateQuestions({
        prompt: {
          subjectId,
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
    if (!selectedSubject?._id) {
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
    setStep('subject-selection');
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
    } else if (step === 'details') {
      setStep('subject-selection');
    }
  };

  const isStepValid = () => {
    if (step === 'subject-selection') {
      return selectedSubject !== null;
    }
    
    if (step === 'details') {
      return (
        formData.name.trim() !== '' &&
        formData.selectedAttributes.length > 0
      );
    }
    
    return true;
  };

  const renderStepContent = () => {
    switch (step) {
      case 'subject-selection':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Subject</h3>
              <p className="text-gray-600">Choose the subject you want to create an assessment for</p>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="grid gap-3 max-h-80 overflow-y-auto">
                {subjects.map((subject) => (
                  <button
                    key={subject._id}
                    onClick={() => {
                      setSelectedSubject(subject);
                      setStep('details');
                    }}
                    className={`p-4 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                      selectedSubject?._id === subject._id 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{subject.code}</h4>
                        <p className="text-sm text-gray-600 mt-1">{subject.name}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
                
                {subjects.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p>No subjects available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
        
      case 'details':
        return (
          <div className="space-y-6">
            {selectedSubject && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">{selectedSubject.name}</h3>
                    <p className="text-sm text-blue-700">{selectedSubject.code}</p>
                  </div>
                </div>
              </div>
            )}
            
            <DetailsStep
              formData={formData}
              setFormData={setFormData}
              attributes={attributes}
              uploadedFile={uploadedFile}
              setUploadedFile={setUploadedFile}
              isLoading={isLoading}
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden">
        {/* Header with Progress */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {assessmentToEdit ? 'Edit Assessment' : 'Create AI Assessment'}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              disabled={isGenerating || isSubmitting}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Step Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{currentStepConfig.title}</h3>
              <span className="text-sm text-gray-500">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
            <p className="text-gray-600">{currentStepConfig.description}</p>
            
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        {step !== 'generate' && (
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step !== 'subject-selection' && (
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
                  onClick={step === 'subject-selection' ? () => setStep('details') : handleNext}
                  disabled={!isStepValid() || isGenerating || isSubmitting}
                  className="flex items-center gap-2 min-w-[140px]"
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
      </DialogContent>
    </Dialog>
  );
}