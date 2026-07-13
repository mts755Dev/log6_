import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Trash2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Upload,
  ChevronDown,
  Pencil,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { uploadNTPDocument } from '../../lib/storage';
import { format } from 'date-fns';
import type { NTPSpecialization } from '../../types';
import { NTP_SPECIALIZATION_LABELS } from '../../types';

interface Engineer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  companyId: string;
  isActive: boolean;
  specializations: NTPSpecialization[];
  idDocumentUrl?: string;
  qualificationCardUrls: string[];
}

const SPECIALIZATION_OPTIONS: NTPSpecialization[] = ['heat_pumps', 'solar', 'battery_storage', 'ev_charging'];

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const idFileRef = useRef<HTMLInputElement>(null);
  const qualFileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    specializations: [] as NTPSpecialization[],
  });

  useEffect(() => {
    fetchEngineers();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEngineers(engineers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredEngineers(
        engineers.filter(
          (e) =>
            e.fullName.toLowerCase().includes(query) ||
            e.email.toLowerCase().includes(query) ||
            e.phone.includes(query) ||
            e.specializations.some(s => NTP_SPECIALIZATION_LABELS[s].toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, engineers]);

  const fetchEngineers = async () => {
    if (!user?.companyId) return;

    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, created_at, company_id')
        .eq('company_id', user.companyId)
        .eq('role', 'engineer')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch NTP data linked by engineer_id
      const { data: ntpData } = await supabase
        .from('nominated_technical_persons')
        .select('*')
        .eq('company_id', user.companyId)
        .eq('is_active', true);

      const ntpByEngineerId = new Map<string, any>();
      (ntpData || []).forEach(ntp => {
        if (ntp.engineer_id) ntpByEngineerId.set(ntp.engineer_id, ntp);
      });

      const mappedEngineers: Engineer[] = (data || []).map((profile) => {
        const ntp = ntpByEngineerId.get(profile.id);
        return {
          id: profile.id,
          fullName: profile.full_name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          createdAt: profile.created_at,
          companyId: profile.company_id,
          isActive: true,
          specializations: ntp?.specializations || [],
          idDocumentUrl: ntp?.id_document_url,
          qualificationCardUrls: ntp?.qualification_card_urls || [],
        };
      });

      setEngineers(mappedEngineers);
      setFilteredEngineers(mappedEngineers);
    } catch (error: any) {
      console.error('Error fetching engineers:', error);
      toast.error('Failed to load technical persons');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpecToggle = (spec: NTPSpecialization) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec],
    }));
  };

  const handleCreateEngineer = async () => {
    if (!user?.companyId) {
      toast.error('Company information not found');
      return;
    }
    if (!formData.fullName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (formData.specializations.length === 0) {
      toast.error('Please select at least one installation type');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-engineer', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone || null,
          companyId: user.companyId,
        },
      });

      if (error) throw new Error(error.message || 'Failed to create');
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('Failed to create - unexpected response');

      // Create NTP record linked by engineer_id (userId from edge function response)
      await supabase.from('nominated_technical_persons').insert({
        company_id: user.companyId,
        engineer_id: data.userId,
        full_name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || null,
        specializations: formData.specializations,
      });

      toast.success('Technical person created successfully!');
      setShowAddModal(false);
      resetForm();
      await fetchEngineers();
    } catch (error: any) {
      console.error('Error creating engineer:', error);
      let errorMessage = 'Failed to create technical person';
      if (error.message?.includes('duplicate key') || error.message?.includes('23505') || error.message?.includes('already exists')) {
        errorMessage = 'A person with this email already exists';
      } else if (error.message) {
        errorMessage = error.message;
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
      const { data, error } = await supabase.functions.invoke('delete-engineer', {
        body: { userId: selectedEngineer.id },
      });

      if (error) throw new Error(error.message || 'Failed to delete');
      if (data?.error) throw new Error(data.error);

      // Also deactivate the NTP record
      await supabase
        .from('nominated_technical_persons')
        .update({ is_active: false })
        .eq('engineer_id', selectedEngineer.id);

      toast.success('Technical person removed successfully');
      setShowDeleteModal(false);
      setSelectedEngineer(null);
      await fetchEngineers();
    } catch (error: any) {
      console.error('Error deleting engineer:', error);
      toast.error(error.message || 'Failed to remove technical person');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSpecializations = async (engineer: Engineer, specs: NTPSpecialization[]) => {
    if (!user?.companyId) return;
    try {
      const { data: existing } = await supabase
        .from('nominated_technical_persons')
        .select('id')
        .eq('engineer_id', engineer.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('nominated_technical_persons')
          .update({ specializations: specs })
          .eq('id', existing.id);
      } else {
        await supabase.from('nominated_technical_persons').insert({
          company_id: user.companyId,
          engineer_id: engineer.id,
          full_name: engineer.fullName,
          email: engineer.email,
          phone: engineer.phone || null,
          specializations: specs,
        });
      }

      setEngineers(prev => prev.map(e =>
        e.id === engineer.id ? { ...e, specializations: specs } : e
      ));
      toast.success('Installation types updated');
    } catch (error: any) {
      console.error('Error updating specializations:', error);
      toast.error('Failed to update installation types');
    }
  };

  const handleIdUpload = async (engineerId: string, file: File) => {
    if (!user?.companyId) return;
    const engineer = engineers.find(e => e.id === engineerId);
    if (!engineer) return;

    setUploadingId(engineerId);
    try {
      let ntpId: string;
      const { data: existing } = await supabase
        .from('nominated_technical_persons')
        .select('id')
        .eq('engineer_id', engineerId)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        ntpId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('nominated_technical_persons')
          .insert({
            company_id: user.companyId,
            engineer_id: engineerId,
            full_name: engineer.fullName,
            email: engineer.email,
            specializations: engineer.specializations,
          })
          .select('id')
          .single();
        if (error) throw error;
        ntpId = created.id;
      }

      const url = await uploadNTPDocument(file, user.companyId, ntpId, 'id_document');
      await supabase
        .from('nominated_technical_persons')
        .update({ id_document_url: url })
        .eq('id', ntpId);

      toast.success('ID document uploaded');
      await fetchEngineers();
    } catch (error: any) {
      console.error('Error uploading ID:', error);
      toast.error('Failed to upload ID document');
    } finally {
      setUploadingId(null);
    }
  };

  const handleQualUpload = async (engineerId: string, file: File) => {
    if (!user?.companyId) return;
    const engineer = engineers.find(e => e.id === engineerId);
    if (!engineer) return;

    setUploadingId(engineerId);
    try {
      let ntpId: string;
      const { data: existing } = await supabase
        .from('nominated_technical_persons')
        .select('id, qualification_card_urls')
        .eq('engineer_id', engineerId)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        ntpId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('nominated_technical_persons')
          .insert({
            company_id: user.companyId,
            engineer_id: engineerId,
            full_name: engineer.fullName,
            email: engineer.email,
            specializations: engineer.specializations,
          })
          .select('id')
          .single();
        if (error) throw error;
        ntpId = created.id;
      }

      const url = await uploadNTPDocument(file, user.companyId, ntpId, 'qualification_card');
      const existingUrls = existing?.qualification_card_urls || [];
      await supabase
        .from('nominated_technical_persons')
        .update({ qualification_card_urls: [...existingUrls, url] })
        .eq('id', ntpId);

      toast.success('Qualification card uploaded');
      await fetchEngineers();
    } catch (error: any) {
      console.error('Error uploading qualification card:', error);
      toast.error('Failed to upload qualification card');
    } finally {
      setUploadingId(null);
    }
  };

  const resetForm = () => {
    setFormData({ fullName: '', email: '', phone: '', password: '', specializations: [] });
    setShowPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Nominated Technical Persons</h1>
          <p className="page-subtitle">Manage the qualified people who carry out installations for your company</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
          Add Person
        </Button>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or installation type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
          />
        </div>
      </Card>

      {/* Hidden file inputs */}
      <input
        ref={idFileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetId) handleIdUpload(uploadTargetId, file);
          e.target.value = '';
          setUploadTargetId(null);
        }}
      />
      <input
        ref={qualFileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetId) handleQualUpload(uploadTargetId, file);
          e.target.value = '';
          setUploadTargetId(null);
        }}
      />

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
            <p className="text-slate-400 mb-2">
              {searchQuery ? 'No technical persons found matching your search' : 'No technical persons added yet'}
            </p>
            {!searchQuery && (
              <>
                <p className="text-slate-500 text-sm mb-6">
                  Add the qualified people who carry out installations. Each person can be assigned specific installation types and upload their ID and qualification cards.
                </p>
                <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
                  Add Your First Technical Person
                </Button>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEngineers.map((engineer) => {
            const isExpanded = expandedId === engineer.id;
            const isUploading = uploadingId === engineer.id;
            const hasId = !!engineer.idDocumentUrl;
            const qualCount = engineer.qualificationCardUrls.length;

            return (
              <Card key={engineer.id} className="overflow-hidden hover:border-primary-500/30 transition-all">
                {/* Main row */}
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : engineer.id)}
                >
                  <div className="w-12 h-12 rounded-full bg-energy-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-energy-400 font-bold text-sm">
                      {engineer.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white">{engineer.fullName}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {engineer.email}
                      </span>
                      {engineer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {engineer.phone}
                        </span>
                      )}
                    </div>

                    {/* Specialization badges */}
                    {engineer.specializations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {engineer.specializations.map(spec => (
                          <span
                            key={spec}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-energy-500/10 text-energy-300 border border-energy-500/20"
                          >
                            {NTP_SPECIALIZATION_LABELS[spec]}
                          </span>
                        ))}
                      </div>
                    )}
                    {engineer.specializations.length === 0 && (
                      <p className="text-xs text-amber-400/70 mt-1.5">No installation types assigned yet</p>
                    )}
                  </div>

                  {/* Status indicators */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${hasId ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        ID {hasId ? '✓' : '—'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${qualCount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        Quals {qualCount > 0 ? `✓ ${qualCount}` : '—'}
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded area */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 mt-4 border-t border-slate-700/50 space-y-4">
                        {/* Installation Types */}
                        <div>
                          <p className="text-sm font-medium text-slate-300 mb-2">Installation Types</p>
                          <div className="flex flex-wrap gap-2">
                            {SPECIALIZATION_OPTIONS.map(spec => {
                              const isSelected = engineer.specializations.includes(spec);
                              return (
                                <button
                                  key={spec}
                                  type="button"
                                  onClick={() => {
                                    const updated = isSelected
                                      ? engineer.specializations.filter(s => s !== spec)
                                      : [...engineer.specializations, spec];
                                    handleUpdateSpecializations(engineer, updated);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isSelected
                                      ? 'bg-energy-500/20 text-energy-300 border border-energy-500/40'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                                  }`}
                                >
                                  {NTP_SPECIALIZATION_LABELS[spec]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Document uploads */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* ID Document */}
                          <div className="border border-slate-700/50 rounded-xl p-4">
                            <p className="text-xs text-slate-400 font-medium mb-3">ID Document</p>
                            {engineer.idDocumentUrl ? (
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                                <a href={engineer.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-400 hover:underline truncate">
                                  View uploaded ID
                                </a>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mb-2">No ID uploaded yet</p>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              onClick={() => { setUploadTargetId(engineer.id); idFileRef.current?.click(); }}
                              disabled={isUploading}
                              className="w-full"
                            >
                              {engineer.idDocumentUrl ? 'Replace ID' : 'Upload ID'}
                            </Button>
                          </div>

                          {/* Qualification Cards */}
                          <div className="border border-slate-700/50 rounded-xl p-4">
                            <p className="text-xs text-slate-400 font-medium mb-3">
                              Qualification Cards ({qualCount})
                            </p>
                            {qualCount > 0 && (
                              <div className="space-y-1 mb-2">
                                {engineer.qualificationCardUrls.map((url, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:underline truncate">
                                      Card {i + 1}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                            {qualCount === 0 && (
                              <p className="text-xs text-slate-500 mb-2">No qualification cards uploaded</p>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                              onClick={() => { setUploadTargetId(engineer.id); qualFileRef.current?.click(); }}
                              disabled={isUploading}
                              className="w-full"
                            >
                              {qualCount > 0 ? 'Add Another Card' : 'Upload Card'}
                            </Button>
                          </div>
                        </div>

                        {/* Meta + actions */}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-slate-500">
                            Added {format(new Date(engineer.createdAt), 'dd MMM yyyy')}
                          </span>
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => { setSelectedEngineer(engineer); setShowDeleteModal(true); }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Engineer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title="Add Nominated Technical Person"
        size="md"
      >
        <div className="space-y-5">
          <p className="text-slate-300 text-sm">
            Add a qualified person who carries out installations for your company. They will receive login credentials and can manage installations, upload commissioning documents, and submit completed jobs.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
              placeholder="James Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
              placeholder="james@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 outline-none"
              placeholder="+44 7700 900000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password *</label>
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
              They will use this to log in. They can change it later.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Installation Types *</label>
            <p className="text-xs text-slate-500 mb-3">What types of installations will this person carry out?</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATION_OPTIONS.map(spec => {
                const isSelected = formData.specializations.includes(spec);
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => handleSpecToggle(spec)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-energy-500/20 text-energy-300 border border-energy-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {NTP_SPECIALIZATION_LABELS[spec]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
            <p className="text-sm text-primary-300">
              <strong>Note:</strong> You can upload their ID documents and qualification cards after creating the account. They will also receive a welcome email with login credentials.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreateEngineer}
              isLoading={isLoading}
              leftIcon={<Plus className="w-4 h-4" />}
              className="flex-1"
              disabled={!formData.fullName.trim() || !formData.email.trim() || formData.password.length < 6 || formData.specializations.length === 0}
            >
              Add Person
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedEngineer(null); }}
        onConfirm={handleDeleteEngineer}
        title="Remove Technical Person"
        message={`Are you sure you want to remove ${selectedEngineer?.fullName}? This will delete their account and they will no longer be able to access the system.`}
        confirmText="Remove Person"
        variant="danger"
      />
    </div>
  );
}
