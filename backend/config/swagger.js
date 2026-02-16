const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Tenant Task Manager API',
      version: '1.0.0',
      description: 'API documentation for multi-tenant task management system',
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 50 },
            pages: { type: 'integer', example: 3 },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '664a1b2c3d4e5f6a7b8c9d0e' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            age: { type: 'integer', example: 28 },
            gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
            designation: { type: 'string', example: 'Software Engineer' },
            companyId: { type: 'string', example: 'acme-corp' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'MEMBER'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            age: { type: 'integer' },
            gender: { type: 'string' },
            designation: { type: 'string' },
            companyName: { type: 'string', example: 'Acme Corp' },
            companyId: { type: 'string', example: 'acme-corp' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'MEMBER'] },
            token: { type: 'string', description: 'JWT token (7-day expiry)' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Website Redesign' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'COMPLETED'] },
            companyId: { type: 'string' },
            createdBy: { $ref: '#/components/schemas/UserRef' },
            members: { type: 'array', items: { $ref: '#/components/schemas/UserRef' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'Implement login page' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKER'] },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            project: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' } } },
            assignedTo: { $ref: '#/components/schemas/UserRef' },
            createdBy: { $ref: '#/components/schemas/UserRef' },
            companyId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            text: { type: 'string', example: 'Looks good! @"Jane Doe" please review.' },
            task: { type: 'object', properties: { _id: { type: 'string' }, title: { type: 'string' } } },
            author: { $ref: '#/components/schemas/UserRef' },
            mentions: { type: 'array', items: { $ref: '#/components/schemas/UserRef' } },
            companyId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            recipient: { type: 'string' },
            triggeredBy: { $ref: '#/components/schemas/UserRef' },
            type: { type: 'string', enum: ['TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'COMMENT_ADDED', 'COMMENT_MENTIONED'] },
            message: { type: 'string' },
            relatedType: { type: 'string', enum: ['Task', 'Comment'], nullable: true },
            relatedId: { type: 'string', nullable: true },
            read: { type: 'boolean' },
            readAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ActivityLog: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            action: {
              type: 'string',
              enum: [
                'COMPANY_CREATED', 'USER_JOINED', 'USER_REMOVED',
                'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_DELETED',
                'TASK_CREATED', 'TASK_UPDATED', 'TASK_DELETED',
                'TASK_ASSIGNED', 'TASK_STATUS_CHANGED',
                'COMMENT_ADDED', 'COMMENT_DELETED',
              ],
            },
            description: { type: 'string' },
            performedBy: { $ref: '#/components/schemas/UserRef' },
            targetType: { type: 'string', enum: ['Company', 'User', 'Project', 'Task', 'Comment'] },
            targetId: { type: 'string' },
            metadata: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        UserRef: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and registration' },
      { name: 'Users', description: 'User management' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Tasks', description: 'Task management with status workflow' },
      { name: 'Comments', description: 'Task comments and @mentions' },
      { name: 'Notifications', description: 'Real-time notification management' },
      { name: 'Activity Logs', description: 'Audit trail (Admin only)' },
      { name: 'Dashboard', description: 'Dashboard analytics' },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
