import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface Engineer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  companyId: string;
  isActive: boolean;
}

export function EngineersPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [filteredEngineers, setFilteredEngineers] = useState<Engineer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });

  useEffect(() => {
    fetchEngineers();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEngineers(engineers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = engineers.filter(
        (engineer) =>
          engineer.fullName.toLowerCase().includes(query) ||
          engineer.email.toLowerCase().includes(query) ||
          engineer.phone.includes(query)
      );
      setFilteredEngineers(filtered);
    }
  }, [searchQuery, engineers]);

  const fetchEngineers = async () => {
    if (!user?.companyId) return;

    try {
      setIsLoading(true);

      // Fetch engineers for this company from auth.users via profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, created_at, company_id')
        .eq('company_id', user.companyId)
        .eq('role', 'engineer')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedEngineers: Engineer[] = (data || []).map((profile) => ({
        id: profile.id,
        fullName: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        createdAt: profile.created_at,
        companyId: profile.company_id,
        isActive: true,
      }));

      setEngineers(mappedEngineers);
      setFilteredEngineers(mappedEngineers);
    } catch (error: any) {
      console.error('Error fetching engineers:', error);
      toast.error('Failed to load engineers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEngineer = async () => {
    if (!user?.companyId) {
      toast.error('Company information not found');
      return;
    }

    // Validation
    if (!formData.fullName.trim()) {
      toast.error('Please enter engineer name');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter email address');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Call the create-engineer Edge Function
      const { data, error } = await supabase.functions.invoke('create-engineer', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone || null,
          companyId: user.companyId,
        },
      });

      // Check for errors in the response
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create engineer');
      }

      // Check if the response contains an error
      if (data?.error) {
        console.error('API error:', data.error);
        throw new Error(data.error);
      }

      // Check for success
      if (!data?.success) {
        throw new Error('Failed to create engineer - unexpected response');
      }

      toast.success('Engineer created successfully and welcome email sent!');
      setShowAddModal(false);
      resetForm();
      await fetchEngineers();
    } catch (error: any) {
      console.error('Error creating engineer:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to create engineer';
      
      if (error.message) {
        // Check for specific database errors
        if (error.message.includes('duplicate key') || error.message.includes('23505')) {
          errorMessage = 'An engineer with this email already exists';
        } else if (error.message.includes('invalid email')) {
          errorMessage = 'Invalid email address';
        } else if (error.message.includes('profiles_pkey')) {
          errorMessage = 'This user already exists in the system';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEngineer = async () => {
    if (!selectedEngineer) return;

    setIsLoading(true);

    try {
      // Delete the engineer account
      const { data, error } = await supabase.functions.invoke('delete-engineer', {
        body: { userId: selectedEngineer.id },
      });

      // Check for errors in the response
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to delete engineer');
      }

      // Check if the response contains an error
      if (data?.error) {
        console.error('API error:', data.error);
        throw new Error(data.error);
      }

      toast.success('Engineer deleted successfully');
      setShowDeleteModal(false);
      setSelectedEngineer(null);
      await fetchEngineers();
    } catch (error: any) {
      console.error('Error deleting engineer:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to delete engineer';
      
      if (error.message) {
        if (error.message.includes('not found')) {
          errorMessage = 'Engineer not found';
        } else if (error.message.includes('permission')) {
          errorMessage = 'You do not have permission to delete this engineer';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      password: '',
    });
    setShowPassword(false);
  };

  const openDeleteModal = (engineer: Engineer) => {
    setSelectedEngineer(engineer);
    setShowDeleteModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Engineers</h1>
          <p className="page-subtitle">Manage your installation engineers</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowAddModal(true)}
        >
          Add Engineer
        </Button>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search engineers by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
          />
        </div>
      </Card>

      {/* Engineers List */}
      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        </Card>
      ) : filteredEngineers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-700" />
            <p className="text-slate-400 mb-4">
              {searchQuery ? 'No engineers found matching your search' : 'No engineers yet'}
            </p>
            {!searchQuery && (
              <Button
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowAddModal(true)}
              >
                Add Your First Engineer
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEngineers.map((engineer) => (
            <Card key={engineer.id} className="hover:border-primary-500/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{engineer.fullName}</h3>
                    <Badge variant="primary" size="sm">Engineer</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span>{engineer.email}</span>
                </div>

                {engineer.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Phone className="w-4 h-4" />
                    <span>{engineer.phone}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {format(new Date(engineer.createdAt), 'dd MMM yyyy')}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {engineer.isActive ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-success-400" />
                      <span className="text-sm text-success-400">Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Inactive</span>
                    </>
                  )}
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => openDeleteModal(engineer)}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Engineer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add New Engineer"
        size="md"
      >
        <div className="space-y-6">
          <p className="text-slate-300 text-sm">
            Create a new engineer account for your company. They will be able to manage installations and upload documentation.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
              placeholder="+44 20 1234 5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none pr-12"
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The engineer will use this password to log in. They can change it later.
            </p>
          </div>

          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
            <p className="text-sm text-primary-300">
              💡 <strong>Note:</strong> The engineer will be automatically assigned to your company and will receive login credentials at the email address provided.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateEngineer}
              isLoading={isLoading}
              leftIcon={<Plus className="w-4 h-4" />}
              className="flex-1"
            >
              Create Engineer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedEngineer(null);
        }}
        onConfirm={handleDeleteEngineer}
        title="Remove Engineer"
        message={`Are you sure you want to remove ${selectedEngineer?.fullName}? This will delete their account and they will no longer be able to access the system.`}
        confirmText="Remove Engineer"
        variant="danger"
      />
    </div>
  );
}
