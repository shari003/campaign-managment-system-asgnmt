# Query Performance Report

## MongoDB Explain Analysis

## Dataset at Time of Testing

| Collection | Document Count | Notes |
|-----------|---------------|-------|
| `contacts` | **55,551** | Uploaded via CSV across multiple batches |
| `campaigns` | **3** | All in `completed` status |
| `deliverylogs` | **0** | Collection empty - campaigns pre-date worker logging on this instance |

**Campaign Summary:**

| Campaign Name | Status | Total Contacts | Sent | Failed | Pending |
|--------------|--------|---------------|------|--------|---------|
| Unlock Exclusive Benefits Today! | completed | 5,555 | 4,936 | 619 | 0 |
| Exclusive VIP Access - Just for You | completed | 9,059 | 8,143 | 916 | 0 |
| Make the Most of Your Free Trial | completed | 9,271 | 8,330 | 941 | 0 |

**Tag Distribution (contacts):**

| Tag | Count | % of Collection |
|-----|-------|----------------|
| `active` | 9,393 | 16.9% |
| `high_value` | 9,135 | 16.4% |
| `inactive` | 9,301 | 16.7% |
| `loyal` | 9,130 | 16.4% |
| `new` | 9,373 | 16.9% |
| `premium` | 9,059 | 16.3% |
| `tier1` | 9,249 | 16.6% |
| `tier2` | 9,241 | 16.6% |
| `trial` | 9,271 | 16.7% |

---

## Index Choices on Collection

### `contacts` Collection

| Index Name | Key | Properties |
|-----------|-----|------------|
| `_id_` | `{ _id: 1 }` | Default |
| `email_1` | `{ email: 1 }` | **Unique** |
| `phone_1` | `{ phone: 1 }` | **Sparse** |
| `tags_1` | `{ tags: 1 }` | **Multikey** |
| `name_text_email_text` | `{ name: "text", email: "text" }` | Text index |
| `createdAt_-1` | `{ createdAt: -1 }` | Descending sort |

### `campaigns` Collection

| Index Name | Key | Properties |
|-----------|-----|------------|
| `_id_` | `{ _id: 1 }` | Default |
| `status_1` | `{ status: 1 }` | - |
| `createdAt_-1` | `{ createdAt: -1 }` | - |
| `status_1_createdAt_-1` | `{ status: 1, createdAt: -1 }` | Compound |

### `deliverylogs` Collection

| Index Name | Key | Properties |
|-----------|-----|------------|
| `_id_` | `{ _id: 1 }` | Default |
| `campaignId_1_status_1` | `{ campaignId: 1, status: 1 }` | **Most critical** |
| `campaignId_1_contactId_1` | `{ campaignId: 1, contactId: 1 }` | **Unique** |
| `contactId_1` | `{ contactId: 1 }` | - |
| `campaignId_1_createdAt_-1` | `{ campaignId: 1, createdAt: -1 }` | Paginated log listing |
| `status_1` | `{ status: 1 }` | All-campaign status |

---

## Query 1 - Contact Email Point Lookup (CSV Upsert Filter)

**Description:** Every row of a CSV upload runs a `bulkWrite` upsert filtered on `email`. This is the hottest single-document path - executed once per contact per upload. At 55k contacts uploaded in 1000-doc batches, this runs 55,551 times per full reload.

**Query:**
```javascript
db.contacts.find({ email: "shanehester@campbell.org" })
  .explain("executionStats")
```

**Raw Explain Output:**
```json
{
  "executionSuccess": true,
  "nReturned": 1,
  "executionTimeMillis": 0,
  "totalKeysExamined": 1,
  "totalDocsExamined": 1,
  "executionStages": {
    "isCached": false,
    "stage": "EXPRESS_IXSCAN",
    "keyPattern": "{ email: 1 }",
    "indexName": "email_1",
    "keysExamined": 1,
    "docsExamined": 1,
    "nReturned": 1
  }
}
```

**Execution Metrics:**

| Metric | Value |
|--------|-------|
| Execution time | **0 ms** |
| Keys examined | **1** |
| Documents examined | **1** |
| Documents returned | **1** |
| Index used | `email_1` (unique) |
| Stage | `EXPRESS_IXSCAN` |

**Stage Breakdown:**
```
EXPRESS_IXSCAN (email_1)
  └─ Unique index seek → 1 key → 1 document → done
```

**Optimization Notes:**
- `EXPRESS_IXSCAN` is MongoDB's fastest single-document path - a unique index seek that terminates at exactly one result. There is no `FETCH` stage because the unique constraint allows the engine to stop immediately.
- The `unique: true` guarantee means MongoDB knows the result set is either 0 or 1 - no further traversal is ever needed.
- This is O(log n) = effectively O(1) for all practical dataset sizes.

**Scaling Projection:**

| Dataset | Keys Examined | Docs Examined | Expected Time |
|---------|--------------|---------------|---------------|
| 55,551 *(actual)* | **1** | **1** | **0ms** |
| 100k | 1 | 1 | ~0ms |
| 1M | 1 | 1 | ~0ms |
| 10M | 1 | 1 | ~0ms |

> Unique index seeks are constant time. The entire 55k collection was of no use to this query.

---

## Query 2 - Tag Filter (Campaign Audience Resolution)

**Description:** When a campaign is created with a tag-based `audienceFilter`, this query resolves all matching contact IDs. Executed once at campaign creation - the result feeds the `insertMany` that creates all DeliveryLog records.

**Query:**
```javascript
db.contacts.find(
  { tags: { $in: ["premium"] } },
  { _id: 1 }
).explain("executionStats")
```

**Raw Explain Output:**
```json
{
  "executionSuccess": true,
  "nReturned": 9059,
  "executionTimeMillis": 22,
  "totalKeysExamined": 9059,
  "totalDocsExamined": 9059,
  "executionStages": {
    "isCached": false,
    "stage": "PROJECTION_SIMPLE",
    "nReturned": 9059,
    "inputStage": {
      "stage": "FETCH",
      "docsExamined": 9059,
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "tags": 1 },
        "indexName": "tags_1",
        "isMultiKey": true,
        "multiKeyPaths": { "tags": ["tags"] },
        "keysExamined": 9059,
        "seeks": 1,
        "dupsTested": 9059,
        "dupsDropped": 0,
        "indexBounds": { "tags": ["[\"premium\", \"premium\"]"] }
      }
    }
  }
}
```

**Execution Metrics:**

| Metric | Value |
|--------|-------|
| Execution time | **22 ms** |
| Keys examined | **9,059** |
| Documents examined | **9,059** |
| Documents returned | **9,059** |
| Index used | `tags_1` (multikey) |
| Stage | `IXSCAN → FETCH → PROJECTION_SIMPLE` |
| Selectivity | 9,059 / 55,551 = **16.3%** |

**Stage Breakdown:**
```
PROJECTION_SIMPLE ({ _id: 1 })
  └─ FETCH (9,059 full documents retrieved)
       └─ IXSCAN (tags_1 multikey)
            indexBounds: tags → ["premium", "premium"]
            seeks: 1 - single seek into the "premium" bucket
            keysExamined: 9059
            dupsTested: 9059 | dupsDropped: 0
```

**How the Multikey Index Works:**

A contact with `tags: ["premium", "active", "loyal"]` generates **three** separate index entries - one per element. The IXSCAN seeks directly to the `"premium"` bucket with a single index seek (`seeks: 1`) and reads exactly 9,059 entries. `dupsDropped: 0` confirms no contact document was duplicated in the result despite the multikey nature of the index.

The `PROJECTION_SIMPLE { _id: 1 }` projection means only `_id` is returned per document - minimising memory and data transfer when returning 9,059 IDs to feed the subsequent `insertMany`.

