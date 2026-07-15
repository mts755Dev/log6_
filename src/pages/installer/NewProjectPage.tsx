import { useState, useEffect, useRef, type ComponentType } from 'react';
import { useNavigate, useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  FolderKanban,
  FileText,
  Link2,
} from 'lucide-react';
import {
  SolarPanelIcon,
  BatteryTerminalsIcon,
  HeatPumpIcon,
} from '../../components/icons/TechnologyIcons';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UkAddressFields } from '../../components/ui/UkAddressFields';
import {
  LinkSimpliHeatModal,
  type LinkedSimpliHeatProject,
} from '../../components/projects/LinkSimpliHeatModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { generateProjectReference, mapProjectRow } from '../../lib/projects';
import { getSimpliHeatProjectSummary, syncHeliosProjectToSimpliHeat } from '../../lib/simpliheatProjects';
import { cn } from '../../utils/cn';
import type { ProjectStatus, ProjectTechnology, ProjectType } from '../../types';
import { PROJECT_TECHNOLOGY_LABELS } from '../../types';

const TECHNOLOGY_OPTIONS: {
  id: ProjectTechnology;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'solar', label: 'Solar', icon: SolarPanelIcon },
  { id: 'battery', label: 'Battery', icon: BatteryTerminalsIcon },
  { id: 'heat_pumps', label: 'Heat Pumps', icon: HeatPumpIcon },
];

function projectTypeToTechnologies(type: ProjectType): ProjectTechnology[] {
  if (type === 'simpliheat') return ['heat_pumps'];
  if (type === 'battery') return ['battery'];
  if (type === 'solar') return ['solar'];
  if (type === 'simplipv') return ['solar', 'battery'];
  return [];
}

function technologiesToProjectType(technologies: ProjectTechnology[]): ProjectType {
  if (technologies.includes('heat_pumps')) return 'simpliheat';
  return 'simplipv';
}

function getTechnologyLabels(technologies: ProjectTechnology[]): string {
  if (technologies.length === 0) return 'None selected';
  return technologies
    .map((technology) => PROJECT_TECHNOLOGY_LABELS[technology])
    .join(', ');
}

function hasSimpliPvTechnology(technologies: ProjectTechnology[]): boolean {
  return technologies.some((technology) => technology === 'solar' || technology === 'battery');
}

const steps = [
  { id: 'customer', title: 'Customer Info', icon: <User className="w-5 h-5" /> },
  { id: 'project', title: 'Project Details', icon: <FolderKanban className="w-5 h-5" /> },
  { id: 'review', title: 'Review', icon: <FileText className="w-5 h-5" /> },
];

type NewProjectLocationState = {
  linkedSimpliHeat?: LinkedSimpliHeatProject;
  prefill?: {
    name?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    siteAddress?: string;
    postcode?: string;
  };
};

