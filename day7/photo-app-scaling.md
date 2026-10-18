# SnapShare: System Scaling & Architecture Plan

A comprehensive architectural and capacity scaling plan for **SnapShare**, a consumer photo-sharing platform where users upload photos and scroll through feeds of photos posted by accounts they follow.

---

## 1. Assumptions & Daily Active Users (DAU)

### Core Starting Facts
* **Total Registered Users**: 10,000,000 (10 million).
* **Daily Active Ratio**: 10% of registered users are active daily.
* **Upload Frequency**: Each active user uploads 1 photo per day.
* **Feed Consumption**: Each active user views 50 feed pages per day.
* **Original Photo Size**: Average of 2 MB per image.
* **Thumbnail Size**: Average of 50 KB (0.05 MB) per thumbnail generated for each photo.
* **Peak Traffic Factor**: 5× the average traffic volume during peak hours.
* **Seconds per Day**: $24 \text{ hours} \times 60 \text{ minutes} \times 60 \text{ seconds} = 86,400 \text{ seconds}$.

### Daily Active Users (DAU)
$$\text{DAU} = 10,000,000 \times 0.10 = 1,000,000 \text{ active users per day}$$

---

## 2. Traffic & Storage Estimates

### A. Uploads per Second (Write Traffic)
* **Daily Uploads**:
  $$1,000,000 \text{ users} \times 1 \text{ upload/day} = 1,000,000 \text{ photos/day}$$
* **Average Uploads per Second**:
  $$\frac{1,000,000 \text{ uploads}}{86,400 \text{ seconds}} \approx 11.57 \text{ uploads/second} \quad (\approx 12 \text{ uploads/sec})$$
* **Peak Uploads per Second (5× multiplier)**:
  $$11.57 \times 5 \approx 57.87 \text{ uploads/second} \quad (\approx 58 \text{ uploads/sec})$$

---

### B. Feed Views per Second (Read Traffic)
* **Daily Feed Views**:
  $$1,000,000 \text{ users} \times 50 \text{ views/day} = 50,000,000 \text{ feed views/day}$$
* **Average Feed Views per Second**:
  $$\frac{50,000,000 \text{ views}}{86,400 \text{ seconds}} \approx 578.70 \text{ views/second} \quad (\approx 579 \text{ views/sec})$$
* **Peak Feed Views per Second (5× multiplier)**:
  $$578.70 \times 5 \approx 2,893.52 \text{ views/second} \quad (\approx 2,894 \text{ views/sec})$$

---

### C. Photo Storage Requirements per Year
* **Storage per Photo Upload**:
  $$\text{Original Photo} + \text{Thumbnail} = 2 \text{ MB} + 0.05 \text{ MB} = 2.05 \text{ MB}$$
* **Daily Storage Added**:
  * Original photos: $1,000,000 \times 2 \text{ MB} = 2,000,000 \text{ MB} = 2,000 \text{ GB} = 2 \text{ TB/day}$
  * Thumbnails: $1,000,000 \times 0.05 \text{ MB} = 50,000 \text{ MB} = 50 \text{ GB} = 0.05 \text{ TB/day}$
  * Total daily storage: $2 \text{ TB} + 0.05 \text{ TB} = 2.05 \text{ TB/day}$
* **Annual Storage Added (365 days)**:
  * Original photos: $2 \text{ TB/day} \times 365 \text{ days} = 730 \text{ TB/year}$
  * Thumbnails: $0.05 \text{ TB/day} \times 365 \text{ days} = 18.25 \text{ TB/year}$
  * **Total Photo Storage per Year**:
    $$730 \text{ TB} + 18.25 \text{ TB} = 748.25 \text{ TB/year} \quad (\approx 0.75 \text{ PB/year})$$

---

## 3. Read-Heavy vs. Write-Heavy System Decision

* **System Nature**: **SnapShare is overwhelmingly read-heavy.**
* **Read-to-Write Ratio**:
  $$\text{Feed Views} : \text{Photo Uploads} = 50,000,000 : 1,000,000 = 50 : 1$$
  For every 1 photo uploaded, users request 50 feed views.
