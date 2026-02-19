import React from 'react';
import { Mail, Users } from 'lucide-react';
import { StudentTeacher } from '../../../services/studentService';

interface HomeTeachersPanelProps {
  teachers: StudentTeacher[];
  loading: boolean;
  error: string | null;
}

const HomeTeachersPanel: React.FC<HomeTeachersPanelProps> = ({ teachers, loading, error }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900">My teachers</h2>
        <p className="text-sm text-slate-500">Teachers currently assigned to your classes and subjects.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="h-4 w-56 rounded bg-slate-100" />
              <div className="h-3 w-28 rounded bg-slate-100" />
              <div className="h-3 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : teachers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
          No teachers assigned yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {teachers.map((teacher) => {
            const initials = `${teacher.firstName?.[0] || ''}${teacher.lastName?.[0] || ''}`.toUpperCase() || 'T';
            return (
              <article key={teacher.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {teacher.firstName} {teacher.lastName}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 text-sm text-slate-600 mt-1 min-w-0">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{teacher.email}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Subjects</p>
                    <p className="text-sm text-slate-700">
                      {teacher.subjectNames.length > 0 ? teacher.subjectNames.join(', ') : 'No subject allocations yet'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Classes</p>
                    <p className="text-sm text-slate-700">
                      {teacher.classNames.length > 0 ? teacher.classNames.join(', ') : 'No class allocations yet'}
                    </p>
                  </div>

                  {teacher.homeroomClassNames.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      Homeroom: {teacher.homeroomClassNames.join(', ')}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HomeTeachersPanel;
