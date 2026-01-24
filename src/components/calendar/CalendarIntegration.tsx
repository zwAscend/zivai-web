import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Download, Upload, Link, Settings, FolderSync as Sync, CheckCircle, AlertCircle, ExternalLink, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/use-toast';

interface CalendarIntegrationProps {
  onClose: () => void;
}

const CalendarIntegration: React.FC<CalendarIntegrationProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState({
    googleCalendar: { connected: false, email: '' },
    outlookCalendar: { connected: false, email: '' },
    appleCalendar: { connected: false, email: '' }
  });
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleConnect = async (provider: string) => {
    try {
      setSyncInProgress(true);
      
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIntegrations(prev => ({
        ...prev,
        [provider]: {
          connected: true,
          email: 'user@example.com'
        }
      }));
      
      toast.success(`Successfully connected to ${provider.replace('Calendar', ' Calendar')}`);
    } catch (error) {
      toast.error(`Failed to connect to ${provider.replace('Calendar', ' Calendar')}`);
    } finally {
      setSyncInProgress(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      setIntegrations(prev => ({
        ...prev,
        [provider]: {
          connected: false,
          email: ''
        }
      }));
      
      toast.success(`Disconnected from ${provider.replace('Calendar', ' Calendar')}`);
    } catch (error) {
      toast.error(`Failed to disconnect from ${provider.replace('Calendar', ' Calendar')}`);
    }
  };

  const handleSync = async () => {
    try {
      setSyncInProgress(true);
      
      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setLastSync(new Date());
      toast.success('Calendar sync completed successfully');
    } catch (error) {
      toast.error('Calendar sync failed');
    } finally {
      setSyncInProgress(false);
    }
  };

  const exportCalendar = () => {
    // Create ICS file content
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Educational Management System//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:sample-event@ems.edu
DTSTART:20250325T090000Z
DTEND:20250325T103000Z
SUMMARY:Network Security Lecture
DESCRIPTION:Introduction to Firewalls and Intrusion Detection Systems
LOCATION:Room 101
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `academic-calendar-${new Date().toISOString().split('T')[0]}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Calendar exported successfully');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Calendar Integration</h2>
              <p className="text-blue-100 mt-1">Connect and sync with external calendars</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Calendar Providers */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">External Calendar Providers</h3>
          
          <div className="grid gap-4">
            {/* Google Calendar */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Google Calendar</h4>
                    <p className="text-sm text-gray-600">
                      {integrations.googleCalendar.connected 
                        ? `Connected as ${integrations.googleCalendar.email}`
                        : 'Sync events with Google Calendar'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {integrations.googleCalendar.connected && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  <Button
                    variant={integrations.googleCalendar.connected ? "outline" : "default"}
                    size="sm"
                    onClick={() => integrations.googleCalendar.connected 
                      ? handleDisconnect('googleCalendar')
                      : handleConnect('googleCalendar')
                    }
                    disabled={syncInProgress}
                  >
                    {integrations.googleCalendar.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Outlook Calendar */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Outlook Calendar</h4>
                    <p className="text-sm text-gray-600">
                      {integrations.outlookCalendar.connected 
                        ? `Connected as ${integrations.outlookCalendar.email}`
                        : 'Sync events with Microsoft Outlook'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {integrations.outlookCalendar.connected && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  <Button
                    variant={integrations.outlookCalendar.connected ? "outline" : "default"}
                    size="sm"
                    onClick={() => integrations.outlookCalendar.connected 
                      ? handleDisconnect('outlookCalendar')
                      : handleConnect('outlookCalendar')
                    }
                    disabled={syncInProgress}
                  >
                    {integrations.outlookCalendar.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Apple Calendar */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Apple Calendar</h4>
                    <p className="text-sm text-gray-600">
                      {integrations.appleCalendar.connected 
                        ? `Connected as ${integrations.appleCalendar.email}`
                        : 'Sync events with Apple Calendar (iCal)'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {integrations.appleCalendar.connected && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  <Button
                    variant={integrations.appleCalendar.connected ? "outline" : "default"}
                    size="sm"
                    onClick={() => integrations.appleCalendar.connected 
                      ? handleDisconnect('appleCalendar')
                      : handleConnect('appleCalendar')
                    }
                    disabled={syncInProgress}
                  >
                    {integrations.appleCalendar.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Sync Settings</h3>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Auto Sync</h4>
                <p className="text-sm text-gray-600">
                  Automatically sync events every hour
                  {lastSync && (
                    <span className="block mt-1">
                      Last sync: {lastSync.toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <Button
                onClick={handleSync}
                disabled={syncInProgress}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {syncInProgress ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    <Sync className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Export/Import */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Export & Import</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Download className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Export Calendar</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Download your calendar as an ICS file to import into other applications
              </p>
              <Button
                variant="outline"
                onClick={exportCalendar}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as ICS
              </Button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Upload className="w-5 h-5 text-blue-600" />
                <h4 className="font-medium text-gray-900">Import Calendar</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Import events from an ICS file or CSV format
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.ics,.csv';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      toast.success(`Importing ${file.name}...`);
                      // Handle file import logic here
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Events
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Sharing */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Calendar Sharing</h3>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Public Calendar Link</h4>
                <p className="text-sm text-gray-600">
                  Share a read-only view of your calendar with students
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                <Link className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Input
                value="https://calendar.ems.edu/public/teacher123"
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText('https://calendar.ems.edu/public/teacher123');
                  toast.success('Link copied to clipboard');
                }}
              >
                Copy
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('https://calendar.ems.edu/public/teacher123', '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Settings className="w-4 h-4 mr-2" />
            Advanced Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalendarIntegration;