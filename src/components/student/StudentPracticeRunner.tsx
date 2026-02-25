import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, CircleDot, XCircle } from 'lucide-react';

export type PracticeQuestionType = 'input' | 'single' | 'multiple';

type QuestionResult = 'correct' | 'incorrect' | 'skipped';

interface BasePracticeQuestion {
  id: string;
  prompt: string;
  helpText?: string;
}

interface InputPracticeQuestion extends BasePracticeQuestion {
  type: 'input';
  placeholder?: string;
  acceptedAnswers: string[];
}

interface SinglePracticeQuestion extends BasePracticeQuestion {
  type: 'single';
  options: string[];
  correctOptionIndexes: number[];
}

interface MultiplePracticeQuestion extends BasePracticeQuestion {
  type: 'multiple';
  options: string[];
  correctOptionIndexes: number[];
}

export type PracticeQuestion = InputPracticeQuestion | SinglePracticeQuestion | MultiplePracticeQuestion;

export interface PracticeRunSummary {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
}

interface StudentPracticeRunnerProps {
  title: string;
  subtitle?: string;
  questions: PracticeQuestion[];
  onComplete?: (summary: PracticeRunSummary) => void;
  fixedFooterStyle?: React.CSSProperties;
  contentWrapperClassName?: string;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const buildSummary = (results: Record<string, QuestionResult>, total: number): PracticeRunSummary => {
  const values = Object.values(results);
  const correct = values.filter((result) => result === 'correct').length;
  const incorrect = values.filter((result) => result === 'incorrect').length;
  const skipped = values.filter((result) => result === 'skipped').length + Math.max(0, total - values.length);

  return { total, correct, incorrect, skipped };
};

export const buildMockPracticeQuestions = (seedText: string, mode: 'assignment' | 'quiz' | 'mixed' = 'mixed'): PracticeQuestion[] => {
  const seed = seedText.toLowerCase();

  if (seed.includes('polynomial') || seed.includes('algebra') || seed.includes('equation') || seed.includes('quiz')) {
    return [
      {
        id: 'q1',
        type: 'input',
        prompt: 'What is the degree of 5x^3 - 2x^4 - 9x^2 + z?',
        placeholder: 'Type your answer',
        acceptedAnswers: ['4', 'degree 4'],
      },
      {
        id: 'q2',
        type: 'multiple',
        prompt: 'Which expressions are in standard form? Choose all that apply.',
        options: ['10 - n', '5n + 3n^3 - 1', 'n + 4n^2 - 7n^3', 'None of the above'],
        correctOptionIndexes: [0],
      },
      {
        id: 'q3',
        type: 'single',
        prompt: 'Which option is a polynomial?',
        options: ['3/x + 2', 'x^2 + 4x - 7', 'sqrt(x) + 1', '1/(x-1)'],
        correctOptionIndexes: [1],
      },
      {
        id: 'q4',
        type: 'input',
        prompt: 'In one short phrase, what should you do before submitting your final answer?',
        placeholder: 'e.g. verify working',
        acceptedAnswers: ['check your work', 'verify working', 'review your answer', 'verify final result'],
      },
    ];
  }

  if (seed.includes('english') || seed.includes('writing') || seed.includes('vocabulary') || seed.includes('context')) {
    return [
      {
        id: 'q1',
        type: 'single',
        prompt: 'Choose the word that best fits: "The evidence was ____ and supported the claim clearly."',
        options: ['vague', 'arbitrary', 'convincing', 'unrelated'],
        correctOptionIndexes: [2],
      },
      {
        id: 'q2',
        type: 'multiple',
        prompt: 'Which actions improve a paragraph response? Choose all that apply.',
        options: [
          'Use one clear main idea per paragraph',
          'Skip evidence to save time',
          'Link evidence back to your claim',
          'Revise for clarity and grammar',
        ],
        correctOptionIndexes: [0, 2, 3],
      },
      {
        id: 'q3',
        type: 'input',
        prompt: 'Write one sentence starter you can use to explain evidence.',
        placeholder: 'Type a sentence starter',
        acceptedAnswers: ['this shows that', 'this suggests that', 'this evidence shows', 'this indicates that'],
      },
      {
        id: 'q4',
        type: 'single',
        prompt: 'What is the best final step before submission?',
        options: ['Add new ideas', 'Check for coherence and accuracy', 'Delete topic sentence', 'Ignore feedback'],
        correctOptionIndexes: [1],
      },
    ];
  }

  if (mode === 'assignment') {
    return [
      {
        id: 'q1',
        type: 'input',
        prompt: `What is the first thing you should do in "${seedText}"?`,
        placeholder: 'Short response',
        acceptedAnswers: ['break it down', 'plan steps', 'identify requirements', 'understand the task'],
      },
      {
        id: 'q2',
        type: 'single',
        prompt: 'Which approach best shows strong reasoning?',
        options: ['Guess and move on', 'Write only final answer', 'Show method and checks', 'Copy a classmate'],
        correctOptionIndexes: [2],
      },
      {
        id: 'q3',
        type: 'multiple',
        prompt: 'Select all habits that improve accuracy.',
        options: ['Check assumptions', 'Skip units', 'Review calculations', 'Explain each step'],
        correctOptionIndexes: [0, 2, 3],
      },
      {
        id: 'q4',
        type: 'input',
        prompt: 'Type one reflection question you should ask yourself after solving.',
        placeholder: 'Reflection question',
        acceptedAnswers: ['does this make sense', 'can i justify this', 'what did i learn', 'is my method valid'],
      },
    ];
  }

  return [
    {
      id: 'q1',
      type: 'single',
      prompt: `Quick check: what is the main goal of "${seedText}"?`,
      options: ['Memorize answers', 'Develop understanding and reasoning', 'Skip hard parts', 'Only finish quickly'],
      correctOptionIndexes: [1],
    },
    {
      id: 'q2',
      type: 'input',
      prompt: 'Write one phrase that describes a good problem-solving process.',
      placeholder: 'Type a phrase',
      acceptedAnswers: ['explain reasoning', 'show working', 'check method', 'verify answer'],
    },
    {
      id: 'q3',
      type: 'multiple',
      prompt: 'Which behaviors show productive learning? Choose all that apply.',
      options: ['Ask clarifying questions', 'Reflect after attempts', 'Avoid feedback', 'Retry with improvements'],
      correctOptionIndexes: [0, 1, 3],
    },
    {
      id: 'q4',
      type: 'single',
      prompt: 'What should you do when your first answer is wrong?',
      options: ['Stop immediately', 'Try the same step without changes', 'Review mistakes and retry', 'Skip everything'],
      correctOptionIndexes: [2],
    },
  ];
};

const StudentPracticeRunner: React.FC<StudentPracticeRunnerProps> = ({
  questions,
  onComplete,
  fixedFooterStyle,
  contentWrapperClassName,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [selectedOptionIndexes, setSelectedOptionIndexes] = useState<Record<string, number[]>>({});
  const [results, setResults] = useState<Record<string, QuestionResult>>({});
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'missing' | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [hasSubmittedSummary, setHasSubmittedSummary] = useState(false);

  const currentQuestion = questions[currentIndex];

  const progressSummary = useMemo(() => buildSummary(results, questions.length), [results, questions.length]);

  const currentTextAnswer = currentQuestion?.type === 'input' ? textAnswers[currentQuestion.id] || '' : '';
  const currentSelectedIndexes = currentQuestion?.type !== 'input' ? selectedOptionIndexes[currentQuestion.id] || [] : [];

  const canCheck = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'input') {
      return currentTextAnswer.trim().length > 0;
    }
    return currentSelectedIndexes.length > 0;
  }, [currentQuestion, currentSelectedIndexes.length, currentTextAnswer]);

  const markComplete = () => {
    if (!sessionCompleted) {
      setSessionCompleted(true);
    }

    if (!hasSubmittedSummary) {
      onComplete?.(buildSummary(results, questions.length));
      setHasSubmittedSummary(true);
    }
  };

  const goToNextQuestion = () => {
    setFeedback(null);

    if (currentIndex >= questions.length - 1) {
      markComplete();
      return;
    }

    setCurrentIndex((previous) => Math.min(previous + 1, questions.length - 1));
  };

  const isCurrentAnswerCorrect = () => {
    if (!currentQuestion) return false;

    if (currentQuestion.type === 'input') {
      const answer = normalize(currentTextAnswer);
      return currentQuestion.acceptedAnswers.some((accepted) => normalize(accepted) === answer);
    }

    const submitted = [...currentSelectedIndexes].sort((a, b) => a - b);
    const expected = [...currentQuestion.correctOptionIndexes].sort((a, b) => a - b);
    return submitted.length === expected.length && submitted.every((value, index) => value === expected[index]);
  };

  const handleCheck = () => {
    if (!currentQuestion) return;
    if (!canCheck) {
      setFeedback('missing');
      return;
    }

    const correct = isCurrentAnswerCorrect();
    setResults((previous) => ({ ...previous, [currentQuestion.id]: correct ? 'correct' : 'incorrect' }));
    setFeedback(correct ? 'correct' : 'incorrect');
  };

  const handlePrimaryAction = () => {
    if (sessionCompleted) return;

    if (feedback === 'correct') {
      goToNextQuestion();
      return;
    }

    if (feedback === 'incorrect' || feedback === 'missing') {
      setFeedback(null);
      return;
    }

    handleCheck();
  };

  const handleSkip = () => {
    if (!currentQuestion || sessionCompleted) return;

    setResults((previous) => ({ ...previous, [currentQuestion.id]: previous[currentQuestion.id] || 'skipped' }));
    goToNextQuestion();
  };

  const toggleOption = (optionIndex: number) => {
    if (!currentQuestion || currentQuestion.type === 'input' || sessionCompleted) return;

    setSelectedOptionIndexes((previous) => {
      const current = previous[currentQuestion.id] || [];

      if (currentQuestion.type === 'single') {
        return { ...previous, [currentQuestion.id]: [optionIndex] };
      }

      const exists = current.includes(optionIndex);
      const updated = exists ? current.filter((item) => item !== optionIndex) : [...current, optionIndex];
      return { ...previous, [currentQuestion.id]: updated };
    });
  };

  const footerPrimaryLabel = sessionCompleted
    ? 'Practice complete'
    : feedback === 'correct'
      ? currentIndex >= questions.length - 1
        ? 'Finish practice'
        : 'Next question'
      : feedback === 'incorrect'
        ? 'Try again'
        : feedback === 'missing'
          ? 'Check'
        : 'Check';

  const showFeedbackToast = feedback !== null;
  const desktopFeedbackStyle: React.CSSProperties = {
    bottom: '5.5rem',
    right: fixedFooterStyle?.right ? `calc(${String(fixedFooterStyle.right)} + 1.5rem)` : '1.5rem',
  };
  const contentWrapperClasses = contentWrapperClassName || 'px-6 py-6 pb-24 space-y-6';

  return (
    <div className="relative bg-white overflow-hidden">
      <div className={contentWrapperClasses}>
        {sessionCompleted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-lg font-semibold text-emerald-800">Practice complete</p>
            <p className="text-sm text-emerald-700 mt-1">
              You got {progressSummary.correct} out of {progressSummary.total} correct.
            </p>
          </div>
        ) : currentQuestion ? (
          <>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">Question {currentIndex + 1}</p>
              <p className="text-lg text-slate-800">{currentQuestion.prompt}</p>
            </div>

            {currentQuestion.type === 'input' && (
              <input
                value={currentTextAnswer}
                onChange={(event) => setTextAnswers((previous) => ({ ...previous, [currentQuestion.id]: event.target.value }))}
                placeholder={currentQuestion.placeholder || 'Type your answer'}
                className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {(currentQuestion.type === 'single' || currentQuestion.type === 'multiple') && (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-200">
                {currentQuestion.options.map((option, optionIndex) => {
                  const selected = currentSelectedIndexes.includes(optionIndex);
                  const optionPrefix = String.fromCharCode(65 + optionIndex);
                  const isMultipleChoice = currentQuestion.type === 'multiple';

                  return (
                    <button
                      key={`${currentQuestion.id}-${option}`}
                      type="button"
                      onClick={() => toggleOption(optionIndex)}
                      className={`w-full text-left px-4 py-4 flex items-center gap-3 transition ${
                        selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center h-8 w-8 border text-sm font-semibold ${
                        isMultipleChoice ? 'rounded-md' : 'rounded-full'
                      } ${
                        selected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'
                      }`}>
                        {optionPrefix}
                      </span>
                      <span className="text-lg">{option}</span>
                    </button>
                  );
                })}
              </div>
            )}

          </>
        ) : null}
      </div>

      {showFeedbackToast && !sessionCompleted && (
        <>
          <div
            className={`md:hidden absolute right-4 bottom-24 z-20 w-[260px] rounded-lg border p-3 shadow-sm bg-white ${
              feedback === 'correct' ? 'border-emerald-200' : feedback === 'missing' ? 'border-amber-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback === 'correct' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
              ) : feedback === 'missing' ? (
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-slate-500 mt-0.5" />
              )}
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {feedback === 'correct' ? 'Great work!' : feedback === 'missing' ? 'Select an answer first' : 'Not quite yet...'}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {feedback === 'correct'
                    ? 'You got it. Onward!'
                    : feedback === 'missing'
                      ? 'Choose an option or type your answer, then check again.'
                      : 'Give it another try.'}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`hidden md:block fixed z-40 w-[260px] rounded-lg border p-3 shadow-sm bg-white ${
              feedback === 'correct' ? 'border-emerald-200' : feedback === 'missing' ? 'border-amber-200' : 'border-slate-200'
            }`}
            style={desktopFeedbackStyle}
          >
            <div className="flex items-start gap-3">
              {feedback === 'correct' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
              ) : feedback === 'missing' ? (
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-slate-500 mt-0.5" />
              )}
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {feedback === 'correct' ? 'Great work!' : feedback === 'missing' ? 'Select an answer first' : 'Not quite yet...'}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {feedback === 'correct'
                    ? 'You got it. Onward!'
                    : feedback === 'missing'
                      ? 'Choose an option or type your answer, then check again.'
                      : 'Give it another try.'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div
        className="hidden md:block fixed bottom-0 z-30"
        style={fixedFooterStyle}
      >
        <footer className="border-t border-l border-r border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <span className="font-semibold">
                {sessionCompleted ? `${progressSummary.total} of ${progressSummary.total}` : `${currentIndex + 1} of ${questions.length}`}
              </span>
              <div className="flex items-center gap-1.5">
                {questions.map((question, index) => {
                  const result = results[question.id];
                  if (result === 'correct') return <CheckCircle2 key={question.id} className="w-3.5 h-3.5 text-emerald-600" />;
                  if (index === currentIndex && !sessionCompleted) return <CircleDot key={question.id} className="w-3.5 h-3.5 text-blue-600" />;
                  return <Circle key={question.id} className="w-3.5 h-3.5 text-slate-400" />;
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={sessionCompleted}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={sessionCompleted}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {footerPrimaryLabel}
              </button>
            </div>
          </div>
        </footer>
      </div>

      <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="font-semibold">
              {sessionCompleted ? `${progressSummary.total} of ${progressSummary.total}` : `${currentIndex + 1} of ${questions.length}`}
            </span>
            <div className="flex items-center gap-1.5">
              {questions.map((question, index) => {
                const result = results[question.id];
                if (result === 'correct') return <CheckCircle2 key={question.id} className="w-3.5 h-3.5 text-emerald-600" />;
                if (index === currentIndex && !sessionCompleted) return <CircleDot key={question.id} className="w-3.5 h-3.5 text-blue-600" />;
                return <Circle key={question.id} className="w-3.5 h-3.5 text-slate-400" />;
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              disabled={sessionCompleted}
              className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={sessionCompleted}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {footerPrimaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentPracticeRunner;
