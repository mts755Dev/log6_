import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search,
  Plus,
  Edit,
  Trash2,
  Shield,
  Wrench,
  UserCheck,
  MoreVertical,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { useData } from '../../contexts/DataContext';
import { format } from 'date-fns';
import type { User } from '../../types';

export function UsersPage() {
  const { users, companies } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && u.role === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All Users', badge: users.length },
    { id: 'admin', label: 'Admins', icon: <Shield className="w-4 h-4" />, badge: users.filter(u => u.role === 'admin').length },
    { id: 'installer', label: 'Installers', icon: <Wrench className="w-4 h-4" />, badge: users.filter(u => u.role === 'installer').length },
    { id: 'assessor', label: 'Assessors', icon: <UserCheck className="w-4 h-4" />, badge: users.filter(u => u.role === 'assessor').length },
  ];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'installer': return <Wrench className="w-4 h-4" />;
      case 'assessor': return <UserCheck className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): 'primary' | 'success' | 'warning' => {
    switch (role) {
      case 'admin': return 'primary';
      case 'installer': return 'success';
      case 'assessor': return 'warning';
      default: return 'primary';
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 font-medium">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-white">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => (
        <Badge variant={getRoleBadgeVariant(user.role)}>
          <span className="flex items-center gap-1">
            {getRoleIcon(user.role)}
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
        </Badge>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      render: (user: User) => (
        <span className="text-slate-300">{user.companyName}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <Badge variant={user.isActive ? 'success' : 'danger'}>
          {user.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (user: User) => (
        <span className="text-slate-400">
          {format(new Date(user.lastLogin), 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (user: User) => (
        <div className="flex items-center gap-1 justify-end">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage platform users and permissions</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />
        </div>
      </Card>

      {/* Users Table */}
      <Table
        columns={columns}
        data={filteredUsers}
        keyExtractor={(user) => user.id}
        emptyMessage="No users found"
      />
    </div>
  );
}

