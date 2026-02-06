import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatMessage } from '../../types';
import { authService, chatService, UnreadChatCount } from '../../services/api';
import { Inbox as InboxIcon, Users } from 'lucide-react';
import { getChatWsUrl } from '../../utils/ws';

interface InboxMessage {
  id: string;
  sender: string;
  title: string;
  preview: string;
  time: string;
  read: boolean;
  fullContent?: string;
  studentId: string;
}

const Inbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inbox');
  const [threads, setThreads] = useState<UnreadChatCount[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const currentUser = authService.getCurrentUser();
  const wsUrl = useMemo(() => getChatWsUrl(), []);
  const location = useLocation();
  const preselectedStudentId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('studentId') || '';
  }, [location.search]);

  useEffect(() => {
    const loadThreads = async () => {
      try {
        const data = await chatService.getUnreadCounts();
        setThreads(data);
        if (data.length > 0) {
          const preferred = preselectedStudentId
            ? data.find((thread) => thread.studentId === preselectedStudentId)
            : undefined;
          const first = preferred || data[0];
          setSelectedMessage(toInboxMessage(first, []));
        }
      } catch (error) {
        console.error('Failed to load chat threads:', error);
      } finally {
        setLoading(false);
      }
    };
    loadThreads();
  }, [preselectedStudentId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedMessage) {
        setConversation([]);
        return;
      }
      try {
        const messages = await chatService.getMessages(selectedMessage.studentId);
        setConversation(messages);
        const updated = toInboxMessage(
          {
            studentId: selectedMessage.studentId,
            studentName: selectedMessage.sender,
            unreadCount: selectedMessage.read ? 0 : 1,
            lastMessage: messages[messages.length - 1]?.content,
            lastMessageTime: messages[messages.length - 1]?.timestamp,
          },
          messages
        );
        setSelectedMessage(updated);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };
    loadMessages();
  }, [selectedMessage?.studentId]);

  useEffect(() => {
    if (!selectedMessage?.studentId || !wsUrl) {
      return;
    }

    const socket = new WebSocket(`${wsUrl}?studentId=${selectedMessage.studentId}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ChatMessage;
        setConversation((prev) => {
          if (prev.some((message) => message.id === payload.id)) {
            return prev;
          }
          return [...prev, payload];
        });
        setThreads((prev) =>
          prev.map((thread) =>
            thread.studentId === selectedMessage.studentId
              ? {
                  ...thread,
                  lastMessage: payload.content,
                  lastMessageTime: payload.timestamp,
                  unreadCount: payload.isTeacher ? thread.unreadCount : thread.unreadCount + 1,
                }
              : thread
          )
        );
      } catch (error) {
        console.error('Failed to parse socket message:', error);
      }
    };

    return () => {
      socket.close();
    };
  }, [selectedMessage?.studentId, wsUrl]);

  const toInboxMessage = (thread: UnreadChatCount, messages: ChatMessage[]): InboxMessage => {
    const lastMessage = thread.lastMessage || messages[messages.length - 1]?.content || 'No messages yet.';
    const lastTimeRaw = thread.lastMessageTime || messages[messages.length - 1]?.timestamp;
    const time = lastTimeRaw ? new Date(lastTimeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const fullContent = messages.length > 0
      ? messages.map(msg => `${msg.sender.firstName} ${msg.sender.lastName}: ${msg.content}`).join('\n\n')
      : undefined;

    return {
      id: thread.studentId,
      studentId: thread.studentId,
      sender: thread.studentName || 'Student',
      title: lastMessage.length > 60 ? `${lastMessage.slice(0, 60)}...` : lastMessage,
      preview: lastMessage,
      time,
      read: thread.unreadCount === 0,
      fullContent,
    };
  };

  const sortedConversation = [...conversation].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !draftMessage.trim() || sending) {
      return;
    }
    setSending(true);
    try {
      const sent = await chatService.sendMessage(selectedMessage.studentId, draftMessage.trim(), currentUser?.id);
      setConversation((prev) => [...prev, sent]);
      setThreads((prev) =>
        prev.map((thread) =>
          thread.studentId === selectedMessage.studentId
            ? { ...thread, lastMessage: sent.content, lastMessageTime: sent.timestamp }
            : thread
        )
      );
      setDraftMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)]">
      {/* Left Side - Message List */}
      <div className="w-2/5 bg-white border-r overflow-y-auto">
        <div className="flex border-b">
          <button
            className={`flex-1 py-3 flex justify-center items-center ${
              activeTab === 'inbox' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
            onClick={() => setActiveTab('inbox')}
          >
            <InboxIcon size={18} className="mr-2" />
            <span>INBOX</span>
          </button>
          <button
            className={`flex-1 py-3 flex justify-center items-center ${
              activeTab === 'chat' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
            onClick={() => setActiveTab('chat')}
          >
            <Users size={18} className="mr-2" />
            <span>STUDENT CHAT</span>
          </button>
        </div>

        <div className="divide-y">
          {loading && (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-blue-100 rounded animate-pulse" />
                    <div className="h-3 w-40 bg-blue-100 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-blue-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && threads.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No messages yet.</div>
          )}
          {!loading && threads.map((thread) => {
            const message = toInboxMessage(thread, []);
            return (
            <div
              key={message.id}
              className={`p-4 hover:bg-gray-100 cursor-pointer ${
                selectedMessage?.id === message.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => setSelectedMessage(message)}
            >
              <div className="flex items-start">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${!message.read ? 'font-bold' : ''}`}>
                    {message.sender}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{message.title}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{message.preview}</p>
                </div>
                <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {message.time}
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Right Side - Chat Thread */}
      <div className="w-3/5 bg-white p-6 flex flex-col">
        {!selectedMessage && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting.
          </div>
        )}
        {selectedMessage && (
          <>
            <div className="flex items-center border-b pb-4">
              <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedMessage.sender}</h3>
                <p className="text-sm text-gray-500">Student chat</p>
              </div>
              <div className="ml-auto text-xs text-gray-400">
                {wsUrl ? 'Live' : 'Offline'}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {sortedConversation.length === 0 && (
                <div className="text-sm text-gray-500">No messages yet. Start the conversation.</div>
              )}
              {sortedConversation.map((message) => {
                const isOwn = message.sender?.id && currentUser?.id
                  ? message.sender.id === currentUser.id
                  : message.isTeacher === true;
                return (
                  <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-line">{message.content}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="border-t pt-4 flex gap-2">
              <input
                type="text"
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!draftMessage.trim() || sending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Inbox;
