// src/components/resources/Sidebar.tsx
import React, { useState } from 'react';
import { Menu, UploadCloud, FileText as CreateAssignmentIcon, CheckCircle, FileImage, FileVideo, FilePlus, Eye, BarChart3, UserCheck, Sparkles, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface RecentUpload {
    id: string; name: string; type: string; createdAt: string;
    subject: { id: string; name: string; code?: string; };
    uploadedBy: { id: string; firstName: string; lastName: string; };
}

interface SidebarProps {
  mode?: 'resources' | 'assessments';
  onUploadClick?: () => void;
  onCreateAssessment?: () => void;
  onMarkAssessment?: () => void;
  onViewAssessments?: () => void;
  onAssessmentAnalysis?: () => void;
  onStudentAnalysis?: () => void;
  onGenerateNotes?: () => void;
  onViewNotes?: () => void;
  onLessonPlans?: () => void;
  onDrafts?: () => void;
  onMaterial?: () => void;
  activeAction?: string;
  recentUploads: RecentUpload[];
}

// ✨ UX Improvement: A helper function for consistent, descriptive file icons
const getFileIcon = (type: string, className = "h-5 w-5") => {
    switch (type.toLowerCase()) {
        case 'document': return <CreateAssignmentIcon className={clsx(className, "text-blue-500")} />;
        case 'image': return <FileImage className={clsx(className, "text-green-500")} />;
        case 'video': return <FileVideo className={clsx(className, "text-purple-500")} />;
        default: return <FilePlus className={clsx(className, "text-slate-500")} />;
    }
};

const Sidebar: React.FC<SidebarProps> = ({
  mode = 'resources',
  onUploadClick,
  onCreateAssessment,
  onMarkAssessment,
  onViewAssessments,
  onAssessmentAnalysis,
  onStudentAnalysis,
  onGenerateNotes,
  onViewNotes,
  onLessonPlans,
  onDrafts,
  onMaterial,
  activeAction,
  recentUploads
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const actions = mode === 'assessments'
    ? [
        { id: 'create-assessment', label: 'Generate Assessment', icon: CreateAssignmentIcon, onClick: onCreateAssessment },
        { id: 'view-assessments', label: 'View Assessment', icon: Eye, onClick: onViewAssessments },
        { id: 'mark-assessment', label: 'Mark Assessment', icon: CheckCircle, onClick: onMarkAssessment },
        { id: 'analysis-assessment', label: 'Class Analysis', icon: BarChart3, onClick: onAssessmentAnalysis },
        { id: 'analysis-student', label: 'Student Analysis', icon: UserCheck, onClick: onStudentAnalysis },
      ]
    : [
        { id: 'generate-notes', label: 'Generate Content', icon: Sparkles, onClick: onGenerateNotes },
        { id: 'view-notes', label: 'View Content', icon: Eye, onClick: onViewNotes },
        { id: 'lesson-plans', label: 'Lesson Plans', icon: BookOpen, onClick: onLessonPlans },
        { id: 'drafts', label: 'Content Drafts', icon: CreateAssignmentIcon, onClick: onDrafts },
        { id: 'material', label: 'Material', icon: UploadCloud, onClick: onMaterial },
      ];

  return (
    <motion.aside
        // ✨ UX Improvement: Sidebar is now animated and collapsible
        animate={{ width: isCollapsed ? '5rem' : '16rem' }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-white border-r border-slate-200 flex flex-col h-full"
    >
      <div className={clsx("p-4 border-b border-slate-200 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <h2 className="text-lg font-bold text-slate-800">Actions</h2>}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded-md hover:bg-slate-100">
          <Menu className="h-5 w-5 text-slate-600" />
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {actions.map(({ id, label, icon: Icon, onClick }) => (
            <li key={id}>
              <button
                onClick={onClick}
                className={clsx(
                  "w-full flex items-center gap-3 p-2.5 rounded-md text-sm font-medium transition-colors",
                  id === activeAction
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </li>
          ))}
        </ul>

        {mode === 'resources' && (
        <div className="mt-6">
          <h3 className={clsx(
              "text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2",
              isCollapsed ? "text-center" : "px-2.5"
          )}>
            {isCollapsed ? "..." : "Recent Uploads"}
          </h3>
          <div className="space-y-1">
            {recentUploads.length > 0 ? recentUploads.map(upload => (
                <div key={upload.id} className={clsx("flex items-center gap-3 p-2.5 text-sm rounded-md", isCollapsed && "justify-center")} title={isCollapsed ? `${upload.name} in ${upload.subject.name}` : undefined}>
                  <div className="flex-shrink-0">{getFileIcon(upload.type)}</div>
                  {!isCollapsed && (
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{upload.name}</p>
                      <p className="text-xs text-slate-500 truncate">{upload.subject.name}</p>
                    </div>
                  )}
                </div>
              )) : (
                <p className={clsx("text-sm text-slate-500", isCollapsed ? 'text-center' : 'px-2.5')}>-</p>
              )}
          </div>
        </div>
        )}
      </nav>
    </motion.aside>
  );
};

export default Sidebar;
