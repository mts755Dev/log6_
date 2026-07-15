import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, ArrowRight, Shield, Wrench, Users, Sun, Battery, Zap,
  User, Phone, Building2, FileText, ArrowLeft, CheckCircle2, Clock,
  ChevronDown, AlertTriangle, Circle,
} from 'lucide-react';
import { SimpliHeatConnectionBanner } from '../../components/auth/SimpliHeatConnectionBanner';
import { Logo } from '../../components/ui/Logo';
import { getStoredSimpliHeatLinkCode, storeSimpliHeatLinkCode, tryCompleteStoredSimpliHeatLinkWithRetry, clearStoredSimpliHeatLinkCode, markSimpliHeatLinkSuccess, hasPendingSimpliHeatLinkSuccess } from '../../lib/simpliheatLink';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { MultiFileUpload, type DocumentGroup } from '../../components/ui/MultiFileUpload';
import { supabase } from '../../lib/supabase';
import { uploadDocument, saveDocumentMetadata, getNextDocumentVersion } from '../../lib/storage';
import { scanDocument, terminateWorker } from '../../utils/documentScanner';
import type { UserRole, ConsumerCode } from '../../types';
import { CONSUMER_CODE_LABELS } from '../../types';

const roleConfig: Record<UserRole, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}> = {
  admin: {
    title: 'Admin Portal',
    subtitle: 'Platform management & analytics',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10',
  },
  installer: {
    title: 'Installer Portal',
    subtitle: 'Quotes, proposals & installations',
    icon: <Users className="w-6 h-6" />,
    color: 'text-energy-500',
    bgColor: 'bg-energy-500/10',
  },
  assessor: {
    title: 'Installer Portal',
    subtitle: 'Quotes, proposals & installations',
    icon: <Users className="w-6 h-6" />,
    color: 'text-energy-500',
    bgColor: 'bg-energy-500/10',
  },
  engineer: {
    title: 'Engineer Portal',
    subtitle: 'Field installations & commissioning',
    icon: <Wrench className="w-6 h-6" />,
    color: 'text-energy-500',
    bgColor: 'bg-energy-500/10',
  },
  compliance_officer: {
    title: 'Compliance Portal',
    subtitle: 'Installation reviews & approvals',
    icon: <CheckCircle2 className="w-6 h-6" />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
};

type DocumentKey = 'competencyCards' | 'certificates' | 'insurance' | 'mcsCertificate' | 'insuranceBackedGuarantee' | 'wasteLicense';

const DOC_TYPE_MAP: Record<DocumentKey, string> = {
  competencyCards: 'competency_cards',
  certificates: 'course_certificates',
  insurance: 'insurance',
  mcsCertificate: 'mcs_certificate',
  insuranceBackedGuarantee: 'ibg_certificate',
  wasteLicense: 'waste_carrier_license',
};

interface DocSectionConfig {
  key: DocumentKey;
  label: string;
  description: string;
  showDates: boolean;
  showReference: boolean;
  showProvider: boolean;
  groupLabel: string;
}

const documentSections: DocSectionConfig[] = [
  { key: 'competencyCards', label: 'Competency Cards', description: 'Upload competency cards with dates', showDates: true, showReference: true, showProvider: true, groupLabel: 'card' },
  { key: 'certificates', label: 'Course Completion Certificates', description: 'Certificates of course completion', showDates: true, showReference: true, showProvider: true, groupLabel: 'certificate' },
  { key: 'insurance', label: 'Insurance Documents', description: 'Public liability and professional indemnity insurance', showDates: true, showReference: true, showProvider: true, groupLabel: 'document' },
  { key: 'mcsCertificate', label: 'MCS Certificate', description: 'MCS certificate', showDates: true, showReference: true, showProvider: false, groupLabel: 'certificate' },
  { key: 'insuranceBackedGuarantee', label: 'IBG Provider Certificate', description: 'Insurance Backed Guarantee certificate', showDates: true, showReference: true, showProvider: true, groupLabel: 'certificate' },
];

const EMPTY_GROUP: DocumentGroup = {
  files: [], issuedDate: '', expiryDate: '', referenceNumber: '', providerName: '', scanStatus: 'idle',
};

type InstallerSignupResult = {
  success?: boolean;
  userId?: string;
  companyId?: string;
  company_id?: string;
  session?: { access_token: string; refresh_token: string };
  simpliheatLinked?: boolean;
  simpliheatUserId?: string;
  error?: string;
};

type PendingInstallerSignup = {
  userId: string;
  companyId: string;
};

const PENDING_SIGNUP_STORAGE_KEY = 'helios_pending_installer_signup';

function readPendingSignupFromStorage(): PendingInstallerSignup | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInstallerSignup;
    if (parsed?.userId && parsed?.companyId) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writePendingSignupToStorage(signup: PendingInstallerSignup) {
  sessionStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(signup));
}

function clearPendingSignupStorage() {
  sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}

function buildInstallerLoginNavigateState(message: string, email: string) {
  const simpliheatLinked = hasPendingSimpliHeatLinkSuccess();
  const simpliheatFlow = simpliheatLinked || Boolean(getStoredSimpliHeatLinkCode());

  return {
    message,
    email,
    ...(simpliheatFlow ? { simpliheatFlow: true, simpliheatLinked } : {}),
  };
}

async function parseInstallerSignupInvoke(
  accountResult: unknown,
  accountError: Error | null,
): Promise<InstallerSignupResult | null> {
  let payload = accountResult as InstallerSignupResult | null;
  if (!payload && accountError && 'context' in accountError) {
    try {
      const ctx = (accountError as { context?: { json?: () => Promise<InstallerSignupResult> } }).context;
      payload = (await ctx?.json?.()) ?? null;
    } catch {
      // ignore
    }
  }
  return payload;
}

export function SignupPage() {
  const { role } = useParams<{ role: UserRole }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', companyName: '', password: '', confirmPassword: '',
  });

  // Multi-file document groups per document type
  const [docGroups, setDocGroups] = useState<Record<DocumentKey, DocumentGroup[]>>({
    competencyCards: [{ ...EMPTY_GROUP }],
    certificates: [{ ...EMPTY_GROUP }],
    insurance: [{ ...EMPTY_GROUP }],
    mcsCertificate: [{ ...EMPTY_GROUP }],
    insuranceBackedGuarantee: [{ ...EMPTY_GROUP }],
    wasteLicense: [{ ...EMPTY_GROUP }],
  });

  const [useExternalWasteCarrier, setUseExternalWasteCarrier] = useState('');
  const [selectedConsumerCode, setSelectedConsumerCode] = useState('');
  const [deferredDocuments, setDeferredDocuments] = useState<Record<string, boolean>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<PendingInstallerSignup | null>(null);
  const [signupCompleted, setSignupCompleted] = useState(false);
  const [simpliHeatPending, setSimpliHeatPending] = useState(false);

  const pendingSignupRef = useRef<PendingInstallerSignup | null>(null);
  const signupCompletedRef = useRef(false);

  const resolvedRole = role === 'assessor' ? 'installer' : role;
  const config = resolvedRole && roleConfig[resolvedRole] ? roleConfig[resolvedRole] : roleConfig.installer;
  const currentRole = resolvedRole || 'installer';
  const isInstaller = currentRole === 'installer';

  useEffect(() => {
    if (role === 'assessor') {
      navigate('/signup/installer', { replace: true });
    }
  }, [role, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linkCode = params.get('simpliheat_link');

    if (linkCode) {
      storeSimpliHeatLinkCode(linkCode);
      setSimpliHeatPending(true);
      if (role !== 'installer') {
        navigate('/signup/installer', { replace: true });
      }
      return;
    }

    if (getStoredSimpliHeatLinkCode()) {
      setSimpliHeatPending(true);
    }
  }, [location.search, navigate, role]);
  const totalSteps = isInstaller ? 2 : 1;

  useEffect(() => {
    pendingSignupRef.current = pendingSignup;
  }, [pendingSignup]);

  useEffect(() => {
    signupCompletedRef.current = signupCompleted;
  }, [signupCompleted]);

  const cancelPendingInstallerSignup = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    try {
      await supabase.functions.invoke('cancel-installer-signup', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.warn('cancel-installer-signup failed:', err);
    } finally {
      clearPendingSignupStorage();
      await supabase.auth.signOut();
    }
  }, []);

  const createInstallerAccountOnStep1 = useCallback(async (): Promise<PendingInstallerSignup> => {
    const simpliheatLinkCode = getStoredSimpliHeatLinkCode();
    const { data: accountResult, error: accountError } = await supabase.functions.invoke(
      'create-installer-account',
      {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone || null,
          companyName: formData.companyName.trim(),
          ...(simpliheatLinkCode ? { simpliheatLinkCode } : {}),
        },
      },
    );

    const accountPayload = await parseInstallerSignupInvoke(accountResult, accountError);
    const resolvedCompanyId = accountPayload?.companyId || accountPayload?.company_id;
    const accountFailureMessage =
      accountPayload?.error ||
      accountError?.message ||
      (accountError ? 'Installer signup service failed. Deploy create-installer-account and try again.' : null);

    if (accountFailureMessage || !accountPayload?.success || !accountPayload.userId || !resolvedCompanyId) {
      throw new Error(
        accountFailureMessage ||
          'Account creation failed. Deploy create-installer-account and try again.',
      );
    }

    if (accountPayload.simpliheatLinked) {
      clearStoredSimpliHeatLinkCode();
      markSimpliHeatLinkSuccess();
    }

    if (accountPayload.session?.access_token && accountPayload.session?.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accountPayload.session.access_token,
        refresh_token: accountPayload.session.refresh_token,
      });
      if (sessionError) {
        console.warn('setSession after signup failed:', sessionError);
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (signInError) {
        throw new Error('Account created but sign-in failed. Please try again.');
      }
    }

    const signup: PendingInstallerSignup = {
      userId: accountPayload.userId,
      companyId: String(resolvedCompanyId),
    };
    writePendingSignupToStorage(signup);
    return signup;
  }, [formData]);

  const resolveInstallerCompanyId = useCallback(
    async (userId: string, signup: PendingInstallerSignup | null): Promise<string> => {
      const fromState = signup?.companyId?.trim();
      if (fromState) return fromState;

      const fromStorage = readPendingSignupFromStorage()?.companyId?.trim();
      if (fromStorage) return fromStorage;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.company_id) return String(profile.company_id);

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      if (company?.id) return String(company.id);

      throw new Error(
        'Company ID is missing. Go back to step 1 and click Next again.',
      );
    },
    [],
  );

  useEffect(() => {
    const stored = readPendingSignupFromStorage();
    if (stored) {
      setPendingSignup(stored);
      setCurrentStep(1);
    }
  }, []);

  useEffect(() => {
    document.body.classList.add('dark');
    return () => {
      document.body.classList.remove('dark');
      terminateWorker();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDocGroupsChange = useCallback((key: DocumentKey, groups: DocumentGroup[]) => {
    setDocGroups(prev => ({ ...prev, [key]: groups }));
    const hasFiles = groups.some(g => g.files.length > 0);
    if (hasFiles) {
      setDeferredDocuments(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  const handleScanFile = useCallback((key: DocumentKey) => {
    return async (file: File, groupIndex: number) => {
      setDocGroups(prev => {
        const updated = [...prev[key]];
        updated[groupIndex] = { ...updated[groupIndex], scanStatus: 'scanning' };
        return { ...prev, [key]: updated };
      });

      try {
        const result = await scanDocument(file);
        setDocGroups(prev => {
          const updated = [...prev[key]];
          const group = { ...updated[groupIndex] };
          const scanned: DocumentGroup['scannedFields'] = {};

          if (result.issuedDate && !group.issuedDate) {
            group.issuedDate = result.issuedDate;
            scanned.issuedDate = result.issuedDate;
          }
          if (result.expiryDate && !group.expiryDate) {
            group.expiryDate = result.expiryDate;
            scanned.expiryDate = result.expiryDate;
          }
          if (result.referenceNumber && !group.referenceNumber) {
            group.referenceNumber = result.referenceNumber;
            scanned.referenceNumber = result.referenceNumber;
          }
          if (result.providerName && !group.providerName) {
            group.providerName = result.providerName;
            scanned.providerName = result.providerName;
          }
          if (result.holderName) scanned.holderName = result.holderName;
          if (result.qualificationType) scanned.qualificationType = result.qualificationType;
          if (result.organizationName) scanned.organizationName = result.organizationName;
          if (result.cardNumber) scanned.cardNumber = result.cardNumber;
          if (result.policyNumber) scanned.policyNumber = result.policyNumber;
          if (result.membershipId) scanned.membershipId = result.membershipId;

          group.scanStatus = 'done';
          group.scannedFields = scanned;
          group.rawText = result.rawText;
          group.confidence = result.confidence;
          updated[groupIndex] = group;
          return { ...prev, [key]: updated };
        });
      } catch {
        setDocGroups(prev => {
          const updated = [...prev[key]];
          updated[groupIndex] = { ...updated[groupIndex], scanStatus: 'error' };
          return { ...prev, [key]: updated };
        });
      }
    };
  }, []);

  const handleDeferToggle = (key: string) => {
    setDeferredDocuments(prev => ({ ...prev, [key]: !prev[key] }));
    if (!deferredDocuments[key]) {
      setExpandedSection(null);
    }
  };

  const getDocumentStatus = (key: DocumentKey): 'uploaded' | 'deferred' | 'pending' => {
    const groups = docGroups[key];
    if (groups.some(g => g.files.length > 0)) return 'uploaded';
    if (deferredDocuments[key]) return 'deferred';
    return 'pending';
  };

  const hasDeferredDocuments = Object.values(deferredDocuments).some(v => v);
  const completedCount = documentSections.filter(s => getDocumentStatus(s.key) !== 'pending').length;

  const isStep1Complete = () => {
    const basics =
      formData.fullName.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.password.length >= 6 &&
      formData.confirmPassword === formData.password;
    if (!isInstaller) return basics;
    return basics && formData.companyName.trim() !== '';
  };

  const isStep2Complete = () => {
    if (!isInstaller) return true;
    const allSectionsHandled = documentSections.every(s => getDocumentStatus(s.key) !== 'pending');
    const consumerCodeSelected = selectedConsumerCode !== '';
    const wasteCarrierAnswered = useExternalWasteCarrier !== '';
    const wasteLicenseHandled = useExternalWasteCarrier === 'no' ||
      docGroups.wasteLicense.some(g => g.files.length > 0) ||
      deferredDocuments['wasteLicense'];
    return allSectionsHandled && consumerCodeSelected && wasteCarrierAnswered && wasteLicenseHandled;
  };

  const handleNext = async () => {
    setError('');
    if (currentStep === 0) {
      if (!formData.fullName || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (isInstaller && !formData.companyName.trim()) {
        setError('Company name is required');
        return;
      }

      if (isInstaller) {
        setIsLoading(true);
        try {
          if (pendingSignup) {
            await cancelPendingInstallerSignup();
            setPendingSignup(null);
          }
          const created = await createInstallerAccountOnStep1();
          setPendingSignup(created);
          pendingSignupRef.current = created;
          if (getStoredSimpliHeatLinkCode()) {
            const linked = await tryCompleteStoredSimpliHeatLinkWithRetry();
            if (!linked) {
              console.warn('SimpliHeat link will retry after sign-in');
            }
          }
          setCurrentStep(1);
        } catch (err: any) {
          console.error('Step 1 account creation error:', err);
          setError(err.message || 'Failed to create installer account');
        } finally {
          setIsLoading(false);
        }
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!formData.fullName || !formData.email) {
      setError('Please fill in all required fields');
      return;
    }
    if (isInstaller && !formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (isInstaller && !isStep2Complete()) {
      setError('Please complete or defer all required documents');
      return;
    }

    setIsLoading(true);
    let userId: string | null = null;

    try {
      if (!isInstaller) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: currentRole,
              phone: formData.phone || null,
              company_name: formData.companyName || null,
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }
        navigate(`/login/${currentRole}`, {
          state: { message: 'Account created successfully! Please sign in.', email: formData.email },
        });
        return;
      }

      // Step 2: account + company already created on "Next" (step 1).
      const activeSignup = pendingSignup ?? readPendingSignupFromStorage();
      if (!activeSignup?.userId) {
        throw new Error('Please go back to step 1 and click Next first.');
      }

      userId = activeSignup.userId;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) {
          throw new Error('Please sign in to finish uploading documents. Try step 1 again if needed.');
        }
      }

      const companyId = await resolveInstallerCompanyId(userId, activeSignup);

      if (selectedConsumerCode) {
        const { error: companyUpdateError } = await supabase
          .from('companies')
          .update({ consumer_code: selectedConsumerCode })
          .eq('id', companyId);
        if (companyUpdateError) {
          throw new Error(`Failed to save consumer code: ${companyUpdateError.message}`);
        }
      }

      // Upload documents (multi-file)
      try {
        for (const section of documentSections) {
          if (deferredDocuments[section.key]) continue;
          const groups = docGroups[section.key];
          const dbType = DOC_TYPE_MAP[section.key];

          for (const group of groups) {
            for (const file of group.files) {
              const version = await getNextDocumentVersion(userId, dbType);
              const { path: filePath, file: uploaded } = await uploadDocument(
                file,
                userId,
                dbType,
                version,
                companyId
              );
              await saveDocumentMetadata(
                userId, dbType, uploaded.name, filePath, uploaded.size, version,
                group.issuedDate || undefined, group.expiryDate || undefined,
                companyId,
              );
            }
          }
        }

        // Waste license
        if (useExternalWasteCarrier === 'yes' && !deferredDocuments['wasteLicense']) {
          for (const group of docGroups.wasteLicense) {
            for (const file of group.files) {
              const version = await getNextDocumentVersion(userId, 'waste_carrier_license');
              const { path: filePath, file: uploaded } = await uploadDocument(
                file,
                userId,
                'waste_carrier_license',
                version,
                companyId
              );
              await saveDocumentMetadata(
                userId,
                'waste_carrier_license',
                uploaded.name,
                filePath,
                uploaded.size,
                version,
                undefined,
                undefined,
                companyId
              );
            }
          }
        }

        // Save installer settings
        const { error: settingsError } = await supabase.from('installer_settings').insert({
          user_id: userId,
          use_external_waste_carrier: useExternalWasteCarrier === 'yes',
        });
        if (settingsError) throw new Error(`Failed to save settings: ${settingsError.message}`);

        signupCompletedRef.current = true;
        setSignupCompleted(true);
        clearPendingSignupStorage();

        if (getStoredSimpliHeatLinkCode()) {
          await tryCompleteStoredSimpliHeatLinkWithRetry();
        }

        await supabase.auth.signOut();

        navigate(`/login/${currentRole}`, {
          state: buildInstallerLoginNavigateState(
            hasDeferredDocuments
              ? 'Account created! Please sign in and upload remaining documents from the Onboarding page.'
              : 'Account created successfully! Please sign in.',
            formData.email,
          ),
        });
        setIsLoading(false);
      } catch (uploadError: any) {
        console.error('Document upload error:', uploadError);
        setError(
          `Account created but document upload failed: ${uploadError.message || 'Unknown error'}. ` +
          `Please contact support or try uploading documents after logging in.`
        );
        setIsLoading(false);
        setTimeout(() => {
          navigate(`/login/${currentRole}`, {
            state: buildInstallerLoginNavigateState(
              'Account created. Please sign in and upload documents.',
              formData.email,
            ),
          });
        }, 5000);
        return;
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────

  const renderDocumentSection = (section: DocSectionConfig) => {
    const status = getDocumentStatus(section.key);
    const isExpanded = expandedSection === section.key && !deferredDocuments[section.key];
    const isDeferred = deferredDocuments[section.key];
    const groups = docGroups[section.key];
    const fileCount = groups.reduce((sum, g) => sum + g.files.length, 0);

    return (
      <div
        key={section.key}
        className={`border rounded-xl transition-all ${
          status === 'uploaded'
            ? 'border-green-500/30 bg-green-500/5'
            : status === 'deferred'
              ? 'border-amber-500/30 bg-amber-500/5'
              : isExpanded
                ? 'border-primary-500/40 bg-primary-500/5'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
        }`}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => {
            if (isDeferred) return;
            setExpandedSection(isExpanded ? null : section.key);
          }}
        >
          <div className="flex-shrink-0">
            {status === 'uploaded' ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : status === 'deferred' ? (
              <Clock className="w-5 h-5 text-amber-400" />
            ) : (
              <Circle className="w-5 h-5 text-slate-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${
              status === 'uploaded' ? 'text-green-300' : status === 'deferred' ? 'text-amber-300' : 'text-slate-200'
            }`}>
              {section.label}
            </p>
            {status === 'uploaded' && (
              <p className="text-xs text-slate-400 truncate">
                {fileCount} file{fileCount !== 1 ? 's' : ''} across {groups.filter(g => g.files.length > 0).length} {section.groupLabel}{groups.filter(g => g.files.length > 0).length !== 1 ? 's' : ''}
              </p>
            )}
            {status === 'deferred' && (
              <p className="text-xs text-amber-400/70">Will upload later</p>
            )}
          </div>

          <label
            className="flex items-center gap-2 text-xs cursor-pointer flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isDeferred}
              onChange={() => handleDeferToggle(section.key)}
              className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
            />
            <span className="text-slate-400 whitespace-nowrap">Upload later</span>
          </label>

          {!isDeferred && (
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
          )}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1">
                <MultiFileUpload
                  label=""
                  name={section.key}
                  groups={groups}
                  onChange={(g) => handleDocGroupsChange(section.key, g)}
                  onScanFile={handleScanFile(section.key)}
                  showDates={section.showDates}
                  showReference={section.showReference}
                  showProvider={section.showProvider}
                  groupLabel={section.groupLabel}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderStepIndicator = () => {
    if (!isInstaller) return null;
    const steps = [
      { label: 'Basic Information', sub: 'Account details' },
      { label: 'Certifications', sub: 'Documents & licenses' },
    ];
    return (
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              {i > 0 && (
                <div className={`h-0.5 w-10 flex-shrink-0 ${currentStep > i - 1 ? 'bg-primary-500' : 'bg-slate-700'}`} />
              )}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                currentStep === i
                  ? 'bg-primary-500 text-white'
                  : currentStep > i
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-400'
              }`}>
                {currentStep > i ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">{step.label}</p>
                <p className="text-[10px] text-slate-500">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const canProceed = () => {
    if (currentStep === 0) return isStep1Complete();
    return true; // Step 3 is optional
  };

  const isLastStep = currentStep === totalSteps - 1;
  const hasPendingInstallerAccount = Boolean(
    pendingSignup?.companyId || readPendingSignupFromStorage()?.companyId,
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900"
      >
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-energy-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/">
            <Logo size="xl" variant="dark" />
          </Link>

          <div className="max-w-md">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              <div className="flex items-center gap-3 mb-6">
                <Sun className="w-10 h-10 text-solar-400" />
                <Battery className="w-10 h-10 text-energy-400" />
                <Zap className="w-10 h-10 text-primary-400" />
              </div>
              <h1 className="text-4xl font-bold font-display text-white mb-4">
                Join heliOS Today
              </h1>
              <p className="text-lg text-slate-400 mb-8">
                Start generating professional battery storage quotes in minutes.
                Join hundreds of UK installers already using heliOS.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Quote Generation', value: '< 2 min' },
                { label: 'Active Installers', value: '500+' },
                { label: 'MCS Compliant', value: '100%' },
                { label: 'Free Trial', value: '14 days' },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="text-sm text-slate-500">
            &copy; 2025 heliOS Technologies Ltd. All rights reserved.
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Signup Form */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full lg:w-1/2 flex flex-col p-8 ${currentStep === 0 ? 'overflow-y-auto justify-center items-center' : ''}`}
      >
        <div className={`w-full ${currentStep === 0 ? 'max-w-md' : 'max-w-lg mx-auto flex flex-col h-full'}`}>
          {/* Mobile logo */}
          <div className="lg:hidden mb-6 flex-shrink-0">
            <Link to="/"><Logo size="xl" /></Link>
          </div>

          {/* Role indicator */}
          <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl mb-6 flex-shrink-0">
            <div className={`p-2.5 rounded-xl ${config.bgColor} ${config.color}`}>{config.icon}</div>
            <div>
              <p className="font-semibold text-white text-sm">{config.title}</p>
              <p className="text-xs text-slate-500">{config.subtitle}</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold font-display text-white mb-1 flex-shrink-0">Create your account</h2>
          <p className="text-slate-400 mb-6 text-sm flex-shrink-0">Get started with your {currentRole} account</p>

          {isInstaller && simpliHeatPending && <SimpliHeatConnectionBanner variant="signup" />}

          {renderStepIndicator()}

          <form onSubmit={handleSubmit} className={`${currentStep > 0 ? 'flex flex-col flex-1 min-h-0' : 'space-y-5'}`}>
            <AnimatePresence mode="wait">
              {/* ── Step 1: Basic Information ── */}
              {currentStep === 0 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-5">
                  <Input label="Full Name" name="fullName" type="text" placeholder="John Doe" value={formData.fullName} onChange={handleChange} leftIcon={<User className="w-4 h-4" />} required />
                  <Input label="Email Address" name="email" type="email" placeholder="you@company.com" value={formData.email} onChange={handleChange} leftIcon={<Mail className="w-4 h-4" />} required />
                  <Input label="Phone Number (Optional)" name="phone" type="tel" placeholder="+44 7700 900000" value={formData.phone} onChange={handleChange} leftIcon={<Phone className="w-4 h-4" />} />
                  {isInstaller && (
                    <Input label="Company Name" name="companyName" type="text" placeholder="Your Company Ltd" value={formData.companyName} onChange={handleChange} leftIcon={<Building2 className="w-4 h-4" />} required />
                  )}
                  <Input label="Password" name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} leftIcon={<Lock className="w-4 h-4" />} required />
                  <Input label="Confirm Password" name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} leftIcon={<Lock className="w-4 h-4" />} required />
                </motion.div>
              )}

              {/* ── Step 2: Documents & Certifications ── */}
              {currentStep === 1 && isInstaller && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex gap-3 items-center">
                      <div className="p-2 bg-primary-500/10 rounded-lg">
                        <FileText className="w-4 h-4 text-primary-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Required Documents</h3>
                        <p className="text-xs text-slate-400">Upload multiple files per document &mdash; OCR auto-fills dates &amp; refs</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full">
                      {completedCount}/{documentSections.length} complete
                    </div>
                  </div>

                  {!hasPendingInstallerAccount && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4 flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300/90 leading-relaxed">
                        Please complete step 1 first. Click <span className="font-semibold">Back</span>, then <span className="font-semibold">Next</span> to continue.
                      </p>
                    </motion.div>
                  )}

                  {hasPendingInstallerAccount && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-start gap-2.5 p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-4 flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-green-300/90 leading-relaxed">
                        Upload your documents below, then continue to finish registration.
                      </p>
                    </motion.div>
                  )}

                  {hasDeferredDocuments && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300/90 leading-relaxed">
                        <span className="font-semibold">Compliance notice:</span> MCS compliance documents and installation certifications cannot be generated until all required documents have been uploaded. You can upload them later from the Onboarding page.
                      </p>
                    </motion.div>
                  )}

                  <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 custom-scrollbar">
                    {documentSections.map(renderDocumentSection)}

                    {/* Consumer Code Selection */}
                    <div className="border border-slate-700/50 bg-slate-800/30 rounded-xl px-4 py-3 space-y-2">
                      <Select
                        label="Consumer Code Membership"
                        value={selectedConsumerCode}
                        onChange={(e) => setSelectedConsumerCode(e.target.value)}
                        options={Object.entries(CONSUMER_CODE_LABELS).map(([value, label]) => ({ value, label }))}
                        placeholder="Select your consumer code..."
                        required
                      />
                      {selectedConsumerCode && (
                        <p className="text-xs text-green-400/80">
                          The standard {selectedConsumerCode} consumer code leaflet will be automatically attached to your customer proposals.
                        </p>
                      )}
                    </div>

                    {/* Waste Carrier */}
                    <div className="border border-slate-700/50 bg-slate-800/30 rounded-xl px-4 py-3 space-y-3 mt-2">
                      <Select
                        label="Will you use an external waste carrier?"
                        value={useExternalWasteCarrier}
                        onChange={(e) => setUseExternalWasteCarrier(e.target.value)}
                        options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                        placeholder="Please select..."
                        required
                      />
                      {useExternalWasteCarrier === 'yes' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                          {(() => {
                            const wStatus = docGroups.wasteLicense.some(g => g.files.length > 0) ? 'uploaded' : deferredDocuments['wasteLicense'] ? 'deferred' : 'pending';
                            const isWasteDeferred = deferredDocuments['wasteLicense'];
                            return (
                              <div className={`border rounded-xl transition-all ${wStatus === 'uploaded' ? 'border-green-500/30 bg-green-500/5' : wStatus === 'deferred' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                                <div className="flex items-center gap-3 px-4 py-3">
                                  <div className="flex-shrink-0">
                                    {wStatus === 'uploaded' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : wStatus === 'deferred' ? <Clock className="w-5 h-5 text-amber-400" /> : <Circle className="w-5 h-5 text-slate-500" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${wStatus === 'uploaded' ? 'text-green-300' : wStatus === 'deferred' ? 'text-amber-300' : 'text-slate-200'}`}>
                                      Waste / WEEE Transfer License
                                    </p>
                                    {wStatus === 'deferred' && <p className="text-xs text-amber-400/70">Will upload later</p>}
                                  </div>
                                  <label className="flex items-center gap-2 text-xs cursor-pointer flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={!!isWasteDeferred} onChange={() => handleDeferToggle('wasteLicense')} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/20 cursor-pointer" />
                                    <span className="text-slate-400 whitespace-nowrap">Upload later</span>
                                  </label>
                                </div>
                                {!isWasteDeferred && !docGroups.wasteLicense.some(g => g.files.length > 0) && (
                                  <div className="px-4 pb-4 pt-1">
                                    <MultiFileUpload
                                      label=""
                                      name="wasteLicense"
                                      groups={docGroups.wasteLicense}
                                      onChange={(g) => handleDocGroupsChange('wasteLicense', g)}
                                      onScanFile={handleScanFile('wasteLicense')}
                                      groupLabel="license"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 flex-shrink-0 mt-4">
                {error}
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 flex-shrink-0">
              {currentStep > 0 && isInstaller && (
                <Button type="button" onClick={handleBack} variant="secondary" size="lg" leftIcon={<ArrowLeft className="w-4 h-4" />} className="flex-1">
                  Back
                </Button>
              )}

              {!isLastStep && isInstaller ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className={currentStep === 0 ? 'w-full' : 'flex-1'}
                  size="lg"
                  isLoading={isLoading && currentStep === 0}
                  disabled={!canProceed() || isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1"
                  size="lg"
                  isLoading={isLoading}
                  disabled={
                    isInstaller &&
                    currentStep === 1 &&
                    (!isStep2Complete() || !hasPendingInstallerAccount)
                  }
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Complete Signup
                </Button>
              )}
            </div>

          </form>

          {/* Sign In Link */}
          <div className="mt-4 text-center flex-shrink-0">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <Link to={`/login/${currentRole}`} className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
                Sign In
              </Link>
            </p>
          </div>

          {/* Portal switcher + back to home (step 1 only) */}
          {currentStep === 0 && (
            <>
              <div className="mt-6 pt-4 border-t border-slate-800 flex-shrink-0">
                <p className="text-sm text-slate-500 text-center mb-4">Switch portal</p>
                <div className="flex justify-center gap-3">
                  {Object.entries(roleConfig)
                    .filter(([key]) => key !== 'admin' && key !== 'assessor')
                    .map(([key, value]) => (
                      <Link
                        key={key}
                        to={`/signup/${key}`}
                        className={`p-3 rounded-xl border transition-all ${
                          key === currentRole
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                        title={value.title}
                      >
                        {value.icon}
                      </Link>
                    ))}
                </div>
              </div>
              <div className="mt-6 text-center flex-shrink-0">
                <Link to="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                  &larr; Back to home
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
