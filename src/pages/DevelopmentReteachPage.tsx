import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reteachCardService, studentService, subjectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student, Subject } from '../types';
import DevelopmentLayout from '../components/development/DevelopmentLayout';
import type { ReteachCardSummary } from '../services/reteachCardService';

interface ReteachCard {
  id: string;
  topic: string;
  subject: string;
  priority: 'High' | 'Normal';
  students: Student[];
  planName: string;
  notes: string;
  affectedCount: number;
}

const DevelopmentReteachPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cards, setCards] = useState<ReteachCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (!subjectFilter && selectedSubject?.id) {
          setSubjectFilter(selectedSubject.id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, [selectedSubject?.id]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cardsData, studentsData] = await Promise.all([
          reteachCardService.list({
            subjectId: subjectFilter || undefined,
            priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          }),
          studentService.getStudents(subjectFilter || undefined),
        ]);
        setCards(Array.isArray(cardsData) ? cardsData : []);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
      } catch (error) {
        console.error('Failed to load students for reteach cards:', error);
        setCards([]);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [subjectFilter, priorityFilter]);

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((student) => {
      map.set(student.id, student);
    });
    return map;
  }, [students]);

  const reteachCards = useMemo(() => {
    return cards.map((card) => {
      const matchedStudents = (card.affectedStudentIds || [])
        .map((id) => studentsById.get(id))
        .filter(Boolean) as Student[];
      const subjectLabel = card.subjectName || 'Selected Subject';
      const topicLabel = card.topicName || card.title || 'Topic';
      const priorityLabel = card.priority?.toLowerCase() === 'high' ? 'High' : 'Normal';
      return {
        id: card.id,
        topic: topicLabel,
        subject: subjectLabel,
        priority: priorityLabel,
        students: matchedStudents,
        planName: card.recommendedActions || 'Targeted Plan',
        notes: card.issueSummary || 'Re-teach the core misconception, run a short check, then update mastery status.',
        affectedCount: card.affectedStudents ?? matchedStudents.length,
      } as ReteachCard;
    });
  }, [cards, studentsById]);

  const filteredCards = useMemo(() => {
    const search = query.trim().toLowerCase();
    return reteachCards.filter((card) => {
      const matchesPriority = priorityFilter === 'all' || card.priority.toLowerCase() === priorityFilter;
      const matchesSearch = !search || card.topic.toLowerCase().includes(search) || card.students.some((student) => {
        const name = `${student.firstName} ${student.lastName}`.toLowerCase();
        return name.includes(search);
      });
      return matchesPriority && matchesSearch;
    });
  }, [reteachCards, priorityFilter, query]);

  return (
    <DevelopmentLayout>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Re-teach Cards</h2>
          <p className="text-sm text-slate-500">
            Focused remediation scripts per topic, highlighting students who need targeted support.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topic or student"
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="normal">Normal priority</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="space-y-3">
            {filteredCards.map((card) => {
              return (
                <div key={card.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{card.topic}</p>
                      <p className="text-xs text-slate-500">Subject: {card.subject}</p>
                      <p className="text-xs text-slate-500 mt-1">{card.affectedCount} students affected</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${card.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}
                      >
                        {card.priority} priority
                      </span>
                      <button
                        onClick={() => navigate(`/development/reteach/${card.id}`, { state: { card } })}
                        className="text-xs text-blue-600 hover:text-blue-700"
                        type="button"
                      >
                        View more
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-3">{card.notes}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No re-teach cards available for the selected filters.</div>
        )}
      </div>
    </DevelopmentLayout>
  );
};

export default DevelopmentReteachPage;
