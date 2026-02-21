import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Question, QuestionOption } from '@/types';
import { 
  RefreshCw, 
  Trash2, 
  Plus, 
  Loader2, 
  Edit3, 
  Save, 
  CheckCircle,
  Eye,
  MessageSquare
} from 'lucide-react';

interface ReviewStepProps {
  questions: Question[];
  onUpdateQuestion: (question: Question) => void;
  onRegenerate: (feedback: string) => Promise<void>;
  isGenerating: boolean;
}

export function ReviewStep({ questions, onUpdateQuestion, onRegenerate, isGenerating }: ReviewStepProps) {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const handleEditClick = (question: Question) => {
    setEditingQuestion({ ...question });
    setEditingQuestionId(question.id || null);
  };

  const handleSaveEdit = () => {
    if (!editingQuestion) return;
    
    const updatedQuestion: Question = {
      ...editingQuestion,
      options: editingQuestion.options?.map((opt, idx) => ({
        id: opt.id || `opt-${idx}`,
        text: opt.text,
        isCorrect: opt.isCorrect || false,
        explanation: opt.explanation || ''
      })) || []
    };
    
    onUpdateQuestion(updatedQuestion);
    setEditingQuestion(null);
    setEditingQuestionId(null);
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
    setEditingQuestionId(null);
  };

  const handleChange = (field: keyof Question, value: any) => {
    if (!editingQuestion) return;
    setEditingQuestion({ ...editingQuestion, [field]: value });
  };

  const handleOptionChange = (index: number, field: keyof QuestionOption, value: any) => {
    if (!editingQuestion) return;
    const newOptions = [...(editingQuestion.options || [])];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setEditingQuestion({ ...editingQuestion, options: newOptions });
  };

  const handleAddOption = () => {
    if (!editingQuestion) return;
    const newOption: QuestionOption = {
      id: `opt-${Date.now()}`,
      text: '',
      isCorrect: false,
      explanation: ''
    };
    const newOptions = [...(editingQuestion.options || []), newOption];
    setEditingQuestion({ ...editingQuestion, options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    if (!editingQuestion?.options) return;
    const newOptions = [...editingQuestion.options];
    newOptions.splice(index, 1);
    handleChange('options', newOptions);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    
    setIsSubmittingFeedback(true);
    try {
      await onRegenerate(feedback);
      setFeedback('');
      setShowFeedbackForm(false);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'bg-blue-100 text-blue-800';
      case 'true_false': return 'bg-green-100 text-green-800';
      case 'short_answer': return 'bg-purple-100 text-purple-800';
      case 'essay': return 'bg-orange-100 text-orange-800';
      case 'code': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderQuestionContent = (question: Question) => {
    const isEditing = editingQuestionId === question.id && editingQuestion;
    const isExpanded = expandedQuestionId === question.id;

    if (isEditing) {
      return (
        <div className="space-y-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Question Text</Label>
            <Textarea
              value={editingQuestion.text}
              onChange={(e) => handleChange('text', e.target.value)}
              placeholder="Enter question text"
              rows={3}
              className="resize-none"
            />
          </div>

          {editingQuestion.options && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-gray-700">Answer Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  disabled={(editingQuestion.options?.length ?? 0) >= 5}
                  className="h-8"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Option
                </Button>
              </div>
              
              <div className="space-y-2">
                {editingQuestion.options?.map((option, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={option.text}
                        onChange={(e) => handleOptionChange(idx, 'text', e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleOptionChange(idx, 'isCorrect', !option.isCorrect)}
                        className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                          option.isCorrect 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}
                      >
                        {option.isCorrect ? 'Correct' : 'Incorrect'}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      disabled={!editingQuestion.options || editingQuestion.options.length <= 2}
                    >
                      <Trash2 className="h-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-blue-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-medium text-gray-900 leading-relaxed">{question.text}</p>
          </div>
          <button
            onClick={() => setExpandedQuestionId(isExpanded ? null : question.id || null)}
            className="ml-4 p-1 text-gray-400 hover:text-gray-600"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
        
        {question.options && (
          <div className="space-y-2">
            {question.options.slice(0, isExpanded ? undefined : 2).map((option, idx) => {
              const optionText = typeof option === 'string' ? option : option.text;
              const isCorrect = Array.isArray(question.correctAnswer) 
                ? question.correctAnswer.includes(idx.toString()) 
                : question.correctAnswer === idx.toString();
              
              return (
                <div key={idx} className={`p-3 rounded-lg border ${
                  isCorrect 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <span className={isCorrect ? 'font-semibold text-green-800' : 'text-gray-700'}>
                      {optionText}
                    </span>
                    {isCorrect && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Correct
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            
            {!isExpanded && question.options.length > 2 && (
              <button
                onClick={() => setExpandedQuestionId(question.id || null)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Show {question.options.length - 2} more options...
              </button>
            )}
          </div>
        )}
        
        {question.explanation && isExpanded && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-1">Explanation:</p>
            <p className="text-sm text-blue-800">{question.explanation}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-gray-900">Review Generated Questions</h3>
        <p className="text-gray-600">
          Review and customize the AI-generated questions. You can edit individual questions or regenerate them with feedback.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-gray-600">{questions.length} questions generated</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600">Ready for review</span>
          </div>
        </div>
      </div>

      {/* Global Regenerate */}
      {!showFeedbackForm && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Want to regenerate all questions?</span>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFeedbackForm(true)}
              disabled={isGenerating}
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
            >
              Provide Feedback
            </Button>
          </div>
        </div>
      )}

      {/* Global Feedback Form */}
      {showFeedbackForm && (
        <form onSubmit={handleSubmitFeedback} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Regenerate All Questions</h4>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="global-feedback" className="text-sm font-medium text-blue-800">
              What would you like to change about these questions?
            </Label>
            <Textarea
              id="global-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="E.g., Make questions more challenging, focus on practical applications, include more code examples..."
              rows={3}
              className="resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowFeedbackForm(false);
                setFeedback('');
              }}
              disabled={isSubmittingFeedback}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!feedback.trim() || isSubmittingFeedback}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate All
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Question Header */}
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getQuestionTypeColor(question.type)}`}>
                      {question.type === 'multiple_choice' ? 'Multiple Choice' : 
                       question.type === 'true_false' ? 'True/False' : 
                       question.type === 'short_answer' ? 'Short Answer' : 
                       question.type === 'essay' ? 'Essay' : 
                       question.type === 'code' ? 'Coding' : question.type}
                    </Badge>
                    <Badge className={`text-xs ${getDifficultyColor(question.difficulty || 'medium')}`}>
                      {question.difficulty || 'Medium'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {question.points || 1} {(question.points || 1) === 1 ? 'point' : 'points'}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditClick(question)}
                    disabled={isGenerating || editingQuestionId === question.id}
                    className="h-8"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Individual question regeneration could be implemented here
                      setShowFeedbackForm(true);
                    }}
                    disabled={isGenerating}
                    className="h-8"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Question Content */}
            <div className="p-4">
              {renderQuestionContent(question)}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">
              {questions.length} question{questions.length !== 1 ? 's' : ''} ready for assessment
            </span>
          </div>
          <div className="text-sm text-green-700">
            Total Points: {questions.reduce((sum, q) => sum + (q.points || 1), 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