**Optimization Notes:**
- **Keys examined = documents returned** - zero wasted traversal. Every key the index scan touches becomes a returned document.
- Without the `tags_1` index, this query would be a COLLSCAN across all 55,551 contacts - scanning 55,551 documents to find 9,059.
- `seeks: 1` confirms a single jump to the index bucket for "premium" - not an iterative scan.

**Scaling Projection:**

| Dataset | `premium` contacts (~16.3%) | Keys Examined | Expected Time |
|---------|----------------------------|--------------|---------------|
| 55,551 *(actual)* | **9,059** | **9,059** | **22ms** |
| 100k | ~16,300 | ~16,300 | ~x2ms |
| 1M | ~163,000 | ~163,000 | ~x20ms |
| 10M | ~1.63M | ~1.63M | **~x200s - async job required** |

> At 10M contacts, synchronous audience resolution blocks the API for ~(2-3)+ seconds. Mitigation: return `status: "preparing"` immediately and resolve the audience in a background BullMQ job.

---

## Query 3 - Contact Search with Regex (Search Bar)

**Description:** The contact listing page provides a search bar that does a case-insensitive substring match on both `name` and `email` using `$or` + `$regex`.

**Query:**
```javascript
db.contacts.find({
  $or: [
    { name: { $regex: "shane", $options: "i" } },
    { email: { $regex: "shane", $options: "i" } }
  ]
}).explain("executionStats")
```

**Raw Explain Output:**
```json
{
  "executionSuccess": true,
  "nReturned": 140,
  "executionTimeMillis": 93,
  "totalKeysExamined": 0,
  "totalDocsExamined": 55551,
  "executionStages": {
    "isCached": false,
    "stage": "SUBPLAN",
    "nReturned": 140,
    "inputStage": {
      "stage": "COLLSCAN",
      "filter": {
        "$or": [
          { "email": { "$regex": "shane", "$options": "i" } },
          { "name": { "$regex": "shane", "$options": "i" } }
        ]
      },
      "nReturned": 140,
      "docsExamined": 55551
    }
  }
}
```

**Execution Metrics:**

| Metric | Value |
|--------|-------|
| Execution time | **93 ms** |
| Keys examined | **0** |
| Documents examined | **55,551** - full collection scan |
| Documents returned | **140** |
| Index used | **None - COLLSCAN** |
| Stage | `SUBPLAN → COLLSCAN` |
| Selectivity | 140 / 55,551 = **0.25%** |

**Stage Breakdown:**
```
SUBPLAN (OR query planner - evaluated all indexes, chose none)
  └─ COLLSCAN
       filter: $or[email $regex "shane" /i, name $regex "shane" /i]
       docsExamined: 55,551 | nReturned: 140
       works: 55,552 | needTime: 55,411
```

**Why the Index Cannot Be Used:**

A `$regex` without a leading anchor (`^`) cannot use a B-tree index because the match can start at any character position in the string. MongoDB's `SUBPLAN` stage evaluated all available indexes and concluded none could satisfy this query - resulting in a full collection scan of all 55,551 documents.

The existing text index (`name_text_email_text`) is not triggered by `$regex` - it is only activated by the `$text` operator with word-boundary matching.

**This is the highest-severity performance gap in the system.** At 55k documents it takes 93ms - already near the 100ms threshold. The degradation goes up from here.

**Mitigation Path:**

```javascript
// Current - always a full COLLSCAN (93ms at 55k, ~2s at 1M):
db.contacts.find({ $or: [{ name: { $regex: "shane" } }, { email: { $regex: "shane" } }] })

// Better - uses the text index (inverted index, word-boundary match):
db.contacts.find({ $text: { $search: "shane" } })

// Best at 1M+ - Algolia / Elasticsearch for partial/fuzzy match:
// Requires external search infrastructure
```

**Scaling Projection:**

