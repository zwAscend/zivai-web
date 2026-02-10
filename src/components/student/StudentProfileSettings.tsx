import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Mail, Save, UserCircle } from 'lucide-react';
import { Student } from '../../types';
import { studentService } from '../../services/api';

interface StudentProfileSettingsProps {
  student: Student;
  onStudentUpdated: (student: Student) => void;
}

const StudentProfileSettings: React.FC<StudentProfileSettingsProps> = ({ student, onStudentUpdated }) => {
  const [formData, setFormData] = useState({
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    email: student.email || '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(student.avatar || null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const avatarInitials = useMemo(() => {
    const first = formData.firstName?.[0] || '';
    const last = formData.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'S';
  }, [formData.firstName, formData.lastName]);

  useEffect(() => {
    setFormData({
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: student.email || '',
    });
    setAvatarPreview(student.avatar || null);
    setPendingAvatar(null);
  }, [student]);

  const handleInputChange = (field: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      setPendingAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        avatar: pendingAvatar ?? student.avatar ?? undefined,
      };
      const updated = await studentService.updateStudent(student.id, payload);
      onStudentUpdated(updated);
      setPendingAvatar(null);
    } catch (err) {
      console.error('Failed to update student profile', err);
      setError('Unable to save changes right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <UserCircle className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Profile Details</h2>
              <p className="text-sm text-slate-500">Keep your information accurate for feedback and reports.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-slate-600 font-semibold">
              First name
              <input
                value={formData.firstName}
                onChange={handleInputChange('firstName')}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="text-sm text-slate-600 font-semibold">
              Last name
              <input
                value={formData.lastName}
                onChange={handleInputChange('lastName')}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="text-sm text-slate-600 font-semibold md:col-span-2">
              Email
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <input
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  className="w-full text-sm text-slate-700 focus:outline-none"
                />
              </div>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Camera className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Avatar</h2>
                <p className="text-sm text-slate-500">Pick a profile image so teachers can recognize you.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="w-20 h-20 rounded-full border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center text-lg font-semibold text-slate-600"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Student avatar preview" className="w-full h-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </button>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Change avatar
                </button>
                <p className="text-xs text-slate-500">Upload a clear photo or avatar you like.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          <div className="mt-6">
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileSettings;
