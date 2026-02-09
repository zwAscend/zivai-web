import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { subjectService, curriculumService } from '../../../services/api';
import AdminSectionHeader from '../components/AdminSectionHeader';
import AdminConfirmDialog from '../components/AdminConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useToast } from '../../ui/use-toast';

interface SubjectOption {
  id: string;
  code: string;
  name: string;
}

interface TopicFormState {
  code: string;
  name: string;
  description: string;
  sequenceIndex: string;
}

interface SubjectFormState {
  code: string;
  name: string;
  examBoardCode: string;
  description: string;
}

const defaultForm: TopicFormState = {
  code: '',
  name: '',
  description: '',
  sequenceIndex: '',
};

const defaultSubjectForm: SubjectFormState = {
  code: '',
  name: '',
  examBoardCode: 'ZIMSEC',
  description: '',
};

const AdminCurriculumPage: React.FC = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubjectFormOpen, setIsSubjectFormOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [form, setForm] = useState<TopicFormState>(defaultForm);
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(defaultSubjectForm);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadSubjects = async () => {
    try {
      const data = await subjectService.getSubjects();
      const list = (Array.isArray(data) ? data : []).map((subject: any) => ({
        id: subject.id,
        code: subject.code || '',
        name: subject.name || '',
      }));
      setSubjects(list);
      if (!selectedSubjectId && list.length > 0) {
        setSelectedSubjectId(list[0].id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load subjects.');
    }
  };

  const loadTopics = async (subjectId: string) => {
    if (!subjectId) {
      setTopics([]);
      return;
    }
    setLoading(true);
    try {
      const data = await curriculumService.listTopics(subjectId);
      const mapped = (Array.isArray(data) ? data : []).map((topic: any) => ({
        id: topic.id,
        code: topic.code || '',
        name: topic.name || '',
        description: topic.description || '',
        sequenceIndex: topic.sequenceIndex ?? null,
      }));
      setTopics(mapped);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load curriculum topics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      loadTopics(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const filteredTopics = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return topics;
    return topics.filter((topic) =>
      topic.code.toLowerCase().includes(query) ||
      topic.name.toLowerCase().includes(query) ||
      topic.description.toLowerCase().includes(query)
    );
  }, [topics, searchTerm]);

  const handleOpenCreate = () => {
    setEditingTopicId(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const handleOpenSubjectCreate = () => {
    setSubjectForm(defaultSubjectForm);
    setIsSubjectFormOpen(true);
  };

  const handleOpenEdit = (topic: any) => {
    setEditingTopicId(topic.id);
    setForm({
      code: topic.code,
      name: topic.name,
      description: topic.description || '',
      sequenceIndex: topic.sequenceIndex !== null && topic.sequenceIndex !== undefined ? String(topic.sequenceIndex) : '',
    });
    setIsFormOpen(true);
  };

  const handleSaveSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subjectForm.code.trim() || !subjectForm.name.trim()) {
      toast.error('Subject code and name are required.');
      return;
    }
    setSubjectSaving(true);
    try {
      const payload = {
        code: subjectForm.code.trim(),
        name: subjectForm.name.trim(),
        examBoardCode: subjectForm.examBoardCode || undefined,
        description: subjectForm.description.trim() || undefined,
      };
      const created = await subjectService.createSubject(payload);
      toast.success('Curriculum subject created.');
      await loadSubjects();
      if (created?.id) {
        setSelectedSubjectId(created.id);
      }
      setIsSubjectFormOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create subject.');
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSubjectId) {
      toast.error('Select a subject first.');
      return;
    }
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Topic code and name are required.');
      return;
    }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sequenceIndex: form.sequenceIndex ? Number(form.sequenceIndex) : undefined,
    };

    try {
      if (editingTopicId) {
        await curriculumService.updateTopic(editingTopicId, payload);
        toast.success('Topic updated.');
      } else {
        await curriculumService.createTopic(selectedSubjectId, payload);
        toast.success('Topic created.');
      }
      setIsFormOpen(false);
      await loadTopics(selectedSubjectId);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save topic.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTopicId) return;
    try {
      await curriculumService.deleteTopic(deleteTopicId);
      toast.success('Topic deleted.');
      setDeleteTopicId(null);
      await loadTopics(selectedSubjectId);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete topic.');
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <AdminSectionHeader
        title="Curriculum"
        description="Create and maintain subject curriculum topics used in forecasts and analytics."
        icon={BookOpen}
      />

      <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md"
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search topic"
              className="px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadTopics(selectedSubjectId)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-slate-200 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={handleOpenSubjectCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-slate-200 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Create Curriculum
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Topic
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading curriculum topics...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b text-slate-500">
                  <th className="py-2 pr-4">Sequence</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Topic</th>
                  <th className="py-2 pr-4">Objectives</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopics.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-slate-500">
                      No topics found for this subject.
                    </td>
                  </tr>
                )}
                {filteredTopics.map((topic) => (
                  <tr key={topic.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 text-slate-700">{topic.sequenceIndex ?? '-'}</td>
                    <td className="py-3 pr-4 text-slate-700">{topic.code}</td>
                    <td className="py-3 pr-4 text-slate-900 font-medium">{topic.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{topic.description || '—'}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(topic)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTopicId(topic.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTopicId ? 'Edit Topic' : 'Add Topic'}</DialogTitle>
            <DialogDescription>
              Maintain curriculum topics for the selected subject.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Topic code</label>
                <input
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. ALG-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Sequence index</label>
                <input
                  value={form.sequenceIndex}
                  onChange={(event) => setForm((prev) => ({ ...prev, sequenceIndex: event.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Topic name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Algebraic Expressions"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Objectives</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full min-h-[120px] border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="List learning objectives for this topic"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                {editingTopicId ? 'Update Topic' : 'Create Topic'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSubjectFormOpen} onOpenChange={setIsSubjectFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Curriculum Subject</DialogTitle>
            <DialogDescription>
              Set up the subject before adding curriculum topics.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveSubject}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Subject code</label>
                <input
                  value={subjectForm.code}
                  onChange={(event) =>
                    setSubjectForm((prev) => ({ ...prev, code: event.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. MATH"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Subject name</label>
                <input
                  value={subjectForm.name}
                  onChange={(event) =>
                    setSubjectForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. Mathematics"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Exam board</label>
              <select
                value={subjectForm.examBoardCode}
                onChange={(event) =>
                  setSubjectForm((prev) => ({ ...prev, examBoardCode: event.target.value }))
                }
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="ZIMSEC">ZIMSEC</option>
                <option value="CAMBRIDGE">Cambridge</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Objectives</label>
              <textarea
                value={subjectForm.description}
                onChange={(event) =>
                  setSubjectForm((prev) => ({ ...prev, description: event.target.value }))
                }
                className="w-full min-h-[110px] border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Outline subject-level objectives or scope."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSubjectFormOpen(false)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={subjectSaving}
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {subjectSaving ? 'Saving...' : 'Create Curriculum'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={!!deleteTopicId}
        title="Delete topic"
        description="This will remove the topic from the curriculum."
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTopicId(null);
        }}
        confirmLabel="Delete"
      />
    </div>
  );
};

export default AdminCurriculumPage;
