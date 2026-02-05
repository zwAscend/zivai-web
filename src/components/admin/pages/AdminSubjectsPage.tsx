import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { authService, subjectService } from '../../../services/api';
import AdminSectionHeader from '../components/AdminSectionHeader';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useToast } from '../../ui/use-toast';
import AdminConfirmDialog from '../components/AdminConfirmDialog';

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  examBoardCode?: string;
  description?: string;
  active?: boolean;
  grades?: string[];
  teachers?: string[];
}

interface SubjectFormState {
  code: string;
  name: string;
  examBoardCode: string;
  description: string;
  grades: string[];
  active: boolean;
}

const defaultForm: SubjectFormState = {
  code: '',
  name: '',
  examBoardCode: '',
  description: '',
  grades: [],
  active: true,
};

const EXAM_BOARD_OPTIONS = [
  { label: 'ZIMSEC', value: 'ZIMSEC' },
  { label: 'CAMBRIDGE', value: 'CAMBRIDGE' },
];

const FORM_OPTIONS = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'];

const SubjectTableSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((__, colIndex) => (
          <div key={colIndex} className="h-9 rounded bg-slate-200 animate-pulse" />
        ))}
      </div>
    ))}
  </div>
);

const AdminSubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [form, setForm] = useState<SubjectFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectRow | null>(null);
  const [codeFilter, setCodeFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { toast } = useToast();

  const currentUser = authService.getCurrentUser();
  const isAdmin = !!currentUser?.isAdmin || currentUser?.role === 'admin';

  const gradeOptions = useMemo(() => {
    return Array.from(
      new Set(
        subjects
          .flatMap((subject) => subject.grades || [])
          .filter((grade) => !!grade)
      )
    ).sort();
  }, [subjects]);

  const teacherOptions = useMemo(() => {
    return Array.from(
      new Set(
        subjects
          .flatMap((subject) => subject.teachers || [])
          .filter((teacher) => !!teacher)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const normalizedCode = codeFilter.trim().toLowerCase();
    const normalizedName = nameFilter.trim().toLowerCase();
    return subjects
      .filter((subject) => {
        const matchesCode = !normalizedCode || subject.code.toLowerCase().includes(normalizedCode);
        const matchesName = !normalizedName || subject.name.toLowerCase().includes(normalizedName);
        const active = subject.active !== false;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && active) ||
          (statusFilter === 'inactive' && !active);
        const matchesGrade = gradeFilter === 'all' || (subject.grades || []).includes(gradeFilter);
        const matchesTeacher = teacherFilter === 'all' || (subject.teachers || []).includes(teacherFilter);
        return matchesCode && matchesName && matchesStatus && matchesGrade && matchesTeacher;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects, codeFilter, nameFilter, statusFilter, gradeFilter, teacherFilter]);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const data = await subjectService.getSubjects();
      const mapped = (Array.isArray(data) ? data : []).map((item: any) => ({
        id: item.id,
        code: item.code || '',
        name: item.name || '',
        examBoardCode: item.examBoardCode || '',
        description: item.description || '',
        active: item.active !== false,
        grades: Array.isArray(item.grades) ? item.grades : [],
        teachers: Array.isArray(item.teachers) ? item.teachers : [],
      }));
      setSubjects(mapped);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadSubjects();
    }
  }, [isAdmin]);

  const onChange = <K extends keyof SubjectFormState>(key: K, value: SubjectFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const openEditModal = (subject: SubjectRow) => {
    setEditingId(subject.id);
    setForm({
      code: subject.code,
      name: subject.name,
      examBoardCode: subject.examBoardCode || '',
      description: subject.description || '',
      grades: subject.grades || [],
      active: subject.active !== false,
    });
    setIsFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Subject code and name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        examBoardCode: form.examBoardCode.trim() || undefined,
        description: form.description.trim() || undefined,
        grades: form.grades,
        active: form.active,
      };

      if (editingId) {
        await subjectService.updateSubject(editingId, payload);
        toast.success('Subject updated successfully.');
      } else {
        await subjectService.createSubject(payload);
        toast.success('Subject created successfully.');
      }

      setIsFormOpen(false);
      await loadSubjects();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  const askDeleteSubject = (subject: SubjectRow) => {
    setSubjectToDelete(subject);
  };

  const deleteSubject = async () => {
    if (!subjectToDelete) {
      return;
    }

    setSaving(true);
    try {
      await subjectService.deleteSubject(subjectToDelete.id);
      toast.success('Subject deleted successfully.');
      setSubjectToDelete(null);
      await loadSubjects();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete subject');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-4">
        <div className="flex items-center gap-2 text-red-600 font-semibold mb-2">
          <AlertCircle className="w-5 h-5" />
          Access Denied
        </div>
        <p className="text-gray-600">This page is available to administrators only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <AdminSectionHeader
        title="Subject Management"
        description="Maintain the subject catalog used by classes, plans, and assessments."
        icon={BookOpen}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Subject Records</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadSubjects}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md"
            >
              <Plus className="w-4 h-4" />
              Create Subject
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <input
            className="border rounded-md px-3 py-2"
            placeholder="Filter by code"
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
          />
          <input
            className="border rounded-md px-3 py-2"
            placeholder="Filter by name"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="all">All Grades</option>
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          >
            <option value="all">All Teachers</option>
            {teacherOptions.map((teacher) => (
              <option key={teacher} value={teacher}>
                {teacher}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <SubjectTableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Exam Board</th>
                  <th className="py-2 pr-4">Grades</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((subject) => (
                  <tr key={subject.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium">{subject.code || '-'}</td>
                    <td className="py-2 pr-4">{subject.name || '-'}</td>
                    <td className="py-2 pr-4">{subject.examBoardCode || '-'}</td>
                    <td className="py-2 pr-4">
                      {subject.grades && subject.grades.length > 0 ? subject.grades.join(', ') : '-'}
                    </td>
                    <td className="py-2 pr-4">
                      {subject.active === false ? (
                        <span className="text-red-600">Inactive</span>
                      ) : (
                        <span className="text-green-600">Active</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(subject)}
                          className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1 text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => askDeleteSubject(subject)}
                          className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSubjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-500">
                      No subjects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Subject' : 'Create Subject'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update subject details and active state.'
                : 'Add a new subject for school and class mapping.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Subject code *"
              value={form.code}
              onChange={(e) => onChange('code', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Subject name *"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
            />
            <select
              className="border rounded-md px-3 py-2"
              value={form.examBoardCode}
              onChange={(e) => onChange('examBoardCode', e.target.value)}
            >
              <option value="">Select exam board</option>
              {EXAM_BOARD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 px-1 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => onChange('active', e.target.checked)}
              />
              Active subject
            </label>
            <select
              multiple
              className="border rounded-md px-3 py-2 md:col-span-2 min-h-28"
              value={form.grades}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((option) => option.value);
                onChange('grades', selected);
              }}
            >
              {FORM_OPTIONS.map((formOption) => (
                <option key={formOption} value={formOption}>
                  {formOption}
                </option>
              ))}
            </select>
            <textarea
              className="border rounded-md px-3 py-2 md:col-span-2 min-h-24"
              placeholder="Description"
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
            />
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-5 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Subject'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={!!subjectToDelete}
        title="Delete Subject"
        description={`Delete subject "${subjectToDelete?.code || ''}"? This performs a soft delete.`}
        confirmLabel="Delete Subject"
        busy={saving}
        onConfirm={deleteSubject}
        onOpenChange={(open) => {
          if (!open) {
            setSubjectToDelete(null);
          }
        }}
      />
    </div>
  );
};

export default AdminSubjectsPage;
