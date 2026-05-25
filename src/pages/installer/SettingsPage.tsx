import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Building2, 
  Bell, 
  CreditCard,
  Shield,
  Palette,
  Save,
  FileText,
  Download,
  Upload,
  Calendar,
  Camera,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabPanels, TabPanel } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { FileUpload } from '../../components/ui/FileUpload';
import { FileUploadWithDates } from '../../components/ui/FileUploadWithDates';
import { ChoosePaymentModel } from '../../components/payments/ChoosePaymentModel';
import { StripeConnectOnboarding } from '../../components/payments/StripeConnectOnboarding';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import type { User as UserType } from '../../types';
import { uploadDocument, saveDocumentMetadata, getNextDocumentVersion } from '../../lib/storage';

const ONBOARDING_REQUIRED_DOCS: Array<{ type: string; label: string }> = [
  { type: 'competency_cards', label: 'Competency Cards' },
  { type: 'course_certificates', label: 'Course Completion Certificates' },
  { type: 'insurance', label: 'Insurance Documents' },
  { type: 'mcs_certificate', label: 'MCS Certificate' },
  { type: 'ibg_certificate', label: 'IBG Provider Certificate' },
];

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { getCompany, refreshData } = useData();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [showChoosePaymentModal, setShowChoosePaymentModal] = useState(false);

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);
  const [documentDates, setDocumentDates] = useState({ issuedDate: '', expiryDate: '' });

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const company = user?.companyId ? getCompany(user.companyId) : null;

  const missingOnboardingDocs = useMemo(() => {
    const uploadedTypes = new Set(documents.map((doc) => doc.document_type));
    return ONBOARDING_REQUIRED_DOCS.filter((doc) => !uploadedTypes.has(doc.type));
  }, [documents]);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: company?.name || '',
    email: company?.email || '',
    phone: company?.phone || '',
    mcsNumber: company?.mcsNumber || '',
    address: company?.address || '',
    postcode: company?.postcode || '',
    brandColor: (company?.brandColor && company.brandColor !== '#0c8cf1') ? company.brandColor : '#eab308',
  });

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    quoteAccepted: true,
    quoteViewed: true,
    commissionApproved: true,
    commissionChanges: true,
    productAnnouncements: false,
    platformUpdates: true,
  });

  // Update form when company data loads
  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name,
        email: company.email,
        phone: company.phone,
        mcsNumber: company.mcsNumber || '',
        address: company.address,
        postcode: company.postcode,
        brandColor: (company.brandColor && company.brandColor !== '#0c8cf1') ? company.brandColor : '#eab308',
      });
      // Load existing logo
      if (company.logo) {
        setLogoPreview(company.logo);
      }
    }
  }, [company]);

  // Update profile form when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm(prev => ({
        ...prev,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
      }));
      // Load existing avatar
      if (user.avatar) {
        setPhotoPreview(user.avatar);
      }
    }
  }, [user]);

  // Load notification preferences from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`notifications_${user.id}`);
      if (saved) {
        try {
          setNotifications(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading notification preferences:', e);
        }
      }
    }
  }, [user]);

  // Fetch user documents
  const fetchDocuments = async () => {
    if (!user || !user.companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('installer_onboarding_docs')
        .select('*')
        .eq('company_id', user.companyId)
        .eq('is_current', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
    }
  };

  // Load documents when user is available
  useEffect(() => {
    if (user && activeTab === 'company') {
      fetchDocuments();
    }
  }, [user, activeTab]);

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Update profile in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.name,
          phone: profileForm.phone,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // If password is being changed
      if (profileForm.newPassword) {
        if (profileForm.newPassword !== profileForm.confirmPassword) {
          toast.error('New passwords do not match');
          setIsLoading(false);
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: profileForm.newPassword,
        });

        if (passwordError) throw passwordError;

        // Clear password fields
        setProfileForm(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      }

      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, or WebP image.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be less than 2MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${user.id}/avatar_${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        throw new Error(`Failed to upload photo: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(uploadData.path);

      // Update profile record with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile avatar:', updateError);
        throw new Error('Failed to save photo URL');
      }

      setPhotoPreview(publicUrl);
      // Update user in auth context so avatar shows immediately everywhere
      setUser((prev: UserType | null) => prev ? { ...prev, avatar: publicUrl } : prev);
      toast.success('Profile photo uploaded successfully!');
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  // Remove profile photo
  const handleRemovePhoto = async () => {
    if (!user) return;

    setIsUploadingPhoto(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setPhotoPreview(null);
      setUser((prev: UserType | null) => prev ? { ...prev, avatar: undefined } : prev);
      toast.success('Photo removed successfully!');
    } catch (error: any) {
      console.error('Error removing photo:', error);
      toast.error('Failed to remove photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle logo file selection and upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, WebP, or SVG image.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo image must be less than 2MB.');
      return;
    }

    if (!user?.companyId && !company) {
      toast.error('Please save company details first before uploading a logo.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const companyId = user?.companyId || company?.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `logos/${companyId}/logo_${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Logo upload error:', uploadError);
        throw new Error(`Failed to upload logo: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(uploadData.path);

      // Update company record with logo URL
      if (companyId) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({ logo: publicUrl })
          .eq('id', companyId);

        if (updateError) {
          console.error('Error updating company logo:', updateError);
          throw new Error('Failed to save logo URL');
        }
      }

      setLogoPreview(publicUrl);
      await refreshData();
      toast.success('Company logo uploaded successfully!');
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  // Remove logo
  const handleRemoveLogo = async () => {
    if (!user?.companyId && !company) return;

    setIsUploadingLogo(true);
    try {
      const companyId = user?.companyId || company?.id;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo: null })
        .eq('id', companyId);

      if (updateError) throw updateError;

      setLogoPreview(null);
      await refreshData();
      toast.success('Logo removed successfully!');
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save company changes
  const handleSaveCompany = async () => {
    console.log('Save button clicked');
    console.log('Company:', company);
    console.log('Company Form:', companyForm);
    
    // Validate required fields
    if (!companyForm.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    
    if (!companyForm.email.trim()) {
      toast.error('Company email is required');
      return;
    }
    
    setIsLoading(true);

    try {
      if (!company) {
        console.log('Creating new company through edge function...');

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          throw new Error('You must be signed in to create a company');
        }

        const { data: companyResult, error: createError } = await supabase.functions.invoke('create-company', {
          body: {
            name: companyForm.name,
            email: companyForm.email,
            phone: companyForm.phone || null,
            mcsNumber: companyForm.mcsNumber || null,
            address: companyForm.address || '',
            postcode: companyForm.postcode || '',
            brandColor: companyForm.brandColor,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (createError || !companyResult?.success) {
          throw new Error(createError?.message || companyResult?.error || 'Failed to create company');
        }

        console.log('Company created successfully');
        await refreshData();
        toast.success('Company created successfully! You have 5 FREE trial credits to get started. 🎉');
      } else {
        // Update existing company
        console.log('Updating company with ID:', company.id);
        
        const { error } = await supabase
          .from('companies')
          .update({
            name: companyForm.name,
            email: companyForm.email,
            phone: companyForm.phone,
            mcs_number: companyForm.mcsNumber || null,
            address: companyForm.address,
            postcode: companyForm.postcode,
            brand_color: companyForm.brandColor,
          })
          .eq('id', company.id);

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        console.log('Company updated successfully');
        await refreshData();
        toast.success('Company details updated successfully!');
      }
    } catch (error: any) {
      console.error('Error saving company:', error);
      toast.error(error.message || 'Failed to save company details');
    } finally {
      setIsLoading(false);
    }
  };

  // Save notification preferences
  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      // For now, just save locally - we can add a notifications table later
      localStorage.setItem(`notifications_${user?.id}`, JSON.stringify(notifications));
      toast.success('Notification preferences saved!');
    } catch (error: any) {
      console.error('Error saving notifications:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (
    file: File,
    documentType: string,
    issuedDate?: string,
    expiryDate?: string
  ) => {
    if (!user) return;

    setUploadingDocuments(true);
    try {
      // Get next version number
      const version = await getNextDocumentVersion(user.id, documentType);

      // Upload file to storage
      const filePath = await uploadDocument(file, user.id, documentType, version);

      // Save metadata to database
      await saveDocumentMetadata(
        user.id,
        documentType,
        file.name,
        filePath,
        file.size,
        version,
        issuedDate,
        expiryDate
      );

      // Refresh documents list
      await fetchDocuments();

      toast.success('Document uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploadingDocuments(false);
    }
  };

  // Download document
  const handleDocumentDownload = async (fileUrl: string, fileName: string) => {
    try {
      // Fetch the file from the public URL
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch document');
      
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Document downloaded!');
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  // Start editing document
  const handleStartEditDocument = (doc: any) => {
    setEditingDocumentId(doc.id);
    setDocumentDates({
      issuedDate: doc.issued_date || '',
      expiryDate: doc.expiry_date || '',
    });
    setNewDocumentFile(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingDocumentId(null);
    setNewDocumentFile(null);
    setDocumentDates({ issuedDate: '', expiryDate: '' });
  };

  // Update document
  const handleUpdateDocument = async (doc: any) => {
    if (!user || !newDocumentFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploadingDocuments(true);
    try {
      // Get next version number
      const version = await getNextDocumentVersion(user.id, doc.document_type);

      // Upload new file version to storage
      const filePath = await uploadDocument(
        newDocumentFile,
        user.id,
        doc.document_type,
        version
      );

      // Save new version metadata to database
      await saveDocumentMetadata(
        user.id,
        doc.document_type,
        newDocumentFile.name,
        filePath,
        newDocumentFile.size,
        version,
        documentDates.issuedDate || undefined,
        documentDates.expiryDate || undefined
      );

      // Refresh documents list
      await fetchDocuments();

      // Reset editing state
      handleCancelEdit();

      toast.success(`Document updated to version ${version}!`);
    } catch (error: any) {
      console.error('Error updating document:', error);
      toast.error(error.message || 'Failed to update document');
    } finally {
      setUploadingDocuments(false);
    }
  };

  // Upgrade to subscription tier - Triggers Stripe payment
  const handleUpgradeToSubscription = async (tier: 'starter' | 'professional' | 'enterprise') => {
    if (!company || !user) {
      toast.error('Company or user not found');
      return;
    }

    setIsLoading(true);
    try {
      const tierConfig = {
        starter: { 
          price: 29, 
          proposals: 10,
          priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID || 'price_starter' 
        },
        professional: { 
          price: 79, 
          proposals: 50,
          priceId: import.meta.env.VITE_STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional'
        },
        enterprise: { 
          price: 199, 
          proposals: null,
          priceId: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise'
        },
      };

      const config = tierConfig[tier];

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to create subscription with Stripe
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { 
          price_id: config.priceId,
          company_id: company.id,
          user_id: user.id,
          plan_name: tier
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.clientSecret) {
        // For now, show a success message - in a full implementation,
        // you would redirect to Stripe Checkout or use Stripe Elements
        toast.success(`Subscription setup initiated! Redirecting to payment...`);
        
        // TODO: Implement Stripe Elements or Checkout redirect
        // For now, we'll simulate the subscription activation
        // In production, this should be handled by the Stripe webhook after successful payment
        
        // Temporary: Update database (in production, this happens via webhook)
        await supabase
          .from('companies')
          .update({
            payment_model: 'subscription',
            subscription_tier: tier,
            subscription_status: 'active',
            subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            monthly_proposal_limit: config.proposals,
            proposals_used_this_month: 0,
            proposal_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
          })
          .eq('id', company.id);

        await refreshData();
        toast.success(`Successfully subscribed to ${tier} plan! £${config.price}/month`);
      }
    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      toast.error(error.message || 'Failed to upgrade subscription');
    } finally {
      setIsLoading(false);
    }
  };



  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'company', label: 'Company', icon: <Building2 className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'subscription', label: 'Subscription', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <TabPanels activeTab={activeTab}>
        {/* Profile Tab */}
        <TabPanel id="profile">
          <Card>
            <h3 className="section-title">Personal Information</h3>
            <div className="max-w-xl space-y-6">
              <div className="flex items-center gap-4 mb-6">
                {/* Hidden file input */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                
                <div className="relative group">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-slate-700"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 text-2xl font-bold">
                      {user?.name.charAt(0)}
                    </div>
                  )}
                  {/* Camera overlay */}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute inset-0 w-20 h-20 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    disabled={isUploadingPhoto}
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          {photoPreview ? 'Change Photo' : 'Upload Photo'}
                        </>
                      )}
                    </Button>
                    {photoPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePhoto}
                        disabled={isUploadingPhoto}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">JPG, PNG, WebP. Max 2MB</p>
                </div>
              </div>

              <div className="form-grid">
                <Input
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileForm.email}
                  disabled
                  hint="Email cannot be changed"
                />
                <Input
                  label="Phone Number"
                  placeholder="+44 7700 900000"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>

              <div className="pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-4">Change Password</h4>
                <div className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    placeholder="••••••••"
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                  />
                  <div className="form-grid">
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="••••••••"
                      value={profileForm.newPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      placeholder="••••••••"
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSaveProfile}
                  isLoading={isLoading}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* Company Tab */}
        <TabPanel id="company">
          <Card>
            <h3 className="section-title">Company Details</h3>
            <div className="max-w-xl space-y-6">
              {!company && (
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-4">
                  <p className="text-sm text-primary-300">
                    <strong>No company profile found.</strong> Fill in the details below to create your company profile and start creating quotes.
                  </p>
                </div>
              )}
              <div className="form-grid">
                <Input
                  label="Company Name"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                />
                <Input
                  label="Company Email"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                />
                <Input
                  label="MCS Number"
                  value={companyForm.mcsNumber}
                  onChange={(e) => setCompanyForm({ ...companyForm, mcsNumber: e.target.value })}
                  placeholder="MCS/12345"
                />
              </div>

              <div>
                <Input
                  label="Address"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                />
              </div>

              <div className="form-grid">
                <Input
                  label="Postcode"
                  value={companyForm.postcode}
                  onChange={(e) => setCompanyForm({ ...companyForm, postcode: e.target.value })}
                />
              </div>

              <div className="pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-4">Branding</h4>
                <div className="flex items-start gap-8">
                  {/* Company Logo Upload */}
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Company Logo</p>
                    <div className="relative group">
                      {logoPreview ? (
                        <div className="w-32 h-32 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 relative">
                          <img
                            src={logoPreview}
                            alt="Company Logo"
                            className="w-full h-full object-contain p-2"
                          />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => logoInputRef.current?.click()}
                              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                              title="Change logo"
                              disabled={isUploadingLogo}
                            >
                              <Camera className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={handleRemoveLogo}
                              className="p-2 bg-red-500/30 rounded-lg hover:bg-red-500/50 transition-colors"
                              title="Remove logo"
                              disabled={isUploadingLogo}
                            >
                              <Trash2 className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="w-32 h-32 bg-slate-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-600 hover:border-primary-500 hover:bg-slate-800/80 transition-all cursor-pointer"
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-slate-500 mb-1" />
                              <span className="text-slate-500 text-xs">Upload Logo</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <p className="text-xs text-slate-500 mt-2">PNG, JPG, WebP or SVG. Max 2MB.</p>
                  </div>

                  {/* Brand Color */}
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Brand Color</p>
                    <div className="flex items-center gap-3">
                      <label 
                        className="w-10 h-10 rounded-lg border-2 border-white/20 cursor-pointer relative overflow-hidden" 
                        style={{ backgroundColor: companyForm.brandColor }}
                      >
                        <input
                          type="color"
                          value={companyForm.brandColor}
                          onChange={(e) => setCompanyForm({ ...companyForm, brandColor: e.target.value })}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </label>
                      <Input
                        value={companyForm.brandColor}
                        onChange={(e) => setCompanyForm({ ...companyForm, brandColor: e.target.value })}
                        className="w-28"
                        placeholder="#eab308"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Used throughout your installer dashboard.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents & Certifications
                </h4>
                <p className="text-xs text-slate-400 mb-6">
                  View and update your company's documents and certifications. All documents should be in PDF, PNG, or JPG format.
                </p>

                {documents.length === 0 ? (
                  <div className="bg-slate-800/50 rounded-xl p-8 text-center">
                    <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-300 font-medium mb-2">No documents uploaded yet</p>
                    <p className="text-slate-500 text-sm">
                      Upload your certifications and compliance documents in{' '}
                      <Link to="/installer/onboarding" className="text-primary-400 hover:text-primary-300 font-medium">
                        Onboarding
                      </Link>
                      . Once uploaded, you can view, download, and update them here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-primary-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="text-sm font-medium text-white capitalize">
                                {doc.document_type.replace(/_/g, ' ')}
                              </h5>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-xs text-slate-400 truncate">{doc.file_name}</p>
                                {/* Show version badge for documents with dates OR when version > 1 */}
                                {((doc.issued_date || doc.expiry_date) || doc.version > 1) && (
                                  <Badge variant="slate" size="sm">v{doc.version}</Badge>
                                )}
                              </div>
                              {(doc.issued_date || doc.expiry_date) && (
                                <div className="flex items-center gap-4 mt-2">
                                  {doc.issued_date && (
                                    <div className="flex items-center gap-1 text-xs text-slate-400">
                                      <Calendar className="w-3 h-3" />
                                      <span>Issued: {new Date(doc.issued_date).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                  {doc.expiry_date && (
                                    <div className="flex items-center gap-1 text-xs text-slate-400">
                                      <Calendar className="w-3 h-3" />
                                      <span className={
                                        new Date(doc.expiry_date) < new Date()
                                          ? 'text-red-400'
                                          : new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                            ? 'text-warning-400'
                                            : ''
                                      }>
                                        Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<Download className="w-4 h-4" />}
                              onClick={() => handleDocumentDownload(doc.file_url, doc.file_name)}
                            >
                              Download
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Upload className="w-4 h-4" />}
                              onClick={() => handleStartEditDocument(doc)}
                            >
                              Update
                            </Button>
                          </div>
                        </div>

                        {/* Edit Mode */}
                        {editingDocumentId === doc.id && (
                          <div className="border-t border-slate-700 p-4 bg-slate-900/50">
                            <h6 className="text-sm font-medium text-white mb-3">Upload New Version</h6>
                            
                            <div className="space-y-4">
                              {/* File Upload */}
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Select New File
                                </label>
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  onChange={(e) => setNewDocumentFile(e.target.files?.[0] || null)}
                                  className="block w-full text-sm text-slate-400
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-lg file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-primary-500 file:text-white
                                    hover:file:bg-primary-600
                                    file:cursor-pointer cursor-pointer"
                                />
                                {newDocumentFile && (
                                  <p className="text-xs text-green-400 mt-1">
                                    ✓ {newDocumentFile.name} selected
                                  </p>
                                )}
                              </div>

                              {/* Date Fields (only for documents that have dates) */}
                              {(doc.issued_date || doc.expiry_date) && (
                                <div className="grid grid-cols-2 gap-4">
                                  <Input
                                    label="Issued Date"
                                    type="date"
                                    value={documentDates.issuedDate}
                                    onChange={(e) => setDocumentDates({ ...documentDates, issuedDate: e.target.value })}
                                  />
                                  <Input
                                    label="Expiry Date"
                                    type="date"
                                    value={documentDates.expiryDate}
                                    onChange={(e) => setDocumentDates({ ...documentDates, expiryDate: e.target.value })}
                                  />
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  disabled={uploadingDocuments}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleUpdateDocument(doc)}
                                  isLoading={uploadingDocuments}
                                  disabled={!newDocumentFile}
                                  leftIcon={<Upload className="w-4 h-4" />}
                                >
                                  Upload New Version
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {missingOnboardingDocs.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      <strong className="text-amber-300">💡 Tip:</strong> You still need to upload:{' '}
                      <span className="font-medium">{missingOnboardingDocs.map((d) => d.label).join(', ')}</span>.
                      {' '}Go to the{' '}
                      <Link
                        to="/installer/onboarding"
                        className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-2"
                      >
                        Onboarding
                      </Link>
                      {' '}page to upload the remaining documents required for MCS compliance.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button 
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSaveCompany}
                  isLoading={isLoading}
                >
                  {company ? 'Save Changes' : 'Create Company'}
                </Button>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel id="notifications">
          <Card>
            <h3 className="section-title">Notification Preferences</h3>
            <div className="max-w-xl space-y-6">
              <div className="space-y-4">
                {[
                  { key: 'quoteAccepted', label: 'Quote accepted by customer', description: 'Get notified when a customer accepts your quote' },
                  { key: 'quoteViewed', label: 'Quote viewed', description: 'Get notified when a customer views your quote' },
                  { key: 'commissionApproved', label: 'Commission approved', description: 'Get notified when your commissioning is approved' },
                  { key: 'commissionChanges', label: 'Commission requires changes', description: 'Get notified when changes are requested' },
                  { key: 'productAnnouncements', label: 'New product announcements', description: 'Updates about new products in the catalogue' },
                  { key: 'platformUpdates', label: 'Platform updates', description: 'News and feature announcements' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button 
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSaveNotifications}
                  isLoading={isLoading}
                >
                  Save Preferences
                </Button>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* Payments Tab - Stripe Connect */}
        <TabPanel id="payments">
          {company ? (
            <StripeConnectOnboarding
              companyId={company.id}
              companyData={{
                name: company.name,
                email: company.email,
                phone: company.phone,
                address: company.address,
                postcode: company.postcode,
              }}
            />
          ) : (
            <Card>
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Company Profile</h3>
                <p className="text-slate-400 mb-6">
                  You need to create a company profile before setting up payments.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('company')}
                >
                  Go to Company Settings
                </Button>
              </div>
            </Card>
          )}
        </TabPanel>

        {/* Subscription Tab */}
        <TabPanel id="subscription">
          <div className="space-y-6">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="section-title mb-0">Current Plan</h3>
                  <p className="text-slate-500 text-sm">Your subscription details</p>
                </div>
                <Badge 
                  variant={company?.subscriptionStatus === 'active' ? 'success' : company?.subscriptionStatus === 'trial' ? 'warning' : 'slate'} 
                  size="md"
                >
                  {company?.subscriptionStatus || 'Active'}
                </Badge>
              </div>

              {/* Payment Model Info */}
              <div className="mt-6 p-6 bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold text-white capitalize">
                      {company?.subscriptionStatus === 'trial' && !company?.paymentModel 
                        ? 'Trial Account' 
                        : company?.paymentModel === 'pay-as-you-go' 
                          ? 'Pay as you go' 
                          : company?.subscriptionTier}
                    </p>
                    <p className="text-slate-400">
                      {company?.subscriptionStatus === 'trial' && !company?.paymentModel 
                        ? '5 free credits - Choose your payment model after trial' 
                        : company?.paymentModel === 'pay-as-you-go' 
                          ? 'Credit-based billing' 
                          : 'Monthly subscription'}
                    </p>
                  </div>
                  {company?.paymentModel === 'subscription' && (
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary-400">
                        £{company?.subscriptionTier === 'starter' ? '29' : company?.subscriptionTier === 'professional' ? '79' : '199'}
                      </p>
                      <p className="text-slate-500">/month</p>
                    </div>
                  )}
                </div>

                {/* Usage Stats */}
                {(company?.subscriptionStatus === 'trial' || company?.paymentModel === 'pay-as-you-go') ? (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                    <div>
                      <p className="text-sm text-slate-500">Credit Balance</p>
                      <p className="text-2xl font-bold text-warning-400">{company?.creditBalance} credits</p>
                      <p className="text-xs text-slate-500 mt-1">1 credit = 1 proposal</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Credit Price</p>
                      <p className="text-white">£{company?.creditPrice.toFixed(2)} per credit</p>
                      <p className="text-xs text-slate-500 mt-1">Purchase credits anytime</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                    <div>
                      <p className="text-sm text-slate-500">Proposals Used</p>
                      <p className="text-white">
                        {company?.proposalsUsedThisMonth} / {company?.monthlyProposalLimit || '∞'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Renewal Date</p>
                      <p className="text-white">
                        {company?.subscriptionEndDate ? new Date(company.subscriptionEndDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Plan Details Card */}
            <Card>
              <h3 className="section-title">Plan Details</h3>
              <p className="text-sm text-slate-400 mb-6">Choose the plan that best fits your needs</p>
              
              <div className="space-y-4">
                {/* Payment Models Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Pay as You Go */}
                  <button
                    onClick={() => setShowChoosePaymentModal(true)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      company?.paymentModel === 'pay-as-you-go'
                        ? 'border-warning-500 bg-warning-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:border-warning-500/50 hover:bg-warning-500/5 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-white">Pay as You Go</h4>
                      {company?.paymentModel === 'pay-as-you-go' && (
                        <Badge variant="warning">Active</Badge>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-white">£3</div>
                      <div className="text-xs text-slate-400">per credit</div>
                    </div>
                    
                    <div className="space-y-2 text-xs mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">1 credit = 1 proposal</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Credits never expire</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Top-up anytime</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">No commitment</span>
                      </div>
                    </div>
                    
                    {company?.paymentModel === 'pay-as-you-go' && (
                      <div className="pt-3 border-t border-slate-700">
                        <div className="text-xs text-slate-400">Current Balance</div>
                        <div className="text-lg font-bold text-warning-400">{company?.creditBalance} credits</div>
                      </div>
                    )}
                    
                    {(company?.paymentModel !== 'pay-as-you-go') && (
                      <div className="mt-3">
                        <div className="text-xs text-center text-warning-400 font-medium">
                          Click to choose
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Starter Plan */}
                  <button
                    onClick={() => setShowChoosePaymentModal(true)}
                    disabled={company?.paymentModel === 'subscription' && company?.subscriptionTier === 'starter'}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      company?.paymentModel === 'subscription' && company?.subscriptionTier === 'starter'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:border-primary-500/50 hover:bg-primary-500/5 cursor-pointer'
                    } ${company?.paymentModel === 'subscription' && company?.subscriptionTier === 'starter' ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-white">Starter</h4>
                      {company?.paymentModel === 'subscription' && company?.subscriptionTier === 'starter' && (
                        <Badge variant="primary">Active</Badge>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-white">£29</div>
                      <div className="text-xs text-slate-400">per month</div>
                    </div>
                    
                    <div className="space-y-2 text-xs mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">10 credits/month</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Fixed monthly cost</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Basic support</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Email notifications</span>
                      </div>
                    </div>
                    
                    {company?.paymentModel === 'subscription' && company?.subscriptionTier === 'starter' && (
                      <div className="pt-3 border-t border-slate-700">
                        <div className="text-xs text-slate-400">Proposals Used</div>
                        <div className="text-lg font-bold text-primary-400">
                          {company?.proposalsUsedThisMonth} / 10
                        </div>
                      </div>
                    )}
                    
                    {(company?.paymentModel !== 'subscription' || company?.subscriptionTier !== 'starter') && (
                      <div className="mt-3">
                        <div className="text-xs text-center text-primary-400 font-medium">
                          Click to choose
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Professional Plan */}
                  <button
                    onClick={() => setShowChoosePaymentModal(true)}
                    disabled={company?.paymentModel === 'subscription' && company?.subscriptionTier === 'professional'}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      company?.paymentModel === 'subscription' && company?.subscriptionTier === 'professional'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:border-primary-500/50 hover:bg-primary-500/5 cursor-pointer'
                    } ${company?.paymentModel === 'subscription' && company?.subscriptionTier === 'professional' ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-white">Professional</h4>
                      {company?.paymentModel === 'subscription' && company?.subscriptionTier === 'professional' && (
                        <Badge variant="primary">Active</Badge>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-white">£79</div>
                      <div className="text-xs text-slate-400">per month</div>
                    </div>
                    
                    <div className="space-y-2 text-xs mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">50 credits/month</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Priority support</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Custom branding</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">MCS documents</span>
                      </div>
                    </div>
                    
                    {company?.paymentModel === 'subscription' && company?.subscriptionTier === 'professional' && (
                      <div className="pt-3 border-t border-slate-700">
                        <div className="text-xs text-slate-400">Proposals Used</div>
                        <div className="text-lg font-bold text-primary-400">
                          {company?.proposalsUsedThisMonth} / 50
                        </div>
                      </div>
                    )}
                    
                    {(company?.paymentModel !== 'subscription' || company?.subscriptionTier !== 'professional') && (
                      <div className="mt-3">
                        <div className="text-xs text-center text-primary-400 font-medium">
                          Click to choose
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Enterprise Plan */}
                  <button
                    onClick={() => setShowChoosePaymentModal(true)}
                    disabled={company?.paymentModel === 'subscription' && company?.subscriptionTier === 'enterprise'}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      company?.paymentModel === 'subscription' && company?.subscriptionTier === 'enterprise'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:border-primary-500/50 hover:bg-primary-500/5 cursor-pointer'
                    } ${company?.paymentModel === 'subscription' && company?.subscriptionTier === 'enterprise' ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-white">Enterprise</h4>
                      {company?.paymentModel === 'subscription' && company?.subscriptionTier === 'enterprise' && (
                        <Badge variant="primary">Active</Badge>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-white">£199</div>
                      <div className="text-xs text-slate-400">per month</div>
                    </div>
                    
                    <div className="space-y-2 text-xs mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Unlimited credits</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Dedicated support</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">API access</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-300">Custom features</span>
                      </div>
                    </div>
                    
                    {company?.paymentModel === 'subscription' && company?.subscriptionTier === 'enterprise' && (
                      <div className="pt-3 border-t border-slate-700">
                        <div className="text-xs text-slate-400">Proposals Used</div>
                        <div className="text-lg font-bold text-primary-400">
                          {company?.proposalsUsedThisMonth} / ∞
                        </div>
                      </div>
                    )}
                    
                    {(company?.paymentModel !== 'subscription' || company?.subscriptionTier !== 'enterprise') && (
                      <div className="mt-3">
                        <div className="text-xs text-center text-primary-400 font-medium">
                          Click to choose
                        </div>
                      </div>
                    )}
                  </button>
                </div>

                {/* Action needed notice for low balance/limit */}
                {company?.paymentModel === 'pay-as-you-go' && company?.creditBalance < 5 && (
                  <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
                    <p className="text-warning-400 font-medium mb-1">⚠️ Low Credit Balance</p>
                    <p className="text-sm text-slate-400">
                      You have {company?.creditBalance} credits remaining. Contact your admin to purchase more credits.
                    </p>
                  </div>
                )}

                {company?.paymentModel === 'subscription' && 
                 company?.monthlyProposalLimit && 
                 company?.proposalsUsedThisMonth >= company?.monthlyProposalLimit * 0.8 && (
                  <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
                    <p className="text-warning-400 font-medium mb-1">⚠️ Approaching Monthly Limit</p>
                    <p className="text-sm text-slate-400">
                      You've used {company?.proposalsUsedThisMonth} of {company?.monthlyProposalLimit} proposals this month. 
                      Consider upgrading your plan or wait until {company?.proposalResetDate ? new Date(company.proposalResetDate).toLocaleDateString() : 'next month'}.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Available Tiers - Only show for subscription model */}
            {company?.paymentModel === 'subscription' && (
              <Card>
                <h3 className="section-title">Available Subscription Tiers</h3>
                <p className="text-slate-400 text-sm mb-6">Upgrade or change your subscription tier anytime</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { 
                      name: 'Starter', 
                      price: 29, 
                      proposals: 10,
                      features: ['10 credits/month', 'Basic support', 'Standard features'] 
                    },
                    { 
                      name: 'Professional', 
                      price: 79, 
                      proposals: 50,
                      features: ['50 credits/month', 'Priority support', 'Custom branding', 'MCS documents', 'Advanced features'] 
                    },
                    { 
                      name: 'Enterprise', 
                      price: 199, 
                      proposals: null,
                      features: ['Unlimited credits', 'Dedicated support', 'API access', 'Custom features', 'White-label option'] 
                    },
                  ].map((plan) => (
                    <div
                      key={plan.name}
                      className={`p-6 rounded-xl border ${
                        plan.name.toLowerCase() === company?.subscriptionTier
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-slate-700 bg-slate-800/30'
                      }`}
                    >
                      <h4 className="text-lg font-semibold text-white mb-2">{plan.name}</h4>
                      <p className="text-3xl font-bold text-white mb-1">
                        £{plan.price}
                      </p>
                      <p className="text-sm text-slate-500 mb-4">/month</p>
                      <ul className="space-y-2 mb-4">
                        {plan.features.map((feature) => (
                          <li key={feature} className="text-sm text-slate-400 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {plan.name.toLowerCase() === company?.subscriptionTier ? (
                        <Button variant="primary" className="w-full" disabled>
                          ✓ Current Plan
                        </Button>
                      ) : (
                        <Button 
                          variant={plan.price > (company?.subscriptionTier === 'starter' ? 29 : company?.subscriptionTier === 'professional' ? 79 : 199) ? 'primary' : 'secondary'}
                          className="w-full"
                          onClick={() => handleUpgradeToSubscription(plan.name.toLowerCase() as 'starter' | 'professional' | 'enterprise')}
                          isLoading={isLoading}
                        >
                          {plan.price > (company?.subscriptionTier === 'starter' ? 29 : company?.subscriptionTier === 'professional' ? 79 : 199) ? 'Upgrade' : 'Switch to'} {plan.name}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </TabPanel>
      </TabPanels>

      {/* Choose Payment Model Modal */}
      {company && (
        <ChoosePaymentModel
          isOpen={showChoosePaymentModal}
          onClose={() => setShowChoosePaymentModal(false)}
          companyId={company.id}
        />
      )}
    </div>
  );
}

