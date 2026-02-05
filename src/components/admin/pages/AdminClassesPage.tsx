import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, GraduationCap, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { authService, classService, schoolService, userService } from '../../../services/api';
import { ClassItem } from '../../../services/classService';
import { SchoolItem } from '../../../services/schoolService';
import { User } from '../../../types';
import AdminSectionHeader from '../components/AdminSectionHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useToast } from '../../ui/use-toast';
import AdminConfirmDialog from '../components/AdminConfirmDialog';

interface ClassFormState {
  schoolId: string;
  code: string;
  name: string;
  gradeLevel: string;
  academicYear: string;
  homeroomTeacherId: string;
}

const defaultForm: ClassFormState = {
  schoolId: '',
  code: '',
  name: '',
  gradeLevel: '',
  academicYear: '',
  homeroomTeacherId: '',
};

type RoleLike = string | { code?: string; name?: string };

const hasTeacherRole = (roles: unknown): boolean => {
  if (!Array.isArray(roles)) {
    return false;
  }
  return (roles as RoleLike[]).some((role) => {
    if (typeof role === 'string') {
      return role === 'teacher';
    }
    return role.code === 'teacher' || role.name === 'teacher';
  });
};

const teacherDisplayName = (teacher?: User | null): string => {
  if (!teacher) {
    return '-';
  }
  const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
  return fullName || teacher.email || teacher.id;
};

const buildAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear - 2; year <= currentYear + 4; year += 1) {
    years.push(`${year}`);
  }
  return years;
};

const ClassTableSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((__, colIndex) => (
          <div key={colIndex} className="h-9 rounded bg-slate-200 animate-pulse" />
        ))}
      </div>
    ))}
  </div>
);

const AdminClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [form, setForm] = useState<ClassFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const { toast } = useToast();

  const yearOptions = useMemo(() => buildAcademicYearOptions(), []);
  const currentUser = authService.getCurrentUser();
  const isAdmin = !!currentUser?.isAdmin || currentUser?.role === 'admin';

  const gradeOptions = useMemo(() => {
    return Array.from(new Set(classes.map((item) => item.gradeLevel || '').filter(Boolean))).sort();
  }, [classes]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((item) => {
      const teacher = item.homeroomTeacher as User | null | undefined;
      if (teacher?.id) {
        map.set(teacher.id, teacherDisplayName(teacher));
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return classes
      .filter((classItem) => {
        const teacherName = teacherDisplayName((classItem.homeroomTeacher as User | null) || null).toLowerCase();

        const matchesSearch =
          !normalized ||
          classItem.code.toLowerCase().includes(normalized) ||
          classItem.name.toLowerCase().includes(normalized) ||
          teacherName.includes(normalized);
        const matchesYear = yearFilter === 'all' || (classItem.academicYear || '') === yearFilter;
        const matchesGrade = gradeFilter === 'all' || (classItem.gradeLevel || '') === gradeFilter;
        const matchesTeacher =
          teacherFilter === 'all' || ((classItem.homeroomTeacher as User | null)?.id || '') === teacherFilter;

        return matchesSearch && matchesYear && matchesGrade && matchesTeacher;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [classes, searchTerm, yearFilter, gradeFilter, teacherFilter]);

  const loadReferenceData = async () => {
    const [schoolData, userData] = await Promise.all([schoolService.getSchools(), userService.getUsers()]);
    const schoolList = Array.isArray(schoolData) ? schoolData : [];
    const teacherList = (Array.isArray(userData) ? userData : []).filter((user) =>
      hasTeacherRole((user as any).roles)
    );

    setSchools(schoolList);
    setTeachers(teacherList);
    setForm((prev) => ({ ...prev, schoolId: prev.schoolId || schoolList[0]?.id || '' }));
  };

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await classService.getClasses();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!isAdmin) {
        return;
      }

      try {
        await Promise.all([loadClasses(), loadReferenceData()]);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load class management data');
      }
    };

    loadAll();
  }, [isAdmin]);

  const onChange = <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...defaultForm,
      schoolId: schools[0]?.id || '',
      academicYear: `${new Date().getFullYear()}`,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (classItem: ClassItem) => {
    setEditingId(classItem.id);
    setForm({
      schoolId: classItem.school?.id || schools[0]?.id || '',
      code: classItem.code || '',
      name: classItem.name || '',
      gradeLevel: classItem.gradeLevel || '',
      academicYear: classItem.academicYear || `${new Date().getFullYear()}`,
      homeroomTeacherId: classItem.homeroomTeacher?.id || '',
    });
    setIsFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const schoolId = form.schoolId || schools[0]?.id || '';
    if (!schoolId || !form.code.trim() || !form.name.trim()) {
      toast.error('Class code and class name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        schoolId,
        code: form.code.trim(),
        name: form.name.trim(),
        gradeLevel: form.gradeLevel.trim() || undefined,
        academicYear: form.academicYear.trim() || undefined,
        homeroomTeacherId: form.homeroomTeacherId || undefined,
      };

      if (editingId) {
        await classService.updateClass(editingId, {
          ...payload,
          clearHomeroomTeacher: !form.homeroomTeacherId,
        });
        toast.success('Class updated successfully.');
      } else {
        await classService.createClass(payload);
        toast.success('Class created successfully.');
      }

      setIsFormOpen(false);
      await loadClasses();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const askDeleteClass = (classItem: ClassItem) => {
    setClassToDelete(classItem);
  };

  const deleteClass = async () => {
    if (!classToDelete) {
      return;
    }

    setSaving(true);
    try {
      await classService.deleteClass(classToDelete.id);
      toast.success('Class deleted successfully.');
      setClassToDelete(null);
      await loadClasses();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete class');
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
        title="Class Management"
        description="Create and maintain class records and homeroom teacher assignment."
        icon={GraduationCap}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Class Records</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadClasses}
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
              Create Class
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <input
            className="border rounded-md px-3 py-2 md:col-span-2"
            placeholder="Search code, class, teacher"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="all">All Years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <ClassTableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Grade</th>
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4">Homeroom Teacher</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((classItem) => (
                  <tr key={classItem.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium">{classItem.code || '-'}</td>
                    <td className="py-2 pr-4">{classItem.name || '-'}</td>
                    <td className="py-2 pr-4">{classItem.gradeLevel || '-'}</td>
                    <td className="py-2 pr-4">{classItem.academicYear || '-'}</td>
                    <td className="py-2 pr-4">{teacherDisplayName((classItem.homeroomTeacher as User | null) || null)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(classItem)}
                          className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1 text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => askDeleteClass(classItem)}
                          className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-500">
                      No classes found.
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
            <DialogTitle>{editingId ? 'Edit Class' : 'Create Class'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update class details, year, and homeroom assignment.'
                : 'Create a new class and assign initial metadata.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Class code *"
              value={form.code}
              onChange={(e) => onChange('code', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Class name *"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Grade level (e.g. Form 4)"
              value={form.gradeLevel}
              onChange={(e) => onChange('gradeLevel', e.target.value)}
            />
            <select
              className="border rounded-md px-3 py-2"
              value={form.academicYear}
              onChange={(e) => onChange('academicYear', e.target.value)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              className="border rounded-md px-3 py-2"
              value={form.homeroomTeacherId}
              onChange={(e) => onChange('homeroomTeacherId', e.target.value)}
            >
              <option value="">No homeroom teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacherDisplayName(teacher)}
                </option>
              ))}
            </select>
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
                disabled={saving || schools.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Class'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={!!classToDelete}
        title="Delete Class"
        description={`Delete class "${classToDelete?.code || ''}"? This performs a soft delete.`}
        confirmLabel="Delete Class"
        busy={saving}
        onConfirm={deleteClass}
        onOpenChange={(open) => {
          if (!open) {
            setClassToDelete(null);
          }
        }}
      />
    </div>
  );
};

export default AdminClassesPage;
