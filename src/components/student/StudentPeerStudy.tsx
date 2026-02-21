import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  MessageCircle,
  Calendar,
  BookOpen,
  PlusCircle,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Loader2,
} from 'lucide-react';
import { Subject } from '../../types';
import {
  peerStudyService,
  PeerStudyRequestItem,
  PeerStudyRequestType,
} from '../../services/peerStudyService';

type StudentPeerStudyProps = {
  studentId: string;
  selectedSubjectId: string;
  subjects: Subject[];
};

const formatRequestType = (value: PeerStudyRequestType) =>
  value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatPreferredTime = (value?: string | null) => {
  if (!value) return 'Flexible time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Flexible time';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const StudentPeerStudy: React.FC<StudentPeerStudyProps> = ({
  studentId,
  selectedSubjectId,
  subjects,
}) => {
  const [peerTab, setPeerTab] = useState<'create' | 'list'>('list');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestType, setRequestType] = useState<'all' | PeerStudyRequestType>('all');

  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [newRequestType, setNewRequestType] = useState<PeerStudyRequestType>('need-help');
  const [newRequestSubjectId, setNewRequestSubjectId] = useState<string>('all');

  const [requests, setRequests] = useState<PeerStudyRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [joiningRequestId, setJoiningRequestId] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );

  const fetchRequests = useCallback(
    async (forceRefresh = false) => {
      if (!studentId) return;
      setLoadingRequests(true);
      setRequestsError(null);

      try {
        const items = await peerStudyService.listRequests({
          subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
          type: requestType !== 'all' ? requestType : undefined,
          joinedBy: studentId,
          forceRefresh,
        });
        setRequests(items || []);
      } catch (error: any) {
        setRequests([]);
        setRequestsError(error?.message || 'Failed to load collaboration requests.');
      } finally {
        setLoadingRequests(false);
      }
    },
    [requestType, selectedSubjectId, studentId]
  );

  useEffect(() => {
    if (peerTab !== 'list') return;
    fetchRequests();
  }, [fetchRequests, peerTab]);

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

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((item) => String(item.topic || '').toLowerCase().includes(query));
  }, [requests, searchQuery]);

  const handleResetForm = () => {
    setTopic('');
    setNote('');
    setPreferredTime('');
    setNewRequestType('need-help');
    setCreateError(null);
  };

  const handleSubmitRequest = async () => {
    if (!topic.trim() || !note.trim() || !studentId) return;

    const subjectId =
      newRequestSubjectId !== 'all' && subjects.some((subject) => subject.id === newRequestSubjectId)
        ? newRequestSubjectId
        : (selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || ''));

    if (!subjectId) {
      setCreateError('Please select a subject before creating a request.');
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      await peerStudyService.createRequest({
        subjectId,
        topic: topic.trim(),
        type: newRequestType,
        note: note.trim(),
        preferredTime: preferredTime ? new Date(preferredTime).toISOString() : undefined,
        createdBy: studentId,
      });
      handleResetForm();
      setPeerTab('list');
      await fetchRequests(true);
    } catch (error: any) {
      setCreateError(error?.message || 'Failed to create collaboration request.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleJoinRequest = async (requestId: string) => {
    if (!studentId || !requestId) return;
    setJoiningRequestId(requestId);
    setRequestsError(null);

    try {
      await peerStudyService.joinRequest(requestId, studentId);
      await fetchRequests(true);
    } catch (error: any) {
      setRequestsError(error?.message || 'Failed to join collaboration request.');
    } finally {
      setJoiningRequestId(null);
    }
  };

  return (
    <div className="border border-slate-200 bg-white overflow-hidden">
      <div className={`grid grid-cols-1 min-h-[680px] ${isSidebarCollapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[280px_1fr]'}`}>
        <aside className="relative border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
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

          <nav className={`${isSidebarCollapsed ? '-mx-4 sm:-mx-5 border-y border-slate-200 bg-white overflow-hidden' : '-mx-4 sm:-mx-5 border-t border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setPeerTab('create')}
              title="Create Collaboration"
              className={`w-full inline-flex items-center text-sm transition ${
                isSidebarCollapsed
                  ? 'justify-center h-11 border-b border-slate-200'
                  : 'justify-between rounded-none border-b border-slate-200 px-4 sm:px-5 py-2.5'
              } ${
                peerTab === 'create'
                  ? isSidebarCollapsed
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-blue-50 border-l-4 border-l-blue-600 pl-2 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className={`inline-flex items-center min-w-0 ${isSidebarCollapsed ? '' : 'gap-2'}`}>
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    peerTab === 'create'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                </span>
                <span
                  className={`truncate transition-[max-width,opacity,transform] duration-200 ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
                  }`}
                >
                  Create Collaboration
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPeerTab('list')}
              title="Collaboration List"
              className={`w-full inline-flex items-center text-sm transition ${
                isSidebarCollapsed
                  ? 'justify-center h-11 border-b border-slate-200'
                  : 'justify-between rounded-none border-b border-slate-200 px-4 sm:px-5 py-2.5'
              } ${
                peerTab === 'list'
                  ? isSidebarCollapsed
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-blue-50 border-l-4 border-l-blue-600 pl-2 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className={`inline-flex items-center min-w-0 ${isSidebarCollapsed ? '' : 'gap-2'}`}>
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    peerTab === 'list'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </span>
                <span
                  className={`truncate transition-[max-width,opacity,transform] duration-200 ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1 overflow-hidden' : 'max-w-[180px] opacity-100 translate-x-0'
                  }`}
                >
                  Collaboration List
                </span>
              </span>
            </button>
          </nav>
        </aside>

        <section className="p-4 sm:p-6 space-y-4">
          {peerTab === 'create' && (
            <div className="border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-semibold text-slate-900">Create collaboration request</h3>
              <p className="text-sm text-slate-500 mt-1">
                Set the topic, explain your need or offer, and share a preferred time.
              </p>

              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={newRequestType}
                    onChange={(event) => setNewRequestType(event.target.value as PeerStudyRequestType)}
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
                    disabled={subjects.length === 0}
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

              {createError && (
                <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {createError}
                </div>
              )}

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
                  disabled={!topic.trim() || !note.trim() || createSubmitting || subjects.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  {createSubmitting ? 'Posting...' : 'Post request'}
                </button>
              </div>
            </div>
          )}

          {peerTab === 'list' && (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="relative w-full lg:max-w-lg">
                    <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search topic"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={requestType}
                      onChange={(event) => setRequestType(event.target.value as 'all' | PeerStudyRequestType)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="all">All requests</option>
                      <option value="need-help">Need help</option>
                      <option value="offer-help">Offering help</option>
                      <option value="study-group">Study group</option>
                    </select>

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

              {requestsError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {requestsError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6">
                <div className="border border-slate-200 bg-white p-6 space-y-5">
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
                  {loadingRequests ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-28 border border-slate-200 bg-white" />
                      <div className="h-28 border border-slate-200 bg-white" />
                      <div className="h-28 border border-slate-200 bg-white" />
                    </div>
                  ) : filteredRequests.length > 0 ? (
                    filteredRequests.map((request) => {
                      const isJoinDisabled =
                        !!request.joined ||
                        request.status !== 'open' ||
                        joiningRequestId === request.id;

                      return (
                        <div key={request.id} className="border border-slate-200 bg-white p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-800">{request.topic || 'Untitled topic'}</h3>
                              <p className="text-sm text-slate-500 mt-1">
                                {request.subjectName || subjectMap.get(request.subjectId || '') || 'Subject'} • {formatRequestType(request.type)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                {request.participants ?? 0} participants
                              </span>
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 capitalize">
                                {request.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 mt-3">{request.note}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatPreferredTime(request.preferredTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              Shared notes
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isJoinDisabled}
                            onClick={() => handleJoinRequest(request.id)}
                            className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {joiningRequestId === request.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Joining...
                              </>
                            ) : (
                              <>
                                <MessageCircle className="w-4 h-4" />
                                {request.joined
                                  ? 'Joined'
                                  : request.status === 'filled'
                                    ? 'Full'
                                    : request.status === 'closed' || request.status === 'cancelled'
                                      ? 'Closed'
                                      : 'Join request'}
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
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