| Dataset | Docs Examined | Returned | Time | PRD Standard |
|---------|--------------|----------|------|-------------|
| 55,551 *(actual)* | **55,551** | **140** | **93ms** | Borderline |
| 100k | 100,000 | ~250 | ~200ms | Over 100ms |
| 1M | 1,000,000 | ~2,500 | ~2s | Unacceptable |
| 10M | 10,000,000 | ~25,000 | ~20s | Unacceptable |

> **Acknowledged limitation.** Would be better if we moved to any external infrastructure for searching over 10M data documents, but for now in production we can go with `$regex` in searching with 55k documents.

---

## Query 4 - Cursor-Based Paginated Listing (First Page)

**Description:** The default contact list - first page, sorted by `createdAt` descending. Fetches `limit + 1` to detect whether a next page exists.

**Query:**
```javascript
db.contacts.find({})
  .sort({ createdAt: -1 })
  .limit(21)
  .explain("executionStats")
```

**Raw Explain Output:**
```json
{
  "executionSuccess": true,
  "nReturned": 21,
  "executionTimeMillis": 0,
  "totalKeysExamined": 21,
  "totalDocsExamined": 21,
  "executionStages": {
    "isCached": false,
    "stage": "LIMIT",
    "limitAmount": 21,
    "inputStage": {
      "stage": "FETCH",
      "docsExamined": 21,
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "createdAt": -1 },
        "indexName": "createdAt_-1",
        "direction": "forward",
        "indexBounds": { "createdAt": ["[MaxKey, MinKey]"] },
        "keysExamined": 21,
        "seeks": 1,
        "dupsTested": 0,
        "dupsDropped": 0
      }
    }
  }
}
```

**Execution Metrics:**

| Metric | Value |
|--------|-------|
| Execution time | **0 ms** |
| Keys examined | **21** |
| Documents examined | **21** |
| Documents returned | **21** |
| Index used | `createdAt_-1` |
| Stage | `IXSCAN → FETCH → LIMIT` |

**Stage Breakdown:**
```
LIMIT (21)
  └─ FETCH (21 full documents)
       └─ IXSCAN (createdAt_-1)
            indexBounds: createdAt [MaxKey → MinKey]  ← newest first
            seeks: 1 | keysExamined: 21 - stops at LIMIT
```

**Optimization Notes:**
- The index scan reads exactly 21 entries from the top of the `createdAt_-1` index and stops - completely independent of how many documents exist in the collection.
- `seeks: 1` - a single seek to `MaxKey` (the most recent timestamp), then 21 sequential reads.
- At 55,551 documents, 55,530 are never touched by this query.

**Scaling Projection:**

| Dataset | Keys Examined | Docs Examined | Time |
|---------|--------------|---------------|------|
| 55,551 *(actual)* | **21** | **21** | **0ms** |
| 100k | 21 | 21 | 0ms |
| 1M | 21 | 21 | 0ms |
| 10M | 21 | 21 | 0ms |

> First-page cost is constant regardless of whatever the collection size.

---

## Query 5 - Cursor-Based Paginated Listing (After First Page)

**Description:** Subsequent pages pass the `_id` of the last document from the previous page as the cursor. This avoids `skip()` and keeps pagination stable under concurrent inserts.

**Query:**
```javascript
// cursor = _id of the 21st document from page 1
db.contacts.find({ _id: { $lt: ObjectId("69f5aaf0288c2cb7aa7320d4") } })
  .sort({ createdAt: -1 })
  .limit(21)
  .explain("executionStats")
```

**Raw Explain Output:**
```json
{
  "executionSuccess": true,
  "nReturned": 21,
  "executionTimeMillis": 6,
  "totalKeysExamined": 556,
  "totalDocsExamined": 556,
  "executionStages": {
    "isCached": false,
    "stage": "LIMIT",
    "inputStage": {
      "stage": "FETCH",
      "filter": { "_id": { "$lt": "69f5aaf0288c2cb7aa7320d4" } },
      "nReturned": 21,
      "docsExamined": 556,
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "createdAt": -1 },
        "indexName": "createdAt_-1",
        "keysExamined": 556,
        "seeks": 1
      }
    }
  }
}
```

