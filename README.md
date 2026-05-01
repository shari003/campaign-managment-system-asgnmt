# Campaign Management System
Campaign Management platform built with the MERN stack. The system enables bulk contact ingestion, targeted messaging campaign creation, asynchronous batch message processing, and real-time delivery tracking through a dashboard.

## Tech Stack

### Frontend

* React (v19.2)
* Packages:

  * axios
  * @tanstack/react-query
  * tailwindcss
  * lucide-react
  * react-router-dom

---

### Backend

* Node.js + Express
* Packages:

  * express
  * mongoose
  * multer
  * ioredis
  * csv-parser

---

### Worker

* Node.js (BullMQ-based processing)
* Packages:

  * bullmq
  * ioredis
  * mongoose

---

## Expected CSV File Format

| Column           | Required | Notes                                 |
| ---------------- | -------- | ------------------------------------- |
| `email`          | **Yes**  | Unique deduplication key              |
| `name`           | Yes      | Contact display name                  |
| `phone`          | No       | Sparse indexed                        |
| `tags`           | No       | Semicolon-separated: `premium;active` |
| Any other column | No       | Stored as `metadata`                  |

---

## Running the Project

```bash
# 1. Start Redis
docker run -itd --name redis-dev -p 6379:6379 redis:7-alpine

# refer .env.example and mimic it to .env for respective services
# 2. Backend (new terminal)
cd backend
npm install
npm run dev # → http://localhost:5000

# 3. Worker (new terminal)
cd worker
npm install
npm run dev

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev # → http://localhost:5173
```

---

## Notes

* Ensure Redis is running before starting backend/worker.
* Backend and worker must share the same Redis and MongoDB configuration.
* CSV uploads must follow the specified format for proper ingestion.