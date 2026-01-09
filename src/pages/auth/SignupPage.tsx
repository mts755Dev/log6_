import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, Shield, Wrench, Users, Sun, Battery, Zap, User, Phone, Building2, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { FileUpload } from '../../components/ui/FileUpload';
import { FileUploadWithDates } from '../../components/ui/FileUploadWithDates';
import { Select } from '../../components/ui/Select';
import { supabase } from '../../lib/supabase';
import { uploadDocument, saveDocumentMetadata, getNextDocumentVersion } from '../../lib/storage';
import type { UserRole } from '../../types';

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
    icon: <Wrench className="w-6 h-6" />,
    color: 'text-energy-500',
    bgColor: 'bg-energy-500/10',
  },
  assessor: {
    title: 'Assessor Portal',
    subtitle: 'Reviews & certifications',
    icon: <Users className="w-6 h-6" />,
    color: 'text-solar-500',
    bgColor: 'bg-solar-500/10',
  },
};

export function SignupPage() {
  const { role } = useParams<{ role: UserRole }>();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    password: '',
    confirmPassword: '',
  });
  
  // Document fields for installers (Step 2)
  const [documents, setDocuments] = useState({
    competencyCards: { file: null as File | null, issuedDate: '', expiryDate: '' },
    certificates: null as File | null,
    insurance: null as File | null,
    mcsCertificate: null as File | null,
    consumerCode: null as File | null,
    insuranceBackedGuarantee: null as File | null,
    useExternalWasteCarrier: '',
    wasteLicense: null as File | null,
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const config = role && roleConfig[role] ? roleConfig[role] : roleConfig.installer;
  const currentRole = role || 'installer';

  // Add dark class to body for dashboard-style signup
  useEffect(() => {
    document.body.classList.add('dark');
    return () => document.body.classList.remove('dark');
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleDocumentChange = (name: string, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [name]: file
    }));
  };

  // Check if step 1 (basic info) is complete
  const isStep1Complete = () => {
    return formData.fullName.trim() !== '' &&
           formData.email.trim() !== '' &&
           formData.password.length >= 6 &&
           formData.confirmPassword === formData.password;
  };

  // Check if step 2 (documents) is complete for installers
  const isStep2Complete = () => {
    if (currentRole !== 'installer') return true;
    
    return documents.competencyCards.file !== null &&
           documents.competencyCards.issuedDate !== '' &&
           documents.competencyCards.expiryDate !== '' &&
           documents.certificates !== null &&
           documents.insurance !== null &&
           documents.mcsCertificate !== null &&
           documents.consumerCode !== null &&
           documents.insuranceBackedGuarantee !== null &&
           documents.useExternalWasteCarrier !== '' &&
           (documents.useExternalWasteCarrier === 'no' || documents.wasteLicense !== null);
  };

  const handleNext = () => {
    setError('');
    
    // Validate step 1
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

    setCurrentStep(1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
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

    // For installers, validate documents on step 2
    if (currentRole === 'installer' && !isStep2Complete()) {
      setError('Please upload all required documents');
      return;
    }

    setIsLoading(true);
    let userId: string | null = null;
    let accountCreated = false;

    try {
      // For non-installers, create account directly
      if (currentRole !== 'installer') {
        const metadata = {
          full_name: formData.fullName,
          role: currentRole,
          phone: formData.phone || null,
          company_name: formData.companyName || null,
        };

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: metadata },
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }

        // Success! Redirect to login
        navigate(`/login/${currentRole}`, {
          state: { 
            message: 'Account created successfully! Please sign in.',
            email: formData.email 
          }
        });
        return;
      }

      // For installers: First validate all documents are ready
      if (currentRole === 'installer') {
        console.log('Starting installer signup with documents...');

        // Prepare metadata
        const metadata = {
          full_name: formData.fullName,
          role: currentRole,
          phone: formData.phone || null,
          company_name: formData.companyName || null,
        };

        // Create account
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: metadata },
        });

        if (signUpError) {
          throw new Error(`Account creation failed: ${signUpError.message}`);
        }

        if (!data.user) {
          throw new Error('Account creation failed: No user data returned');
        }

        userId = data.user.id;
        accountCreated = true;
        console.log('Account created successfully, uploading documents...');

        // Now upload documents
        try {
          // Upload competency cards with versioning and dates
          if (documents.competencyCards.file) {
            console.log('Uploading competency cards...');
            const version = await getNextDocumentVersion(userId, 'competency_cards');
            const filePath = await uploadDocument(
              documents.competencyCards.file,
              userId,
              'competency_cards',
              version
            );
            await saveDocumentMetadata(
              userId,
              'competency_cards',
              documents.competencyCards.file.name,
              filePath,
              documents.competencyCards.file.size,
              version,
              documents.competencyCards.issuedDate,
              documents.competencyCards.expiryDate
            );
          }

          // Upload other certificates
          if (documents.certificates) {
            console.log('Uploading certificates...');
            const version = await getNextDocumentVersion(userId, 'certificates');
            const filePath = await uploadDocument(documents.certificates, userId, 'certificates', version);
            await saveDocumentMetadata(
              userId,
              'certificates',
              documents.certificates.name,
              filePath,
              documents.certificates.size,
              version
            );
          }

          // Upload insurance documents
          if (documents.insurance) {
            console.log('Uploading insurance...');
            const version = await getNextDocumentVersion(userId, 'insurance');
            const filePath = await uploadDocument(documents.insurance, userId, 'insurance', version);
            await saveDocumentMetadata(
              userId,
              'insurance',
              documents.insurance.name,
              filePath,
              documents.insurance.size,
              version
            );
          }

          // Upload MCS certificate
          if (documents.mcsCertificate) {
            console.log('Uploading MCS certificate...');
            const version = await getNextDocumentVersion(userId, 'mcs_certificate');
            const filePath = await uploadDocument(documents.mcsCertificate, userId, 'mcs_certificate', version);
            await saveDocumentMetadata(
              userId,
              'mcs_certificate',
              documents.mcsCertificate.name,
              filePath,
              documents.mcsCertificate.size,
              version
            );
          }

          // Upload consumer code
          if (documents.consumerCode) {
            console.log('Uploading consumer code...');
            const version = await getNextDocumentVersion(userId, 'consumer_code');
            const filePath = await uploadDocument(documents.consumerCode, userId, 'consumer_code', version);
            await saveDocumentMetadata(
              userId,
              'consumer_code',
              documents.consumerCode.name,
              filePath,
              documents.consumerCode.size,
              version
            );
          }

          // Upload insurance backed guarantee
          if (documents.insuranceBackedGuarantee) {
            console.log('Uploading insurance backed guarantee...');
            const version = await getNextDocumentVersion(userId, 'insurance_backed_guarantee');
            const filePath = await uploadDocument(documents.insuranceBackedGuarantee, userId, 'insurance_backed_guarantee', version);
            await saveDocumentMetadata(
              userId,
              'insurance_backed_guarantee',
              documents.insuranceBackedGuarantee.name,
              filePath,
              documents.insuranceBackedGuarantee.size,
              version
            );
          }

          // Upload waste license if applicable
          if (documents.useExternalWasteCarrier === 'yes' && documents.wasteLicense) {
            console.log('Uploading waste license...');
            const version = await getNextDocumentVersion(userId, 'waste_license');
            const filePath = await uploadDocument(documents.wasteLicense, userId, 'waste_license', version);
            await saveDocumentMetadata(
              userId,
              'waste_license',
              documents.wasteLicense.name,
              filePath,
              documents.wasteLicense.size,
              version
            );
          }

          // Save waste carrier preference
          console.log('Saving installer settings...');
          const { error: settingsError } = await supabase.from('installer_settings').insert({
            user_id: userId,
            use_external_waste_carrier: documents.useExternalWasteCarrier === 'yes',
          });

          if (settingsError) {
            throw new Error(`Failed to save settings: ${settingsError.message}`);
          }

          console.log('All documents uploaded successfully!');

          // Success! Redirect to login
          navigate(`/login/${currentRole}`, {
            state: { 
              message: 'Account created successfully! Please sign in.',
              email: formData.email 
            }
          });

        } catch (uploadError: any) {
          console.error('Document upload error:', uploadError);
          
          // Account was created but documents failed
          setError(
            `Account created but document upload failed: ${uploadError.message || 'Unknown error'}. ` +
            `Please contact support or try uploading documents after logging in.`
          );
          setIsLoading(false);
          
          // Still redirect to login after a delay so user can access their account
          setTimeout(() => {
            navigate(`/login/${currentRole}`, {
              state: { 
                message: 'Account created. Please sign in and upload documents.',
                email: formData.email 
              }
            });
          }, 5000);
          return;
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-energy-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/">
            <Logo size="xl" variant="dark" />
          </Link>
          
          <div className="max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
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
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="grid grid-cols-2 gap-4"
            >
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
            © 2025 heliOS Technologies Ltd. All rights reserved.
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Signup Form */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto"
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link to="/">
              <Logo size="xl" />
            </Link>
          </div>

          {/* Role indicator */}
          <div className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl mb-8">
            <div className={`p-3 rounded-xl ${config.bgColor} ${config.color}`}>
              {config.icon}
            </div>
            <div>
              <p className="font-semibold text-white">{config.title}</p>
              <p className="text-sm text-slate-500">{config.subtitle}</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold font-display text-white mb-2">
            Create your account
          </h2>
          <p className="text-slate-400 mb-8">
            Get started with your {currentRole} account
          </p>

          {/* Step Indicator for Installers */}
          {currentRole === 'installer' && (
            <div className="mb-8">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStep === 0 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    {currentStep > 0 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Basic Information</p>
                    <p className="text-xs text-slate-500">Account details</p>
                  </div>
                </div>
                
                <div className={`h-0.5 w-12 ${currentStep > 0 ? 'bg-primary-500' : 'bg-slate-700'}`} />
                
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStep === 1 
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {/* Step 1: Basic Information */}
              {currentStep === 0 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <Input
                    label="Full Name"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                    leftIcon={<User className="w-4 h-4" />}
                    required
                  />

                  <Input
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    leftIcon={<Mail className="w-4 h-4" />}
                    required
                  />

                  <Input
                    label="Phone Number (Optional)"
                    name="phone"
                    type="tel"
                    placeholder="+44 7700 900000"
                    value={formData.phone}
                    onChange={handleChange}
                    leftIcon={<Phone className="w-4 h-4" />}
                  />

                  {currentRole === 'installer' && (
                    <Input
                      label="Company Name (Optional)"
                      name="companyName"
                      type="text"
                      placeholder="Your Company Ltd"
                      value={formData.companyName}
                      onChange={handleChange}
                      leftIcon={<Building2 className="w-4 h-4" />}
                    />
                  )}

                  <Input
                    label="Password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    leftIcon={<Lock className="w-4 h-4" />}
                    required
                  />

                  <Input
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    leftIcon={<Lock className="w-4 h-4" />}
                    required
                  />
                </motion.div>
              )}

              {/* Step 2: Documents & Certifications (Installer only) */}
              {currentStep === 1 && currentRole === 'installer' && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-4 mb-6">
                    <div className="flex gap-3">
                      <FileText className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-1">Required Documents</h3>
                        <p className="text-xs text-slate-400">
                          Please upload all required certifications and licenses. All files should be in PDF, PNG, or JPG format.
                        </p>
                      </div>
                    </div>
                  </div>

                  <FileUploadWithDates
                    label="Competency Cards"
                    name="competencyCards"
                    value={documents.competencyCards}
                    onChange={(data) => setDocuments({ ...documents, competencyCards: data })}
                    required
                  />

                  <FileUpload
                    label="Certificates of Course Completion"
                    name="certificates"
                    value={documents.certificates}
                    onChange={(file) => handleDocumentChange('certificates', file)}
                    required
                  />

                  <FileUpload
                    label="Insurance Documents"
                    name="insurance"
                    value={documents.insurance}
                    onChange={(file) => handleDocumentChange('insurance', file)}
                    required
                  />

                  <FileUpload
                    label="MCS Certificate"
                    name="mcsCertificate"
                    value={documents.mcsCertificate}
                    onChange={(file) => handleDocumentChange('mcsCertificate', file)}
                    required
                  />

                  <FileUpload
                    label="Consumer Code Membership"
                    name="consumerCode"
                    value={documents.consumerCode}
                    onChange={(file) => handleDocumentChange('consumerCode', file)}
                    required
                  />

                  <FileUpload
                    label="Insurance Backed Guarantee Provider Certificate"
                    name="insuranceBackedGuarantee"
                    value={documents.insuranceBackedGuarantee}
                    onChange={(file) => handleDocumentChange('insuranceBackedGuarantee', file)}
                    required
                  />

                  <Select
                    label="Will Installer use external waste carrier?"
                    value={documents.useExternalWasteCarrier}
                    onChange={(e) => setDocuments({ ...documents, useExternalWasteCarrier: e.target.value })}
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ]}
                    placeholder="Please select..."
                    required
                  />

                  {documents.useExternalWasteCarrier === 'yes' && (
                    <FileUpload
                      label="Waste Removal License / WEEE Transfer License"
                      name="wasteLicense"
                      value={documents.wasteLicense}
                      onChange={(file) => handleDocumentChange('wasteLicense', file)}
                      required
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {currentStep === 1 && currentRole === 'installer' && (
                <Button
                  type="button"
                  onClick={handleBack}
                  variant="secondary"
                  size="lg"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="flex-1"
                >
                  Back
                </Button>
              )}

              {currentStep === 0 && currentRole === 'installer' ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="w-full"
                  size="lg"
                  disabled={!isStep1Complete()}
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
                  disabled={currentRole === 'installer' && currentStep === 1 && !isStep2Complete()}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Account
                </Button>
              )}
            </div>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <Link
                to={`/login/${currentRole}`}
                className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>

          {/* Portal switcher */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-sm text-slate-500 text-center mb-4">Switch portal</p>
            <div className="flex justify-center gap-3">
              {Object.entries(roleConfig)
                .filter(([key]) => key !== 'admin') // Hide admin from portal switcher
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

          {/* Back to home */}
          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
