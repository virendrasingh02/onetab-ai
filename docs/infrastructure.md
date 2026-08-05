# OneTab AI Local Infrastructure Guide

This document provides complete instructions for running, configuring, managing, and maintaining the OneTab AI local infrastructure suite.

---

## 1. Service Overview

| Service | Technology | Primary Purpose | Port | Data Volume |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | PostgreSQL 16 | Relational data: Users, Workspaces, Projects, CRM, Tasks, AI, Settings | `5432` | `onetab_postgres_data` |
| **Cache & Queue** | Redis 7 | Sessions, caching, message queues, rate limiting | `6379` | `onetab_redis_data` |
| **Matrix Homeserver**| Synapse | Real-time chat, channels, presence, typing, read receipts, voice/video signaling | `8008` | `onetab_synapse_data` |
| **Object Storage** | MinIO | Media, user uploads, documents, attachments, AI-generated files | `9000` (API)<br/>`9001` (Console) | `onetab_minio_data` |
| **Global Search** | Meilisearch v1.12 | Ultra-fast search across chat, docs, files, tasks, AI memories | `7700` | `onetab_meili_data` |
| **Local AI** | Ollama | Local LLM inference: chat, streaming responses, embeddings, tool calling | `11434` | `onetab_ollama_data` |
| **Vector DB** | Qdrant | High-performance vector embeddings, AI memory, semantic search | `6333` (HTTP)<br/>`6334` (gRPC) | `onetab_qdrant_data` |

---

## 2. Architecture Diagram

```mermaid
graph TD
    subgraph Frontends
        WEB["React Web App (apps/web)"]
        ADMIN["React Admin App (apps/admin)"]
    end

    subgraph Backend Boundary
        API["NestJS API (apps/api)"]
    end

    subgraph Local Infrastructure Services
        PG[("PostgreSQL\n:5432")]
        REDIS[("Redis\n:6379")]
        MATRIX["Matrix Synapse\n:8008"]
        MINIO["MinIO S3\n:9000 / :9001"]
        MEILI["Meilisearch\n:7700"]
        OLLAMA["Ollama AI\n:11434"]
        QDRANT[("Qdrant Vector DB\n:6333")]
    end

    WEB -->|HTTP / REST| API
    ADMIN -->|HTTP / REST| API
    API -->|@org/database| PG
    API -->|@org/api-cache| REDIS
    API -->|@org/api-matrix & @org/matrix-client| MATRIX
    API -->|@org/api-storage| MINIO
    API -->|@org/api-search| MEILI
    API -->|@org/api-ai| OLLAMA
    API -->|@org/api-ai| QDRANT

    classDef frontend fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef backend fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef infra fill:#1e1035,stroke:#8b5cf6,stroke-width:2px,color:#fff;

    class WEB,ADMIN frontend;
    class API backend;
    class PG,REDIS,MATRIX,MINIO,MEILI,OLLAMA,QDRANT infra;
```

> [!IMPORTANT]
> The frontends **never** communicate with Matrix, MinIO, or Qdrant directly. All communication is routed through the NestJS backend abstraction layer.

---

## 3. Environment Variables Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/onetab?sslmode=disable` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `MATRIX_URL` | `http://localhost:8008` | Matrix Synapse endpoint |
| `MATRIX_SERVER_NAME` | `localhost` | Domain name for Matrix identity resolution |
| `MINIO_ENDPOINT` | `http://localhost:9000` | MinIO API endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO root access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO root secret key |
| `MEILI_HOST` | `http://localhost:7700` | Meilisearch host address |
| `MEILI_MASTER_KEY` | `masterKey123` | Meilisearch authentication key |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama AI runner URL |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant Vector database endpoint |

---

## 4. Operational Commands

### Start All Infrastructure
```bash
npm run infra:start
```

### Stop Infrastructure (Preserve Data)
```bash
npm run infra:stop
```

### Restart All Services
```bash
npm run infra:restart
```

### View Live Container Logs
```bash
npm run infra:logs
```

### Wipe Infrastructure & Data Volumes
> [!CAUTION]
> This command completely removes all containers and persistent volumes.
```bash
npm run infra:clean
```

---

## 5. Health Check & Diagnostics

All containers are configured with built-in health checks:
```bash
docker compose -f docker/docker-compose.yml ps
```

To manually verify specific service endpoints:
- **Postgres**: `docker exec -it onetab-postgres pg_isready -U postgres`
- **Redis**: `docker exec -it onetab-redis redis-cli ping`
- **Matrix**: `curl http://localhost:8008/_matrix/client/versions`
- **MinIO**: `curl http://localhost:9000/minio/health/live`
- **Meilisearch**: `curl http://localhost:7700/health`
- **Ollama**: `curl http://localhost:11434/api/version`
- **Qdrant**: `curl http://localhost:6333/healthz`

---

## 6. Troubleshooting

1. **Port Conflicts**:
   If a local service is already binding to a port (e.g. Postgres on 5432), set custom ports in `.env`:
   ```env
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   ```
2. **MinIO Permission Denied**:
   Ensure Docker has appropriate file writing privileges for mounted volumes.
3. **Ollama Model Pulling**:
   Pull your desired model into the container using:
   ```bash
   docker exec -it onetab-ollama ollama pull llama3.2
   ```

---

## 7. Backup and Restore Procedures

### PostgreSQL
- **Backup**: `docker exec -t onetab-postgres pg_dump -U postgres onetab > backup.sql`
- **Restore**: `cat backup.sql | docker exec -i onetab-postgres psql -U postgres -d onetab`

### Meilisearch
- **Dump**: `curl -X POST 'http://localhost:7700/dumps' -H 'Authorization: Bearer masterKey123'`

### Qdrant
- **Snapshot**: `curl -X POST 'http://localhost:6333/collections/{collection_name}/snapshots'`
