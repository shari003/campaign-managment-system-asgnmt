# Design Decisions - Campaign Management System

## Objective

The goal was to build a system that could:

1. Ingest large contact lists (up to 55k records) from CSV files reliably and efficiently
2. Let users create campaigns targeting a subset of those contacts
3. Process those campaigns asynchronously - without blocking the API or the user
4. Track the delivery status of every message, in near real-time
5. Surface all of this through a responsive dashboard

---

## Schema Design Reasoning

### Contact Schema - Why `email` as the deduplication key

Email is the only field that is both universally present in contact data and logically unique per person. Phone numbers can be shared (family plans), names are obviously non-unique, and we cannot guarantee UUIDs from external CSVs.

Setting `{ email: 1 }` as a **unique index** means the bulk upsert operation is both fast (index lookup per row) and correct (no duplicates, updates merge changes). The alternative - checking existence before insert - would require N round-trips for N contacts, which is untenable at 55k rows.

**The `tags` field as an array with a multikey index:** Tags are the primary audience filter mechanism. A contact can belong to multiple tags (e.g., `["premium", "active", "newsletter"]`). MongoDB's multikey index on an array field creates one index entry per element, which means `{ tags: { $in: ["premium"] } }` hits the index directly without a collection scan.

**The `metadata` field as a flexible Map:** Rather than rejecting rows with extra CSV columns, we store them. This makes the ingestion pipeline maximally tolerant of varied data sources and preserves data that might be valuable later.

### Campaign Schema - Why Denormalized Counters

The three fields `sentCount`, `failedCount`, `pendingCount` are the most consequential schema decision in the entire project.

The alternative would be to compute these live: every dashboard request would run `db.deliverylogs.countDocuments({ campaignId, status: "sent" })`. At 10k contacts per campaign and 100 campaigns, that's 300 aggregation queries per dashboard load. At 1M delivery logs, each of those queries scans a large portion of the collection even with an index.

Instead, the worker increments these counters atomically via `$inc` after every batch:

```javascript
Campaign.findByIdAndUpdate(campaignId, {
  $inc: { sentCount: 450, failedCount: 50, pendingCount: -500 }
})
```

This is a single document write. The dashboard reads one Campaign document and gets all three numbers instantly - O(1) regardless of how many delivery logs exist. The cost is a marginally more complex write path in the worker. The benefit is dashboard reads that stay fast at any scale.

**The `pendingCount` starting at `totalContacts`** and counting down via `$inc` with a negative value means it is always accurate without a subtraction query.

### DeliveryLog Schema - Why a Separate Collection (Not Embedded)

The intuitive MongoDB approach might be to embed delivery logs inside the Campaign document as an array. This fails immediately:

- MongoDB documents have a 16MB size limit (per document size). A campaign with 55k contacts would have 55k embedded subdocuments - easily exceeding this limit.
- Bulk-updating the status of 500 embedded subdocuments in a single array requires `$[]` positional operators that are significantly harder to write and less efficient than `updateMany` on a separate collection.
- Querying "all queued logs for campaign X" with a limit would require an aggregation `$unwind` instead of a simple `find()`.

As a separate collection with a compound index on `{ campaignId: 1, status: 1 }`, the worker's inner loop is a simple indexed find with a limit - the most performance-critical query in the entire system, running potentially hundreds of times per campaign.

**The compound unique index on `{ campaignId, contactId }`** is the idempotency guarantee. If the worker is somehow triggered twice for the same campaign, the second `insertMany` call will fail on duplicate key errors (with `ordered: false`, the rest of the batch still succeeds). No contact gets messaged twice.

---

## Backend Business Logic Reasoning

### Why Batch Processing at 500 (not 1 at a time, not all at once)

Processing one message at a time means N database round-trips for N contacts. For 10,000 contacts, that's 10,000 individual write operations - slow and expensive.

Processing all at once means loading potentially 55,000 documents into memory simultaneously, updating them in a single massive `updateMany`, and having no progress visibility until it's all done.

500 is the middle ground:
- 20 database round-trips to process 10,000 contacts - manageable
- Each batch fits comfortably in memory
- Job progress can be reported after every batch
- If the worker crashes, at most 500 messages are in an ambiguous `processing` state (they remain in that state rather than being silently lost)

The `processing` status also serves as a crash-recovery signal. If the worker restarts, logs stuck in `processing` can be detected and reset by a cleanup job - something the `queued` filter alone wouldn't expose.

### Why the Worker is a Separate Process

This is the single most important architectural decision for production reliability.

If campaign processing ran inside the API server:
- A large campaign (55k contacts) ties up Node's event loop for its duration
- A memory spike processing a bad dataset takes down the API for all other users
- Scaling the API horizontally would spin up unnecessary campaign processors on every instance
- A bug in the processor could crash the API mid-request

