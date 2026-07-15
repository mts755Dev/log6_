import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { openSimpliHeat } from '../../lib/simpliheat';

/** Legacy route — opens SimpliHeat on its own site and returns to heliOS. */
export function SimpliHeatDesignerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { getCompany } = useData();

  useEffect(() => {
    const returnTo = searchParams.get('returnTo') || '/installer/projects/new';
    const projectIdParam = searchParams.get('p') || searchParams.get('projectId');
    const projectId = projectIdParam ? Number(projectIdParam) : null;
    const openProjectId = projectId != null && Number.isFinite(projectId) ? projectId : null;

    const company = user?.companyId ? getCompany(user.companyId) : null;
    openSimpliHeat(
      { projectId: openProjectId },
      { companyId: user?.companyId, companyName: company?.name },
    );
    navigate(returnTo, { replace: true });
  }, [getCompany, navigate, searchParams, user?.companyId]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="spinner w-10 h-10" />
    </div>
  );
}
