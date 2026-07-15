import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { format } from 'date-fns';
import { Flame, Link2, Plus, Search, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchSimpliHeatProjectsForUser,
  resolveSimpliHeatUserIdForCompany,
  type SimpliHeatProjectRow,
} from '../../lib/simpliheatProjects';

export interface LinkedSimpliHeatProject {
  id: number;
  name: string;
  reference: string;
}

interface LinkSimpliHeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProject: LinkedSimpliHeatProject | null;
  onSelectProject: (project: LinkedSimpliHeatProject | null) => void;
  /** Called after choosing to create a new Simpli Heat plan (e.g. advance wizard to Review). */
  onAfterCreateNew?: () => void;
  /** Return false to block create/link actions (e.g. missing project name on the wizard). */
  onRequireProjectName?: () => boolean;
}

export function LinkSimpliHeatModal({
  isOpen,
  onClose,
  selectedProject,
  onSelectProject,
  onAfterCreateNew,
  onRequireProjectName,
}: LinkSimpliHeatModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState<SimpliHeatProjectRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resolveSimpliHeatUserId = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;
    return resolveSimpliHeatUserIdForCompany(user.id, user.companyId);
  }, [user?.companyId, user?.id]);

  const fetchSimpliHeatProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const simpliHeatUserId = await resolveSimpliHeatUserId();
      if (!simpliHeatUserId) {
        setProjects([]);
        return;
      }

      const rows = await fetchSimpliHeatProjectsForUser(simpliHeatUserId);
      setProjects(rows);
    } catch (error) {
      console.error('Error loading Simpli Heat projects:', error);
      toast.error('Failed to load Simpli Heat projects');
    } finally {
      setIsLoading(false);
    }
  }, [resolveSimpliHeatUserId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchSimpliHeatProjects();
    }
  }, [fetchSimpliHeatProjects, isOpen]);

  const filteredProjects = projects.filter((project) => {
    const query = searchTerm.toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      project.reference.toLowerCase().includes(query) ||
      project.customerName.toLowerCase().includes(query) ||
      project.postcode.toLowerCase().includes(query)
    );
  });

  const handleCreateNew = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (onRequireProjectName && !onRequireProjectName()) {
      onClose();
      return;
    }
    onSelectProject(null);
    onClose();
    onAfterCreateNew?.();
    toast.success('Save this project to link a new Simpli Heat design from My Projects.');
  };

  const handleLink = (project: SimpliHeatProjectRow) => {
    onSelectProject({
      id: project.id,
      name: project.name,
      reference: project.reference,
    });
    toast.success(`Linked to ${project.reference}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simpli Heat Projects"
      description="Link this heliOS job to a SimpliHeat heat-loss plan saved on your account."
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Flame className="w-4 h-4 text-primary-400" />
            <span>{filteredProjects.length} Simpli Heat project{filteredProjects.length === 1 ? '' : 's'}</span>
          </div>
          <Button type="button" onClick={handleCreateNew} leftIcon={<Plus className="w-4 h-4" />}>
            Create Simpli Heat Project
          </Button>
        </div>

        <Input
          placeholder="Search by project, customer, reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        {selectedProject && (
          <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-sm text-slate-200">
            Currently linked: <span className="font-medium text-white">{selectedProject.reference}</span>
            {' · '}
            {selectedProject.name}
            <button
              type="button"
              onClick={() => onSelectProject(null)}
              className="ml-3 text-primary-300 hover:text-white underline"
            >
              Remove link
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner w-8 h-8" />
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto app-scrollbar pr-1">
            {filteredProjects.map((project) => {
              const isLinked = selectedProject?.id === project.id;

              return (
              <div
                key={project.id}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4',
                  isLinked
                    ? 'border-primary-500/40 bg-primary-500/10'
                    : 'border-slate-800 bg-slate-800/30',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-primary-400">{project.reference}</span>
                    {project.totalHeatLossW != null && (
                      <span className="text-xs text-slate-500">
                        {(project.totalHeatLossW / 1000).toFixed(1)} kW
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-white truncate">{project.name}</p>
                  <p className="text-sm text-slate-500">
                    {project.customerName || 'No customer'}
                    {project.postcode ? ` · ${project.postcode}` : ''}
                    {' · '}
                    Updated {format(new Date(project.updatedAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isLinked ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleLink(project)}
                  leftIcon={isLinked ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  className="shrink-0"
                  disabled={isLinked}
                >
                  {isLinked ? 'Linked' : 'Link'}
                </Button>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/20 px-6 py-10 text-center">
            <Flame className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">No Simpli Heat projects yet</p>
            <p className="text-sm text-slate-500 mb-4">
              Sign in to SimpliHeat with the same account, save a heat-loss plan, then return here.
            </p>
            <Button type="button" onClick={handleCreateNew} leftIcon={<Plus className="w-4 h-4" />}>
              Create Simpli Heat Project
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
