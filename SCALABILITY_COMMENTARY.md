# Scalability Commentary

## Overview

This document analyses how the system performs as data volume grows - from the current dataset of 55,551 contacts through 100k, 1M, and 10M records. It includes a real observed bottleneck from live testing, a root-cause breakdown of why it happens, and concrete mitigation strategies at each scale tier.

---

## Real Observed Behaviour - CSV Upload at 5,555 vs 55,555 Rows

### What Was Observed

During live testing, uploading a **5,555-row CSV** completed noticeably faster than uploading a **55,555-row CSV**. The difference was visible in the browser - the upload response took longer to return at the larger file size.

### Why This Happens

The CSV upload pipeline has three stages, each of which scales linearly with row count:

```
Browser  →  multer (memory buffer)  →  csv-parser (stream)  →  bulkWrite (1,000-doc batches)
```

**Stage 1 - In-Memory Buffering (multer)**

```typescript
// upload.middleware.ts
const storage = multer.memoryStorage(); // entire file loaded into RAM
```

The entire CSV file is held in memory as a `Buffer` before a single row is parsed. File size scales linearly with row count:

| Rows | Approximate File Size | RAM Used |
|------|--------------------- |----------|
| 5,555 | ~460 KB | ~460 KB |
| 55,555 | ~4.6 MB | ~4.6 MB |
| 500,000 | ~46 MB | ~46 MB - approaching the 50MB limit |

At 55k rows this is still fast - the bottleneck is not memory allocation, but the work that follows.

**Stage 2 - CSV Parsing (streaming, but CPU-bound)**

```typescript
Readable.from(fileBuffer)
  .pipe(csvParser())
  .on("data", (row) => contacts.push(row)) // accumulates all rows
```

`csv-parser` processes the stream row by row - good. But every parsed row is pushed into an in-memory `contacts[]` array before `bulkWrite` begins. At 55k rows, this array holds 55k objects simultaneously in memory before any database write starts. This not a true streaming.

| Rows | Parse Time (est.) | Memory (contacts array) |
|------|------------------|------------------------|
| 5,555 | ~100ms | ~5 MB |
| 55,555 | ~1s | ~50 MB |
| 500,000 | ~10s | ~500 MB - OOM risk |

**Stage 3 - Bulk Write (batched, but N round-trips)**

```typescript
// contact.service.ts
const batchSize = 1000;
for (let i = 0; i < ops.length; i += batchSize) {
    await Contact.bulkWrite(ops.slice(i, i + batchSize), { ordered: false });
}
```

Each `bulkWrite` call is one network RTT to MongoDB. The number of RTTs scales directly with row count:

| Rows | Batches (÷1000) | Round-trips | Approx. DB Time |
|------|----------------|-------------|----------------|
| 5,555 | **6** | 6 | ~300ms |
| 55,555 | **56** | 56 | ~x2s |
| 500,000 | **500** | 500 | ~x20s |
| 1,000,000 | **1,000** | 1,000 | ~x200s |

**The combined effect** - larger CSV → more parsing time + more memory held + more DB round-trips - explains the observable difference between 5k and 55k uploads. The relationship is approximately linear: **10× the rows ≈ 10× the upload time**.

### Why It Is Still Correct Behaviour (at This Scale)

For files up to 50MB (approximately 500k contacts), the current approach is acceptable:
- `ordered: false` means one bad batch does not abort the rest
- Upsert semantics handle duplicates correctly at any row count
- 56 round-trips at ~50ms each ≈ 3 seconds total - within acceptable API latency for a bulk operation

The problem emerges at **500k+ rows** where the in-memory array risks OOM and the response time exceeds reasonable timeouts.

---

## Scalability at 100,000 Records

### What Changes

| Metric | 55,551 (current) | 100,000 |
|--------|-----------------|---------|
| Contact collection size | ~50 MB | ~x2 MB |
| Index memory (`email_1`) | ~5 MB | ~x2 MB |
| Index memory (`tags_1`) | ~8 MB | ~x2 MB |
| CSV upload (50k rows) | ~3s | ~x2s |
| Tag filter query | 22ms | ~x2ms |
| Regex search | 93ms | **~x2ms** |
| Dashboard aggregation | 1ms | ~x2ms |
| Page 1 listing | 0ms | 0ms |

### What Still Works Well

- **Email lookup, tag filter, pagination, worker batch fetch** - all index-bound, performance unchanged
- **Dashboard** - still O(campaigns), not O(contacts)
- **All indexes fit in RAM** comfortably

### Emerging Bottleneck

