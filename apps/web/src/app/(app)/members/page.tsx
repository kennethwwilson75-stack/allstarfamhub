'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Pencil, Trash2, GraduationCap, School } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import type { FamilyMember, MemberRole } from '@allstarfamhub/shared';

const MEMBER_COLORS = [
  '#1D9E75', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#06B6D4', '#84CC16',
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  PARENT: 'Parent',
  CHILD: 'Child',
};

export default function MembersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<MemberRole>('CHILD');
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [grade, setGrade] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data } = await api.get<FamilyMember[]>('/members');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/members', {
        displayName,
        role,
        color,
        grade: grade || undefined,
        schoolName: schoolName || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/members/${id}`, {
        displayName,
        role,
        color,
        grade: grade || undefined,
        schoolName: schoolName || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  function openCreate() {
    setEditing(null);
    setDisplayName('');
    setRole('CHILD');
    setColor(MEMBER_COLORS[members?.length ? members.length % MEMBER_COLORS.length : 0]);
    setGrade('');
    setSchoolName('');
    setModalOpen(true);
  }

  function openEdit(member: FamilyMember) {
    setEditing(member);
    setDisplayName(member.displayName);
    setRole(member.role);
    setColor(member.color);
    setGrade(member.grade ?? '');
    setSchoolName(member.schoolName ?? '');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate(editing.id);
    } else {
      createMutation.mutate();
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Family Members
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage who&apos;s in your family hub
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Member
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members && members.length > 0 ? (
        <div className="space-y-3">
          {members.map((member) => (
            <Card key={member.id}>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{member.displayName}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                    {member.grade && (
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Grade {member.grade}
                      </span>
                    )}
                    {member.schoolName && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <School className="h-3.5 w-3.5 flex-shrink-0" />
                        {member.schoolName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(member)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${member.displayName} from the family?`)) {
                        deleteMutation.mutate(member.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-danger" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No family members yet</p>
            <Button onClick={openCreate} variant="secondary" className="mt-4">
              <Plus className="h-4 w-4 mr-1.5" />
              Add your first member
            </Button>
          </div>
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Member' : 'Add Member'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="displayName"
            label="Name"
            placeholder="Emma"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              <option value="ADMIN">Admin (Parent/Guardian)</option>
              <option value="PARENT">Parent</option>
              <option value="CHILD">Child</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <div className="flex gap-2">
              {MEMBER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <Input
            id="grade"
            label="Grade (optional)"
            placeholder="6, 10, K..."
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />

          <Input
            id="schoolName"
            label="School (optional)"
            placeholder="Lincoln Middle School"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
            >
              {editing ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
