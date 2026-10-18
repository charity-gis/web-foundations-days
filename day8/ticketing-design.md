# TicketHub: High-Concurrency Event Ticketing System Design

A comprehensive system design document for **TicketHub**, an online ticketing platform that sells reserved-seating tickets for concerts, sporting events, and theater productions under extreme flash-sale concurrency.

---

## 1. System Requirements

### Functional Requirements
1. **Event Discovery**: Users can browse, search, and view upcoming events, venue details, and schedules.
2. **Interactive Seat Map**: Users can view real-time seat availability for an event (available, held, sold).
3. **Seat Reservation (Hold)**: Users can select and temporarily reserve up to 4 specific seats for a 10-minute window while completing payment.
4. **Order Checkout & Payment**: Users can pay for held seats via a secure payment gateway; upon confirmation, seats transition to permanently sold.
5. **Ticket Retrieval**: Users can view their purchased tickets, unique QR validation codes, and receipts.
6. **Automatic Hold Expiration**: If held seats are not paid for within 10 minutes, they automatically release back into the general available pool.

### Non-Functional Requirements
1. **Correctness (Zero Double-Booking)**: Under no circumstance may two different users purchase or hold the same seat. Absolute data integrity is mandatory.
2. **Fairness**: Tickets during high-demand drops must be allocated fairly without allowing automated scalper bots or malicious actors to hoard seats. A First-In, First-Out (FIFO) virtual waiting room ensures equitable access.
3. **Speed & Latency**:
   * Seat map retrieval $< 100\text{ ms}$ under normal traffic and $< 300\text{ ms}$ during flash sales.
   * Seat reservation and checkout API responses $< 500\text{ ms}$.
4. **High Availability**: 99.99% uptime for browsing and ticket viewing, with graceful queue-based degradation during extreme flash sales.

---

## 2. Capacity Estimates: Normal Traffic vs. "Big Sale" Peak

### Baseline Metrics
* **Total Registered Users**: 2,000,000 (2 million).
* **Normal Day Visitors**: 50,000 users/day (each viewing 10 pages = 500,000 page views/day).
* **Normal Day Ticket Sales**: 5,000 tickets sold/day.
* **"Big Sale" Flash Event**: A high-demand concert where **200,000 users** compete to buy **20,000 seats** within a **10-minute window (600 seconds)**.

---

### Traffic Calculations

#### A. Normal Day Traffic
* **Page Views per Day**:
  $$50,000 \text{ visitors} \times 10 \text{ views} = 500,000 \text{ views/day}$$
* **Average Read Throughput**:
  $$\frac{500,000 \text{ requests}}{86,400 \text{ seconds}} \approx 5.79 \text{ requests/sec} \quad (\approx 6 \text{ RPS})$$
* **Peak Normal Read Throughput (3×)**:
  $$5.79 \times 3 \approx 17.37 \text{ requests/sec} \quad (\approx 18 \text{ RPS})$$
* **Ticket Purchases (Write Throughput)**:
  $$\frac{5,000 \text{ sales}}{86,400 \text{ seconds}} \approx 0.058 \text{ transactions/sec} \quad (\approx 1 \text{ sale every 17 seconds})$$

---

#### B. "Big Sale" Peak Traffic (10-Minute Spike)
* **Active Competing Users**: 200,000 users in 600 seconds.
* **Read Traffic (Seat Map Polling & Queue Ingress)**:
  * In a high-stakes sale, users rapidly refresh the seating map or poll for seat availability (averaging 15 requests per user across the 10-minute period):
  $$\text{Total Read Requests} = 200,000 \text{ users} \times 15 \text{ requests} = 3,000,000 \text{ requests in 600s}$$
  * **Peak Read Throughput**:
    $$\frac{3,000,000 \text{ requests}}{600 \text{ seconds}} = \mathbf{5,000\text{ RPS}}$$
* **Write Traffic (Seat Hold & Purchase Attempts)**:
  * 200,000 users attempt to hold seats as quickly as possible:
    $$\frac{200,000 \text{ hold attempts}}{600 \text{ seconds}} \approx \mathbf{333.33\text{ hold attempts/sec}} \quad (\text{bursting up to } 1,000+\text{ WPS in the first 60 seconds})$$

---

### Traffic Comparison Table

| Metric | Normal Day | Big Sale Peak (10 min) | Spike Factor |
| :--- | :--- | :--- | :--- |
| **Active Concurrent Users** | ~500 | 200,000 | **400×** |
| **Read Requests / Sec** | 6 RPS | 5,000 RPS | **~833×** |
| **Write Transactions / Sec** | 0.06 WPS | 333–1,000+ WPS | **~5,500× to 16,000×** |
| **Target Resource** | Distributed across events | Concentrated on single event (20k seats) | **Extreme Contention** |

**Design Implication**: Under normal traffic, standard relational database reads and writes easily suffice. However, during the "Big Sale," directing 5,000 RPS and 1,000 concurrent seat-locking writes directly to the primary database would cause connection pool starvation, lock contention, and catastrophic database collapse. The system requires an edge virtual waiting room and distributed in-memory locking.

---

## 3. API Specification

### 1. Browse & Filter Events
* **Method**: `GET`
* **Path**: `/api/v1/events`
* **Description**: Lists upcoming events with search, category, and date filtering.
* **Success Status**: `200 OK`
* **Sample Response**:
  ```json
  [
    {
      "id": 101,
      "title": "Coldplay: Music of the Spheres World Tour",
      "venue": "Wembley Stadium, London",
      "event_date": "2026-11-20T19:30:00Z",
      "starting_price": 85.00,
      "status": "on_sale"
    }
  ]
  ```

---

### 2. View Real-Time Seat Map
* **Method**: `GET`
* **Path**: `/api/v1/events/:id/seats`
* **Description**: Retrieves real-time seating inventory showing availability status (`available`, `held`, `sold`) and prices.
* **Success Status**: `200 OK`
* **Sample Response**:
  ```json
  {
    "event_id": 101,
    "total_seats": 20000,
    "available_seats": 1420,
    "seats": [
      { "id": 5001, "section": "A1", "row": "10", "number": "14", "price": 120.00, "status": "available" },
      { "id": 5002, "section": "A1", "row": "10", "number": "15", "price": 120.00, "status": "held" },
      { "id": 5003, "section": "A1", "row": "10", "number": "16", "price": 120.00, "status": "sold" }
    ]
  }
  ```

---

### 3. Hold Selected Seats
* **Method**: `POST`
* **Path**: `/api/v1/seats/hold`
* **Description**: Temporarily locks selected seats for the authenticated user for exactly 10 minutes.
* **Request Body**:
  ```json
  {
    "event_id": 101,
    "seat_ids": [5001, 5002]
  }
  ```
* **Success Status**: `201 Created`
* **Sample Response**:
  ```json
  {
    "hold_token": "hld_983f4b2e-a17c-48c9",
    "event_id": 101,
    "seat_ids": [5001, 5002],
    "expires_at": "2026-10-18T22:25:00Z",
    "total_amount": 240.00,
    "time_remaining_seconds": 600
  }
  ```
* **Failure Responses**:
  * `409 Conflict`: One or more requested seats are already held or sold.
  * `429 Too Many Requests`: User exceeded reservation rate limits.

---

### 4. Order Checkout & Payment
* **Method**: `POST`
* **Path**: `/api/v1/orders/checkout`
* **Description**: Processes payment for held seats, writes order, and permanently marks seats as sold.
* **Request Body**:
  ```json
  {
    "hold_token": "hld_983f4b2e-a17c-48c9",
    "payment_method_token": "pm_card_visa_4242",
    "billing_email": "user@example.com"
  }
  ```
* **Success Status**: `201 Created`
* **Sample Response**:
  ```json
  {
    "order_id": "ord_882914",
    "event_id": 101,
    "seat_ids": [5001, 5002],
    "total_paid": 240.00,
    "status": "confirmed",
    "purchased_at": "2026-10-18T22:18:30Z"
  }
  ```

---

### 5. View Purchased Tickets
* **Method**: `GET`
* **Path**: `/api/v1/users/me/tickets`
* **Description**: Returns all confirmed tickets, venue access details, and digital entry passes for the logged-in user.
* **Success Status**: `200 OK`
* **Sample Response**:
  ```json
  [
    {
      "ticket_id": "tkt_11928",
      "order_id": "ord_882914",
      "event_title": "Coldplay: Music of the Spheres World Tour",
      "venue": "Wembley Stadium, London",
      "event_date": "2026-11-20T19:30:00Z",
      "section": "A1",
      "row": "10",
      "seat_number": "14",
      "qr_code_url": "https://cdn.tickethub.com/qr/tkt_11928.png"
    }
  ]
  ```

---

## 4. Data Model

### Relational Schema

```
+--------------------+        1:N        +--------------------+
|       users        |------------------>|       orders       |
+--------------------+                   +---------+----------+
          |                                        |
          | 1:N (Holds)                            | 1:N
          v                                        v
+--------------------+        1:N        +--------------------+
|       events       |------------------>|       seats        |
+--------------------+                   +--------------------+
```

### Table Definitions

#### 1. `users`
* `id`: `BIGINT PRIMARY KEY AUTO_INCREMENT`
* `email`: `VARCHAR(255) NOT NULL UNIQUE`
* `name`: `VARCHAR(100) NOT NULL`
* `created_at`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

#### 2. `events`
* `id`: `BIGINT PRIMARY KEY AUTO_INCREMENT`
* `title`: `VARCHAR(200) NOT NULL`
* `venue`: `VARCHAR(200) NOT NULL`
* `event_date`: `TIMESTAMP NOT NULL`
* `total_seats`: `INT NOT NULL`
* `status`: `ENUM('draft', 'scheduled', 'on_sale', 'sold_out', 'completed') NOT NULL`

#### 3. `seats`
* `id`: `BIGINT PRIMARY KEY AUTO_INCREMENT`
* `event_id`: `BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE`
* `section`: `VARCHAR(20) NOT NULL`
* `row_number`: `VARCHAR(10) NOT NULL`
* `seat_number`: `VARCHAR(10) NOT NULL`
* `price`: `DECIMAL(10,2) NOT NULL`
* `status`: `ENUM('available', 'held', 'sold') NOT NULL DEFAULT 'available'`
* `held_by_user_id`: `BIGINT NULL REFERENCES users(id)`
* `held_until`: `TIMESTAMP NULL`
* `order_id`: `BIGINT NULL REFERENCES orders(id)`
* `version`: `INT NOT NULL DEFAULT 0` *(for Optimistic Locking)*
* **Constraints**:
  * `UNIQUE (event_id, section, row_number, seat_number)` (guarantees physical seat uniqueness per event).

#### 4. `orders`
* `id`: `BIGINT PRIMARY KEY AUTO_INCREMENT`
* `order_code`: `VARCHAR(64) NOT NULL UNIQUE`
* `user_id`: `BIGINT NOT NULL REFERENCES users(id)`
* `event_id`: `BIGINT NOT NULL REFERENCES events(id)`
* `total_amount`: `DECIMAL(10,2) NOT NULL`
* `payment_status`: `ENUM('pending', 'succeeded', 'failed', 'refunded') NOT NULL`
* `payment_intent_id`: `VARCHAR(128) NOT NULL UNIQUE`
* `created_at`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

---

## 5. Preventing Double-Booking: Transactions & Constraints

The single most critical failure mode in a ticketing platform is **overselling or double-booking the same seat**. TicketHub enforces a multi-layered prevention architecture:

```
[User Request] 
      │
      ▼
┌──────────────────────────────────────────────┐
│ Layer 1: Redis Distributed Lock (Pre-Filter) │  --> Rejects duplicate attempts in memory (<2ms)
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Layer 2: ACID Relational DB Transaction      │  --> Atomic State Transition & Row Lock
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Layer 3: Database Unique Constraints         │  --> Physical safeguard on final orders
└──────────────────────────────────────────────┘
```

### Layer 1: In-Memory Distributed Lock (Redis Atomic Script)
Before hitting the database, the application server requests an atomic lock in Redis using an atomic Lua script:
```lua
-- Lua script executed atomically in Redis
if redis.call('get', KEYS[1]) == false then
    redis.call('set', KEYS[1], ARGV[1], 'EX', 600) -- 600s TTL (10 minutes)
    return 1
else
    return 0
end
```
If two users click "Seat A1-10" at the exact same millisecond, Redis grants the key `lock:event:101:seat:5001` to only one user. The second user immediately receives an HTTP `409 Conflict` in under 2 ms without incurring database I/O.

### Layer 2: Atomic Database Transaction with Conditional Update
When reserving seats in PostgreSQL/MySQL, the system executes an atomic conditional update inside a transactional boundary:
```sql
BEGIN;

-- Atomically reserve seats that are either 'available' OR have an expired hold
UPDATE seats
SET status = 'held',
    held_by_user_id = :user_id,
    held_until = NOW() + INTERVAL '10 minutes',
    version = version + 1
WHERE id IN (:seat_ids)
  AND (
      status = 'available' 
      OR (status = 'held' AND held_until < NOW())
  );

-- Verify that all requested seats were successfully locked
-- If rows updated < count(seat_ids), at least one seat was stolen
IF (ROW_COUNT() != :expected_seat_count) THEN
    ROLLBACK;
    RAISE EXCEPTION 'One or more seats are no longer available.';
END IF;

COMMIT;
```

### Layer 3: Final Checkout Transaction & Unique Constraints
During final payment confirmation, the transaction verifies the active hold and sets the seat permanently to `'sold'`:
```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 1. Verify seat is held by this specific user and hold has not expired
SELECT id FROM seats 
WHERE id IN (:seat_ids) 
  AND status = 'held' 
  AND held_by_user_id = :user_id 
  AND held_until >= NOW()
FOR UPDATE;

-- 2. Insert confirmed Order
INSERT INTO orders (order_code, user_id, event_id, total_amount, payment_status, payment_intent_id)
VALUES (:order_code, :user_id, :event_id, :total, 'succeeded', :stripe_payment_id);

-- 3. Transition seat to permanently sold
UPDATE seats 
SET status = 'sold', 
    order_id = :order_id, 
    held_by_user_id = NULL, 
    held_until = NULL
WHERE id IN (:seat_ids);

COMMIT;
```
Because the `seats` table has strict foreign keys and unique constraints (`UNIQUE(event_id, section, row_number, seat_number)`), and because `status = 'sold'` is immutable, a seat can never be purchased twice.

---

## 6. System Architecture & Surviving the Big Sale

### Architecture Diagram

```
                                  +---------------------------+
                                  |   200,000 Client Apps     |
                                  +-------------+-------------+
                                                |
                                                v
                                  +---------------------------+
                                  |   Edge CDN & DDoS Shield  |
                                  |   (Cloudflare Enterprise) |
                                  +-------------+-------------+
                                                |
                                                v
                                  +---------------------------+
                                  |   Virtual Waiting Room    |
                                  |   (Fair Token Bucket FIFO)|
                                  +-------------+-------------+
                                                |  Admit ~1,000 users/min
                                                v
                                  +---------------------------+
                                  |    API Load Balancer      |
                                  |       (AWS ALB)           |
                                  +-------------+-------------+
                                                |
                        +-----------------------+-----------------------+
                        |                                               |
                        v                                               v
             +--------------------+                          +--------------------+
             |  App Server Pool   |                          |  App Server Pool   |
             |   (Instance 1-N)   |                          |   (Auto-Scaled)    |
             +----------+---------+                          +----------+---------+
                        |                                               |
         +--------------+---------------+---------------+---------------+
         |                              |                               |
         v                              v                               v
+------------------+          +-------------------+           +-------------------+
|  Redis Cluster   |          |   Message Queue   |           | Primary Database  |
|  - Seat Bitmaps  |          | (RabbitMQ/Kafka)  |           | (PostgreSQL ACID) |
|  - Distributed   |          +---------+---------+           +---------+---------+
|    Locks (Holds) |                    |                               |
+------------------+                    v                          Replication
                               +------------------+                     |
                               | Payment & Order  |                     v
                               | Background Worker|           +-------------------+
                               +--------+---------+           |   Read Replica    |
                                        |                     |     Cluster       |
                                        v                     +-------------------+
                               +------------------+
                               | Payment Gateway  |
                               | (Stripe / Adyen) |
                               +------------------+
```

