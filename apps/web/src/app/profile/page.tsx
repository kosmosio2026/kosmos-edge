'use client';

import { useAuth } from '@/components/providers/auth-provider';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-bold">Profile</h1>
      <div>ID: {user.id}</div>
      <div>Name: {user.name}</div>
      <div>Roles: {user.roles.join(', ')}</div>
    </div>
  );
}