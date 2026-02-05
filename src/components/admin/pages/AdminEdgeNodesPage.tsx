import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Cpu, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import AdminSectionHeader from '../components/AdminSectionHeader';
import { AdminEdgeNode, adminService } from '../../../services/adminService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useToast } from '../../ui/use-toast';
import AdminConfirmDialog from '../components/AdminConfirmDialog';

interface EdgeNodeFormState {
  deviceId: string;
  status: 'active' | 'inactive' | 'retired';
  softwareVersion: string;
  location: string;
  ipAddress: string;
  hardwareModel: string;
  serialNumber: string;
  comments: string;
}

const defaultForm: EdgeNodeFormState = {
  deviceId: '',
  status: 'active',
  softwareVersion: '',
  location: '',
  ipAddress: '',
  hardwareModel: '',
  serialNumber: '',
  comments: '',
};

const EdgeNodesTableSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((__, colIndex) => (
          <div key={colIndex} className="h-9 rounded bg-slate-200 animate-pulse" />
        ))}
      </div>
    ))}
  </div>
);

const statusBadgeClass = (status?: string) => {
  if (status === 'active') return 'bg-blue-100 text-blue-700';
  if (status === 'inactive') return 'bg-amber-100 text-amber-700';
  if (status === 'retired') return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-700';
};

const toFriendlyError = (fallback: string, err?: any) => {
  const message = String(err?.message || '').toLowerCase();
  if (message.includes('no static resource') || message.includes('404')) {
    return 'Edge node endpoint not found. Restart the backend to load latest admin APIs.';
  }
  return err?.message || fallback;
};

