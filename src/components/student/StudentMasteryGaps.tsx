import React, { useMemo } from 'react';
import { AlertCircle, Brain, CheckCircle2, Sparkles } from 'lucide-react';
import { DevelopmentPlan, Subject } from '../../types';

type StudentMasteryGapsProps = {
  selectedSubjectId: string;
  subjects: Subject[];
  activePlan?: DevelopmentPlan | null;
  onOpenTutor?: (prompt?: string) => void;
};

const StudentMasteryGaps: React.FC<StudentMasteryGapsProps> = ({
  selectedSubjectId,
  subjects,
  activePlan,
  onOpenTutor,
}) => {
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  const planForSubject = useMemo(() => {
    if (!activePlan || !activePlan.plan?.subjectId) {
      return null;
    }
    return activePlan.plan.subjectId === selectedSubjectId ? activePlan : null;
  }, [activePlan, selectedSubjectId]);

  if (selectedSubjectId === 'all') {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
        Select a subject to view mastery gaps and retrieval practice suggestions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {planForSubject ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.3fr] gap-6">
          <div className="space-y-4">
            {planForSubject.plan.skills.map((skill) => (
              <div key={skill.name} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">{skill.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                    Focus
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Explain the core concept before checking solutions.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {skill.subskills.map((subskill) => (
                    <span key={subskill.name} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {subskill.name}
                    </span>
                  ))}
                </div>
                {onOpenTutor && (
                  <button
                    type="button"
                    onClick={() => onOpenTutor(`Help me understand ${skill.name} and practice it.`)}
                    className="mt-4 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Ask AI Tutor for guidance
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Retrieval Practice Cards
              </div>
              <div className="space-y-3">
                {(planForSubject.plan.skills || []).slice(0, 3).map((skill) => (
                  <div key={skill.name} className="border border-slate-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-slate-800">{skill.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try to solve without hints, then ask for feedback.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => onOpenTutor?.(`Give me a practice question on ${skill.name}.`)}
                        className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs"
                      >
                        Practice question
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTutor?.(`Check my reasoning on ${skill.name}.`)}
                        className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs"
                      >
                        Check reasoning
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Reflection Checklist
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  I attempted the problem before hints.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  I explained my reasoning in my own words.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  I can solve a similar question again.
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
          No active plan for this subject yet. Ask the tutor to create a practice path.
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
          <Brain className="w-4 h-4 text-blue-600" />
          AI‑Proof Learning Tips
        </div>
        <p className="text-sm text-slate-500">
          Use the tutor for hints and checks, not full solutions. Always attempt, explain, and retry.
        </p>
      </div>
    </div>
  );
};

export default StudentMasteryGaps;
