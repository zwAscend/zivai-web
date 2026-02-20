import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  MessageCircle,
  Calendar,
  BookOpen,
  PlusCircle,
  ChevronsLeft,
  ChevronsRight,
  Users,
} from 'lucide-react';
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
}) => {
  const [peerTab, setPeerTab] = useState<'create' | 'list'>('list');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestType, setRequestType] = useState<'all' | PeerStudyRequest['type']>('all');

  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [newRequestType, setNewRequestType] = useState<PeerStudyRequest['type']>('need-help');
  const [newRequestSubjectId, setNewRequestSubjectId] = useState<string>('all');
  const [customRequests, setCustomRequests] = useState<PeerStudyRequest[]>([]);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject.name]));
  }, [subjects]);

  const allRequests = useMemo(() => {
    const subjectIds = subjects.map((subject) => subject.id);
    const seededRequests: PeerStudyRequest[] = sampleRequestsTemplate.map((template, index) => ({
      ...template,
      subjectId: subjectIds[index % Math.max(subjectIds.length, 1)] || 'unknown',
    }));
    return [...customRequests, ...seededRequests];
  }, [customRequests, subjects]);

  const requests = useMemo(() => {
    const normalizedSubject = selectedSubjectId === 'all' ? null : selectedSubjectId;
    return allRequests.filter((req) => {
      const subjectMatch = !normalizedSubject || req.subjectId === normalizedSubject;
      const typeMatch = requestType === 'all' || req.type === requestType;
      const query = searchQuery.trim().toLowerCase();
      const queryMatch = !query || req.topic.toLowerCase().includes(query);
      return subjectMatch && typeMatch && queryMatch;
    });
  }, [allRequests, requestType, searchQuery, selectedSubjectId]);

  useEffect(() => {
    const defaultSubject =
      selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || 'all');

    if (!newRequestSubjectId || newRequestSubjectId === 'all') {
      setNewRequestSubjectId(defaultSubject);
      return;
    }

    if (!subjects.some((subject) => subject.id === newRequestSubjectId)) {
      setNewRequestSubjectId(defaultSubject);
    }
  }, [newRequestSubjectId, selectedSubjectId, subjects]);

  const handleResetForm = () => {
    setTopic('');
    setNote('');
    setPreferredTime('');
    setNewRequestType('need-help');
  };

  const handleSubmitRequest = () => {
    if (!topic.trim() || !note.trim()) return;

    const subjectId =
      newRequestSubjectId !== 'all' && subjects.some((subject) => subject.id === newRequestSubjectId)
        ? newRequestSubjectId
        : (selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || 'unknown'));

    const formattedTime = preferredTime
      ? new Date(preferredTime).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'Flexible time';

    const nextRequest: PeerStudyRequest = {
      id: `req-${Date.now()}`,
      topic: topic.trim(),
      subjectId,
      type: newRequestType,
      note: note.trim(),
      preferredTime: formattedTime,
      participants: 1,
    };

    setCustomRequests((prev) => [nextRequest, ...prev]);
    handleResetForm();
    setPeerTab('list');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className={`grid grid-cols-1 min-h-[640px] ${isSidebarCollapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[260px_1fr]'}`}>
        <aside className="relative border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="hidden lg:inline-flex absolute top-1/2 -translate-y-1/2 -right-4 z-10 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label={isSidebarCollapsed ? 'Expand peer study panel' : 'Collapse peer study panel'}
          >
            {isSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>

          <p
            className={`text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold transition-[max-width,opacity,transform] duration-200 ${
              isSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
            }`}
          >
            Peer Study
          </p>

          <nav className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setPeerTab('create')}
              title="Create Collaboration"
              className={`w-full inline-flex items-center rounded-md py-2 text-sm font-medium transition ${
                isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'
              } ${
                peerTab === 'create'
                  ? 'bg-blue-50 border border-blue-100 text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span
                className={`truncate transition-[max-width,opacity,transform] duration-200 ${
                  isSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
                }`}
              >
                Create Collaboration
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPeerTab('list')}
              title="Collaboration List"
              className={`w-full inline-flex items-center rounded-md py-2 text-sm font-medium transition ${
                isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'
              } ${
                peerTab === 'list'
                  ? 'bg-blue-50 border border-blue-100 text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span
                className={`truncate transition-[max-width,opacity,transform] duration-200 ${
                  isSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
                }`}
              >
                Collaboration List
              </span>
            </button>
          </nav>
        </aside>

        <section className="p-4 sm:p-6 space-y-4">
          {peerTab === 'create' && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-semibold text-slate-900">Create collaboration request</h3>
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
                  onClick={handleResetForm}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={!topic.trim() || !note.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
                >
                  <PlusCircle className="w-4 h-4" />
                  Post request
                </button>
              </div>
            </div>
          )}

          {peerTab === 'list' && (
            <>
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
                        onChange={(event) => setRequestType(event.target.value as 'all' | PeerStudyRequest['type'])}
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
                      onClick={() => setPeerTab('create')}
                      className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Create collaboration
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
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default StudentPeerStudy;
