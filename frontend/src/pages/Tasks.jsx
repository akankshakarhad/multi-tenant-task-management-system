import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import ProtectedRoute from '../components/ProtectedRoute';
import KanbanBoard from '../components/KanbanBoard';
import '../styles/Tasks.css';

const LIMIT = 20;

const TasksInner = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [projects, setProjects] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: '',
    projectId: searchParams.get('projectId') || '',
    assignedTo: '',
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    title: '',
    description: '',
    project: searchParams.get('projectId') || '',
    assignedTo: '',
    priority: 'MEDIUM',
    dueDate: '',
  });

  const canCreate = ['ADMIN', 'MANAGER'].includes(user.role);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setPage(1); }, [filters, viewMode]);

  const fetchTasks = useCallback(async () => {
    try {
      const isBoard = viewMode === 'board';
      const params = {
        page: isBoard ? 1 : page,
        limit: isBoard ? 500 : LIMIT,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status && !isBoard) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.projectId) params.projectId = filters.projectId;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      const res = await api.get('/tasks', { params });
      setTasks(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, viewMode]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const fetchData = async () => {
    try {
      const [projRes, usersRes] = await Promise.all([
        api.get('/projects?limit=100'),
        api.get('/users'),
      ]);
      setProjects(projRes.data.data || projRes.data);
      setCompanyUsers(usersRes.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchInput });
  };

  const handleBoardStatusChange = async (taskId, newStatus) => {
    await api.put(`/tasks/${taskId}`, { status: newStatus });
    toast.success('Status updated');
    fetchTasks();
  };

  const validateCreate = () => {
    if (!form.title.trim()) return 'Task title is required';
    if (form.title.length > 300) return 'Title is too long (max 300 characters)';
    if (form.description.length > 5000) return 'Description is too long (max 5000 characters)';
    if (!form.project) return 'Please select a project';
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
      const payload = { ...form, projectId: form.project };
      delete payload.project;
      if (!payload.assignedTo) delete payload.assignedTo;
      if (!payload.dueDate) delete payload.dueDate;
      await api.post('/tasks', payload);
      setShowCreate(false);
      setForm({ title: '', description: '', project: '', assignedTo: '', priority: 'MEDIUM', dueDate: '' });
      toast.success('Task created');
      fetchTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="page-container"><div className="loading-card">Loading...</div></div>;

  return (
    <div className={`page-container ${viewMode === 'board' ? 'board-view' : ''}`}>
      <div className="page-header">
        <h1>Tasks</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><rect y="0" width="16" height="2" rx="1" fill="currentColor"/><rect y="6" width="16" height="2" rx="1" fill="currentColor"/><rect y="12" width="16" height="2" rx="1" fill="currentColor"/></svg>
              List
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
              title="Board View"
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><rect x="0" width="4" height="14" rx="1" fill="currentColor"/><rect x="6" width="4" height="14" rx="1" fill="currentColor"/><rect x="12" width="4" height="14" rx="1" fill="currentColor"/></svg>
              Board
            </button>
          </div>
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + New Task
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          className="search-input"
          placeholder="Search tasks by title..."
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
        {viewMode === 'list' && (
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
            <option value="BLOCKER">Blocker</option>
          </select>
        )}
        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <select
          value={filters.projectId}
          onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        {user.role !== 'MEMBER' && (
          <select
            value={filters.assignedTo}
            onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
          >
            <option value="">All Assignees</option>
            {companyUsers.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        )}
        <span className="filter-count">{pagination.total} task{pagination.total !== 1 ? 's' : ''}</span>
      </div>

      {viewMode === 'board' ? (
        <KanbanBoard
          tasks={tasks}
          onStatusChange={handleBoardStatusChange}
          userRole={user.role}
        />
      ) : (
        <>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <h3>No tasks found</h3>
              <p>{canCreate ? 'Create a task to get started.' : 'No tasks match your filters.'}</p>
            </div>
          ) : (
            <div className="tasks-table">
              <div className="tasks-header-row">
                <span className="col-priority"></span>
                <span className="col-title">Title</span>
                <span className="col-project">Project</span>
                <span className="col-assignee">Assignee</span>
                <span className="col-status">Status</span>
                <span className="col-due">Due</span>
              </div>
              {tasks.map((task) => (
                <Link to={`/tasks/${task._id}`} key={task._id} className="task-row">
                  <span className="col-priority">
                    <span className={`priority-dot priority-${task.priority?.toLowerCase()}`} title={task.priority} />
                  </span>
                  <span className="col-title">{task.title}</span>
                  <span className="col-project">{task.project?.name || '\u2014'}</span>
                  <span className="col-assignee">
                    {task.assignedTo ? (
                      <span className="assignee-chip">
                        <span className="assignee-avatar">{task.assignedTo.name?.charAt(0)}</span>
                        {task.assignedTo.name}
                      </span>
                    ) : (
                      <span className="unassigned">Unassigned</span>
                    )}
                  </span>
                  <span className="col-status">
                    <span className={`status-badge status-${task.status?.toLowerCase().replace('_', '-')}`}>
                      {task.status?.replace('_', ' ')}
                    </span>
                  </span>
                  <span className="col-due">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : '\u2014'}
                  </span>
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
        </>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <Modal title="Create Task" onClose={() => setShowCreate(false)}>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleCreate} noValidate>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Task title"
                maxLength={300}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the task"
                maxLength={5000}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Project</label>
              <select
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                required
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Assign To</label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              >
                <option value="">Unassigned</option>
                {companyUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Task'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

const Tasks = () => (
  <ProtectedRoute>
    <TasksInner />
  </ProtectedRoute>
);

export default Tasks;
