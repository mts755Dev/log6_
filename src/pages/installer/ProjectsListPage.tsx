import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProjectTechnologyIcons } from '../../components/projects/ProjectTechnologyIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import {
  buildMergedProjectList,
  formatProjectAddress,
  getProjectListItemSearchText,
  mapProjectRow,
  type ProjectListItem,
} from '../../lib/projects';
import {
  fetchSimpliHeatProjectsForUser,
  formatSimpliHeatProjectAddress,
  resolveSimpliHeatUserIdForCompany,
  type SimpliHeatProjectRow,
} from '../../lib/simpliheatProjects';
import { format } from 'date-fns';
import type { Project, ProjectTechnology } from '../../types';

const SIMPLIHEAT_LIST_PROJECT = {
  projectType: 'simpliheat' as const,
  technologies: ['heat_pumps'] as ProjectTechnology[],
};

const PAGE_SIZE = 10;

export function ProjectsListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [simpliHeatProjects, setSimpliHeatProjects] = useState<SimpliHeatProjectRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProjects = useCallback(async () => {
    if (!user?.companyId || !user.id) return;

    setIsLoading(true);
    try {
      const [projectsResult, simpliHeatUserId] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', user.companyId)
          .order('created_at', { ascending: false }),
        resolveSimpliHeatUserIdForCompany(user.id, user.companyId),
      ]);

      if (projectsResult.error) throw projectsResult.error;

      let mappedProjects = (projectsResult.data || []).map(mapProjectRow);

      if (!simpliHeatUserId) {
        mappedProjects = mappedProjects.filter((project) => !project.linkedSimpliHeatProjectId);
        setSimpliHeatProjects([]);
      } else {
        try {
          const rows = await fetchSimpliHeatProjectsForUser(simpliHeatUserId);
          setSimpliHeatProjects(rows);
        } catch (simpliHeatError) {
          console.error('Error loading Simpli Heat projects:', simpliHeatError);
          setSimpliHeatProjects([]);
        }
      }

      setProjects(mappedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [user?.companyId, user?.id, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const listItems = useMemo(
    () => buildMergedProjectList(projects, simpliHeatProjects),
    [projects, simpliHeatProjects],
  );

  const filteredProjects = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return listItems;

    return listItems.filter((item) => getProjectListItemSearchText(item).includes(query));
  }, [listItems, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const showPagination = filteredProjects.length > PAGE_SIZE;

  const openProjectDetails = (item: ProjectListItem) => {
    if (item.source === 'helios') {
      navigate(`/installer/projects/${item.project.id}`);
      return;
    }

    navigate(`/installer/projects/simpliheat/${item.project.id}`);
  };

  const getListItemKey = (item: ProjectListItem) =>
    item.source === 'helios' ? item.project.id : `sh-${item.project.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="page-title text-2xl sm:text-3xl">Projects</h1>
        <Link to="/installer/projects/new" className="w-full sm:w-auto">
          <Button leftIcon={<Plus className="w-4 h-4" />} className="w-full sm:w-auto justify-center">
            New Project
          </Button>
        </Link>
      </div>

      <Input
        placeholder="Search for projects by reference, customer, address or technology..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        leftIcon={<Search className="w-4 h-4" />}
      />

      {isLoading ? (
        <Card>
          <div className="animate-pulse space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </Card>
      ) : filteredProjects.length > 0 ? (
        <>
          <div className="hidden lg:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      Created
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </th>
                  <th className="!text-center">Technologies</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((item) => {
                  const isHelios = item.source === 'helios';
                  const address = isHelios
                    ? formatProjectAddress(item.project)
                    : formatSimpliHeatProjectAddress(item.project);
                  const displayDate = isHelios
                    ? format(new Date(item.project.createdAt), 'dd/MM/yyyy')
                    : format(new Date(item.project.updatedAt), 'dd/MM/yyyy');

                  return (
                    <tr
                      key={getListItemKey(item)}
                      className="cursor-pointer"
                      onClick={() => openProjectDetails(item)}
                    >
                      <td>
                        <p className="font-medium text-white">{item.project.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{item.project.reference}</p>
                      </td>
                      <td className="text-white">{item.project.customerName || '—'}</td>
                      <td className="text-slate-400 max-w-xs truncate" title={address}>
                        {address || '—'}
                      </td>
                      <td className="text-slate-400 whitespace-nowrap">{displayDate}</td>
                      <td>
                        <div className="flex justify-center">
                          <ProjectTechnologyIcons
                            project={isHelios ? item.project : SIMPLIHEAT_LIST_PROJECT}
                            size="compact"
                            className="justify-center gap-3"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {paginatedProjects.map((item) => {
              const isHelios = item.source === 'helios';
              const address = isHelios
                ? formatProjectAddress(item.project)
                : formatSimpliHeatProjectAddress(item.project);
              const displayDate = isHelios
                ? format(new Date(item.project.createdAt), 'dd/MM/yyyy')
                : format(new Date(item.project.updatedAt), 'dd/MM/yyyy');

              return (
                <Card
                  key={getListItemKey(item)}
                  variant="hover"
                  onClick={() => openProjectDetails(item)}
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{item.project.name}</p>
                      <p className="text-xs font-mono text-slate-500">{item.project.reference}</p>
                    </div>
                    <ProjectTechnologyIcons
                      project={isHelios ? item.project : SIMPLIHEAT_LIST_PROJECT}
                      size="compact"
                      className="gap-2 shrink-0"
                    />
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-400">
                    <p>{item.project.customerName || 'No customer'}</p>
                    {address && <p className="truncate">{address}</p>}
                    <p className="pt-1">{displayDate}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          {showPagination && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                aria-label="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 3), currentPage + 2)
                .map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-9 h-9 rounded-lg text-sm font-medium ${
                      page === currentPage
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <Card className="text-center py-16">
          <p className="text-slate-400 mb-2">
            {searchTerm ? 'No projects match your search' : 'No projects yet'}
          </p>
          {!searchTerm && (
            <Link to="/installer/projects/new">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                Create Your First Project
              </Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