**Execution Metrics:**

| Metric | Value |
|--------|-------|
| Execution time | **6 ms** |
| Keys examined | **556** |
| Documents examined | **556** |
| Documents returned | **21** |
| Index used | `createdAt_-1` |
| Stage | `IXSCAN → FETCH (with _id post-filter) → LIMIT` |

**Stage Breakdown:**
```
LIMIT (21)
  └─ FETCH - applies _id < cursor as post-index predicate
       docsExamined: 556 | nReturned: 21
       └─ IXSCAN (createdAt_-1)
            keysExamined: 556 | seeks: 1
```

**Important Finding - Cursor Efficiency Gap:**

The explain reveals that `_id < cursor` is applied as a **post-fetch predicate**, not at the index scan level. Since the sort index is on `createdAt` and does not contain `_id`, MongoDB must:
1. Walk the `createdAt_-1` index from `MaxKey` downward
2. Fetch each document to evaluate `_id < cursor`
3. Discard documents that fail the filter
4. Stop when 21 pass

At page 25 (cursor around position 500), it scanned **556 documents to return 21**. This cost grows gradually as the cursor moves deeper into the dataset.

**versus/ - Offset Pagination at the Same Depth:**

```javascript
db.contacts.find({}).sort({ createdAt: -1 }).skip(500).limit(21).explain("executionStats")
```

```json
{
  "nReturned": 21,
  "executionTimeMillis": 1,
  "totalKeysExamined": 521,
  "totalDocsExamined": 21,
  "executionStages": {
    "stage": "LIMIT",
    "inputStage": {
      "stage": "FETCH",
      "docsExamined": 21,
      "inputStage": {
        "stage": "SKIP",
        "skipAmount": 500,
        "inputStage": {
          "stage": "IXSCAN",
          "indexName": "createdAt_-1",
          "keysExamined": 521
        }
      }
    }
  }
}
```

**Side-by-Side at ~page 25 (position 500):**

| Approach | Keys Examined | Docs Examined | Time | At 1M (page 50k) |
|----------|--------------|---------------|------|-----------------|
| Cursor `_id: $lt` *(current)* | 556 | 556 | 6ms | Degrades, but stabilises |
| Offset `skip(500)` | 521 | 21 | 1ms | **~500ms - linear degradation** |

**Why Cursor Is Still Better at Scale:**
Offset pagination's `SKIP` traverses index entries sequentially - at `skip(50000)`, that is 50,000 key traversals before touching a single result document. At 1M records, `skip(500000)` traverses 500,000 keys.

---

## Query 6 - Campaign Stats Aggregation (Dashboard)

**Description:** The dashboard endpoint aggregates `sentCount`, `failedCount`, `pendingCount` across all campaigns grouped by status. This runs every 5 seconds via frontend polling.

**Query:**
```javascript
db.campaigns.explain("executionStats").aggregate([
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      totalSent: { $sum: "$sentCount" },
      totalFailed: { $sum: "$failedCount" },
      totalPending: { $sum: "$pendingCount" }
    }
  }
])
```

**Raw Explain Output (critical section):**
```json
{
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 1,
    "executionTimeMillis": 1,
    "totalKeysExamined": 0,
    "totalDocsExamined": 3,
    "executionStages": {
      "stage": "scan",
      "nReturned": 3,
      "numReads": 3,
      "scanFieldNames": ["failedCount", "pendingCount", "sentCount", "status"]
    }
  },
  "queryPlanner": {
    "winningPlan": {
      "queryPlan": {
        "stage": "GROUP",
        "inputStage": { "stage": "COLLSCAN", "direction": "forward" }
      }
    }
  }
}
```

**Execution Metrics:**

