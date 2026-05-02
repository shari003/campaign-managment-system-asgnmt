# API Documentation

**Base URL:** `http://localhost:5000/api`  
**Content-Type:** `application/json` (except file upload)  
**Authentication:** Not Implemented

All successful responses wrap their payload in a `data` field. All error responses return a `message` field.

```json
// Success
{ "success": true, "data": { ... }, "message": "....", "meta": null }

// Error
{ "success": false, "data": null,"message": "Description of what went wrong", "meta": null }
```

---

## Table of Contents

- [Data Models](#data-models)
- [Contacts API](#contacts-api)
  - [POST /contacts/upload](#1-post-contactsupload)
  - [GET /contacts](#2-get-contacts)
  - [GET /contacts/count](#3-get-contactscount)
  - [GET /contacts/:id](#4-get-contactsid)
  - [DELETE /contacts/:id](#5-delete-contactsid)
- [Campaigns API](#campaigns-api)
  - [POST /campaigns](#1-post-campaigns)
  - [GET /campaigns](#2-get-campaigns)
  - [GET /campaigns/dashboard](#3-get-campaignsdashboard)
  - [GET /campaigns/:id](#4-get-campaignsid)
  - [POST /campaigns/:id/start](#5-post-campaignsidstart)
  - [GET /campaigns/:id/details](#6-get-campaignsiddetails)
  - [GET /campaigns/:id/logs](#7-get-campaignsidlogs)
  - [DELETE /campaigns/:id](#8-delete-campaignsid)
- [HTTP Status Codes](#http-status-codes)
- [Pagination](#pagination)

---

## MongoDB Data Models

### Contact Object

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phone": "+1-555-0101",
  "tags": ["premium", "active"],
  "metadata": {
    "city": "New York",
    "plan": "pro"
  },
  "createdAt": "2026-05-02T06:42:30.041Z",
  "updatedAt": "2026-05-02T06:42:30.041Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | - | MongoDB document ID (auto-generated) |
| `name` | string | Yes | Contact full name |
| `email` | string | Yes | Unique. Lowercased on insert. Used as deduplication key |
| `phone` | string | No | Phone number. Null if not provided |
| `tags` | string[] | No | Array of tag strings. Used for audience filtering |
| `metadata` | object | No | Mixed-type map of any extra CSV columns. Values can be strings, numbers, booleans, or nested objects - whatever the CSV column contains. Stored as `Schema.Types.Mixed` in MongoDB |
| `createdAt` | Date | - | Auto-managed by Mongoose |
| `updatedAt` | Date | - | Auto-managed by Mongoose |

---

### Campaign Object

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
  "name": "Summer Sale Announcement",
  "messageTemplate": "Hi there, check out our summer deals!",
  "status": "running",
  "audienceFilter": {
    "tags": ["premium"],
    "search": "gmail.com"
  },
  "totalContacts": 5000,
  "sentCount": 2300,
  "failedCount": 200,
  "pendingCount": 2500,
  "scheduledAt": null,
  "completedAt": null,
  "createdAt": "2026-05-02T06:42:30.041Z",
  "updatedAt": "2026-05-02T06:42:30.041Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | MongoDB document ID |
| `name` | string | Campaign display name |
| `messageTemplate` | string | Message body |
| `status` | `CampaignStatus` enum | Current campaign state. See enum values below |
| `audienceFilter` | object | Filter used to resolve the audience at creation time |
| `totalContacts` | number | Total contacts targeted. Set at creation, never changes |
| `sentCount` | number | Messages successfully delivered. Updated by worker via `$inc` |
| `failedCount` | number | Messages that failed delivery. Updated by worker via `$inc` |
| `pendingCount` | number | Messages not yet processed. Starts at `totalContacts`, decrements |
| `scheduledAt` | Date \| null | Reserved for future scheduled campaigns |
| `completedAt` | Date \| null | Timestamp when status changed to `completed` |

**`CampaignStatus` Enum**

Defined as a TypeScript enum in the model. The value (what the API sends/receives) is always the lowercase string on the right:

| Enum Constant | Value (string) |
|---------------|---------------------|
| `CampaignStatus.DRAFT` | `"draft"` |
| `CampaignStatus.RUNNING` | `"running"` |
| `CampaignStatus.COMPLETED` | `"completed"` |
| `CampaignStatus.PAUSED` | `"paused"` |
| `CampaignStatus.FAILED` | `"failed"` |

**Status lifecycle:**
```
draft → running → completed
                ↘ failed
```

---

### DeliveryLog Object

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
  "campaignId": "64f1a2b3c4d5e6f7a8b9c0d2",
  "contactId": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "phone": "+1-555-0101"
  },
  "status": "sent",
  "retryCount": 0,
  "lastError": null,
  "sentAt": "2026-05-02T07:42:30.041Z",
  "createdAt": "2026-05-02T06:42:30.041Z",
  "updatedAt": "2026-05-02T07:42:30.041Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `campaignId` | ObjectId | Reference to parent Campaign |
| `contactId` | Contact (populated) | Populated with `name`, `email`, `phone` on list queries |
| `status` | `DeliveryStatus` enum | Current delivery state. See enum values below |
| `retryCount` | number | How many times delivery was attempted. Incremented on failure |
| `lastError` | string \| null | Error message from last failed attempt |
| `sentAt` | Date \| null | Timestamp of successful delivery. Null until sent |

**`DeliveryStatus` Enum**

Defined as a TypeScript enum in the model. The value (what the API sends/receives) is always the lowercase string on the right:

| Enum Constant | Value (string) |
|---------------|---------------------|
| `DeliveryStatus.QUEUED` | `"queued"` |
| `DeliveryStatus.PROCESSING` | `"processing"` |
| `DeliveryStatus.SENT` | `"sent"` |
| `DeliveryStatus.FAILED` | `"failed"` |

**Status lifecycle:**
```
queued → processing → sent
                    ↘ failed
```

---

## Contacts API

### 1. `POST /contacts/upload`

Upload a CSV file to bulk-import contacts. Existing contacts (matched by email) are updated, new ones are inserted.

**Request**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Accepted formats: `.csv` only
- Max file size: `50MB`

**CSV Format**

| Column | Required | Notes |
|--------|----------|-------|
| `email` | **Yes** | Unique per contact. Rows without email are skipped |
| `name` | Yes | Contact display name |
| `phone` | No | Optional phone number |
| `tags` | No | Semicolon-separated: `premium;active;newsletter;etc...` |
| Any other column | No | Stored in `metadata` map |

**Example CSV:**
```csv
name,email,phone,tags,city,plan
Erik Little,shanehester@campbell.org,457-542-6899,premium;loyal,Caitlynmouth,free
Yvonne Shaw,kleinluis@vang.com,9610730173,tier1;high_value;loyal,Janetfort,pro
Jeffery Ibarra,deckerjamie@bartlett.biz,(840)539-1797x479,active;loyal,Darlenebury,pro
James Walters,dochoa@carey-morse.com,+1-985-596-1072x3040,,Donhaven,max
```

**Success Response** - `200 OK`
```json
{
  "success": true,
  "message": "CSV processed successfully",
  "data": {
    "totalParsed": 3,
    "insertedCount": 2,
    "modifiedCount": 1,
    "errors": []
  },
  "meta": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalParsed` | number | Total rows successfully parsed from the CSV |
| `insertedCount` | number | New contacts created (email did not exist) |
| `modifiedCount` | number | Existing contacts updated (email already existed) |
| `errors` | string[] | Row-level parse errors or batch errors. Empty on full success |

**Error Responses**

| Status | Condition | Response body |
|--------|-----------|---------------|
| `400` | No file attached | `{ "message": "No file uploaded" }` |
| `400` | File is not a CSV | `{ "message": "Only CSV files are allowed" }` |
| `500` | Server error | `{ "message": "Internal Server Error" }` |

---

### 2. `GET /contacts`

Returns a cursor-paginated list of contacts with optional search and tag filtering.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Case-insensitive substring match on `name` or `email` |
| `tags` | string | - | Comma-separated tags. Returns contacts matching ANY tag: `premium,active` |
| `cursor` | string | - | ObjectId of the last item from the previous page. Omit for first page |
| `limit` | number | `20` | Number of contacts per page |
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortOrder` | string | `desc` | `asc` or `desc` |

**Example Requests**
```
GET /api/contacts
GET /api/contacts?search=alice
GET /api/contacts?tags=premium,active&limit=50
GET /api/contacts?cursor=64f1a2b3c4d5e6f7a8b9c0d1&limit=20
GET /api/contacts?search=gmail&tags=premium&cursor=64f1a2b3c4d5e6f7a8b9c0d1
```

**Success Response** - `200 OK`
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "phone": "+1-555-0101",
        "tags": ["premium", "active"],
        "metadata": { "city": "New York", "plan": "pro" },
        "createdAt": "2026-05-02T06:42:30.041Z",
        "updatedAt": "2026-05-02T06:42:30.041Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "64f1a2b3c4d5e6f7a8b9c0d1"
  },
  "message": "Fetched all contacts",
  "meta": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `contacts` | Contact[] | Array of contact objects for current page |
| `hasMore` | boolean | `true` if more pages exist beyond current one |
| `nextCursor` | string \| null | Pass this as `cursor` in the next request to get the next page. `null` when on the last page |

---

### 3. `GET /contacts/count`

Returns the total number of contacts in the database. Uses `estimatedDocumentCount()` - O(1) metadata read, not a full scan (by `countDocuments()`).

**Example Request**
```
GET /api/contacts/count
```

**Success Response** - `200 OK`
```json
{
  "success": true,
  "message": "Fetched Total Contacts Count",
  "data": {
    "count": 5555
  },
  "meta": null
}
```

---

### 4. `GET /contacts/:id`

Fetch a single contact by its MongoDB ObjectId.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the contact |

**Example Request**
```
GET /api/contacts/64f1a2b3c4d5e6f7a8b9c0d1
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Fetched Contact Details",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "phone": "+1-555-0101",
    "tags": ["premium", "active"],
    "metadata": { "city": "New York" },
    "createdAt": "2026-05-02T06:42:30.041Z",
    "updatedAt": "2026-05-02T06:42:30.041Z"
  },
  "meta": null
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | No contact found with this ID |

---

### 5. `DELETE /contacts/:id`

Permanently delete a contact by ID. Does not cascade-delete associated DeliveryLogs.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the contact |

**Example Request**
```
DELETE /api/contacts/64f1a2b3c4d5e6f7a8b9c0d1
```

**Success Response** - `200 OK`
```json
{
  "success": true,
  "message": "Contact deleted",
  "data": null, 
  "meta": null
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | No contact found with this ID |

---

## Campaigns API

### 1. `POST /campaigns`

Create a new campaign. Resolves the audience immediately - contacts matching the filter are found and a DeliveryLog is created for each one with `status: "queued"`. Campaign starts in `draft` status and must be explicitly started.

**Request Body**

```json
{
  "name": "Summer Sale Announcement",
  "messageTemplate": "Hi user, check out our summer deals!",
  "audienceFilter": {
    "tags": ["premium", "active"],
    "search": "gmail.com"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Campaign display name |
| `messageTemplate` | string | **Yes** | Message body |
| `audienceFilter` | object | No | If omitted, targets all contacts |
| `audienceFilter.tags` | string[] | No | Contact must have at least one of these tags (`$in` match) |
| `audienceFilter.search` | string | No | Case-insensitive substring match on contact name or email |

**Note:** `audienceFilter.tags` and `audienceFilter.search` are combined with `AND` logic - a contact must match both if both are provided.

**Success Response** - `201 Created`
```json
{
  "success": true, 
  "message": "Created New Campaign",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "name": "Summer Sale Announcement",
    "messageTemplate": "Hi user, check out our summer deals!",
    "status": "draft",
    "audienceFilter": {
      "tags": ["premium", "active"],
      "search": "gmail.com"
    },
    "totalContacts": 5000,
    "sentCount": 0,
    "failedCount": 0,
    "pendingCount": 5000,
    "scheduledAt": null,
    "completedAt": null,
    "createdAt": "2026-05-02T08:42:30.041Z",
    "updatedAt": "2026-05-02T08:42:30.041Z"
  },
  "meta": null
}
```

**Error Responses**

| Status | Condition | Response body |
|--------|-----------|---------------|
| `400` | `name` or `messageTemplate` missing | `{ "message": "name and messageTemplate are required" }` |
| `500` | Server error | `{ "message": "Internal Server Error" }` |

---

### 2. `GET /campaigns`

Returns a cursor-paginated list of campaigns sorted by creation date descending.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | - | ObjectId of last item from previous page |
| `limit` | number | `20` | Number of campaigns per page |
| `status` | string | - | Filter by status: `draft`, `running`, `completed`, `paused`, `failed` |

**Example Requests**
```
GET /api/campaigns
GET /api/campaigns?status=running
GET /api/campaigns?cursor=64f1a2b3c4d5e6f7a8b9c0d2&limit=10
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Fetched all Campaigns",
  "data": {
    "campaigns": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "name": "Summer Sale Announcement",
        "status": "running",
        "totalContacts": 5000,
        "sentCount": 2300,
        "failedCount": 200,
        "pendingCount": 2500,
        "createdAt": "2026-05-02T08:42:30.041Z",
        "updatedAt": "2026-05-02T08:48:30.041Z"
      }
    ],
    "hasMore": false,
    "nextCursor": null
  },
  "meta": null
}
```

---

### 3. `GET /campaigns/dashboard`

Returns aggregated statistics across all campaigns and the total contact count. Used by the dashboard page. Powered by a single MongoDB `$group` aggregation on the Campaign collection - does not scan DeliveryLogs.

**Example Request**
```
GET /api/campaigns/dashboard
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Fetched Dashboard stats",
  "data": {
    "totalContacts": 48230,
    "totalCampaigns": 12,
    "totalSent": 95400,
    "totalFailed": 8600,
    "totalPending": 16000,
    "campaignsByStatus": {
      "draft": 3,
      "running": 2,
      "completed": 6,
      "failed": 1
    }
  },
  "meta": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalContacts` | number | Total contacts in the database (estimated count) |
| `totalCampaigns` | number | Total number of campaigns across all statuses |
| `totalSent` | number | Sum of `sentCount` across all campaigns |
| `totalFailed` | number | Sum of `failedCount` across all campaigns |
| `totalPending` | number | Sum of `pendingCount` across all campaigns |
| `campaignsByStatus` | object | Campaign count broken down by status |

---

### 4. `GET /campaigns/:id`

Fetch a single campaign document by ID.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the campaign |

**Example Request**
```
GET /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Fetched Campaign",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "name": "Summer Sale Announcement",
    "messageTemplate": "Hi {{name}}, check out our summer deals!",
    "status": "completed",
    "audienceFilter": { "tags": ["premium"] },
    "totalContacts": 5000,
    "sentCount": 4510,
    "failedCount": 490,
    "pendingCount": 0,
    "completedAt": "2026-05-02T08:49:30.041Z",
    "createdAt": "2026-05-02T08:42:30.041Z",
    "updatedAt": "2026-05-02T08:49:30.041Z"
  },
  "meta": null
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | No campaign found with this ID |

---

### 5. `POST /campaigns/:id/start`

Start a campaign that is currently in `draft` status. Sets status to `running` and enqueues a background processing job. Returns immediately - processing happens asynchronously in the worker.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the campaign |

**Example Request**
```
POST /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2/start
```

**Success Response** - `200 OK`
```json
{
  "success": true,
  "message": "Campaign started",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "name": "Summer Sale Announcement",
    "status": "running",
    "totalContacts": 5000,
    "sentCount": 0,
    "failedCount": 0,
    "pendingCount": 5000,
    "createdAt": "2026-05-02T08:42:30.041Z",
    "updatedAt": "2026-05-02T08:48:30.041Z"
  },
  "meta": null,
}
```

**Error Responses**

| Status | Condition | Response body |
|--------|-----------|---------------|
| `400` | Campaign is not in `draft` status | `{ "message": "Cannot start campaign in \"running\" status" }` |
| `404` | Campaign not found | `{ "message": "Campaign not found" }` |

---

### 6. `GET /campaigns/:id/details`

Returns the campaign document alongside a real-time status breakdown from DeliveryLogs and a timeline of message activity grouped by minute. Used for the campaign detail page.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the campaign |

**Example Request**
```
GET /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2/details
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Fetched Campaign Details",
  "data": {
    "campaign": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "Summer Sale Announcement",
      "status": "running",
      "totalContacts": 5000,
      "sentCount": 2300,
      "failedCount": 200,
      "pendingCount": 2500
    },
    "counts": {
      "queued": 2500,
      "processing": 0,
      "sent": 2300,
      "failed": 200
    },
    "timeline": [
      {
        "_id": {
          "status": "sent",
          "minute": "2024-01-15T11:01"
        },
        "count": 500
      },
      {
        "_id": {
          "status": "failed",
          "minute": "2024-01-15T11:01"
        },
        "count": 50
      }
    ]
  },
  "meta": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `campaign` | Campaign | Full campaign document |
| `counts` | object | Live count of DeliveryLogs per status. Sourced from a `$group` aggregation |
| `timeline` | array | Message activity bucketed by minute and status. Useful for charting throughput over time |

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | Campaign not found |

---

### 7. `GET /campaigns/:id/logs`

Returns a cursor-paginated list of DeliveryLogs for a specific campaign. Each log includes the associated contact populated with `name`, `email`, and `phone`.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the campaign |

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | - | ObjectId of the last log from the previous page |
| `limit` | number | `50` | Number of logs per page |
| `status` | string | - | Filter by delivery status: `queued`, `processing`, `sent`, `failed` |

**Example Requests**
```
GET /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2/logs
GET /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2/logs?status=failed
GET /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2/logs?status=sent&cursor=64f1a2b3c4d5e6f7a8b9c0d3&limit=25
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Fetched Delivery Logs for this Campaign",
  "data": {
    "logs": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
        "campaignId": "64f1a2b3c4d5e6f7a8b9c0d2",
        "contactId": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
          "name": "Alice Johnson",
          "email": "alice@example.com",
          "phone": "+1-555-0101"
        },
        "status": "sent",
        "retryCount": 0,
        "lastError": null,
        "sentAt": "2024-01-15T11:06:00.000Z",
        "createdAt": "2026-05-02T08:42:30.041Z",
        "updatedAt": "2024-01-15T11:06:00.000Z"
      },
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
        "campaignId": "64f1a2b3c4d5e6f7a8b9c0d2",
        "contactId": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
          "name": "Bob Smith",
          "email": "bob@example.com",
          "phone": null
        },
        "status": "failed",
        "retryCount": 1,
        "lastError": "Simulated delivery failure",
        "sentAt": null,
        "createdAt": "2026-05-02T08:42:30.041Z",
        "updatedAt": "2024-01-15T11:06:00.000Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "64f1a2b3c4d5e6f7a8b9c0d4"
  },
  "meta": null
}
```

---

### 8. `DELETE /campaigns/:id`

Permanently delete a campaign and all its associated DeliveryLogs. Only callable on any campaign regardless of status - use with caution on running campaigns.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | ObjectId string | MongoDB `_id` of the campaign |

**Example Request**
```
DELETE /api/campaigns/64f1a2b3c4d5e6f7a8b9c0d2
```

**Success Response** - `200 OK`
```json
{
  "success": true, 
  "message": "Campaign deleted", 
  "data": null, 
  "meta": null
}
```

**Error Responses**

| Status | Condition |
|--------|-----------|
| `404` | No campaign found with this ID |

---

## HTTP Status Codes

| Code | Meaning | When returned |
|------|---------|---------------|
| `200` | OK | Successful GET, DELETE, and campaign start |
| `201` | Created | Successful POST that creates a new resource |
| `400` | Bad Request | Missing required fields, invalid status transition |
| `404` | Not Found | Resource with given ID does not exist |
| `500` | Internal Server Error | Unhandled server-side error |

---

## Pagination

All list endpoints use **cursor-based pagination** rather than offset/page-number pagination.

### How It Works

```
First page:
  GET /api/contacts?limit=20
  → returns 20 contacts + { hasMore: true, nextCursor: "64f1a2b3c4d5e6f7a8b9c0d1" }

Next page:
  GET /api/contacts?cursor=64f1a2b3c4d5e6f7a8b9c0d1&limit=20
  → returns next 20 contacts + { hasMore: false, nextCursor: null }

Last page:
  nextCursor is null - stop fetching
```

The cursor is always the `_id` (MongoDB ObjectId) of the last item returned. Pass it as the `cursor` query parameter to get the next page. When `hasMore` is `false` or `nextCursor` is `null`, you have reached the last page.