- **Regex search crosses 100ms threshold** - users will feel a lag in the search bar
- **CSV upload at 50k rows takes ~5s** - acceptable but approaching the limit of a synchronous API call

### Required Changes at 100k

| Change | Reason |
|--------|--------|
| Switch contact search to `$text` operator | Regex search degrading to ~x2ms |
| Add Redis cache (10s TTL) for dashboard | Polling every 5s × multiple users adds load |
| No structural changes to schema or indexes | All indexes still fit in RAM |

---

## Scalability at 1,000,000 Records

### What Changes

| Metric | 100k | 1,000,000 |
|--------|------|-----------|
| Contact collection size | ~90 MB | ~x10 MB |
| Index memory (all indexes) | ~30 MB | ~x10 MB |
| CSV upload (500k rows) | ~25s | needs redesign |
| Tag filter (16% selectivity) | ~40ms | ~x10ms |
| Regex search | ~170ms | **~1.7s - too long** |
| Campaign creation (audience resolution) | ~500ms | **~x10s - blocks API (Main Backend)** |
| Worker batch fetch | <5ms | <5ms - index unchanged |

### New Bottlenecks at 1M

**1. CSV Upload Architecture Must Change**

The current in-memory buffer approach (`multer.memoryStorage`) cannot handle 500k-row files:
- File size: ~55 MB - approaching the 50MB configured limit
- In-memory contact array: ~500 MB - OOM risk on standard instances
- Round-trips: ~500 - total API response time exceeds 30s

**Required redesign:**
```
Current:  HTTP upload → RAM buffer → parse → bulkWrite (synchronous)

At 1M:    
  Client 
    ↓
  (pre-signed URL upload) Object Storage (S3) 
    ↓ 
  (ObjectCreated event) Event Bridge (SQS / Lambda) 
    ↓ 
  BullMQ Queue ("process-csv-file") 
    ↓ 
  Worker (stream → parse → bulkWrite)
    ↓
  MongoDB
```

**2. Audience Resolution Blocks API**

Resolving a tag-filtered audience of 163k contacts (16% of 1M) takes ~300ms just for the query, plus ~2s for the 163k-row `insertMany`. The API endpoint blocks for ~2.5s.

**Required redesign:**
```typescript
// Current (synchronous, blocks at 1M):
POST /api/campaigns → resolve audience → insertMany → return campaign

// At 1M (async):
POST /api/campaigns → create campaign (status: "preparing") → enqueue "prepare-campaign" job → return 202
// Worker: resolve audience → insertMany → set status: "draft"
// Frontend polls until status becomes "draft"
```

**3. Regex Search Will take too long resolve**

At 1M contacts, `$regex` on `name` and `email` takes ~x2s - well beyond the PRD's 500ms target.

**Required change:** Replacing `$regex` with MongoDB `$text` index (for word-boundary matches) or ElastiSearch/ Algolia (for partial substring matches):

```javascript
// Replace:
{ $or: [{ name: { $regex: "term", $options: "i" } }, { email: { $regex: "term" } }] }

// With:
{ $text: { $search: "term" } }
// Index: db.contacts.createIndex({ name: "text", email: "text" })
// This index already exists in the schema - just needs the operator change in the service layer
```

### Required Changes at 1M

| Change | Component | Why |
|--------|-----------|-----|
| S3 + async CSV processing | Backend + Worker | In-memory buffer fails at 500k+ rows |
| Async campaign creation | Backend | Audience resolution blocks for 3s |
| Replace regex with `$text` | Backend service | Regex search takes x2s |
| Redis cache for dashboard | Backend | 5s polling × N users = database load |
| Ensure indexes fit in RAM | MongoDB | 300MB index set needs 2GB+ RAM instance |
| Monitor `deliverylogs` index | MongoDB | Could reach 100M+ documents |

---

## Scalability at 10,000,000 Records

### System-Wide Impact

| Component | Behaviour at 10M | Action |
|-----------|-----------------|--------|
| Contact collection | ~9 GB | Dedicated MongoDB instance minimum |
| All indexes combined | ~3 GB | 16GB+ RAM instance required |
| Tag filter (1.6M results) | ~3s | Async job mandatory |
| Regex search | ~17s | Completely broken - Atlas Search required |
| `$text` search | ~500ms | Acceptable |
| CSV upload (5M rows) | Hours if synchronous | Full streaming pipeline required |
| Campaign creation | Minutes if sync | Async with progress tracking |
| Worker batch (100M logs) | ~6ms/batch | Unchanged - index still O(batchSize) |
| Dashboard aggregation | ~100ms (100k campaigns) | Redis cache mandatory |

