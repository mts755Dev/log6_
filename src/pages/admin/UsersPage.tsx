import { useState, useEffect } from 'react';
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
  Ban,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Calendar,
  Download,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { FileUpload } from '../../components/ui/FileUpload';
import { FileUploadWithDates } from '../../components/ui/FileUploadWithDates';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { uploadDocument, saveDocumentMetadata, getNextDocumentVersion } from '../../lib/storage';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import type { User, UserRole } from '../../types';

interface ProfileData {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  company_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InstallerDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  version: number;
  issued_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

interface InstallerSettings {
  use_external_waste_carrier: boolean;
}

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInstallerDetailsModalOpen, setIsInstallerDetailsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [installerDocuments, setInstallerDocuments] = useState<InstallerDocument[]>([]);
  const [installerSettings, setInstallerSettings] = useState<InstallerSettings | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'installer' as UserRole,
    phone: '',
    isActive: true,
  });
  
  const [addUserStep, setAddUserStep] = useState(0);
  const [installerDocumentsForm, setInstallerDocumentsForm] = useState({
    competencyCards: { file: null as File | null, issuedDate: '', expiryDate: '' },
    certificates: null as File | null,
    insurance: null as File | null,
    mcsCertificate: null as File | null,
    consumerCode: null as File | null,
    insuranceBackedGuarantee: null as File | null,
    useExternalWasteCarrier: '',
    wasteLicense: null as File | null,
  });

  // Fetch users from Supabase
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedUsers: User[] = (data as ProfileData[]).map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email.split('@')[0],
        role: profile.role,
        companyId: profile.company_id,
        companyName: 'heliOS Platform', // You can fetch from companies table later
        phone: profile.phone,
        isActive: profile.is_active,
        createdAt: profile.created_at,
        lastLogin: profile.updated_at,
      }));

      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch installer details
  const fetchInstallerDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      // Fetch documents
      const { data: documents, error: docsError } = await supabase
        .from('installer_documents')
        .select('*')
        .eq('user_id', userId)
        .order('document_type', { ascending: true })
        .order('version', { ascending: false });

      if (docsError) throw docsError;
      setInstallerDocuments(documents || []);

      // Fetch settings
      const { data: settings, error: settingsError } = await supabase
        .from('installer_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Settings error:', settingsError);
      }
      setInstallerSettings(settings || null);
    } catch (error) {
      console.error('Error fetching installer details:', error);
      toast.error('Failed to load installer details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle viewing installer details
  const handleViewInstallerDetails = async (user: User) => {
    if (user.role !== 'installer') {
      toast.info('Details view is only available for installers');
      return;
    }
    setSelectedUser(user);
    setIsInstallerDetailsModalOpen(true);
    await fetchInstallerDetails(user.id);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && u.role === activeTab;
  });

  // Check if installer documents are complete
  const isInstallerDocsComplete = () => {
    if (formData.role !== 'installer') return true;
    
    return installerDocumentsForm.competencyCards.file !== null &&
           installerDocumentsForm.competencyCards.issuedDate !== '' &&
           installerDocumentsForm.competencyCards.expiryDate !== '' &&
           installerDocumentsForm.certificates !== null &&
           installerDocumentsForm.insurance !== null &&
           installerDocumentsForm.mcsCertificate !== null &&
           installerDocumentsForm.consumerCode !== null &&
           installerDocumentsForm.insuranceBackedGuarantee !== null &&
           installerDocumentsForm.useExternalWasteCarrier !== '' &&
           (installerDocumentsForm.useExternalWasteCarrier === 'no' || installerDocumentsForm.wasteLicense !== null);
  };

  // Create new user
  const handleCreateUser = async () => {
    try {
      setIsLoading(true);

      // For installers, check if we're ready to create
      if (formData.role === 'installer' && addUserStep === 1 && !isInstallerDocsComplete()) {
        toast.error('Please upload all required documents');
        setIsLoading(false);
        return;
      }

      // Create user in Supabase Auth using admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.fullName,
          role: formData.role,
          phone: formData.phone || null,
        },
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Upload documents for installers
      if (formData.role === 'installer') {
        try {
          // Upload competency cards
          if (installerDocumentsForm.competencyCards.file) {
            const version = await getNextDocumentVersion(userId, 'competency_cards');
            const filePath = await uploadDocument(
              installerDocumentsForm.competencyCards.file,
              userId,
              'competency_cards',
              version
            );
            await saveDocumentMetadata(
              userId,
              'competency_cards',
              installerDocumentsForm.competencyCards.file.name,
              filePath,
              installerDocumentsForm.competencyCards.file.size,
              version,
              installerDocumentsForm.competencyCards.issuedDate,
              installerDocumentsForm.competencyCards.expiryDate
            );
          }

          // Upload other documents
          const documentTypes = [
            { key: 'certificates', type: 'certificates' },
            { key: 'insurance', type: 'insurance' },
            { key: 'mcsCertificate', type: 'mcs_certificate' },
            { key: 'consumerCode', type: 'consumer_code' },
            { key: 'insuranceBackedGuarantee', type: 'insurance_backed_guarantee' },
          ];

          for (const { key, type } of documentTypes) {
            const file = installerDocumentsForm[key as keyof typeof installerDocumentsForm] as File | null;
            if (file) {
              const version = await getNextDocumentVersion(userId, type);
              const filePath = await uploadDocument(file, userId, type, version);
              await saveDocumentMetadata(userId, type, file.name, filePath, file.size, version);
            }
          }

          // Upload waste license if applicable
          if (installerDocumentsForm.useExternalWasteCarrier === 'yes' && installerDocumentsForm.wasteLicense) {
            const version = await getNextDocumentVersion(userId, 'waste_license');
            const filePath = await uploadDocument(installerDocumentsForm.wasteLicense, userId, 'waste_license', version);
            await saveDocumentMetadata(
              userId,
              'waste_license',
              installerDocumentsForm.wasteLicense.name,
              filePath,
              installerDocumentsForm.wasteLicense.size,
              version
            );
          }

          // Save installer settings
          await supabase.from('installer_settings').insert({
            user_id: userId,
            use_external_waste_carrier: installerDocumentsForm.useExternalWasteCarrier === 'yes',
          });
        } catch (uploadError) {
          console.error('Document upload error:', uploadError);
          toast.warning('User created but some documents failed to upload');
        }
      }

      // Profile is auto-created by trigger
      await fetchUsers();
      setIsAddModalOpen(false);
      setAddUserStep(0);
      resetForm();
      resetInstallerDocsForm();
      toast.success('User created successfully!');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update user
  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone: formData.phone || null,
          is_active: formData.isActive,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      await fetchUsers();
      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
      toast.success('User updated successfully!');
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit modal
  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      fullName: user.name,
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
    });
    setIsEditModalOpen(true);
  };

  // Open delete confirmation modal
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setIsLoading(true);
      // Delete from auth.users (cascade will delete profile) using admin client
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);

      if (error) throw error;

      await fetchUsers();
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      toast.success('User deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'installer',
      phone: '',
      isActive: true,
    });
  };

  const resetInstallerDocsForm = () => {
    setInstallerDocumentsForm({
      competencyCards: { file: null, issuedDate: '', expiryDate: '' },
      certificates: null,
      insurance: null,
      mcsCertificate: null,
      consumerCode: null,
      insuranceBackedGuarantee: null,
      useExternalWasteCarrier: '',
      wasteLicense: null,
    });
  };

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
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{user.name}</p>
              {user.role === 'installer' && (
                <Eye className="w-4 h-4 text-primary-400" />
              )}
            </div>
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
          {user.isActive ? 'Active' : 'Suspended'}
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(user);
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Edit user"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(user);
            }}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete user"
          >
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
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
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
        onRowClick={(user) => user.role === 'installer' && handleViewInstallerDetails(user)}
        emptyMessage="No users found"
        isLoading={isLoading}
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddUserStep(0);
          resetForm();
          resetInstallerDocsForm();
        }}
        title={formData.role === 'installer' && addUserStep === 1 ? 'Add Installer - Documents' : 'Add New User'}
        size={formData.role === 'installer' && addUserStep === 1 ? 'lg' : 'md'}
      >
        <div className="space-y-4">
          {/* Step Indicator for Installers */}
          {formData.role === 'installer' && (
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    addUserStep === 0 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    {addUserStep > 0 ? <CheckCircle className="w-5 h-5" /> : '1'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Basic Information</p>
                    <p className="text-xs text-slate-500">Account details</p>
                  </div>
                </div>
                
                <div className={`h-0.5 w-12 ${addUserStep > 0 ? 'bg-primary-500' : 'bg-slate-700'}`} />
                
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    addUserStep === 1 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Certifications</p>
                    <p className="text-xs text-slate-500">Documents & licenses</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 0: Basic Info */}
          {addUserStep === 0 && (
            <>
              <Input
                label="Full Name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
                required
              />

              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />

              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
              />

              <Select
                label="Role"
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setFormData({ ...formData, role: newRole });
                  setAddUserStep(0);
                }}
                options={[
                  { value: 'installer', label: 'Installer' },
                  { value: 'assessor', label: 'Assessor' },
                ]}
              />

              <Input
                label="Phone (Optional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+44 7700 900000"
              />
            </>
          )}

          {/* Step 1: Documents (Installer Only) */}
          {addUserStep === 1 && formData.role === 'installer' && (
            <>
              <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-4 mb-4">
                <div className="flex gap-3">
                  <FileText className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Required Documents</h3>
                    <p className="text-xs text-slate-400">
                      Upload all required certifications and licenses
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
                <FileUploadWithDates
                  label="Competency Cards"
                  name="competencyCards"
                  value={installerDocumentsForm.competencyCards}
                  onChange={(data) => setInstallerDocumentsForm({ ...installerDocumentsForm, competencyCards: data })}
                  required
                />

                <FileUpload
                  label="Certificates of Course Completion"
                  name="certificates"
                  value={installerDocumentsForm.certificates}
                  onChange={(file) => setInstallerDocumentsForm({ ...installerDocumentsForm, certificates: file })}
                  required
                />

                <FileUpload
                  label="Insurance Documents"
                  name="insurance"
                  value={installerDocumentsForm.insurance}
                  onChange={(file) => setInstallerDocumentsForm({ ...installerDocumentsForm, insurance: file })}
                  required
                />

                <FileUpload
                  label="MCS Certificate"
                  name="mcsCertificate"
                  value={installerDocumentsForm.mcsCertificate}
                  onChange={(file) => setInstallerDocumentsForm({ ...installerDocumentsForm, mcsCertificate: file })}
                  required
                />

                <FileUpload
                  label="Consumer Code Membership"
                  name="consumerCode"
                  value={installerDocumentsForm.consumerCode}
                  onChange={(file) => setInstallerDocumentsForm({ ...installerDocumentsForm, consumerCode: file })}
                  required
                />

                <FileUpload
                  label="Insurance Backed Guarantee Provider Certificate"
                  name="insuranceBackedGuarantee"
                  value={installerDocumentsForm.insuranceBackedGuarantee}
                  onChange={(file) => setInstallerDocumentsForm({ ...installerDocumentsForm, insuranceBackedGuarantee: file })}
                  required
                />

                <Select
                  label="Will Installer use external waste carrier?"
                  value={installerDocumentsForm.useExternalWasteCarrier}
                  onChange={(e) => setInstallerDocumentsForm({ ...installerDocumentsForm, useExternalWasteCarrier: e.target.value })}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                  placeholder="Please select..."
                  required
                />

                {installerDocumentsForm.useExternalWasteCarrier === 'yes' && (
                  <FileUpload
                    label="Waste Removal License / WEEE Transfer License"
                    name="wasteLicense"
                    value={installerDocumentsForm.wasteLicense}
                    onChange={(file) => setInstallerDocumentsForm({ ...installerDocumentsForm, wasteLicense: file })}
                    required
                  />
                )}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            {addUserStep === 1 && formData.role === 'installer' && (
              <Button
                variant="secondary"
                onClick={() => setAddUserStep(0)}
                className="flex-1"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setAddUserStep(0);
                resetForm();
                resetInstallerDocsForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>

            {addUserStep === 0 && formData.role === 'installer' ? (
              <Button
                onClick={() => {
                  if (!formData.email || !formData.password || !formData.fullName) {
                    toast.error('Please fill in all required fields');
                    return;
                  }
                  setAddUserStep(1);
                }}
                className="flex-1"
                disabled={!formData.email || !formData.password || !formData.fullName}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleCreateUser}
                className="flex-1"
                isLoading={isLoading}
                disabled={
                  !formData.email || 
                  !formData.password || 
                  !formData.fullName || 
                  (formData.role === 'installer' && addUserStep === 1 && !isInstallerDocsComplete())
                }
              >
                Create User
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
          resetForm();
        }}
        title="Edit User"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="John Doe"
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            disabled
            placeholder="john@example.com"
          />

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              {getRoleIcon(formData.role)}
              <span>Role: <span className="text-white font-medium">{formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}</span></span>
            </div>
            <p className="text-xs text-slate-500">Role cannot be changed after creation</p>
          </div>

          <Input
            label="Phone (Optional)"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+44 7700 900000"
          />

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-white">Account Status</p>
                <p className="text-sm text-slate-400">
                  {formData.isActive ? 'User can access the platform' : 'User is suspended'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isActive ? 'bg-green-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedUser(null);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              className="flex-1"
              isLoading={isLoading}
              disabled={!formData.fullName}
            >
              Update User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white mb-1">
                Are you sure you want to delete this user?
              </p>
              <p className="text-sm text-slate-400">
                This action cannot be undone. User: <span className="font-medium text-white">{userToDelete?.name}</span> ({userToDelete?.email})
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
              }}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteUser}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              isLoading={isLoading}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Installer Details Modal */}
      <Modal
        isOpen={isInstallerDetailsModalOpen}
        onClose={() => {
          setIsInstallerDetailsModalOpen(false);
          setSelectedUser(null);
          setInstallerDocuments([]);
          setInstallerSettings(null);
        }}
        title={`Installer Details - ${selectedUser?.name || ''}`}
        size="lg"
      >
        {loadingDetails ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary-400" />
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Full Name</p>
                  <p className="text-white font-medium">{selectedUser?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Email</p>
                  <p className="text-white font-medium">{selectedUser?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Phone</p>
                  <p className="text-white font-medium">{selectedUser?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Company</p>
                  <p className="text-white font-medium">{selectedUser?.companyName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <Badge variant={selectedUser?.isActive ? 'success' : 'danger'}>
                    {selectedUser?.isActive ? 'Active' : 'Suspended'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Joined</p>
                  <p className="text-white font-medium">
                    {selectedUser?.createdAt ? format(new Date(selectedUser.createdAt), 'dd MMM yyyy') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Waste Carrier Settings */}
            {installerSettings && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Uses External Waste Carrier</p>
                    <p className="text-sm text-slate-400">Waste removal service configuration</p>
                  </div>
                  <Badge variant={installerSettings.use_external_waste_carrier ? 'primary' : 'slate'}>
                    {installerSettings.use_external_waste_carrier ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Documents Section */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-400" />
                Uploaded Documents ({installerDocuments.length})
              </h3>

              {installerDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {installerDocuments.map((doc) => {
                    const hasDateInfo = doc.document_type === 'competency_cards' && (doc.issued_date || doc.expiry_date);
                    
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          const { data } = supabase.storage
                            .from('installer-documents')
                            .getPublicUrl(doc.file_path);
                          window.open(data.publicUrl, '_blank');
                        }}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-primary-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-primary-400 group-hover:text-primary-300 transition-colors" />
                              <p className="font-medium text-white">
                                {doc.document_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                              </p>
                              {hasDateInfo && (
                                <Badge variant="slate" className="text-xs">
                                  v{doc.version}
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-slate-400 mb-2">{doc.file_name}</p>
                            
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                              <span>Uploaded: {format(new Date(doc.created_at), 'dd MMM yyyy')}</span>
                            </div>

                            {/* Show dates for competency cards */}
                            {hasDateInfo && (
                              <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4">
                                {doc.issued_date && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Calendar className="w-4 h-4 text-green-400" />
                                    <span className="text-slate-400">Issued:</span>
                                    <span className="text-white font-medium">
                                      {format(new Date(doc.issued_date), 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                                {doc.expiry_date && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Calendar className="w-4 h-4 text-orange-400" />
                                    <span className="text-slate-400">Expires:</span>
                                    <span className="text-white font-medium">
                                      {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-primary-400 group-hover:text-primary-300 transition-colors">
                            <ExternalLink className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsInstallerDetailsModalOpen(false);
                  setSelectedUser(null);
                  setInstallerDocuments([]);
                  setInstallerSettings(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}