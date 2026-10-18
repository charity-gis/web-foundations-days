# School Database Design

This document details the architectural design, table structures, entity relationships, indexing strategy, and technology selection for the school database system implemented in [`school.sql`](file:///c:/Users/ADMN/Desktop/Web%20Development%20fundamentals/day6/school.sql).

---

## 1. Table Explanations

### `students`
* **Purpose**: Represents individual learners registered at the institution.
* **Columns**:
  * `id`: An integer primary key (`PRIMARY KEY AUTOINCREMENT`) uniquely identifying each student.
  * `name`: The student's full name (`TEXT NOT NULL`).
  * `email`: The student's unique academic email address (`TEXT NOT NULL UNIQUE`), ensuring no duplicate accounts exist.

### `courses`
* **Purpose**: Represents the academic curriculum and subjects offered by the school.
* **Columns**:
  * `id`: An integer primary key (`PRIMARY KEY AUTOINCREMENT`) uniquely identifying each course record.
  * `code`: A unique course identifier (e.g., `'CS101'`, `'DB103'`) (`TEXT NOT NULL UNIQUE`).
  * `title`: The descriptive name of the course (`TEXT NOT NULL`).

### `enrolments`
* **Purpose**: Serves as the junction (join) table that connects students with the courses they are taking, while tracking academic progress.
* **Columns**:
  * `id`: An integer primary key (`PRIMARY KEY AUTOINCREMENT`) uniquely identifying each enrolment record.
  * `student_id`: Foreign key referencing `students(id)` (`NOT NULL`).
  * `course_id`: Foreign key referencing `courses(id)` (`NOT NULL`).
  * `grade`: The grade awarded to the student for the course (e.g., `'A'`, `'B+'`).
* **Constraints**:
  * `UNIQUE(student_id, course_id)`: A composite uniqueness constraint that strictly prevents a student from enrolling in the exact same course more than once.
  * `ON DELETE CASCADE`: Automatically cleans up enrolment records if an associated student or course is removed.

---

## 2. Database Relationships

### One-to-Many (1:N) Relationships
1. **`students` to `enrolments`**: One student can have multiple enrolment entries across different courses, but each individual enrolment belongs to exactly one student.
2. **`courses` to `enrolments`**: One course can have multiple enrolment entries representing many students attending it, but each individual enrolment references exactly one course.

### Many-to-Many (M:N) Relationship
* **`students` and `courses`**: A student can register for multiple courses, and conversely, a course can enroll multiple students. This forms a true many-to-many relationship between the two primary entities.

### Why a Join Table is Needed
In relational database design and First Normal Form (1NF), tables cannot store repeating groups or multivalued arrays (such as storing a comma-separated list of course IDs inside a student row, or multiple student IDs inside a course row). Doing so leads to severe data anomalies, inefficient querying, and loss of referential integrity. 

A join (junction) table like `enrolments` decomposes the complex many-to-many relationship into two clean, manageable one-to-many relationships (`students` 1:N `enrolments` and `courses` 1:N `enrolments`). Crucially, the join table also provides a structured location to store **relationship attributes**—data that belongs specifically to the pairing of a student and a course, such as the `grade` earned or the date of enrolment.

---

## 3. Recommended Index and Rationale

* **Recommended Index**: 
  ```sql
  CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
  ```
* **Rationale**: 
  In relational database engines like SQLite, primary keys are indexed automatically, but foreign key columns are not. The school system frequently executes queries filtering or joining by student (for example, generating student transcripts, computing individual GPAs, or looking up a student's enrolled courses). Without an index on `enrolments(student_id)`, the query planner must perform an expensive full table scan across all enrolment records. Adding this B-tree index reduces search time complexity from $O(N)$ to $O(\log N)$, drastically improving `JOIN` performance as the database scales to thousands or millions of records. *(A similar index on `enrolments(course_id)` is also beneficial for class rosters).*

---

## 4. Architectural Choice: SQL vs. NoSQL

For this school management system, **SQL (a relational database)** is clearly the superior architectural choice over NoSQL. Academic records require strict **ACID** (Atomicity, Consistency, Isolation, Durability) guarantees to ensure that grades, registrations, and course completions remain immutable and accurate without risk of corruption or partial writes. The school domain consists of clean, structured entities with well-defined relational integrity rules—such as enforcing that only valid students can be assigned to valid courses and prohibiting duplicate enrolments via unique composite constraints. In a NoSQL document database (such as MongoDB), representing this data would require either embedding courses inside student documents (or vice versa), which causes redundant duplicate data and update anomalies if a course title changes, or manual application-level joins that lack native database-level referential integrity. Therefore, SQL provides the exact consistency, declarative constraint enforcement, and powerful multi-table `JOIN` capabilities this system demands.
