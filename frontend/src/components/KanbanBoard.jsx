import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { useToast } from './Toast';
import '../styles/Kanban.css';

const COLUMNS = [
  { id: 'TODO',        label: 'To Do',       color: '#888' },
  { id: 'IN_PROGRESS', label: 'In Progress',  color: '#4a90d9' },
  { id: 'IN_REVIEW',   label: 'In Review',    color: '#f0ad4e' },
  { id: 'DONE',        label: 'Done',         color: '#28a745' },
  { id: 'BLOCKER',     label: 'Blocker',      color: '#e74c3c' },
];

const STATUS_FLOW = {
  TODO:        ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'TODO', 'BLOCKER'],
  IN_REVIEW:   ['DONE', 'IN_PROGRESS', 'BLOCKER'],
  DONE:        ['TODO'],
  BLOCKER:     ['TODO', 'IN_PROGRESS'],
};

const PRIORITY_COLORS = {
  LOW: '#28a745',
  MEDIUM: '#f0ad4e',
  HIGH: '#fd7e14',
  URGENT: '#e74c3c',
};

const KanbanCard = ({ task }) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <Link to={`/tasks/${task._id}`} className="kanban-card-inner">
      <div
        className="kanban-card-priority-bar"
        style={{ backgroundColor: PRIORITY_COLORS[task.priority] || '#888' }}
      />
      <div className="kanban-card-content">
        <span className="kanban-card-title">{task.title}</span>
        <span className="kanban-card-project">{task.project?.name || '--'}</span>
        <div className="kanban-card-footer">
          {task.assignedTo ? (
            <span className="kanban-card-avatar" title={task.assignedTo.name}>
              {task.assignedTo.name?.charAt(0)}
            </span>
          ) : (
            <span className="kanban-card-unassigned">--</span>
          )}
          {task.dueDate && (
            <span className={`kanban-card-due ${isOverdue ? 'overdue' : ''}`}>
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

const KanbanBoard = ({ tasks, onStatusChange, userRole }) => {
  const toast = useToast();
  const [localTasks, setLocalTasks] = useState(tasks);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) return;

    const fromStatus = source.droppableId;
    const toStatus = destination.droppableId;

    // Client-side transition validation
    if (!STATUS_FLOW[fromStatus]?.includes(toStatus)) {
      toast.error(`Cannot move from ${fromStatus.replace(/_/g, ' ')} to ${toStatus.replace(/_/g, ' ')}`);
      return;
    }

    // Role-based BLOCKER guard
    if (fromStatus === 'BLOCKER' && userRole === 'MEMBER') {
      toast.error('Only managers or admins can resolve blocked tasks');
      return;
    }

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) => t._id === draggableId ? { ...t, status: toStatus } : t)
    );

    try {
      await onStatusChange(draggableId, toStatus);
    } catch {
      // Revert on failure
      setLocalTasks((prev) =>
        prev.map((t) => t._id === draggableId ? { ...t, status: fromStatus } : t)
      );
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const columnTasks = localTasks.filter((t) => t.status === col.id);
          return (
            <div className="kanban-column" key={col.id}>
              <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                <span className="kanban-column-title">{col.label}</span>
                <span className="kanban-column-count" style={{ backgroundColor: col.color }}>
                  {columnTasks.length}
                </span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    className={`kanban-column-body ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable key={task._id} draggableId={task._id} index={index}>
                        {(provided, snapshot) => {
                          const child = (
                            <div
                              className={`kanban-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <KanbanCard task={task} />
                            </div>
                          );
                          // Portal the card to body while dragging so it escapes overflow clipping
                          return snapshot.isDragging
                            ? createPortal(child, document.body)
                            : child;
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
