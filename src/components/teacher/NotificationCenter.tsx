import React, { useState, useEffect } from 'react';
import { Bell, X, Eye, CheckCircle, Clock, AlertCircle, FileText, User } from 'lucide-react';
import { notificationService, submissionService } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import SubmissionReviewModal from './SubmissionReviewModal';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications(1, 50);
      setNotifications(response.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleViewSubmission = async (notification: Notification) => {
    if (notification.data.submissionId) {
      setSelectedSubmission(notification.data.submissionId);
      setShowReviewModal(true);
      
      if (!notification.read) {
        await handleMarkAsRead(notification._id);
      }
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = priority === 'high' || priority === 'urgent' 
      ? 'text-red-500' 
      : priority === 'medium' 
        ? 'text-blue-500' 
        : 'text-gray-500';

    switch (type) {
      case 'assignment_graded':
        return <CheckCircle className={`w-5 h-5 ${iconClass}`} />;
      case 'assignment_submitted':
        return <FileText className={`w-5 h-5 ${iconClass}`} />;
      case 'plan_assigned':
        return <User className={`w-5 h-5 ${iconClass}`} />;
      default:
        return <Bell className={`w-5 h-5 ${iconClass}`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${
                    !notification.read ? 'bg-opacity-100' : 'bg-opacity-50'
                  } hover:bg-opacity-75 transition-colors cursor-pointer`}
                  onClick={() => {
                    if (notification.type === 'assignment_graded' || notification.type === 'assignment_submitted') {
                      handleViewSubmission(notification);
                    } else {
                      handleMarkAsRead(notification._id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-800' : 'text-gray-600'}`}>
                        {notification.message}
                      </p>
                      
                      {/* Additional data for assignment notifications */}
                      {notification.data && (notification.type === 'assignment_graded' || notification.type === 'assignment_submitted') && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          {notification.data.score && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Score: {notification.data.score}/{notification.data.maxScore}
                            </span>
                          )}
                          {notification.data.confidence && (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Confidence: {notification.data.confidence}%
                            </span>
                          )}
                        </div>
                      )}
                      
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={async () => {
              await notificationService.markAllAsRead();
              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }}
            className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Mark all as read
          </button>
        </div>
      </motion.div>

      {/* Submission Review Modal */}
      {showReviewModal && selectedSubmission && (
        <SubmissionReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedSubmission(null);
          }}
          submissionId={selectedSubmission}
          onReviewComplete={() => {
            fetchNotifications(); // Refresh notifications
          }}
        />
      )}
    </>
  );
};

export default NotificationCenter;