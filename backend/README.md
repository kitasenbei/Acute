# File-Ops Backend

A small backend exposing an HTTP interface for file operations, built in a
clean **3-tier architecture** with SQLite for metadata and the local
filesystem for blobs.

## Architecture

```
HTTP request
    │
    ▼
┌─────────────────────────────┐
│ Presentation tier           │  routes → controller → error middleware
│  (Express, HTTP only)       │  src/routes, src/controllers, src/middleware
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Business tier               │  FileService — validation + orchestration,
│  (framework-agnostic)       │  no HTTP, no SQL.   src/services
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Data tier                   │  FileRepository (SQLite metadata)
│                             │  FileStorage    (filesystem blobs)
│                             │  src/repositories, src/storage, src/db
└─────────────────────────────┘
```

Tiers are wired together by dependency injection in `src/app.js`, which keeps
each layer independently testable. Each tier only talks to the one directly
below it.

## Run

```bash
npm install
npm start          # http://localhost:3001  (override with PORT / DATA_DIR)
npm run dev        # auto-restart on change
npm test           # vitest: unit (service) + integration (API) suites
```

## API docs (Swagger)

With the server running, open interactive docs in a browser:

- **Swagger UI:** http://localhost:3001/api/docs
- **Raw OpenAPI 3 spec:** http://localhost:3001/api/docs.json

## API

| Method | Path                     | Description                       |
|--------|--------------------------|-----------------------------------|
| GET    | `/health`                | Liveness check                    |
| GET    | `/api/docs`              | Swagger UI                        |
| POST   | `/api/files`             | Upload (multipart field `file`)   |
| GET    | `/api/files`             | List all file metadata            |
| GET    | `/api/files/:id`         | Get one file's metadata           |
| GET    | `/api/files/:id/content` | Download the raw bytes            |
| PATCH  | `/api/files/:id`         | Rename (`{ "name": "..." }`)      |
| DELETE | `/api/files/:id`         | Delete metadata + blob            |

### Example

```bash
curl -F file=@./photo.png http://localhost:3001/api/files
curl http://localhost:3001/api/files
curl -OJ http://localhost:3001/api/files/<id>/content
```
