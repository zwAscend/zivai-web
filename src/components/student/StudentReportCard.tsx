import React from 'react';

type ReportCardRow = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  masteryPercent: number;
  currentGrade: string;
  predictedZimsecGrade: string;
};

interface StudentReportCardProps {
  rows: ReportCardRow[];
}

const gradeBadgeClass = (grade: string) => {
  if (grade === 'A' || grade === 'B') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (grade === 'C') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (grade === 'D') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-800 border-rose-200';
};

const StudentReportCard: React.FC<StudentReportCardProps> = ({ rows }) => {
  const avgMastery = rows.length > 0
    ? Math.round(rows.reduce((sum, row) => sum + row.masteryPercent, 0) / rows.length)
    : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Student Report Card</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-900">Predicted ZIMSEC Outcome</h3>
        <p className="mt-2 text-sm text-slate-600">
          Subject-level projection based on current mastery and assessment performance trend.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Subjects tracked</p>
            <p className="text-xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Average mastery</p>
            <p className="text-xl font-semibold text-slate-900">{avgMastery}%</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mastery</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Current Grade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Predicted ZIMSEC Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.subjectId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{row.subjectName}</p>
                    <p className="text-xs text-slate-500">{row.subjectCode}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-800 w-10">{row.masteryPercent}%</span>
                      <div className="h-2.5 w-full max-w-[180px] rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.max(0, Math.min(100, row.masteryPercent))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${gradeBadgeClass(row.currentGrade)}`}>
                      {row.currentGrade}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${gradeBadgeClass(row.predictedZimsecGrade)}`}>
                      {row.predictedZimsecGrade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default StudentReportCard;