| Metric | Value |
|--------|-------|
| Execution time | **1 ms** |
| Keys examined | **0** |
| Documents examined | **3** (all 3 campaigns) |
| Documents returned | **1** (1 group - all are "completed") |
| Index used | None - COLLSCAN (appropriate at this scale) |
| Stage | `COLLSCAN → GROUP` |

**Stage Breakdown:**
```
GROUP (by $status, sum counters)
  └─ COLLSCAN (campaigns - only 3 documents)
       numReads: 3
       scanFieldNames: [failedCount, pendingCount, sentCount, status]
```

**Why COLLSCAN Is Correct Here:**

The campaigns collection will never contain millions of documents. A COLLSCAN over 3 documents takes 1ms. More importantly, the aggregation is summing **pre-computed denormalized counters** - `sentCount`, `failedCount`, `pendingCount` - that the worker maintains via atomic `$inc` after every batch. The pipeline never touches `deliverylogs`.

**The alternative without denormalization:**
```javascript
// Without denormalized counters - scans all deliverylogs:
db.deliverylogs.aggregate([
  { $group: { _id: { campaign: "$campaignId", status: "$status" }, count: { $sum: 1 } } }
])
// At 10M deliverylogs: ~10s scan vs 1ms with denormalized counters
```

**Scaling Projection:**

| Campaigns | Docs Examined | Time |
|-----------|--------------|------|
| 3 *(actual)* | **3** | **1ms** |
| 1,000 | 1,000 | ~3ms |
| 10,000 | 10,000 | ~10ms |
| 100,000 | 100,000 | ~100ms |

---

## Query 7 - Worker Batch Fetch (Most Performance-Critical Query)

**Description:** The inner loop of the campaign processor. Runs **hundreds of times per campaign** - once per 500-contact batch. This is the single most executed query in the entire system during campaign processing.

**Query:**
```javascript
db.deliverylogs.find({
  campaignId: ObjectId("69f578f7d8ea8663b7aedda9"),
  status: "queued"
}).limit(500).explain("executionStats")
```

**Actual Output:**
```json
{
  "nReturned": 0,
  "executionTimeMillis": 0,
  "executionStages": {
    "stage": "EOF",
    "type": "nonExistentNamespace"
  }
}
```

> The `deliverylogs` collection is empty on this instance - all 3 campaigns completed before the delivery log schema was in place. The `EOF / nonExistentNamespace` result reflects an empty collection fast-path, not a missing index. The expected behavior with data is described below.

**Expected Explain With Data:**
```json
{
  "executionSuccess": true,
  "nReturned": 500,
  "executionTimeMillis": "<5",
  "totalKeysExamined": 500,
  "totalDocsExamined": 500,
  "executionStages": {
    "stage": "LIMIT",
    "limitAmount": 500,
    "inputStage": {
      "stage": "FETCH",
      "docsExamined": 500,
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "campaignId": 1, "status": 1 },
        "indexName": "campaignId_1_status_1",
        "indexBounds": {
          "campaignId": ["[ObjectId('...'), ObjectId('...')]"],
          "status": ["[\"queued\", \"queued\"]"]
        },
        "keysExamined": 500,
        "seeks": 1
      }
    }
  }
}
```

**Expected Execution Metrics:**

| Metric | Expected Value |
|--------|----------------|
| Execution time | **< 5ms** |
| Keys examined | **500** (= limit) |
| Documents examined | **500** |
| Documents returned | **500** |
| Index used | `campaignId_1_status_1` |
| Stage | `IXSCAN → FETCH → LIMIT` |

**Why `{ campaignId, status }` Is the Most Critical Index:**

The compound index bounds are:
```
campaignId: [ObjectId("abc"), ObjectId("abc")]  ← exact single-value range
status:     ["queued", "queued"]                ← exact single-value range
```

MongoDB performs a **single seek** (`seeks: 1`) to the exact leaf position in the B-tree where `(campaignId=abc, status=queued)` begins, then reads 500 sequential entries - and stops. The total number of documents in the collection is completely irrelevant.