export function NewProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isEditMode = Boolean(id);

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSimpliHeatModal, setShowSimpliHeatModal] = useState(false);
  const [linkedSimpliHeatProject, setLinkedSimpliHeatProject] =
    useState<LinkedSimpliHeatProject | null>(null);
  const [projectNameError, setProjectNameError] = useState('');
  const projectNameRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    technologies: [] as ProjectTechnology[],
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    siteAddress: '',
    postcode: '',
    status: 'draft' as ProjectStatus,
  });

  useEffect(() => {
    const technologyParam = searchParams.get('technology');
    if (!isEditMode && technologyParam === 'heat_pumps') {
      setFormData((current) => ({
        ...current,
        technologies: current.technologies.includes('heat_pumps')
          ? current.technologies
          : [...current.technologies, 'heat_pumps'],
      }));
      setCurrentStep(1);
    }
  }, [isEditMode, searchParams]);

  useEffect(() => {
    if (isEditMode) return;

    const state = location.state as NewProjectLocationState | null;
    if (!state?.linkedSimpliHeat && !state?.prefill) return;

    if (state.linkedSimpliHeat) {
      setLinkedSimpliHeatProject(state.linkedSimpliHeat);
    }

    if (state.prefill || state.linkedSimpliHeat) {
      setFormData((current) => ({
        ...current,
        name: state.prefill?.name || current.name,
        customerName: state.prefill?.customerName || current.customerName,
        customerEmail: state.prefill?.customerEmail || current.customerEmail,
        customerPhone: state.prefill?.customerPhone || current.customerPhone,
        siteAddress: state.prefill?.siteAddress || current.siteAddress,
        postcode: state.prefill?.postcode || current.postcode,
        technologies: state.linkedSimpliHeat
          ? current.technologies.includes('heat_pumps')
            ? current.technologies
            : [...current.technologies, 'heat_pumps']
          : current.technologies,
      }));
    }

    window.history.replaceState({}, document.title);
  }, [isEditMode, location.state]);

  useEffect(() => {
    if (!isEditMode || !id) return;

    let cancelled = false;

    const loadProject = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
        if (error) throw error;
        if (cancelled) return;

        const project = mapProjectRow(data);
        setFormData({
          name: project.name,
          technologies:
            project.technologies?.length
              ? project.technologies
              : projectTypeToTechnologies(project.projectType),
          customerName: project.customerName,
          customerEmail: project.customerEmail || '',
          customerPhone: project.customerPhone || '',
          siteAddress: project.siteAddress,
          postcode: project.postcode,
          status: project.status,
        });

        if (project.linkedSimpliHeatProjectId) {
          const summary = await getSimpliHeatProjectSummary(project.linkedSimpliHeatProjectId);
          if (cancelled) return;
          if (summary) {
            setLinkedSimpliHeatProject(summary);
          } else if (project.linkedSimpliHeatProjectName) {
            setLinkedSimpliHeatProject({
              id: project.linkedSimpliHeatProjectId,
              name: project.linkedSimpliHeatProjectName.split(' · ').slice(1).join(' · ') ||
                project.linkedSimpliHeatProjectName,
              reference:
                project.linkedSimpliHeatProjectName.split(' · ')[0] ||
                `SH-${project.linkedSimpliHeatProjectId}`,
            });
          }
        }
      } catch (error) {
        console.error('Error loading project:', error);
        toast.error('Failed to load project');
        navigate('/installer/projects');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [id, isEditMode, navigate, toast.error]);

  const toggleTechnology = (technology: ProjectTechnology) => {
    const isSelected = formData.technologies.includes(technology);

    if (isSelected && technology === 'heat_pumps') {
      setLinkedSimpliHeatProject(null);
    }

    setFormData((current) => ({
      ...current,
      technologies: isSelected
        ? current.technologies.filter((item) => item !== technology)
        : [...current.technologies, technology],
    }));
  };

  const handleSimpliPvLinkClick = () => {
    if (!requireProjectName()) return;
    navigate('/installer/quotes/new');
  };

  const handleSimpliHeatLinkClick = () => {
    if (!requireProjectName()) return;
    setShowSimpliHeatModal(true);
  };

  const requireProjectName = (): boolean => {
    if (formData.name.trim()) {
      setProjectNameError('');
      return true;
    }

    setProjectNameError('Project name is required');
    projectNameRef.current?.focus();
    projectNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  };

  const goToReviewStep = () => {
    setCurrentStep(steps.length - 1);
  };

  const hasHeatPumps = formData.technologies.includes('heat_pumps');
  const hasSimpliPv = hasSimpliPvTechnology(formData.technologies);
  const showLinkActions = hasHeatPumps || hasSimpliPv;

  const nextStep = () => {
    if (currentStep === 1 && !requireProjectName()) {
      return;
    }
    if (currentStep === 1 && formData.technologies.length === 0) {
      toast.error('Select at least one technology');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    if (!user?.companyId) {
      toast.error('Please log in to save a project');
      return;
    }

    if (!requireProjectName()) {
      return;
    }

    if (formData.technologies.length === 0) {
      toast.error('Select at least one technology');
      return;
    }

    setIsSubmitting(true);
    try {
      const linkedSimpliHeatFields = hasHeatPumps
          ? {
              linked_simpliheat_project_id: linkedSimpliHeatProject?.id ?? null,
              linked_simpliheat_project_name: linkedSimpliHeatProject
                ? `${linkedSimpliHeatProject.reference} · ${formData.name.trim()}`
                : null,
            }
          : {
              linked_simpliheat_project_id: null,
              linked_simpliheat_project_name: null,
            };

      const basePayload = {
        company_id: user.companyId,
        installer_id: user.id,
        installer_name: user.name,
        name: formData.name.trim(),
        project_type: technologiesToProjectType(formData.technologies),
        technologies: formData.technologies,
        customer_name: formData.customerName.trim(),
        customer_email: formData.customerEmail.trim() || null,
        customer_phone: formData.customerPhone.trim() || null,
        site_address: formData.siteAddress.trim(),
        postcode: formData.postcode.trim(),
        estimated_value: 0,
        status: formData.status,
        description: null,
        notes: null,
        ...linkedSimpliHeatFields,
        updated_at: new Date().toISOString(),
      };

      if (isEditMode && id) {
        const { error } = await supabase.from('projects').update(basePayload).eq('id', id);
        if (error) throw error;

        if (linkedSimpliHeatProject?.id) {
          const syncResult = await syncHeliosProjectToSimpliHeat(id);
          if (!syncResult.synced) {
            console.warn('SimpliHeat sync failed:', syncResult.error);
            toast.error('Project saved in heliOS, but Simpli Heat could not be updated.');
          }
        }

        toast.success('Project updated');
        navigate(`/installer/projects/${id}`);
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            ...basePayload,
            reference: generateProjectReference(),
          })
          .select('id')
          .single();

        if (error) throw error;

        if (linkedSimpliHeatProject?.id && data?.id) {
          const syncResult = await syncHeliosProjectToSimpliHeat(data.id);
          if (!syncResult.synced) {
            console.warn('SimpliHeat sync failed:', syncResult.error);
          }
        }

        toast.success('Project created');
        navigate(`/installer/projects/${data.id}`);
      }
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link to="/installer/projects">
          <button type="button" className="p-2 hover:bg-slate-800 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
        </Link>
        <div className="min-w-0">
          <h1 className="page-title text-lg sm:text-2xl">
            {isEditMode ? 'Edit Project' : 'Create New Project'}
          </h1>
          <p className="page-subtitle text-xs sm:text-sm">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </p>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center w-full min-w-max sm:min-w-0">
          {steps.map((step, index) => (
            <div key={step.id} className="contents">
              <button
                type="button"
                onClick={() => index < currentStep && setCurrentStep(index)}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all ${
                  index === currentStep
                    ? 'bg-primary-600 text-white'
                    : index < currentStep
                    ? 'bg-success-600/20 text-success-400 cursor-pointer hover:bg-success-600/30'
                    : 'bg-slate-800/50 text-slate-500'
                }`}
              >
                {index < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="[&>svg]:w-4 [&>svg]:h-4">{step.icon}</span>
                )}
                <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 min-w-4 flex-1 ${
                    index < currentStep ? 'bg-success-500' : 'bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="relative z-10"
        >
          {currentStep === 0 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <User className="w-5 h-5 text-primary-400" />
                Customer Information
              </h2>
              <div className="form-grid">
                <Input
                  label="Customer Name"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="John Smith"
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  placeholder="john@example.com"
                />
                <Input
                  label="Phone Number"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="07700 900123"
                />
                <UkAddressFields
                  address={formData.siteAddress}
                  postcode={formData.postcode}
                  onAddressChange={(siteAddress) =>
                    setFormData((current) => ({ ...current, siteAddress }))
                  }
                  onPostcodeChange={(postcode) =>
                    setFormData((current) => ({ ...current, postcode }))
                  }
                  addressLabel="Site Address"
                  addressClassName="md:col-span-2"
                />
              </div>
            </Card>
          )}

          {currentStep === 1 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary-400" />
                Project Details
              </h2>
              <div className="space-y-6">
                <Input
                  ref={projectNameRef}
                  label="Project Name"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({ ...formData, name });
                    if (name.trim()) setProjectNameError('');
                  }}
                  placeholder="e.g. Smith Residence Battery Install"
                  required
                  error={projectNameError}
                  hint={
                    !projectNameError && showLinkActions
                      ? 'Enter a project name before using Link / Create Simpli PV or Simpli Heat'
                      : undefined
                  }
                />

                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Technology details</h3>
                  <p className="text-sm text-slate-500 mb-4">Select one or more technologies</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {TECHNOLOGY_OPTIONS.map((technology) => {
                      const Icon = technology.icon;
                      const isSelected = formData.technologies.includes(technology.id);

                      return (
                        <button
                          key={technology.id}
                          type="button"
                          onClick={() => toggleTechnology(technology.id)}
                          className={cn(
                            'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 p-8 transition-all',
                            isSelected
                              ? 'border-primary-500 bg-primary-500/10 text-white shadow-lg shadow-primary-500/10'
                              : 'border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                          )}
                        >
                          {isSelected && (
                            <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-slate-950">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                          <Icon className={cn('h-14 w-14', isSelected ? 'text-primary-400' : '')} />
                          <span className="text-base font-semibold">{technology.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {showLinkActions && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
                    >
                      {hasSimpliPv && (
                        <Button
                          variant="secondary"
                          leftIcon={<Link2 className="w-4 h-4" />}
                          onClick={handleSimpliPvLinkClick}
                        >
                          Link / Create Simpli PV
                        </Button>
                      )}
                      {hasHeatPumps && (
                        <Button
                          variant="secondary"
                          leftIcon={<Link2 className="w-4 h-4" />}
                          onClick={handleSimpliHeatLinkClick}
                        >
                          {linkedSimpliHeatProject ? 'Open' : 'Link / Create Simpli Heat'}
                        </Button>
                      )}
                    </motion.div>
                  )}

                  {linkedSimpliHeatProject && hasHeatPumps && (
                    <p className="mt-3 text-sm text-slate-400">
                      Linked plan:{' '}
                      <span className="text-primary-300 font-medium">
                        {linkedSimpliHeatProject.reference}
                      </span>{' '}
                      · {linkedSimpliHeatProject.name}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-400" />
                Review Project
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3">Customer</h3>
                  <p className="text-white font-medium">
                    {formData.customerName.trim() || 'Not provided'}
                  </p>
                  {formData.customerEmail && (
                    <p className="text-slate-400 text-sm">{formData.customerEmail}</p>
                  )}
                  {formData.customerPhone && (
                    <p className="text-slate-400 text-sm">{formData.customerPhone}</p>
                  )}
                  {formData.siteAddress && (
                    <p className="text-slate-400 text-sm">{formData.siteAddress}</p>
                  )}
                  {formData.postcode && (
                    <p className="text-slate-400 text-sm">{formData.postcode}</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3">Project</h3>
                  <p className="text-white font-medium">{formData.name}</p>
                  <p className="text-slate-400 text-sm">
                    Technology: {getTechnologyLabels(formData.technologies)}
                  </p>
                  {hasHeatPumps && (
                    <div className="text-slate-400 text-sm mt-2">
                      {linkedSimpliHeatProject ? (
                        <p>
                          Simpli Heat:{' '}
                          <span className="text-white">
                            {linkedSimpliHeatProject.reference} · {linkedSimpliHeatProject.name}
                          </span>
                        </p>
                      ) : (
                        <p>No Simpli Heat plan linked — open from My Projects after saving.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  {isEditMode ? 'Save Changes' : 'Review completed'}
                </Button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="relative z-0 flex justify-between mt-6">
        <Button
          variant="secondary"
          onClick={prevStep}
          disabled={currentStep === 0}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        {currentStep < steps.length - 1 && (
          <Button onClick={nextStep} rightIcon={<ArrowRight className="w-4 h-4" />}>
            Next Step
          </Button>
        )}
      </div>

      <LinkSimpliHeatModal
        isOpen={showSimpliHeatModal}
        onClose={() => setShowSimpliHeatModal(false)}
        selectedProject={linkedSimpliHeatProject}
        onSelectProject={setLinkedSimpliHeatProject}
        onAfterCreateNew={goToReviewStep}
        onRequireProjectName={requireProjectName}
      />
    </div>
  );
}
