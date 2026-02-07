import React, { useMemo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AIAssessmentModal } from '../components/assessments/AIAssessmentModal';
import Sidebar from '../components/resources/Sidebar';
import { API_URL, fetchData } from '../services/http';
import { authService } from '../services/authService';
import { subjectService } from '../services/subjectService';
import { schoolService, SchoolItem } from '../services/schoolService';
import { Subject } from '../types';

type ManualMode = 'upload' | 'build';
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
}

const CreateAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [manualMode, setManualMode] = useState<ManualMode>('upload');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
  const [manualQuestions, setManualQuestions] = useState<ManualQuestion[]>([]);
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

  const handleManualSubmit = async () => {
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

    const currentUser = authService.getCurrentUser();
    if (!currentUser?.id) {
      toast.error('You need to be logged in to create an assessment.');
      return;
    }

    try {
      setIsSubmitting(true);
      let resourceId: string | null = null;

      if (manualMode === 'upload') {
        if (!assessmentFile) {
          toast.error('Please upload an assessment file.');
          setIsSubmitting(false);
          return;
        }

        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', assessmentFile);
        if (manualForm.subjectId) {
          formData.append('subjectId', manualForm.subjectId);
        }

        const response = await fetch(`${API_URL}/resources/upload`, {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Failed to upload assessment file.' }));
          throw new Error(error.message || 'Failed to upload assessment file.');
        }

        const uploadData = await response.json();
        resourceId = uploadData?.resource?.id || null;
        if (!resourceId) {
          throw new Error('Upload succeeded but no resource was returned.');
        }
      }

      if (manualMode === 'build') {
        if (manualQuestions.length === 0) {
          toast.error('Please add at least one question.');
          setIsSubmitting(false);
          return;
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
        aiEnhanced: false,
        resourceId,
        status: manualForm.status,
        createdBy: currentUser.id,
        lastModifiedBy: currentUser.id,
        questions: manualMode === 'build'
          ? manualQuestions.map((question, index) => ({
              stem: question.stem,
              questionTypeCode: question.questionTypeCode,
              maxMark: question.maxMark,
              difficulty: question.difficulty,
              rubricJson: {
                options: question.options,
                correctAnswer: question.correctAnswer,
                markingGuide: question.markingGuide,
              },
              sequenceIndex: index + 1,
              points: question.maxMark,
            }))
          : [],
      };

      await fetchData('/assessments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Assessment created successfully');
      navigate('/assessments');
    } catch (error: any) {
      console.error('Failed to create assessment:', error);
      toast.error(error?.message || 'Failed to create assessment');
    } finally {
      setIsSubmitting(false);
    }
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
    setManualQuestions((prev) => prev.filter((question) => question.id !== id));
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar
        mode="assessments"
        onCreateAssessment={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onViewAssessments={() => navigate('/assessments')}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="create-assessment"
        recentUploads={[]}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Create Assessment</h1>
              <p className="text-sm text-gray-500">Choose how you want to build the assessment.</p>
            </div>
            <button
              onClick={() => navigate('/assessments')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Assessments
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCreationMode('ai')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  creationMode === 'ai' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                AI-Assisted
              </button>
              <button
                onClick={() => setCreationMode('manual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  creationMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Manual
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Select AI-assisted to generate questions automatically, or manual to craft the assessment yourself.
            </p>
          </div>

          {creationMode === 'ai' ? (
            <AIAssessmentModal
              inline
              isOpen
              onClose={() => navigate('/assessments')}
              subjectId={subjectId}
              onAssessmentCreated={() => {}}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setManualMode('upload')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    manualMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Upload Document
                </button>
                <button
                  onClick={() => setManualMode('build')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    manualMode === 'build' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Build Questions
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">School</label>
                  <select
                    value={manualForm.schoolId}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, schoolId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  >
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Subject</label>
                  <select
                    value={manualForm.subjectId}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  >
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Assessment Name</label>
                  <input
                    value={manualForm.name}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    placeholder="Enter assessment name"
                  />
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
                    <option value="assignment">Homework (Assignment)</option>
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
                  placeholder="Add a brief description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Max Score</label>
                  <input
                    type="number"
                    min="1"
                    value={manualForm.maxScore}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, maxScore: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Weight %</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForm.weightPct}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, weightPct: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Time Limit (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForm.timeLimitMin}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, timeLimitMin: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Attempts Allowed</label>
                  <input
                    type="number"
                    min="1"
                    value={manualForm.attemptsAllowed}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, attemptsAllowed: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {manualMode === 'upload' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <label className="text-xs text-gray-500">Upload assessment file (PDF, DOCX, image)</label>
                  <input
                    type="file"
                    onChange={(e) => setAssessmentFile(e.target.files?.[0] || null)}
                    className="mt-2 block w-full text-sm text-gray-600"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  <p className="text-[11px] text-gray-500 mt-2">We will attach the uploaded file to this assessment for marking and review.</p>
                </div>
              )}

              {manualMode === 'build' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">Questions</h3>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add question
                    </button>
                  </div>

                  {manualQuestions.length === 0 ? (
                    <div className="border border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-500">
                      No questions yet. Add at least one question to proceed.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {manualQuestions.map((question, index) => (
                        <div key={question.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Question {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeQuestion(question.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Question text</label>
                            <textarea
                              value={question.stem}
                              onChange={(e) => updateQuestion(question.id, { stem: e.target.value })}
                              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[80px]"
                              placeholder="Enter the question prompt"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs text-gray-500">Type</label>
                              <select
                                value={question.questionTypeCode}
                                onChange={(e) => {
                                  const nextType = e.target.value as ManualQuestionType;
                                  if (nextType === 'true_false') {
                                    updateQuestion(question.id, {
                                      questionTypeCode: nextType,
                                      options: ['True', 'False'],
                                      correctAnswer: question.correctAnswer === 'True' || question.correctAnswer === 'False'
                                        ? question.correctAnswer
                                        : '',
                                    });
                                    return;
                                  }
                                  if (nextType === 'mcq') {
                                    updateQuestion(question.id, {
                                      questionTypeCode: nextType,
                                      options: question.options.length > 0 ? question.options : [''],
                                      correctAnswer: question.correctAnswer || '',
                                    });
                                    return;
                                  }
                                  updateQuestion(question.id, {
                                    questionTypeCode: nextType,
                                    options: [],
                                    correctAnswer: '',
                                  });
                                }}
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                              >
                                <option value="mcq">Multiple choice</option>
                                <option value="true_false">True/False</option>
                                <option value="short_answer">Short answer</option>
                                <option value="essay">Essay</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Max mark</label>
                              <input
                                type="number"
                                min="1"
                                value={question.maxMark}
                                onChange={(e) => updateQuestion(question.id, { maxMark: Number(e.target.value) })}
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Difficulty</label>
                              <select
                                value={question.difficulty}
                                onChange={(e) => updateQuestion(question.id, { difficulty: Number(e.target.value) })}
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                              >
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
                                  <button
                                    type="button"
                                    onClick={() => addOption(question.id)}
                                    className="text-xs text-blue-600 hover:text-blue-700"
                                  >
                                    + Add option
                                  </button>
                                )}
                              </div>
                              {question.questionTypeCode === 'true_false' ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {['True', 'False'].map((option) => (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => updateQuestion(question.id, { options: ['True', 'False'], correctAnswer: option })}
                                      className={`px-3 py-2 rounded-md text-sm border ${
                                        question.correctAnswer === option
                                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                                          : 'border-gray-200 text-gray-600'
                                      }`}
                                    >
                                      {option}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {question.options.map((option, optionIndex) => (
                                    <div key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                      <input
                                        value={option}
                                        onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder={`Option ${optionIndex + 1}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateQuestion(question.id, { correctAnswer: option })}
                                        className={`text-xs px-2 py-1 rounded-md border ${
                                          question.correctAnswer === option
                                            ? 'border-blue-500 text-blue-700 bg-blue-50'
                                            : 'border-gray-200 text-gray-500'
                                        }`}
                                      >
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
                            <textarea
                              value={question.markingGuide}
                              onChange={(e) => updateQuestion(question.id, { markingGuide: e.target.value })}
                              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[70px]"
                              placeholder="Provide marking guidance for this question"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <select
                    value={manualForm.status}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Visibility</label>
                  <select
                    value={manualForm.visibility}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, visibility: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/assessments')}
                  className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating...' : 'Create Assessment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CreateAssessmentPage;
