import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  PlayCircle,
  Sparkles,
  Target,
} from 'lucide-react';
import { Subject } from '../../types';

type PracticeStatus = 'not-started' | 'in-progress' | 'mastered';
type ResourceType = 'video' | 'notes' | 'article';

interface CurriculumResource {
  id: string;
  title: string;
  type: ResourceType;
}

interface CurriculumPractice {
  id: string;
  title: string;
  status: PracticeStatus;
  target: string;
}

interface CurriculumTopic {
  id: string;
  title: string;
  masteryPercent: number;
  learn: CurriculumResource[];
  practice: CurriculumPractice[];
}

interface CurriculumUnit {
  id: string;
  code: string;
  title: string;
  summary: string;
  masteryPercent: number;
  topics: CurriculumTopic[];
}

interface StudentSubjectsViewProps {
  selectedSubjectId: string;
  subjects: Subject[];
}

const getPracticeActionLabel = (status: PracticeStatus) => {
  if (status === 'mastered') return 'Review';
  if (status === 'in-progress') return 'Resume';
  return 'Start';
};

const buildMathUnits = (): CurriculumUnit[] => [
  {
    id: 'math-unit-1',
    code: 'Unit 1',
    title: 'Polynomial arithmetic',
    masteryPercent: 64,
    summary: 'Build fluency with polynomial expressions, factorization, and interpretation of structure.',
    topics: [
      {
        id: 'math-u1-t1',
        title: 'Interpreting polynomial terms',
        masteryPercent: 72,
        learn: [
          { id: 'r1', title: 'Polynomials intro video', type: 'video' },
          { id: 'r2', title: 'Reading polynomial structure notes', type: 'notes' },
        ],
        practice: [
          { id: 'p1', title: 'Identify terms and degrees', status: 'in-progress', target: 'Get 3 of 4 correct' },
          { id: 'p2', title: 'Classify polynomial expressions', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
      {
        id: 'math-u1-t2',
        title: 'Operations with polynomials',
        masteryPercent: 58,
        learn: [
          { id: 'r3', title: 'Addition and subtraction walkthrough', type: 'article' },
          { id: 'r4', title: 'Multiplication method notes', type: 'notes' },
        ],
        practice: [
          { id: 'p3', title: 'Add and subtract polynomials', status: 'not-started', target: 'Get 3 of 4 correct' },
          { id: 'p4', title: 'Multiply binomials', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
    ],
  },
  {
    id: 'math-unit-2',
    code: 'Unit 2',
    title: 'Exponential models',
    masteryPercent: 41,
    summary: 'Model growth and decay and interpret rate of change in real-world contexts.',
    topics: [
      {
        id: 'math-u2-t1',
        title: 'Interpreting rate of change',
        masteryPercent: 46,
        learn: [
          { id: 'r5', title: 'Rate of change video', type: 'video' },
          { id: 'r6', title: 'Worked examples notes', type: 'notes' },
        ],
        practice: [
          { id: 'p5', title: 'Interpret growth scenarios', status: 'not-started', target: 'Get 3 of 4 correct' },
          { id: 'p6', title: 'Interpret decay scenarios', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
      {
        id: 'math-u2-t2',
        title: 'Constructing exponential models',
        masteryPercent: 36,
        learn: [
          { id: 'r7', title: 'Model construction article', type: 'article' },
          { id: 'r8', title: 'Half-life and percent change notes', type: 'notes' },
        ],
        practice: [
          { id: 'p7', title: 'Construct model from context', status: 'in-progress', target: 'Get 3 of 4 correct' },
          { id: 'p8', title: 'Model validation practice', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
    ],
  },
  {
    id: 'math-unit-3',
    code: 'Unit 3',
    title: 'Transformations of functions',
    masteryPercent: 29,
    summary: 'Analyze translations, reflections, stretches, and combined transformations.',
    topics: [
      {
        id: 'math-u3-t1',
        title: 'Graph transformations',
        masteryPercent: 32,
        learn: [
          { id: 'r9', title: 'Transformations video', type: 'video' },
          { id: 'r10', title: 'Reference graph notes', type: 'notes' },
        ],
        practice: [
          { id: 'p9', title: 'Apply graph shifts', status: 'not-started', target: 'Get 3 of 4 correct' },
          { id: 'p10', title: 'Combined transformations', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
    ],
  },
];

const buildEnglishUnits = (): CurriculumUnit[] => [
  {
    id: 'eng-unit-1',
    code: 'Unit 1',
    title: 'Reading comprehension',
    masteryPercent: 68,
    summary: 'Develop inference, synthesis, and evidence-based interpretation skills.',
    topics: [
      {
        id: 'eng-u1-t1',
        title: 'Main idea and supporting detail',
        masteryPercent: 76,
        learn: [
          { id: 'er1', title: 'Main idea explainer video', type: 'video' },
          { id: 'er2', title: 'Annotation notes', type: 'notes' },
        ],
        practice: [
          { id: 'ep1', title: 'Identify central argument', status: 'mastered', target: 'Completed' },
          { id: 'ep2', title: 'Evidence matching', status: 'in-progress', target: 'Get 3 of 4 correct' },
        ],
      },
      {
        id: 'eng-u1-t2',
        title: 'Inference and interpretation',
        masteryPercent: 61,
        learn: [
          { id: 'er3', title: 'Inference strategy guide', type: 'article' },
          { id: 'er4', title: 'Text clue notes', type: 'notes' },
        ],
        practice: [
          { id: 'ep3', title: 'Inference drills', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
    ],
  },
  {
    id: 'eng-unit-2',
    code: 'Unit 2',
    title: 'Writing mechanics',
    masteryPercent: 47,
    summary: 'Improve grammar control, paragraph coherence, and argument structure.',
    topics: [
      {
        id: 'eng-u2-t1',
        title: 'Paragraph structure',
        masteryPercent: 53,
        learn: [
          { id: 'er5', title: 'Paragraph model notes', type: 'notes' },
          { id: 'er6', title: 'PEEL structure article', type: 'article' },
        ],
        practice: [
          { id: 'ep4', title: 'Draft paragraph response', status: 'in-progress', target: 'Complete one draft' },
        ],
      },
      {
        id: 'eng-u2-t2',
        title: 'Grammar and sentence control',
        masteryPercent: 40,
        learn: [
          { id: 'er7', title: 'Grammar fundamentals video', type: 'video' },
        ],
        practice: [
          { id: 'ep5', title: 'Sentence correction drills', status: 'not-started', target: 'Get 8 of 10 correct' },
        ],
      },
    ],
  },
];

const buildPhysicsUnits = (): CurriculumUnit[] => [
  {
    id: 'phy-unit-1',
    code: 'Unit 1',
    title: 'Kinematics',
    masteryPercent: 55,
    summary: 'Understand motion graphs, displacement, velocity, and acceleration.',
    topics: [
      {
        id: 'phy-u1-t1',
        title: 'Interpreting motion graphs',
        masteryPercent: 62,
        learn: [
          { id: 'pr1', title: 'Motion graphs explainer', type: 'video' },
          { id: 'pr2', title: 'Slope interpretation notes', type: 'notes' },
        ],
        practice: [
          { id: 'pp1', title: 'Graph interpretation set', status: 'in-progress', target: 'Get 3 of 4 correct' },
        ],
      },
      {
        id: 'phy-u1-t2',
        title: 'SUVAT equation selection',
        masteryPercent: 48,
        learn: [
          { id: 'pr3', title: 'Equation selection guide', type: 'article' },
        ],
        practice: [
          { id: 'pp2', title: 'Choose correct equation', status: 'not-started', target: 'Get 3 of 4 correct' },
        ],
      },
    ],
  },
];

const buildGenericUnits = (subjectName: string): CurriculumUnit[] => [
  {
    id: 'gen-unit-1',
    code: 'Unit 1',
    title: `${subjectName} foundations`,
    masteryPercent: 52,
    summary: `Core foundations and essential learning outcomes for ${subjectName}.`,
    topics: [
      {
        id: 'gen-u1-t1',
        title: 'Core concepts',
        masteryPercent: 52,
        learn: [
          { id: 'gr1', title: 'Topic primer video', type: 'video' },
          { id: 'gr2', title: 'Core concept notes', type: 'notes' },
        ],
        practice: [
          { id: 'gp1', title: 'Concept checkpoint', status: 'in-progress', target: 'Get 3 of 4 correct' },
        ],
      },
    ],
  },
];

const getUnitsBySubject = (subjectName: string): CurriculumUnit[] => {
  const normalized = subjectName.toLowerCase();
  if (normalized.includes('math')) return buildMathUnits();
  if (normalized.includes('english')) return buildEnglishUnits();
  if (normalized.includes('physics')) return buildPhysicsUnits();
  return buildGenericUnits(subjectName);
};

const StudentSubjectsView: React.FC<StudentSubjectsViewProps> = ({ selectedSubjectId, subjects }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);

  const activeSubject = useMemo(() => {
    if (subjects.length === 0) return null;
    if (selectedSubjectId === 'all') return subjects[0];
    return subjects.find((subject) => subject.id === selectedSubjectId) || subjects[0];
  }, [selectedSubjectId, subjects]);

  const units = useMemo(() => (
    activeSubject ? getUnitsBySubject(activeSubject.name) : []
  ), [activeSubject]);

  const selectedUnit = units[selectedUnitIndex] || units[0];

  useEffect(() => {
    setSelectedUnitIndex(0);
  }, [activeSubject?.id]);

  const allTopics = useMemo(
    () => units.flatMap((unit) => unit.topics),
    [units]
  );

  const masteredTopics = allTopics.filter((topic) => topic.masteryPercent >= 80).length;
  const inProgressTopics = allTopics.filter((topic) => topic.masteryPercent >= 50 && topic.masteryPercent < 80).length;
  const focusTopics = allTopics.filter((topic) => topic.masteryPercent < 50).slice(0, 3);
  const overallCoverage = allTopics.length > 0
    ? Math.round(allTopics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / allTopics.length)
    : 0;

  if (!activeSubject || units.length === 0 || !selectedUnit) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No curriculum topics available yet.
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      style={{ ['--subjects-cols' as string]: isSidebarCollapsed ? '88px minmax(0,1fr)' : '320px minmax(0,1fr)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="grid grid-cols-1 xl:[grid-template-columns:var(--subjects-cols)]">
        <aside className="relative border-r border-slate-200 bg-slate-50 flex flex-col min-h-[760px]">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="hidden xl:inline-flex absolute top-1/2 -translate-y-1/2 -right-4 z-10 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label={isSidebarCollapsed ? 'Expand topics panel' : 'Collapse topics panel'}
          >
            {isSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>

          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div
                className={`min-w-0 overflow-hidden transition-[max-width,max-height,opacity,transform] duration-200 ease-out ${
                  isSidebarCollapsed ? 'max-w-0 max-h-0 opacity-0 -translate-x-1' : 'max-w-[240px] max-h-16 opacity-100 translate-x-0'
                }`}
              >
                <h2 className="text-xl font-bold text-slate-900 truncate">{activeSubject.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{units.length} topics in curriculum</p>
              </div>
            </div>
            <div className={`mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, overallCoverage))}%` }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {units.map((unit, index) => {
              const isSelected = selectedUnit.id === unit.id;
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setSelectedUnitIndex(index)}
                  title={`${unit.code}: ${unit.title}`}
                  className={`w-full border-b border-slate-200 transition ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3' : 'hover:bg-slate-100'
                  } ${isSidebarCollapsed ? 'px-2 py-3 min-h-[72px] flex items-center justify-center' : 'px-4 py-3 text-left min-h-[84px]'}`}
                >
                  {isSidebarCollapsed ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                      {index + 1}
                    </span>
                  ) : (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{unit.code}</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{unit.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{unit.masteryPercent}% mastery</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className="border-t border-slate-200 p-4 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Focus Area</p>
              <p className="text-xs text-slate-600 mt-2">
                Improve weak topics with guided notes and deliberate practice.
              </p>
            </div>
          )}
        </aside>

        <section className="min-w-0 bg-white">
          <header className="px-6 py-5 border-b border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900">{selectedUnit.code}: {selectedUnit.title}</h1>
            <p className="text-sm text-slate-500 mt-2">{selectedUnit.summary}</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] uppercase font-semibold tracking-wide text-emerald-700">Mastered</p>
                <p className="text-lg font-semibold text-emerald-800">{masteredTopics} topics</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-[11px] uppercase font-semibold tracking-wide text-blue-700">In Progress</p>
                <p className="text-lg font-semibold text-blue-800">{inProgressTopics} topics</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] uppercase font-semibold tracking-wide text-amber-700">Needs Support</p>
                <p className="text-sm font-semibold text-amber-800 truncate">
                  {focusTopics.length > 0 ? focusTopics.map((topic) => topic.title).join(', ') : 'No immediate gaps'}
                </p>
              </div>
            </div>
          </header>

          <div className="p-6 space-y-4">
            {selectedUnit.topics.map((topic) => (
              <section key={topic.id} className="border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold text-slate-900">{topic.title}</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                    <Target className="w-3.5 h-3.5" />
                    {topic.masteryPercent}% mastery
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Learn</p>
                    <div className="space-y-2">
                      {topic.learn.map((resource) => (
                        <div key={resource.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <PlayCircle className="w-4 h-4 text-slate-500" />
                          <span>{resource.title}</span>
                          <span className="text-xs text-slate-400 capitalize">({resource.type})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Practice</p>
                    <div className="space-y-2">
                      {topic.practice.map((practice) => (
                        <div key={practice.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{practice.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{practice.target}</p>
                          </div>
                          <button
                            type="button"
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                              practice.status === 'mastered'
                                ? 'bg-emerald-100 text-emerald-700'
                                : practice.status === 'in-progress'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {getPracticeActionLabel(practice.status)}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}

            <div className="border border-slate-200 rounded-lg p-5 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Sparkles className="w-4 h-4" />
                Course challenge
              </div>
              <p className="text-sm text-slate-600 mt-2">Test your understanding across all topics in this unit.</p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
                Start unit challenge
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default StudentSubjectsView;