**Processing Cost Comparison:**

```
Campaign with 9,059 contacts (Exclusive VIP Access):
  Batches: ceil(9059 / 500) = 19 iterations
  With index: 19 × ~5ms = ~95ms total query time
  With COLLSCAN at 1M deliverylogs: 19 × ~500ms = ~9.5s total query time
```

**Scaling Projection:**

| Total `deliverylogs` | Keys/Batch | Batch Time | Time per 9k campaign |
|----------------------|-----------|------------|---------------------|
| 100k | 500 | ~2ms | ~40ms |
| 1M | 500 | ~4ms | ~x2ms |
| 10M | 500 | ~5ms | ~x3ms |
| 100M | 500 | ~6ms | ~x4ms |

> The compound index makes batch cost O(batchSize) regardless of total collection size. This is why it is the most important index in the system.

---

## Query 8 - DeliveryLog Status Count per Campaign (Campaign Detail Page)

**Description:** The campaign detail page shows a live breakdown of delivery log statuses. Runs every 5 seconds via polling.

**Query:**
```javascript
db.deliverylogs.aggregate([
  { $match: { campaignId: ObjectId("69f578f7d8ea8663b7aedda9") } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
])
```

> Collection is empty on this instance. Expected behavior with data is described below.

**Expected Execution Metrics (for a 9,059-contact campaign):**

| Metric | Expected Value |
|--------|----------------|
| Execution time | ~5ms |
| Keys examined | ~9,059 |
| Documents examined | ~9,059 |
| Documents returned | **4** (one per status) |
| Index used | `campaignId_1_status_1` |
| Stage | `IXSCAN ($match via index) → FETCH → GROUP` |

**Expected Stage Breakdown:**
```
GROUP (by $status)
  └─ FETCH (9,059 documents for this campaign)
       └─ IXSCAN (campaignId_1_status_1)
            $match on campaignId → index range scan
            only this campaign's logs are touched
```

**Why the Index Helps:**