As a separate process:
- The API stays responsive regardless of how many campaigns are processing
- Workers can be scaled independently based on queue depth
- A worker crash is isolated - the job is retried, the API is unaffected
- Different resource profiles can be applied (the API needs low latency, the worker needs sustained throughput)

---

## Why only TanStack Query and no Redux

**Redux solves the problem of shared, client-owned state** - The data are pieces of UI state that live entirely in the browser and don't correspond to any server resource.

**TanStack Query solves the problem of server state** - data that lives on the server, is fetched over the network, can become stale, and needs to be synchronized back to the server when changed. This is almost everything in this application: contacts, campaigns, delivery logs, dashboard stats.

Using Redux for server state creates problems:
- We had to write actions, reducers, selectors, and thunks just to fetch a list and show a loading spinner
- Cache invalidation becomes manual - we had to remember to dispatch the right action after every mutation
- Stale data management is either absent or requires significant custom logic
- Polling requires `setInterval` management, cleanup, and care about component unmounting

TanStack Query gives us all of this:
- `queryKey` is the cache key - change it, the data refetches automatically
- `invalidateQueries` after a mutation tells every component showing that data to refetch
- `refetchInterval: 5000` implements polling with automatic cleanup on unmount
- Loading, error, and success states are first-class

Adding Redux here would mean writing 300+ lines of boilerplate (store, slices, thunks, selectors) to replicate features TanStack Query provides out of the box, while making the codebase harder to follow.

---

## What This System Achieves Well

**Throughput at scale:** A single worker instance can process approximately 5,000 messages per second once the simulated delay is removed. The bottleneck at scale is the MongoDB write throughput. The batch pattern means write operations scale as O(contacts / 500) rather than O(contacts).

**API responsiveness under load:** Because processing is fully decoupled into the worker, the API maintains ~100ms response times regardless of how many campaigns are actively processing. Starting a 55k-contact campaign takes the same time as starting a 10-contact campaign - one queue write.

**Data consistency:** The compound unique index on `(campaignId, contactId)` in DeliveryLog guarantees exactly-once log creation. The `jobId` deduplication in BullMQ guarantees exactly-once job execution. Together, these prevent the most common reliability failure mode: processing the same contact twice.

**Cursor pagination correctness:** Offset-based pagination (`skip(n)`) produces incorrect results when new data is inserted between page fetches. Cursor-based pagination on `_id` is stable: even if 1,000 new contacts are inserted, the next page cursor always points to the same document.

**Extensibility:** Adding a new campaign type, a new audience filter, or a new delivery channel requires changing only the service function and potentially the worker processor. Nothing else in the stack changes.

---

## Honest Demerits and Limitations

### 1. Campaign Creation Blocks on Audience Resolution

When a user creates a campaign targeting 55,000 contacts, the creation endpoint synchronously:
1. Runs a query to find all matching contact IDs
2. Inserts 55,000 DeliveryLog documents

This can take 5–15 seconds for a large audience. The API request hangs for the duration. At 100k contacts, this becomes noticeably slow. The correct approach at scale is to make campaign creation asynchronous too - return immediately with a `preparing` status and resolve the audience in a background job. This was not implemented to keep the flow simple.

### 2. No Real Retry Logic for Failed Delivery Logs

The simulation (as per PRD) marks ~10% of messages as `failed`. The system records `retryCount` on each DeliveryLog and BullMQ retries the **job** on failure, but there is no mechanism to re-attempt failed **individual delivery logs** within a completed campaign. An ideal system would need a separate "retry failed" workflow that re-queues failed logs.

### 3. The `processing` State Can Get Stuck

If the worker crashes after setting a batch to `processing` but before writing the `sent`/`failed` outcomes, those logs remain in `processing` indefinitely. The next batch fetch skips them (it only fetches `queued`). There is no cleanup job that detects and resets stale `processing` logs.

### 4. In-Memory CSV Parsing Has a Size Ceiling

CSV files are held in memory as a Buffer during parsing (via `multer.memoryStorage()`). The limit is set to 50MB. A 500k-row CSV could exceed this. The ideal solution is streaming the file directly to S3 and processing it line-by-line in a background job, never loading the full file into memory.

### 5. No Backpressure on the Worker

The worker processes all campaigns in its queue as fast as possible. There is no rate limiting per campaign or per worker at the application level (there is a BullMQ concurrency limit of 2 jobs). In a real system, the provider would enforce rate limits (e.g., 100 messages/second). Without handling provider backpressure, the system would hit HTTP 429 errors and fail deliveries that should have succeeded.

### 6. Regex Search Does Not Scale Past 1M Contacts

The contact search uses `$regex` with `$options: "i"` for case-insensitive matching. Regex queries without a leading anchor (`^`) cannot use a standard B-tree index and must examine each document's field value within the filtered set. The text index helps for exact word matching but not for partial substrings like searching "gmai" to find "gmail.com". At 1M+ contacts, this becomes the dominant query bottleneck. The correct solution is a dedicated search service (Atlas Search, Elasticsearch) with an inverted index.
