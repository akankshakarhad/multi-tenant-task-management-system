import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import ProtectedRoute from '../components/ProtectedRoute';
import '../styles/Projects.css';

const LIMIT = 20;

const ProjectsInner = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [page, setPage] = useState(1);

  const canCreate = ['ADMIN', 'MANAGER'].includes(user.role);

  useEffect(() => { setPage(1); }, [filters]);

  const fetchProjects = useCallback(async () => {
    try {
      const params = { page, limit: LIMIT };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      const res = await api.get('/projects', { params });
      setProjects(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchInput });
  };

  const validateCreate = () => {
    if (!form.name.trim()) return 'Project name is required';
    if (form.name.length > 200) return 'Project name is too long (max 200 characters)';
    if (form.description.length > 2000) return 'Description is too long (max 2000 characters)';
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateCreate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    try {
      await api.post('/projects', form);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      toast.success('Project created');
      fetchProjects();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="page-container"><div className="loading-card">Loading...</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Projects</h1>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + New Project
          </button>
        )}
      </div>

      {/* Search Bar */}
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          className="search-input"
          placeholder="Search projects by name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
        {filters.search && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setSearchInput(''); setFilters({ ...filters, search: '' }); }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Filters */}
      <div className="filters-bar">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <span className="filter-count">{pagination.total} project{pagination.total !== 1 ? 's' : ''}</span>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects found</h3>
          <p>
            {canCreate
              ? 'Create your first project to get started.'
              : 'No projects match your search.'}
          </p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <Link to={`/projects/${project._id}`} key={project._id} className="project-card">
              <div className="project-card-header">
                <h3>{project.name}</h3>
                <span className={`status-badge status-${project.status?.toLowerCase()}`}>
                  {project.status}
                </span>
              </div>
              <p className="project-desc">{project.description || 'No description'}</p>
              <div className="project-card-footer">
                <span className="project-meta">{project.members?.length || 0} members</span>
                <span className="project-meta">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {showCreate && (
        <Modal title="Create Project" onClose={() => setShowCreate(false)}>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleCreate} noValidate>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter project name"
                maxLength={200}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the project"
                maxLength={2000}
                rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

const Projects = () => (
  <ProtectedRoute>
    <ProjectsInner />
  </ProtectedRoute>
);

export default Projects;
