import React from 'react';
import { motion } from 'framer-motion';
import { DevelopmentPlan, Student, Skill, Step } from '../../types';
import { Target, Clock, TrendingUp, CheckCircle, BookOpen, Video, FileText, Edit, Sparkles, MessageCircle, Users } from 'lucide-react';

interface StudentPlanViewProps {
  plan: DevelopmentPlan;
  student: Student;
  onOpenTutor?: (prompt?: string) => void;
}

// Helper to get an icon for each step type
const getStepIcon = (type: string) => {
  switch (type) {
    case 'video': return <Video className="w-4 h-4" />;
    case 'document': return <FileText className="w-4 h-4" />;
    case 'assignment': return <Edit className="w-4 h-4" />;
    case 'quiz': return <BookOpen className="w-4 h-4" />;
    default: return <BookOpen className="w-4 h-4" />;
  }
};

// ✨ COLOR CHANGE: Re-introduced the original progress bar color logic
const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
};

const StudentPlanView: React.FC<StudentPlanViewProps> = ({ plan, onOpenTutor }) => {

  const sortedSteps = plan.plan.steps?.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) || [];
  const totalSteps = sortedSteps.length;
  const completedStepsCount = Math.floor((plan.currentProgress / 100) * totalSteps);

  // ✨ COLOR CHANGE: Re-introduced the original step tag color logic
  const getStepTagColor = (type: string) => {
      switch(type) {
        case 'video': return 'bg-red-100 text-red-700';
        case 'document': return 'bg-blue-100 text-blue-700';
        case 'assignment': return 'bg-purple-100 text-purple-700';
        case 'quiz': return 'bg-yellow-100 text-yellow-700';
        default: return 'bg-gray-100 text-gray-700';
      }
  };

  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* LEFT COLUMN (MAIN CONTENT) */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">{plan.plan.name}</h2>
            <button
              type="button"
              onClick={() => onOpenTutor?.(`Help me plan my next step for ${plan.plan.name}.`)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Sparkles className="w-4 h-4" />
              Ask AI Tutor
            </button>
          </div>
          <p className="text-gray-500 text-sm">{plan.plan.description}</p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="px-2.5 py-1 rounded-full bg-slate-100">Think first</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100">Attempt on your own</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100">Explain your reasoning</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100">Reflect + retry</span>
          </div>
        </div>
        
        {/* Learning Path Timeline */}
        <div className="relative pl-6">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true"></div>
            <div className="space-y-6">
                {sortedSteps.map((step, index) => {
                    const isCompleted = index < completedStepsCount;
                    return (
                        <div key={index} className="relative flex items-start">
                            {/* Dot on the timeline - COLOR CHANGE */}
                            <div className={`absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center transform -translate-x-1/2 ${
                                isCompleted ? 'bg-green-500' : 'bg-gray-300'
                            }`}>
                                {isCompleted && <CheckCircle className="w-5 h-5 text-white" />}
                            </div>

                            {/* Step Content - COLOR CHANGE */}
                            <div className={`w-full p-4 rounded-lg ml-8 transition-colors ${
                                isCompleted ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'
                            }`}>
                                <h3 className={`font-semibold ${isCompleted ? 'text-green-800' : 'text-gray-700'}`}>
                                    {step.title}
                                </h3>
                                <div className={`flex items-center mt-2 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                                  getStepTagColor(step.type)
                                }`}>
                                    {getStepIcon(step.type)}
                                    <span className="ml-1.5 capitalize">{step.type}</span>
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                  Write a quick explanation before checking solutions. The tutor can guide your reasoning.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => onOpenTutor?.(`Explain the concept behind "${step.title}".`)}
                                    className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                                  >
                                    Explain concept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenTutor?.(`Give me a practice question for "${step.title}".`)}
                                    className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                                  >
                                    Practice question
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenTutor?.(`Check my reasoning for "${step.title}".`)}
                                    className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                                  >
                                    Check reasoning
                                  </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* RIGHT COLUMN (SUMMARY) */}
      <div className="space-y-6">
        {/* Plan Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Plan Progress</h3>
            {/* ✨ COLOR CHANGE: Reverted from indigo to blue */}
            <div className="text-center mb-4">
                <span className="text-5xl font-bold text-blue-600">{plan.currentProgress}</span>
                <span className="text-2xl text-gray-400">%</span>
                <p className="text-sm text-gray-500">Completed</p>
            </div>
            {/* ✨ COLOR CHANGE: Using original getProgressColor function */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div
                    className={`${getProgressColor(plan.currentProgress)} h-2.5 rounded-full`}
                    style={{ width: `${plan.currentProgress}%` }}
                ></div>
            </div>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2"/>Est. Time</span>
                    <span className="font-semibold text-gray-700">{plan.plan.eta} days</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center"><Target className="w-4 h-4 mr-2"/>Target Score</span>
                    <span className="font-semibold text-gray-700">{plan.plan.potentialOverall}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center"><TrendingUp className="w-4 h-4 mr-2"/>Level</span>
                    <span className="font-semibold text-gray-700">{plan.plan.performance}</span>
                </div>
            </div>
        </div>

        {/* AI Tutor Support */}
        <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">AI Tutor Support</h3>
            <p className="text-sm text-gray-500 mb-4">
              The tutor helps you think, not just answer. Use it to clarify, practice, and reflect.
            </p>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Ask for hints and reasoning checks.
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Request retrieval practice questions.
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600" />
                Reflect after each attempt.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenTutor?.('Help me with the next step in my development plan.')}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600 text-blue-600 font-semibold py-2 text-sm hover:bg-blue-50"
            >
              <Sparkles className="w-4 h-4" />
              Open AI Tutor
            </button>
        </div>

        {/* Skills Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Focus Skills</h3>
            <div className="space-y-4">
                {plan.plan.skills.map((skill: Skill, index: number) => (
                    <div key={index}>
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="font-semibold text-gray-700">{skill.name}</h4>
                            {/* ✨ COLOR CHANGE: Reverted from indigo to blue */}
                            <span className="text-sm font-bold text-blue-600">{skill.score} pts</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {skill.subskills.map((subskill, subIndex) => (
                                <span key={subIndex} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    {subskill.name}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Peer Collaboration */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Peer Collaboration</h3>
          <p className="text-sm text-gray-500 mb-4">
            Learn with classmates on shared weaknesses. Compare strategies and explain solutions.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Users className="w-4 h-4 text-blue-600" />
            Join a study circle for this subject.
          </div>
          <button
            type="button"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 text-gray-600 font-semibold py-2 text-sm hover:border-blue-300 hover:text-blue-700"
          >
            <Users className="w-4 h-4" />
            Find a Study Partner
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default StudentPlanView;