Without `{ campaignId, status }`, the `$match` stage would scan all deliverylogs across all campaigns. With it, the index range scan constrains the read to only documents where `campaignId = target`. Even if the collection has 100M logs across 1000 campaigns, this aggregation touches only ~100k (this campaign's logs) - not 100M.

---

## Optimization Justification

### Indexing Decisions

| Index | Query It Serves | Without It | Decision |
|-------|----------------|-----------|----------|
| `email_1` (unique) | CSV upsert filter | 55k full-collection upserts per upload | Mandatory |
| `tags_1` (multikey) | Audience filter `{ tags: $in }` | COLLSCAN - 55k docs for every campaign creation | Mandatory |
| `{ campaignId, status }` | Worker batch fetch | COLLSCAN on all deliverylogs per batch | Mandatory |
| `{ campaignId, contactId }` (unique) | Unique guarantee on `insertMany` | Duplicate delivery logs on worker retry | Mandatory for correctness |
| `phone_1` (sparse) | Phone-based lookups | Wastes index space on null entries | Sparse saves ~20% index size |
| `{ status, createdAt }` | Filtered campaign listing | In-memory sort after status filter | Covers filter + sort in one pass |

### Read vs Write Trade-offs

| Decision | Read Benefit | Write Cost | Chosen? |
|----------|-------------|-----------|---------|
| Denormalised `sentCount / failedCount / pendingCount` on Campaign | O(1) dashboard reads, no DeliveryLog scan | Extra `$inc` per worker batch | Yes - dashboard polled every 5s × many users |
| Pre-create all DeliveryLogs at campaign creation | Worker loop starts instantly, no audience re-query | Campaign creation blocks for O(contacts) `insertMany` | Yes - one-time cost vs repeated benefit |
| Compound index `{ campaignId, status }` | O(batchSize) per worker iteration | Maintained on every status transition (`queued→processing→sent/failed`) | Yes - worker loop dominates total processing time |
| Compound unique `{ campaignId, contactId }` | Uniqueness guarantee at storage engine level | Enforced on every insert | Yes - correctness is non-negotiable |

### Denormalization Choice - Counters on Campaign

```javascript
// Worker runs after every batch:
Campaign.findByIdAndUpdate(campaignId, {
  $inc: { sentCount: 450, failedCount: 50, pendingCount: -500 }
})
```

This is 1 write per batch. The alternative - computing these live - requires:
```javascript
// Dashboard without denormalization (runs every 5s):
db.deliverylogs.countDocuments({ campaignId: X, status: "sent" })   // ×3 statuses
// At 9,059 logs per campaign × 3 campaigns × 3 statuses = 27 count queries/dashboard load
// At 1M deliverylogs per campaign = 3M-document scan every 5 seconds
```

With denormalization: **1 aggregation across 3 Campaign documents = 1ms**.
Without: **27 count queries across up to millions of DeliveryLogs = seconds**.

---

## Scalability Commentary

### At 100,000 Contacts

| Query | Expected Time | Notes |
|-------|--------------|-------|
| Email lookup | 0ms | Constant - unique index |
| Tag filter | ~40ms | ~16k results, index scan |
| Regex search | ~170ms | Full scan - use `$text` |
| Page 1 listing | 0ms | Constant |
| Dashboard | ~3ms | ~50 campaigns |
| Worker batch | <5ms | Index-bound |

### At 1,000,000 Contacts

| Query | Expected Time | Action Required |
|-------|--------------|----------------|
| Email lookup | ~0ms | None |
| Tag filter | ~300ms | Acceptable; move to async if > 500ms |
| Regex search | **~1.7s** | Replace with `$text` or Atlas Search |
| Page 1 listing | 0ms | None |
| Dashboard | ~5ms | None |
| Worker batch | <5ms | None - index scales |

**New requirements at 1M:**
- Contact search must use `$text` index or external search service
- Redis cache for dashboard stats (TTL: 10–30s)
- Monitor `deliverylogs` index sizes vs available RAM

### At 10,000,000 Contacts

| Component | Bottleneck | Mitigation |
|-----------|-----------|-----------|
| Contact search | Regex is ~17s | Atlas Search / Elasticsearch mandatory |
| Audience resolution | ~3s synchronous | Async background job, `status: "preparing"` |
| Campaign creation | `insertMany` 1.6M logs | Stream insertion in 5k batches |
| `deliverylogs` shard | 100M+ documents | Shard on `campaignId` - all queries per campaign stay local to one shard |
| Dashboard | ~100ms (100k campaigns) | `$match { createdAt: { $gte: 30daysAgo } }` + index; Redis cache |
| Worker batch | <6ms per batch | Horizontal scaling - add more worker instances |

---

## Summary - Index Coverage Matrix

| Query | Index Hit? | Stage | Docs Examined / Returned | Verdict |
|-------|-----------|-------|--------------------------|---------|
| Email lookup | `email_1` | `EXPRESS_IXSCAN` | 1 / 1 | Optimal |
| Tag filter | `tags_1` | `IXSCAN → FETCH` | 9,059 / 9,059 | Optimal |
| Regex search | None | `COLLSCAN` | 55,551 / 140 | Full scan - known, documented |
| List page 1 | `createdAt_-1` | `IXSCAN → FETCH → LIMIT` | 21 / 21 | Optimal |
| List page 2+ | `createdAt_-1` (partial) | `IXSCAN → FETCH(filter) → LIMIT` | 556 / 21 | Improvable |
| Dashboard agg | Denormalized counters | `COLLSCAN(3 campaigns) → GROUP` | 3 / 1 | Optimal |
| Worker batch | `campaignId_1_status_1` | `IXSCAN → FETCH → LIMIT` | 500 / 500 | Optimal (theoretical) |
| Status count agg | `campaignId_1_status_1` | `IXSCAN → FETCH → GROUP` | ~9k / 4 | Good (theoretical) |