### Component Explanations (How Each Component Survives the Surge)

1. **Edge CDN & DDoS Shield**: Absorbs static asset requests (seat map SVGs, logos, JavaScript) at edge PoPs, blocking automated scraping bots and preventing malicious volumetric traffic from reaching the origin infrastructure.
2. **Virtual Waiting Room**: The primary defense against flash-sale collapse; it holds all 200,000 users in a cryptographically signed FIFO queue at the edge and admits users into the ticketing application at a strictly controlled rate (e.g., 1,000 users per minute) matching the database write capacity.
3. **API Load Balancer**: Terminate TLS sessions, runs health checks across application nodes, and evenly distributes authenticated API traffic across auto-scaled application instances.
4. **App Server Pool**: Horizontally scaled stateless backend instances running in multiple availability zones that handle request authorization, hold validation, and checkout coordination.
5. **Redis Cluster (In-Memory Inventory & Locks)**: Stores real-time seat availability bitmaps and distributed reservation locks in RAM, absorbing the 5,000 RPS read spike and evaluating seat holds in sub-milliseconds without touching disk storage.
6. **Primary Database (PostgreSQL Master)**: Executes ACID transactional state changes for confirmed holds and orders, protected from overload because only rate-admitted users with confirmed locks are permitted to issue write queries.
7. **Read Replica Cluster**: Serves non-transactional read traffic (user profile data, event details, historical order histories), completely isolating reporting and browsing from the critical booking path.
8. **Message Queue (RabbitMQ / Kafka)**: Buffers post-booking asynchronous operations—including ticket PDF generation, receipt emails, and venue access barcode synchronization—so users receive immediate checkout confirmation.
9. **Payment & Order Worker**: Communicates with external payment providers (Stripe/Adyen) with automated idempotent retries, ensuring that temporary network blips with credit card processors do not cause failed orders.

---

## 7. Architectural Trade-Offs

### Trade-Off 1: Virtual Waiting Room (Queue) vs. Open Flash-Sale Admission
* **Design Choice**: Gate all users through a fair virtual waiting room that throttles admission to 1,000 users/minute rather than allowing open simultaneous access.
* **Advantage**: Guaranteed system stability, zero database connection pool exhaustion, zero crashed servers, and a completely fair FIFO purchase experience for genuine fans.
* **Trade-Off**: Users cannot instantaneously load the seat selector at 10:00 AM; they must wait in a virtual queue showing an estimated wait time. However, this trade-off is widely accepted in ticketing (e.g., Ticketmaster Smart Queue) because a momentary queue is infinitely better than a completely crashed website.

---

### Trade-Off 2: Distributed In-Memory Holds (Redis) vs. Pure Database Pessimistic Locking
* **Design Choice**: Track 10-minute temporary seat holds in Redis memory with distributed lock TTLs, committing to PostgreSQL only upon hold verification.
* **Advantage**: Absorbs 5,000+ RPS and hundreds of concurrent hold attempts per second without maintaining long-running open database transactions (`SELECT FOR UPDATE`), which would exhaust PostgreSQL connection limits.
* **Trade-Off**: Introducing Redis as an intermediate state store introduces dual-write complexity; if Redis crashes, hold states must be reconstructed from the primary database. We mitigate this using a clustered Redis deployment with multi-AZ persistence (AOF + replication).

---

### Trade-Off 3: Strict 10-Minute Reservation Expiry vs. User Convenience
* **Design Choice**: Hard limit on seat holds of exactly 600 seconds, strictly enforced by Redis TTL and background reaper queries.
* **Advantage**: Prevents shoppers from abandoning seats in their carts indefinitely, returning unsold inventory rapidly to genuine buyers during the 20,000-seat rush.
* **Trade-Off**: If a legitimate customer is delayed entering their credit card number past second 600, their held seats are forfeited and returned to the pool, requiring clear countdown timers on the front-end checkout screen.
