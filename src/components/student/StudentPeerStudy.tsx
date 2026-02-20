import React, { useMemo, useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Search, MessageCircle, Calendar, BookOpen, PlusCircle } from 'lucide-react';
import { Subject } from '../../types';

type PeerStudyRequest = {
  id: string;
  topic: string;
  subjectId: string;
  type: 'need-help' | 'offer-help' | 'study-group';
  note: string;
  preferredTime: string;
  participants: number;
};

type StudentPeerStudyProps = {
  selectedSubjectId: string;
  subjects: Subject[];
  isCreateOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
};

const sampleRequestsTemplate = [
  {
    id: 'req-1',
    topic: 'Algebra: Linear Equations',
    type: 'need-help' as const,
    note: 'Struggling with isolating variables and word problems.',
    preferredTime: 'Wed 6pm',
    participants: 3,
  },
  {
    id: 'req-2',
    topic: 'Geometry: Triangles',
    type: 'study-group' as const,
    note: 'Looking for a study circle to work on proofs.',
    preferredTime: 'Sat 10am',
    participants: 5,
  },
  {
    id: 'req-3',
    topic: 'Comprehension Strategies',
    type: 'offer-help' as const,
    note: 'Happy to walk through past paper questions.',
    preferredTime: 'Tue 4pm',
    participants: 2,
  },
];

const StudentPeerStudy: React.FC<StudentPeerStudyProps> = ({
  selectedSubjectId,
  subjects,
  isCreateOpen,
  onOpenCreate,
  onCloseCreate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [requestType, setRequestType] = useState<'all' | PeerStudyRequest['type']>('all');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [newRequestType, setNewRequestType] = useState<PeerStudyRequest['type']>('need-help');
  const [newRequestSubjectId, setNewRequestSubjectId] = useState<string>('all');

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject.name]));
  }, [subjects]);

  const requests = useMemo(() => {
    const subjectIds = subjects.map((subject) => subject.id);
    const derivedRequests: PeerStudyRequest[] = sampleRequestsTemplate.map((template, index) => ({
      ...template,
      subjectId: subjectIds[index % Math.max(subjectIds.length, 1)] || 'unknown',
    }));
    const normalizedSubject = selectedSubjectId === 'all' ? null : selectedSubjectId;
    return derivedRequests.filter((req) => {
      const subjectMatch = !normalizedSubject || req.subjectId === normalizedSubject;
      const typeMatch = requestType === 'all' || req.type === requestType;
      const query = searchQuery.trim().toLowerCase();
      const queryMatch = !query || req.topic.toLowerCase().includes(query);
      return subjectMatch && typeMatch && queryMatch;
    });
  }, [requestType, searchQuery, selectedSubjectId, subjects]);

  useEffect(() => {
    if (isCreateOpen) {
      const defaultSubject =
        selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || 'all');
      setNewRequestSubjectId(defaultSubject);
    }
  }, [isCreateOpen, selectedSubjectId, subjects]);

  const handleCloseModal = () => {
    setTopic('');
    setNote('');
    setPreferredTime('');
    setNewRequestType('need-help');
    onCloseCreate();
  };

  const handleSubmitRequest = () => {
    if (!topic.trim() || !note.trim()) return;
    handleCloseModal();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">Filters</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:ml-auto">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search topic"
                  className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <select
                value={requestType}
                onChange={(event) => setRequestType(event.target.value as any)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                <option value="all">All requests</option>
                <option value="need-help">Need help</option>
                <option value="offer-help">Offering help</option>
                <option value="study-group">Study group</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onOpenCreate}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-blue-700"
            >
              <PlusCircle className="w-4 h-4" />
              Create collaboration request
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6">
        <div className="bg-white rounded-2xl shadow p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Mastery & focus</h3>
              <p className="text-sm text-slate-500 mt-1">
                Based on recent results, here is where you are strongest and what to fix next.
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">Live snapshot</span>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Strengths</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Algebraic manipulation</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Graph interpretation</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Needs attention</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Word problems</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Geometry proofs</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
            Use peer study to compare strategies and explain your reasoning aloud.
          </div>
        </div>

        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{request.topic}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {subjectMap.get(request.subjectId) || 'Subject'} • {request.type.replace('-', ' ')}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {request.participants} participants
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-3">{request.note}</p>
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {request.preferredTime}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  Shared notes
                </span>
              </div>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <MessageCircle className="w-4 h-4" />
                Join request
              </button>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
              No collaboration requests match your filters yet.
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onClose={handleCloseModal} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              Create collaboration request
            </Dialog.Title>
            <p className="text-sm text-slate-500 mt-1">
              Set the topic, explain your need or offer, and share a preferred time.
            </p>
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={newRequestType}
                  onChange={(event) => setNewRequestType(event.target.value as PeerStudyRequest['type'])}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="need-help">Need help</option>
                  <option value="offer-help">Offer help</option>
                  <option value="study-group">Study group</option>
                </select>
                <select
                  value={newRequestSubjectId}
                  onChange={(event) => setNewRequestSubjectId(event.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Topic (e.g. Algebra: Linear Equations)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Explain what you need or what you can offer."
                className="w-full min-h-[120px] px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
              <input
                type="datetime-local"
                value={preferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRequest}
                disabled={!topic.trim() || !note.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
              >
                Post request
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default StudentPeerStudy;