* **Design Implications**:
  1. **Aggressive Multi-Tier Caching**: User feeds, profiles, and relationship graphs must be cached in in-memory datastores (e.g., Redis) so that the majority of feed reads never reach the primary database.
  2. **Global Edge CDN**: Static media assets (original photos and thumbnails) must be cached at edge Points of Presence (PoPs) worldwide, ensuring feed scrolling feels instantaneous while offloading origin servers.
  3. **Read Replicas**: The database tier must separate reads from writes, routing feed metadata queries to horizontally scalable read replicas while reserving the primary master database for writes.
  4. **Asynchronous Write Pipeline**: Heavy write tasks (such as image resizing, compression, and feed fan-out) can be decoupled into asynchronous background queues without stalling user upload response times.

---

## 4. Photo Storage Strategy: Why Not in the Database?

Photos should **never** be stored as raw binary blobs directly inside a relational database (SQL) for several critical reasons:
1. **Severe Database Bloat & Memory Exhaustion**: Storing 2 MB images directly in database tables rapidly bloats table files. Database page buffers (e.g., InnoDB buffer pool) become choked by bulky binary streams instead of caching indexes and hot relational records, causing query performance across the entire system to collapse.
2. **Replication & Backup Bottlenecks**: Replicating 2.05 TB of binary data per day across database read replicas creates unbearable replication lag, massive transaction log overhead, and makes point-in-time database backups and restores virtually impossible.
3. **Prohibitive Cost & Inflexibility**: Relational database storage (high-speed NVMe block storage) is significantly more expensive per gigabyte than dedicated object storage.

### Where They Should Go Instead
All photos and thumbnails are saved to **distributed Object Storage** (such as AWS S3, Google Cloud Storage, or MinIO). The relational database only stores lightweight structured metadata:
* `photo_id`, `user_id`, `caption`, `created_at`
* `photo_url` (e.g., `https://cdn.snapshare.com/photos/2026/10/p_8492.jpg`)
* `thumbnail_url` (e.g., `https://cdn.snapshare.com/thumbs/2026/10/t_8492.jpg`)

---

## 5. System Architecture Diagram

```
                              +--------------------+
                              |    Client App      |
                              |  (Mobile / Web)    |
                              +---------+----------+
                                        |
               +------------------------+------------------------+
               |                                                 |
       Read Media Assets                                 API Requests (Feeds & Uploads)
               |                                                 |
               v                                                 v
    +--------------------+                             +--------------------+
    |        CDN         |                             |   Load Balancer    |
    |  (Cloudflare /     |                             |  (ALB / NGINX)     |
    |    CloudFront)     |                             +---------+----------+
    +---------+----------+                                       |
              |                                        +---------+---------+
         Origin Fetch                                  |                   |
         (Cache Miss)                                  v                   v
              |                             +---------------+     +---------------+
              |                             |  App Server 1 |     |  App Server 2 |
              |                             +-------+-------+     +-------+-------+
              |                                     |                     |
              |            +------------------------+---------------------+
              |            |                        |                     |
              |            v                        v                     v
              |    +---------------+        +---------------+     +---------------+
              |    |  In-Memory    |        |    Message    |     |    Primary    |
              |    | Cache (Redis) |        | Queue (Rabbit |     |  Database     |
              |    +---------------+        |  MQ / SQS)    |     | (PostgreSQL)  |
              |                             +-------+-------+     +-------+-------+
              |                                     |                     |
              |                                     v                 Replication
              |                             +---------------+             |
              |                             | Thumbnail     |             v
              |                             | Worker Pool   |     +---------------+
              |                             +-------+-------+     | Read Replica  |
              |                                     |             | Database      |
              v                                     v             +---------------+
    +---------------------------------------------------------------+
    |                        Object Storage                         |
    |                (Amazon S3 / Google Cloud Storage)             |
    |              - Original Photos (2 MB)                         |
    |              - Generated Thumbnails (50 KB)                   |
    +---------------------------------------------------------------+
```

---

## 6. Component Breakdown (One Sentence per Component)