const AdminEdgeNodesPage: React.FC = () => {
  const [edgeNodes, setEdgeNodes] = useState<AdminEdgeNode[]>([]);
  const [form, setForm] = useState<EdgeNodeFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edgeNodeToDelete, setEdgeNodeToDelete] = useState<AdminEdgeNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const filteredEdgeNodes = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return edgeNodes.filter((node) => {
      const matchesSearch =
        !normalized ||
        (node.deviceId || '').toLowerCase().includes(normalized) ||
        (node.softwareVersion || '').toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [edgeNodes, searchTerm, statusFilter]);

  const loadEdgeNodes = async () => {
    setLoading(true);
    try {
      const data = await adminService.getEdgeNodes();
      setEdgeNodes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const message = toFriendlyError('Unable to load edge node devices right now.', err);
      if (message) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEdgeNodes();
  }, []);

  const onChange = <K extends keyof EdgeNodeFormState>(key: K, value: EdgeNodeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const openEditModal = (node: AdminEdgeNode) => {
    setEditingId(node.id);
    setForm({
      deviceId: node.deviceId || '',
      status: (node.status as EdgeNodeFormState['status']) || 'active',
      softwareVersion: node.softwareVersion || '',
      location: node.location || '',
      ipAddress: node.ipAddress || '',
      hardwareModel: node.hardwareModel || '',
      serialNumber: node.serialNumber || '',
      comments: node.comments || '',
    });
    setIsFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.deviceId.trim()) {
      toast.error('Device ID is required.');
      return;
    }

    setSaving(true);
    try {
      const metadata: Record<string, unknown> = {
        location: form.location.trim() || null,
        ipAddress: form.ipAddress.trim() || null,
        hardwareModel: form.hardwareModel.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        comments: form.comments.trim() || null,
      };

      const payload = {
        deviceId: form.deviceId.trim(),
        status: form.status,
        softwareVersion: form.softwareVersion.trim() || undefined,
        metadata,
      };

      if (editingId) {
        const updated = await adminService.updateEdgeNode(editingId, payload);
        setEdgeNodes((prev) => prev.map((node) => (node.id === updated.id ? updated : node)));
        toast.success('Edge node updated successfully.');
      } else {
        const created = await adminService.registerEdgeNode(payload);
        setEdgeNodes((prev) => [created, ...prev.filter((node) => node.id !== created.id)]);
        toast.success('Edge node registered successfully.');
      }

      setIsFormOpen(false);
    } catch (err: any) {
      const message = toFriendlyError(
        editingId ? 'Unable to update edge node right now.' : 'Unable to register edge node right now.',
        err
      );
      if (message) {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const askDeleteEdgeNode = (node: AdminEdgeNode) => {
    setEdgeNodeToDelete(node);
  };

  const deleteEdgeNode = async () => {
    if (!edgeNodeToDelete) {
      return;
    }

    setSaving(true);
    try {
      await adminService.deleteEdgeNode(edgeNodeToDelete.id);
      setEdgeNodes((prev) => prev.filter((node) => node.id !== edgeNodeToDelete.id));
      setEdgeNodeToDelete(null);
      toast.success('Edge node deleted successfully.');
    } catch (err: any) {
      const message = toFriendlyError('Unable to delete edge node right now.', err);
      if (message) {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <AdminSectionHeader
        title="Edge Node Devices"
        description="Register and monitor school edge devices used for on-site AI and synchronization."
        icon={Cpu}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Edge Node Records</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadEdgeNodes}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md"
            >
              <Plus className="w-4 h-4" />
              Register Node
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            className="border rounded-md px-3 py-2 md:col-span-3"
            placeholder="Search device ID or software version"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
          </select>
        </div>

        {loading ? (
          <EdgeNodesTableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Device ID</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last Seen</th>
                  <th className="py-2 pr-4">Version</th>
                  <th className="py-2 pr-4">Active Deployments</th>
                  <th className="py-2 pr-4">Pending Outbox</th>
                  <th className="py-2 pr-4">Failed Inbox</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEdgeNodes.map((node) => (
                  <tr key={node.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium">{node.deviceId || '-'}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(node.status)}`}>
                        {node.status || '-'}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {node.lastSeenAt ? new Date(node.lastSeenAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-2 pr-4">{node.softwareVersion || '-'}</td>
                    <td className="py-2 pr-4">{node.activeDeployments || 0}</td>
                    <td className="py-2 pr-4">{node.pendingOutboxEvents || 0}</td>
                    <td className="py-2 pr-4">{node.failedInboxEvents || 0}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(node)}
                          className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => askDeleteEdgeNode(node)}
                          className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEdgeNodes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-gray-500">
                      No edge nodes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Edge Node' : 'Register Edge Node'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update edge node details and operational metadata.'
                : 'Add a school edge node device and capture operational details for monitoring.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Device ID *"
              value={form.deviceId}
              onChange={(e) => onChange('deviceId', e.target.value)}
            />
            <select
              className="border rounded-md px-3 py-2"
              value={form.status}
              onChange={(e) => onChange('status', e.target.value as EdgeNodeFormState['status'])}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
            </select>
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Software version"
              value={form.softwareVersion}
              onChange={(e) => onChange('softwareVersion', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Location (e.g. Lab A)"
              value={form.location}
              onChange={(e) => onChange('location', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="IP address"
              value={form.ipAddress}
              onChange={(e) => onChange('ipAddress', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Hardware model"
              value={form.hardwareModel}
              onChange={(e) => onChange('hardwareModel', e.target.value)}
            />
            <input
              className="md:col-span-2 border rounded-md px-3 py-2"
              placeholder="Serial number"
              value={form.serialNumber}
              onChange={(e) => onChange('serialNumber', e.target.value)}
            />
            <textarea
              className="md:col-span-2 border rounded-md px-3 py-2 min-h-24"
              placeholder="Extra details / comments"
              value={form.comments}
              onChange={(e) => onChange('comments', e.target.value)}
            />
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-5 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Register Node'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={!!edgeNodeToDelete}
        title="Delete Edge Node"
        description={`Delete edge node "${edgeNodeToDelete?.deviceId || ''}"? This performs a soft delete.`}
        confirmLabel="Delete Edge Node"
        busy={saving}
        onConfirm={deleteEdgeNode}
        onOpenChange={(open) => {
          if (!open) {
            setEdgeNodeToDelete(null);
          }
        }}
      />

      {!loading && edgeNodes.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-md px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>No edge node has been registered yet. Use “Register Node” to add your first device.</span>
        </div>
      )}
    </div>
  );
};

export default AdminEdgeNodesPage;
