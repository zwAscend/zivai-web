import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { Mic, Image, Smile } from 'lucide-react';

interface StudentChatProps {
  studentId: string;
  studentName: string;
}

const StudentChat: React.FC<StudentChatProps> = ({ studentId, studentName }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: studentName,
      content: 'Would it be possible to get an extension?',
      timestamp: '09:41 AM',
    },
    {
      id: '2',
      sender: studentName,
      content: "I'm facing some challenges with the research.",
      timestamp: '09:42 AM',
    },
    {
      id: '3',
      sender: 'Mr. Blank',
      content: 'I appreciate you reaching out in advance. If you are facing significant challenges, I can grant an extension until Wednesday at 11:59 PM. However, please provide a brief explanation of your difficulties so I can assess the request.',
      timestamp: '09:43 AM',
      isTeacher: true,
    }
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newMessage: ChatMessage = {
      id: String(Date.now()),
      sender: 'Mr. Blank',
      content: message,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      isTeacher: true,
    };

    setMessages([...messages, newMessage]);
    setMessage('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-lg shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mr-3">
            <div className="text-white text-xs">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold">{studentName}</h2>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Online</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-4">
          <button className="text-gray-600 hover:text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button className="text-gray-600 hover:text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Reminder Banner */}
      <div className="bg-teal-600 text-white p-4">
        <p className="font-medium">
          <span className="font-bold">Reminder:</span> Your assignment on Network Security is due Monday at 11:59 PM. Ensure you submit it via the LMS before the deadline
        </p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isTeacher ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.isTeacher
                  ? 'bg-black text-white'
                  : 'bg-gray-100'
              }`}
            >
              <p>{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">{msg.timestamp}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message"
              className="w-full px-4 py-2 rounded-full border focus:outline-none focus:border-blue-500"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <button type="button" className="text-gray-500 hover:text-gray-700">
                <Mic size={20} />
              </button>
              <button type="button" className="text-gray-500 hover:text-gray-700">
                <Image size={20} />
              </button>
              <button type="button" className="text-gray-500 hover:text-gray-700">
                <Smile size={20} />
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudentChat;