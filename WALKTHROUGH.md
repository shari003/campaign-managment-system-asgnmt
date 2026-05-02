## After Uploading CSV File

Backend processed the csv using csv-parser and ran `bulkWrite` with `upsert: true` | key on `email`.

```javascript
db.contacts.find({email: "shanehester@campbell.org"}).explain("executionStats")
```

All Indexes in `contacts` collection

```javascript
db.contacts.getIndexes()
```

---

### How query will resolve to target contacts for a campaign with tags (this being the Array of string and is a multi-key index)

```javascript
db.contacts.find(
  { tags: { $in: ["premium"] } },
  { _id: 1 }
).explain("executionStats")
```

because we only projected `_id` which it does not needs to look into `contacts` collection itself, only index lookup is done.

---

## After Creation of a Campaign, How DeliveryLog insertion works

When we create a campaign, all the contacts resolved based on filters are bulk inserted via `insertMany` to create one document per matching `campaignId` + `contactId` **(This is a Compound Key for `deliverylogs` collection)**. It ensures no duplicate documents are created, uses `ordered: false` (To continue even if any insertion fails). 5000 documents are inserted at once.

```javascript
db.delivery_logs.find({
  campaignId: ObjectId("campaignId"),
  contactId: ObjectId("contactId")
}).explain("executionStats")
```

---

## After Starting the Campaign (or before because the docs will have `status: queued`), How Worker's Batch Fetch Query works

The workers listens to the Queue all the time, fetchs 500 `status: queued` `deliverylogs` at a time. It is important because it hits the DB many times per campaign.

It uses `campaignId` + `status` as Compund Key to narrow down the search. So Even if we have thousands of contacts (let's say x) under a single campaign we will be only processing 500 at a time, meaning it does `x/500` queries to the DB.

Without this indexing it shall scan the entire collection meaning it would take more time.

```javascript
db.delivery_logs.find({
  campaignId: ObjectId("campaignId"),
  status: "queued"
}).limit(500).explain("executionStats")
```

---

## How Dashboard shows the progress, when the Campaign is getting executed by worker (Short Polling by Frontend ~5secs)

The backend (main) runs a status count aggregation every 5 seconds.

```javascript
db.delivery_logs.aggregate([
  { $match: { campaignId: ObjectId("campaignId") } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
]).explain("executionStats")
```

This only scans documents which belongs to a particular `campaignId`. It uses the Compound Index of `campaignId` + `status`.

Since dashboard demanded the individual counts such as SentCount, PendingCount, FailedCount for all the campaigns. I have stored their direct values under a single campaign document which makes the Reads way faster compromising with the Writes, as we are atomically incrementing the counts in Worker process using `$inc` operator after every batch gets processed.

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

Even if a single campaign have thousands of contacts which means thousands of documents in `deliverylogs` collection, it wont touch any of the `deliverylogs` documents to count. Even though we are taking a slight hit in Write during Worker Batch process (which is only once per batch).

---

### Why Cursor Pagination

Traditional Offset pagination needs an offset to move and fetch next page results, under the hood what happens is it scans `offset` number of documents and discards it, then it return `offset + 1` document till `offset + 1 + limit`.

Now in this case we might have lakhs of Contacts, so this might be slow, that's why I chose to go with Cursor Based Pagination. Based on lastSeen contact document index, we proceed further to fetch more results. No matter whatever page we are on either 2 or 2000 it will only fetch `LIMIT` number of documents.

```javascript
db.contacts.find({
  _id: { $lt: ObjectId("lastSeen_contactId") }
})
.sort({ createdAt: -1 })
.limit(21)
.explain("executionStats")
```

```javascript
db.contacts.find()
.sort({ createdAt: -1 })
.skip(2000)
.limit(21)
.explain("executionStats")
```

---

The Indexes I Chose per Mongodb model are:

1. contacts -> `{email: 1}` its unique, helps in CSV file uploading and upsertion into the collection (upsertion -> new email are directly inserted after validation and updates the document if contactId already exists in the DB and with new CSV values).
2. contacts -> `{tags: 1}` multi-key indexes, to filter contacts by tags for targetting by a campaign.
3. contacts -> `{name, email}` text index (not normal regex based searching) because `$regex` is like pattern matching ($regex does not require indexing on the field). Its comparatively slower than `$text` index. It is helpful in searching words, its like a mini search engine.
4. contacts -> `{createdAt: -1}` index for sort + cursor based pagination.

---

5. campaigns -> `{status: 1, createdAt: -1}` compounded key, useful for filtered campaign listing


---

6. deliverylogs -> `{campaignId: 1, status: 1}` most important for Worker Batch Fetch Query - runs hunderds of times per campaign.
7. deliverylogs -> `{campaignId: 1, contactId: 1}` compounded key for no duplicate insertion.
8. deliverylogs -> `{campaignId: 1, createdAt: -1}` index for cursor based paginated logs per campaign id.