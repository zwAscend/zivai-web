import React, { useState } from 'react';
import { Message } from '../../types';
import { messages } from '../../data/mockData';
import { Inbox as InboxIcon, Users } from 'lucide-react';

const Inbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(messages[0]);

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
          {messages.map((message) => (
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
          ))}
        </div>
      </div>

      {/* Right Side - Message Content */}
      <div className="w-3/5 bg-white p-6 overflow-y-auto">
        {selectedMessage && (
          <>
            <div className="flex mb-4 items-center">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mr-4">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedMessage.sender === 'Eujin Blank' ? 'Eujin' : selectedMessage.sender}</h3>
                <p className="text-gray-600">Blank</p>
              </div>
              <div className="ml-auto flex">
                <button className="mx-2 text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button className="mx-2 text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">{selectedMessage.title}</h2>
              
              {selectedMessage.fullContent ? (
                <div className="whitespace-pre-line">
                  {selectedMessage.fullContent.split('\n').map((line, i) => (
                    <p key={i} className="mb-4">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-700">{selectedMessage.preview}</p>
              )}
            </div>

            <div className="flex gap-4 mt-12">
              <button className="bg-blue-500 text-white rounded-md py-2 px-8 hover:bg-blue-600 transition-colors">
                Reply
              </button>
              <button className="bg-blue-500 text-white rounded-md py-2 px-8 hover:bg-blue-600 transition-colors">
                Forward
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Inbox;