### Architectural Changes Required at 10M

**MongoDB Sharding**

The `deliverylogs` collection grows at `totalContacts per campaign × number of campaigns`. At 10M contacts × 100 campaigns = 1 billion delivery logs - this cannot live on a single MongoDB node.

```
Shard key recommendation: { campaignId: 1 }

Reason:
- Every query against deliverylogs filters on campaignId
- Sharding on campaignId means all documents for a campaign live on one shard
- Worker batch fetch queries never scatter across shards
- $match { campaignId } in aggregations stays local to one shard
```

**Contact collection sharding:**
```
Shard key recommendation: { _id: "hashed" }

Reason:
- Hashed _id distributes documents evenly
- Email lookups by unique index work across shards
- Tag filter queries scatter-gather across shards - acceptable because
  each shard handles ~1/N of the work in parallel
```

**Worker Horizontal Scaling**

At 10M contacts per campaign with 500/batch = 20,000 batches:
```
1 worker instance:   20,000 batches × 5ms = 100s per campaign
5 worker instances:  Each handles different campaigns in parallel
                     Effective throughput: 5× campaigns per unit time

BullMQ config (current):
  concurrency: 2   ← increase to 5–10 per worker instance
  Multiple worker processes consuming the same queue
```

**Dedicated Search Infrastructure**

```
At 10M contacts, contact search options ranked by performance:

1. MongoDB $text index     → word-boundary search, ~100ms, free
2. Elasticsearch / OpenSearch → most powerful, ~5ms, requires separate cluster
3. Algolia

The existing text index { name: "text", email: "text" } already supports
option 1. Moving to option 2 is a drop-in replacement at the service layer.
```

**Redis Caching Layer**

```
At 10M contacts × 100k campaigns, the dashboard aggregation over the
campaigns collection could take 100ms+ even with indexes.

Cache strategy:
  Key: "dashboard:stats"
  TTL: 30 seconds
  Invalidate on: campaign status change

Implementation:
  if (cached) return cache.get("dashboard:stats")
  const stats = await computeDashboardStats()
  cache.set("dashboard:stats", stats, 30)
  return stats
```

---

## CSV Upload - Detailed Scaling Analysis

This is the most acutely felt bottleneck in the current system, as directly observed during testing.

### Current Pipeline Performance

```
File Size    Rows      Parse Time    Batches    DB Time     Total (approx)
───────────  ────────  ──────────    ───────    ────────    ──────────────
~600 KB      5,555     ~100ms        6          ~300ms      ~500ms
~6 MB        55,555    ~x10ms        56         ~x10ms      ~x10ms
~55 MB       500,000   ~x100ms       500        ~x100ms     ~x100ms (api timeout)
~500 MB      5,000,000 N/A           N/A        N/A         OOM crash
```

### Why It Scales Linearly

Each step in the current pipeline is O(n):
1. **Buffer allocation** - O(n) memory proportional to file size
2. **Stream parsing** - O(n) rows processed sequentially
3. **Array accumulation** - O(n) objects in memory simultaneously
4. **bulkWrite batches** - O(n/1000) round-trips to MongoDB

There is no parallelism and no streaming to the database. Every byte must be parsed before the first write begins.

### Recommended Architecture for Large CSVs

**Phase 1 - Immediate improvement (without infrastructure change):**
```typescript
// Instead of accumulating all rows, write in rolling windows:
let batch: Record<string, any>[] = [];
const BATCH_SIZE = 2000;

stream.pipe(csvParser()).on("data", async (row) => {
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
        stream.pause();
        await Contact.bulkWrite(buildOps(batch), { ordered: false });
        batch = [];
        stream.resume();
    }
});

// Benefit: memory stays at ~BATCH_SIZE objects, not ~N objects
// First write starts after 2000 rows, not after all N rows
```

**Phase 2 - More Rigorous (for 500k+ rows):**
```
1. Frontend uploads to S3 directly (pre-signed URL)
2. S3 triggers a webhook → Backend enqueues "ingest-csv" BullMQ job
3. Backend returns { jobId, status: "processing" } immediately
4. Worker streams CSV from S3 in 5MB chunks → parses → bulkWrite
5. Frontend polls GET /contacts/jobs/:jobId for progress
6. Job completes → notify user with insertedCount / modifiedCount / errors
```

| Approach | Max File | API Blocks? | Memory | Works at 1M rows? |
|----------|---------|-------------|--------|-------------------|
| Current (memory buffer) | ~50 MB | Yes | O(n) | No |
| Rolling window writes | ~50 MB | Yes | O(batch) | Yes (Partially) |
| S3 + async worker | Unlimited | No | O(chunk) | Yes |