* **CDN (Content Delivery Network)**: Caches static photo and thumbnail files at edge servers globally to deliver fast download times to users while minimizing origin bandwidth.
* **Load Balancer**: Distributes incoming HTTP traffic evenly across multiple application servers to prevent any individual server from becoming overwhelmed and to ensure high service availability.
* **Application Servers**: Execute core application logic, authenticate incoming requests, coordinate feed generation, and manage upload lifecycles.
* **Cache (In-Memory Datastore, e.g., Redis)**: Stores precomputed user feeds, active session tokens, and hot user profiles in memory to serve read requests with sub-millisecond response latency.
* **Primary Database (Master DB)**: Acts as the single source of truth for all transactional writes, storing structured relationships, user accounts, and photo metadata with full ACID guarantees.
* **Read Replica Database**: Continuously synchronizes with the primary database to serve read-only queries (such as user feed lookups and search requests), keeping the primary database free of read contention.
* **Object Storage (e.g., Amazon S3)**: Provides virtually infinite, highly durable, and cost-effective storage designed specifically for storing large binary photo files and thumbnails.
* **Message Queue (e.g., RabbitMQ / AWS SQS)**: Buffers asynchronous jobs (such as image resizing) to decouple time-consuming processing tasks from the synchronous HTTP request-response cycle.
* **Worker (Thumbnail Worker Pool)**: Pulls thumbnail generation jobs from the message queue, fetches original photos, resizes them into 50 KB thumbnails, uploads the results to object storage, and updates the database.

---

## 7. Step-by-Step Flow of Uploading a Photo

1. **Client Request**: The mobile or web client sends an HTTP `POST /api/v1/photos` request containing the photo binary (2 MB) and metadata (caption, tags, location) over TLS to the Load Balancer.
2. **Traffic Distribution**: The Load Balancer directs the upload payload to an available Application Server based on a round-robin or least-connections algorithm.
3. **Validation & Object Storage Upload**: The Application Server authenticates the user token, validates the image format (e.g., JPEG, PNG), generates a unique UUID filename, and uploads the 2 MB raw image directly to **Object Storage**.
4. **Primary Metadata Record**: The Application Server writes a new record to the **Primary Database** containing the photo ID, author ID, caption, timestamp, and the object storage URI of the original photo (with `thumbnail_url` initially marked as pending or null).
5. **Enqueue Background Job**: The Application Server pushes an asynchronous message (containing `photo_id` and the original photo's object storage path) into the **Message Queue**.
6. **Immediate User Response**: The Application Server returns an immediate `201 Created` HTTP response to the client with the initial photo details so the user is never kept waiting.
7. **Worker Processing**: An available **Thumbnail Worker** consumes the task from the Message Queue, downloads the original 2 MB photo from Object Storage into local memory, and resizes it into an optimized 50 KB thumbnail.
8. **Thumbnail Storage & Finalization**: The Worker uploads the 50 KB thumbnail to **Object Storage**, updates the corresponding photo row in the **Primary Database** with the final `thumbnail_url`, and invalidates or updates relevant feed caches in Redis.

---

## 8. Architectural Trade-Offs

### Trade-Off 1: Asynchronous Thumbnail Creation vs. Immediate Consistency
* **Choice**: Defer thumbnail resizing to background queue workers rather than processing it synchronously during the initial HTTP upload request.
* **Advantage**: Ultra-fast perceived upload speeds for users (responses return in under 300 ms instead of multiple seconds), and HTTP server worker threads are never tied up performing CPU-intensive image resizing.
* **Trade-Off**: Weakened immediate consistency. For a few seconds immediately following an upload, the user's feed or profile may display a temporary placeholder or blurry preview until the background worker finishes generating and uploading the thumbnail.

---

### Trade-Off 2: Read Replicas vs. Replication Lag (Eventual Consistency)
* **Choice**: Direct all feed queries and profile lookups to database read replicas while routing writes exclusively to the primary master database.
* **Advantage**: Scales read capacity horizontally to satisfy the heavy 50:1 read ratio (up to ~2,894 peak queries/sec) without risking database CPU throttling or locking on the primary master.
* **Trade-Off**: Asynchronous replication introduces a small replication lag (typically 50–500 ms). If a user uploads a photo and instantly refreshes their feed, the read replica might not have received the latest write yet, occasionally causing a newly published photo to appear absent for a fraction of a second.

---

### Trade-Off 3: Fan-Out-on-Write (Push) vs. Fan-Out-on-Read (Pull) for Feeds
* **Choice**: A hybrid approach using **Fan-Out-on-Write** for regular users (precomputing timeline feeds into Redis when a user posts) combined with **Fan-Out-on-Read** for high-follower celebrities.
* **Advantage**: Feed loading for 99% of users is instant $O(1)$ from cache, easily supporting 50 million daily feed page loads.
* **Trade-Off**: Increased write complexity and storage requirements in Redis; when an account with 100,000 followers uploads a photo, writing to 100,000 cached feed lists generates a brief burst of write load on the queue and cache infrastructure.
