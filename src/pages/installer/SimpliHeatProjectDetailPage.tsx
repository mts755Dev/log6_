import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ensureHeliosProjectForSimpliHeat } from '../../lib/projects';
import { fetchSimpliHeatProjectById } from '../../lib/simpliheatProjects';

/** Resolves a SimpliHeat plan to its linked heliOS project, creating one if needed. */
export function SimpliHeatProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!id || !user?.id || !user.companyId) return;

    const projectId = Number(id);
    if (!Number.isFinite(projectId)) {
      navigate('/installer/projects', { replace: true });
      return;
    }

    let cancelled = false;

    const resolveProject = async () => {
      try {
        const shProject = await fetchSimpliHeatProjectById(projectId, user.id, user.companyId);
        if (cancelled) return;

        if (!shProject) {
          toast.error('Simpli Heat project not found');
          navigate('/installer/projects', { replace: true });
          return;
        }

        const heliosProjectId = await ensureHeliosProjectForSimpliHeat(shProject, user);
        if (cancelled) return;

        navigate(`/installer/projects/${heliosProjectId}`, { replace: true });
      } catch (error) {
        console.error('Error opening Simpli Heat project:', error);
        if (!cancelled) {
          toast.error('Failed to open project');
          navigate('/installer/projects', { replace: true });
        }
      }
    };

    resolveProject();

    return () => {
      cancelled = true;
    };
  }, [id, navigate, toast, user]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="spinner w-10 h-10" />
    </div>
  );
}
