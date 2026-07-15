import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Building2,
  ChevronRight,
  Edit,
  FileText,
  FolderOpen,
  Handshake,
  LayoutGrid,
  Link2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TypeConfirmModal } from '../../components/ui/Modal';
import { ProjectTechnologyList } from '../../components/projects/ProjectTechnologyList';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { mapProjectRow } from '../../lib/projects';
import { deleteHeliosProjectWithSimpliHeat } from '../../lib/simpliheatProjects';
import { cn } from '../../utils/cn';
import type { Project, ProjectStatus } from '../../types';

const DETAIL_TABS = [
  { id: 'summary', label: 'Summary', icon: LayoutGrid, enabled: true },
  { id: 'proposal', label: 'Proposal', icon: FileText, enabled: false },
  { id: 'in-house', label: 'In-House', icon: Building2, enabled: false },
  { id: 'handover', label: 'Handover', icon: Handshake, enabled: false },
  { id: 'files', label: 'Files', icon: FolderOpen, enabled: false },
] as const;

const PROJECT_STATUS_LABELS: Record<ProjectStatus, { label: string; variant: 'slate' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  draft: { label: 'Draft', variant: 'slate' },
  active: { label: 'Active', variant: 'primary' },
  on_hold: { label: 'On hold', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

function DetailField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-slate-800/70 last:border-0">
      {icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-slate-400">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm text-white break-words">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4 mb-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
        {icon}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h2>
    </div>
  );
}

function getLinkedSimpliHeatLabel(project: Project): string {
  if (project.linkedSimpliHeatProjectName) {
    return project.linkedSimpliHeatProjectName;
  }

  if (project.linkedSimpliHeatProjectId != null) {
    return `SH-${project.linkedSimpliHeatProjectId} · ${project.name}`;
  }

  return '';
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof DETAIL_TABS)[number]['id']>('summary');

  useEffect(() => {
    if (!id) return;

    const loadProject = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
        if (error) throw error;
        setProject(mapProjectRow(data));
      } catch (error) {
        console.error('Error loading project:', error);
        toast.error('Failed to load project');
        navigate('/installer/projects');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [id, navigate, toast]);

  const handleDelete = async () => {
    if (!project) return;
    setIsDeleting(true);
    try {
      const result = await deleteHeliosProjectWithSimpliHeat(project.id);
      if (!result.deleted) {
        throw new Error(result.error || 'delete_failed');
      }

      toast.success(
        result.simpliheatDeleted
          ? 'Project deleted from heliOS and Simpli Heat'
          : 'Project deleted',
      );
      navigate('/installer/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  if (!project) return null;

  const linkedSimpliHeatLabel = getLinkedSimpliHeatLabel(project);
  const statusConfig = PROJECT_STATUS_LABELS[project.status] ?? PROJECT_STATUS_LABELS.draft;

  return (
    <div className="space-y-4 max-w-[1400px]">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/installer/projects" className="hover:text-white transition-colors">
          Projects
        </Link>
        <ChevronRight className="w-4 h-4 shrink-0" />
        <span className="text-slate-300 truncate">{project.name}</span>
      </nav>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl shadow-black/20">
        <header className="border-b border-slate-800 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-400/90">
                Project workspace
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <h1 className="page-title truncate text-xl sm:text-2xl">{project.name}</h1>
                <Badge variant={statusConfig.variant} size="sm">
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{project.reference}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                leftIcon={<Edit className="w-4 h-4" />}
                onClick={() => navigate(`/installer/projects/${project.id}/edit`)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </Button>
            </div>
          </div>

          {project.linkedSimpliHeatProjectId != null && (
            <div className="mt-4 flex min-w-0 items-center gap-3 rounded-xl border border-primary-500/30 bg-gradient-to-r from-primary-500/10 to-transparent px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/15 text-primary-400">
                <Link2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-400/90">
                  Linked Simpli Heat
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-white">
                  {linkedSimpliHeatLabel}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Heat-loss design linked from Simpli Heat.
                </p>
              </div>
            </div>
          )}
        </header>

        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <aside
            className="border-b border-slate-800 bg-slate-950/50 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
            aria-label="Project sections"
          >
            <div className="p-3 sm:p-4">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Sections
              </p>
              <ul className="flex flex-col gap-0.5">
                {DETAIL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        disabled={!tab.enabled}
                        onClick={() => tab.enabled && setActiveTab(tab.id)}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all',
                          isActive
                            ? 'bg-primary-500/15 text-primary-300 shadow-sm shadow-primary-500/10'
                            : 'text-slate-400',
                          !tab.enabled && 'cursor-not-allowed opacity-60',
                          tab.enabled && !isActive && 'hover:bg-slate-800/60 hover:text-slate-200',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                            isActive
                              ? 'bg-primary-500/20 text-primary-400'
                              : 'bg-slate-800/80 text-slate-500 group-hover:text-slate-300',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate">{tab.label}</span>
                        {!tab.enabled && (
                          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Soon
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          <div className="flex-1 min-w-0 p-5 sm:p-6">
            {activeTab === 'summary' && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                <Card padding="none" className="overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <SectionHeader title="Customer details" icon={<User className="h-4 w-4" />} />
                    <DetailField
                      label="Contact"
                      value={project.customerName || 'Not provided'}
                      icon={<User className="h-4 w-4" />}
                    />
                    <DetailField
                      label="Address"
                      value={project.siteAddress || 'Not provided'}
                      icon={<MapPin className="h-4 w-4" />}
                    />
                    <DetailField
                      label="Postcode"
                      value={project.postcode || 'Not provided'}
                      icon={<MapPin className="h-4 w-4" />}
                    />
                    <DetailField
                      label="Email address"
                      value={project.customerEmail || 'Not provided'}
                      icon={<Mail className="h-4 w-4" />}
                    />
                    <DetailField
                      label="Phone number"
                      value={project.customerPhone || 'Not provided'}
                      icon={<Phone className="h-4 w-4" />}
                    />
                  </div>
                </Card>

                <Card padding="none" className="overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <SectionHeader title="Project" icon={<LayoutGrid className="h-4 w-4" />} />
                    <div className="py-3.5 border-b border-slate-800/70">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Technologies
                      </p>
                      <ProjectTechnologyList project={project} />
                    </div>
                    <DetailField
                      label="Installer"
                      value={project.installerName || 'Not provided'}
                      icon={<User className="h-4 w-4" />}
                    />
                    <DetailField
                      label="Created"
                      value={format(new Date(project.createdAt), 'dd MMM yyyy')}
                    />
                    <DetailField
                      label="Last updated"
                      value={format(new Date(project.updatedAt), 'dd MMM yyyy')}
                    />
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      <TypeConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={
          project.linkedSimpliHeatProjectId != null
            ? 'This will permanently delete this project from heliOS and Simpli Heat. This cannot be undone.'
            : 'This will permanently delete this project and cannot be undone.'
        }
        confirmValue={project.name}
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
