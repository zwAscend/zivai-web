import React, { useMemo, useState } from 'react';
import { Users, Search, PlusCircle, MessageCircle, Calendar, BookOpen } from 'lucide-react';
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

const StudentPeerStudy: React.FC<StudentPeerStudyProps> = ({ selectedSubjectId, subjects }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [requestType, setRequestType] = useState<'all' | PeerStudyRequest['type']>('all');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [preferredTime, setPreferredTime] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Peer Study</h2>
            <p className="text-gray-600">
              Collaborate with classmates on specific topics, explain solutions, and learn together.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            Study circles & collaboration requests
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">Filters</div>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <PlusCircle className="w-4 h-4 text-blue-600" />
            Create collaboration request
          </div>
          <div className="space-y-3">
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
              value={preferredTime}
              onChange={(event) => setPreferredTime(event.target.value)}
              placeholder="Preferred time (e.g. Wed 6pm)"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <button
              type="button"
              className="w-full bg-blue-600 text-white text-sm font-semibold py-2 rounded-md hover:bg-blue-700"
            >
              Post Request
            </button>
            <p className="text-xs text-slate-500">
              Use collaboration to compare strategies and refine reasoning.
            </p>
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
    </div>
  );
};

export default StudentPeerStudy;
