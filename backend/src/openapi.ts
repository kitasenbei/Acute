import type { JsonObject } from 'swagger-ui-express'

/**
 * OpenAPI 3.0 description of the file-explorer API.
 *
 * Served as raw JSON at GET /api/docs.json and rendered by Swagger UI at
 * GET /api/docs. All `path` values are relative to the configured browsing
 * root ('' is the root itself); the backend rejects any path that escapes it.
 */
export const openapiSpec: JsonObject = {
  openapi: '3.0.3',
  info: {
    title: 'File Explorer API',
    version: '2.0.0',
    description:
      'Browse and operate on the real filesystem, confined to a configured ' +
      'root directory. Built in a 3-tier architecture; favourites persist in SQLite.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Explorer', description: 'Browse directories and operate on files/folders' },
    { name: 'Favorites', description: 'Pinned folders for the sidebar' },
    { name: 'System', description: 'Health and diagnostics' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness check',
        responses: { 200: { description: 'Service is up' } },
      },
    },
    '/api/fs': {
      get: {
        tags: ['Explorer'],
        summary: 'List a directory',
        parameters: [{ $ref: '#/components/parameters/PathQuery' }],
        responses: {
          200: {
            description: 'Directory listing',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DirListing' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Explorer'],
        summary: 'Delete a file or folder (recursive)',
        parameters: [{ $ref: '#/components/parameters/PathQuery' }],
        responses: {
          204: { description: 'Deleted' },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/fs/search': {
      get: {
        tags: ['Explorer'],
        summary: 'Recursively search for entries by name under a directory',
        parameters: [
          { $ref: '#/components/parameters/PathQuery' },
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Case-insensitive name substring',
          },
        ],
        responses: {
          200: {
            description: 'Matching entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: { type: 'array', items: { $ref: '#/components/schemas/Entry' } },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/fs/folder': {
      post: {
        tags: ['Explorer'],
        summary: 'Create a folder',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  path: { type: 'string', description: 'Parent directory', example: 'Documents' },
                  name: { type: 'string', example: 'New Folder' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Entry' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/fs/upload': {
      post: {
        tags: ['Explorer'],
        summary: 'Upload a file into a directory',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  path: { type: 'string', description: 'Target directory' },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Entry' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/fs/content': {
      get: {
        tags: ['Explorer'],
        summary: 'Download a file',
        parameters: [{ $ref: '#/components/parameters/PathQuery' }],
        responses: {
          200: {
            description: 'Raw file bytes',
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/fs/thumbnail': {
      get: {
        tags: ['Explorer'],
        summary: 'Cached thumbnail for an image or video',
        parameters: [
          { $ref: '#/components/parameters/PathQuery' },
          { name: 'w', in: 'query', required: false, description: 'Max size in px', schema: { type: 'integer', default: 256 } },
        ],
        responses: {
          200: { description: 'WebP thumbnail', content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/fs/rename': {
      patch: {
        tags: ['Explorer'],
        summary: 'Rename a file or folder',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path', 'name'],
                properties: {
                  path: { type: 'string', example: 'Documents/old.txt' },
                  name: { type: 'string', example: 'new.txt' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Renamed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Entry' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/favorites': {
      get: {
        tags: ['Favorites'],
        summary: 'List pinned folders',
        responses: {
          200: {
            description: 'Array of favourites',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Favorite' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Favorites'],
        summary: 'Pin a folder',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path'],
                properties: { path: { type: 'string', example: 'Documents/Projects' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Pinned', content: { 'application/json': { schema: { $ref: '#/components/schemas/Favorite' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
      delete: {
        tags: ['Favorites'],
        summary: 'Unpin a folder',
        parameters: [{ $ref: '#/components/parameters/PathQuery' }],
        responses: { 204: { description: 'Unpinned' } },
      },
    },
  },
  components: {
    parameters: {
      PathQuery: {
        name: 'path',
        in: 'query',
        required: false,
        description: "Root-relative path ('' = root)",
        schema: { type: 'string' },
      },
    },
    responses: {
      NotFound: {
        description: 'Path not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      BadRequest: {
        description: 'Invalid input or path outside the root',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
    schemas: {
      Entry: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'report.pdf' },
          path: { type: 'string', example: 'Documents/report.pdf' },
          type: { type: 'string', enum: ['dir', 'file'] },
          size: { type: 'integer', example: 20480 },
          modifiedAt: { type: 'string', format: 'date-time' },
        },
      },
      DirListing: {
        type: 'object',
        properties: {
          path: { type: 'string', example: 'Documents' },
          parent: { type: 'string', nullable: true, example: '' },
          entries: { type: 'array', items: { $ref: '#/components/schemas/Entry' } },
        },
      },
      Favorite: {
        type: 'object',
        properties: {
          path: { type: 'string', example: 'Documents/Projects' },
          name: { type: 'string', example: 'Projects' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'NotFoundError' },
              message: { type: 'string', example: 'Path not found: Documents/x' },
            },
          },
        },
      },
    },
  },
}
