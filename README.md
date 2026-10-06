# infra-lab

App di laboratorio per esercizi di infrastruttura: una API HTTP riceve testi, li salva su PostgreSQL e li accoda su Redis (BullMQ); un worker li "riassume" con un summarizer finto e deterministico.

```
apps/api        @infra-lab/api     Express 5: POST/GET /documents, GET /health
apps/worker     @infra-lab/worker  BullMQ worker + FakeSummarizer
packages/core   @infra-lab/core    config, logger, pool pg, repository, coda, shutdown, migrazioni
```

## Prerequisiti

- Node.js 24 (`.nvmrc`)
- pnpm 11 via corepack: `corepack enable` (la versione è fissata in `packageManager`)
- Docker, per PostgreSQL e Redis

## Avvio in locale

```bash
docker run -d --name infra-lab-postgres -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=infra_lab -e POSTGRES_PASSWORD=infra_lab -e POSTGRES_DB=infra_lab \
  postgres:18
docker run -d --name infra-lab-redis -p 127.0.0.1:6379:6379 redis:8

cp .env.example .env
pnpm install
pnpm build
pnpm db:migrate

pnpm start:api      # terminale 1
pnpm start:worker   # terminale 2
```

`pnpm db:migrate` esegue il codice compilato, quindi va lanciato dopo `pnpm build`.
In sviluppo, `pnpm dev:api` e `pnpm dev:worker` eseguono direttamente i sorgenti TypeScript con riavvio automatico (nessun build necessario).

Arresto: `SIGTERM`/`SIGINT` (Ctrl+C) chiudono in ordine server HTTP, coda, Redis e pool Postgres; il worker attende la fine dei job attivi fino a ~8 s, poi esce comunque.

## Endpoint

```bash
curl -s -X POST localhost:3000/documents \
  -H 'Content-Type: application/json' \
  -d '{"text":"Docker isolates services. Postgres stores the documents. Redis queues the jobs."}'
```

```json
{"id":"3f0c1c52-8a0e-4c0a-9d4e-6f1b2a7c9e10","status":"pending"}
```

```bash
curl -s localhost:3000/documents/3f0c1c52-8a0e-4c0a-9d4e-6f1b2a7c9e10
```

```json
{
  "id": "3f0c1c52-8a0e-4c0a-9d4e-6f1b2a7c9e10",
  "status": "completed",
  "result": {
    "title": "Docker isolates services.",
    "keyPoints": ["Docker isolates services.", "Postgres stores the documents.", "Redis queues the jobs."],
    "wordCount": 11
  },
  "error": null,
  "createdAt": "2026-10-06T17:10:00.000Z",
  "updatedAt": "2026-10-06T17:10:01.020Z"
}
```

```bash
curl -s -i localhost:3000/health
```

```json
{"status":"ok","checks":{"postgres":"ok","redis":"ok"}}
```

Con una dipendenza irraggiungibile la risposta è `503` con `{"status":"degraded","checks":{"postgres":"ok","redis":"unavailable"}}`.

Codici di risposta: `POST` → `202`, `400` (body non valido o JSON malformato), `413` (body troppo grande), `503` (accodamento fallito, documento marcato `failed`). `GET /documents/:id` → `200`, `400` (id non UUID), `404`.

## Limiti noti

- Niente autenticazione, rate limiting né retention dei documenti, per scelta: vanno gestiti a livello di infrastruttura (gateway, reverse proxy, job di pulizia) prima di esporre l'API pubblicamente.
- Il riassunto finto riporta frasi del testo originale e l'UUID del documento è l'unica chiave di accesso: chi lo conosce legge il risultato.

## Qualità

```bash
pnpm build       # tsc per pacchetto → dist/
pnpm typecheck
pnpm lint        # ESLint + typescript-eslint type-checked
pnpm test        # vitest, senza Postgres/Redis (fake in memoria)
```