---

## Campaign Processing - Scaling Analysis

### Worker Batch Processing Performance

The worker processes delivery logs in batches of 500. This is the most scale-resilient part of the system because batch cost is **index-bound**, not collection-size-bound.

```
Campaign: "Exclusive VIP Access" - 9,059 contacts

Batches needed: ceil(9059 / 500) = 19 batches

Per batch:
  - DeliveryLog.find({ campaignId, status: "queued" }).limit(500) → ~5ms (index)
  - DeliveryLog.updateMany(batchIds, { status: "processing" })    → ~10ms
  - simulateDelay(100ms)                                           → 100ms
  - DeliveryLog.updateMany(sentIds, { status: "sent" })            → ~8ms
  - DeliveryLog.updateMany(failedIds, { status: "failed" })        → ~3ms
  - Campaign.findByIdAndUpdate ($inc counters)                     → ~5ms
  ─────────────────────────────────────────────────────────────────────
  Per batch total: ~130ms (dominated by simulated delay)

Total for 9,059 contacts: 19 batches × 130ms ≈ 2.5 seconds
Without simulated delay: 19 × 30ms ≈ 570ms
```

### Scaling the Worker

| Contacts | Batches | Time (with 100ms delay) | Time (no delay, real-world) |
|----------|---------|------------------------|----------------------------|
| 9,059 | 19 | ~2.5s | ~570ms |
| 55,551 | 112 | ~x10s | ~x2s |
| 500,000 | 1,000 | ~x100s | ~x20s |
| 1,000,000 | 2,000 | ~x200s | x40s |

**Horizontal scaling:**
```
# Each worker instance runs concurrency: 2
# Multiple instances consume the same BullMQ queue

1 worker  = 2 concurrent campaigns
5 workers = 10 concurrent campaigns (linear throughput scaling)
```

### Why the Worker Is the Easiest Service to Scale

- **Stateless** - no shared memory, no session state
- **BullMQ handles coordination** - jobs are distributed atomically, two workers never process the same job
- **Database is the bottleneck, not CPU** - adding workers helps until DB write throughput saturates
- **Independent deployable** - can run 10 workers with 1 backend instance or vice versa

---

## Bottleneck Summary by Scale

### 100,000 Records

| Component | Bottleneck | Severity | Fix |
|-----------|-----------|----------|-----|
| Contact search | Regex ~170ms | Medium | Switch to `$text` |
| CSV upload (50k rows) | ~5s response | Medium | Acceptable; document limit |
| Dashboard | Fine | None | - |
| Worker | Fine | None | - |

### 1,000,000 Records

| Component | Bottleneck | Severity | Fix |
|-----------|-----------|----------|-----|
| Contact search | Regex ~1.7s | Critical | `$text` index or Atlas Search |
| CSV upload (500k rows) | ~35s / OOM | Critical | S3 + async worker pipeline |
| Campaign creation | Blocks ~3s | High | Async audience resolution job |
| Dashboard | ~50ms (5k campaigns) | Medium | Redis cache (10s TTL) |
| Worker | Fine | None | - |
| `deliverylogs` indexes | May spill from RAM | Medium | 8GB+ RAM instance |

### 10,000,000 Records

| Component | Bottleneck | Severity | Fix |
|-----------|-----------|----------|-----|
| Contact search | Regex ~17s | Critical | Atlas Search / Elasticsearch |
| `$text` search | ~500ms | Medium | Fine for internal tool |
| CSV upload | Hours if sync | Critical | Full S3 streaming pipeline |
| Campaign creation | Minutes if sync | Critical | Async + progress tracking |
| `contacts` collection | ~9 GB | High | Shard on hashed `_id` |
| `deliverylogs` (1B docs) | Saturates single node | Critical | Shard on `campaignId` |
| Dashboard | ~100ms (100k campaigns) | Medium | Redis cache + time-range `$match` |
| Worker throughput | 2 concurrent/instance | Medium | Horizontal worker scaling |

---

## What Does Not Degrade with Scale

These components are designed to remain fast regardless of data volume:

| Component | Why It Stays Fast |
|-----------|------------------|
| Email point lookup | Unique index - O(log n) |
| Worker batch fetch | Compound index - O(batchSize), not O(total_logs) |
| Page 1 of any list | Index head scan - always reads exactly `limit` entries |
| Campaign `$inc` updates | Single document write - O(1) |
| `estimatedDocumentCount()` | Reads collection metadata - O(1) |
| Individual campaign read | `findById` on indexed `_id` - O(log n) |
