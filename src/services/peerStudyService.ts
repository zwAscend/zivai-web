import { fetchData } from './http';

export type PeerStudyRequestType = 'need-help' | 'offer-help' | 'study-group';
export type PeerStudyRequestStatus = 'open' | 'filled' | 'closed' | 'cancelled';

export interface PeerStudyMember {
  userId?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  joinedAt?: string;
}

export interface PeerStudyRequestItem {
  id: string;
  subjectId?: string | null;
  subjectName?: string | null;
  topicId?: string | null;
  topic?: string | null;
  type: PeerStudyRequestType;
  note: string;
  preferredTime?: string | null;
  status: PeerStudyRequestStatus;
  maxParticipants?: number;
  participants?: number;
  createdById?: string | null;
  createdByName?: string | null;
  joined?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PeerStudyRequestDetail extends PeerStudyRequestItem {
  members: PeerStudyMember[];
}

interface ListPeerStudyRequestParams {
  subjectId?: string;
  topicId?: string;
  type?: PeerStudyRequestType;
  status?: PeerStudyRequestStatus;
  createdBy?: string;
  joinedBy?: string;
  forceRefresh?: boolean;
}

interface CreatePeerStudyRequestPayload {
  subjectId: string;
  topic?: string;
  topicId?: string;
  type: PeerStudyRequestType;
  note: string;
  preferredTime?: string;
  maxParticipants?: number;
  createdBy: string;
}

interface UpdatePeerStudyRequestPayload {
  subjectId?: string;
  topic?: string;
  topicId?: string;
  type?: PeerStudyRequestType;
  note?: string;
  preferredTime?: string;
  maxParticipants?: number;
  status?: PeerStudyRequestStatus;
}

const buildQuery = (params: Omit<ListPeerStudyRequestParams, 'forceRefresh'>) => {
  const query = new URLSearchParams();
  if (params.subjectId) query.set('subjectId', params.subjectId);
  if (params.topicId) query.set('topicId', params.topicId);
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  if (params.createdBy) query.set('createdBy', params.createdBy);
  if (params.joinedBy) query.set('joinedBy', params.joinedBy);
  return query.toString();
};

export const peerStudyService = {
  listRequests: async (params: ListPeerStudyRequestParams = {}): Promise<PeerStudyRequestItem[]> => {
    const { forceRefresh = false, ...queryParams } = params;
    const query = buildQuery(queryParams);
    return fetchData<PeerStudyRequestItem[]>(`/peer-study/requests${query ? `?${query}` : ''}`, {
      forceRefresh,
      cacheTtlMs: 15_000,
    });
  },

  getRequest: async (
    id: string,
    viewerId?: string,
    forceRefresh = false
  ): Promise<PeerStudyRequestDetail> => {
    const query = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : '';
    return fetchData<PeerStudyRequestDetail>(`/peer-study/requests/${id}${query}`, { forceRefresh });
  },

  createRequest: async (payload: CreatePeerStudyRequestPayload): Promise<PeerStudyRequestItem> =>
    fetchData<PeerStudyRequestItem>('/peer-study/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRequest: async (id: string, payload: UpdatePeerStudyRequestPayload): Promise<PeerStudyRequestItem> =>
    fetchData<PeerStudyRequestItem>(`/peer-study/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  joinRequest: async (id: string, studentId: string): Promise<PeerStudyRequestDetail> =>
    fetchData<PeerStudyRequestDetail>(`/peer-study/requests/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),
};
