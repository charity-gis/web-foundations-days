-- ========================================================
-- Day 6 Assignment: A School Database
-- Database Dialect: SQLite (compatible with sqliteonline.com)
-- ========================================================

-- Enable Foreign Key Support in SQLite
PRAGMA foreign_keys = ON;

-- Clean up any existing tables
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ========================================================
-- 1. Table Definitions (CREATE TABLE Statements)
-- ========================================================

-- Students Table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Courses Table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL
);

-- Enrolments Table (Junction Table linking Students and Courses)
CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    -- Prevent duplicate enrolments for the same student on the same course
    UNIQUE (student_id, course_id)
);

-- ========================================================
-- 2. Sample Data Insertion (INSERT Statements)
-- ========================================================

-- Insert Students (4 students; Diana Prince will have no enrolments)
INSERT INTO students (name, email) VALUES
    ('Alice Smith', 'alice.smith@school.edu'),
    ('Bob Jones', 'bob.jones@school.edu'),
    ('Charlie Brown', 'charlie.brown@school.edu'),
    ('Diana Prince', 'diana.prince@school.edu');

-- Insert Courses (3 courses)
INSERT INTO courses (code, title) VALUES
    ('CS101', 'Introduction to Computer Science'),
    ('WEB102', 'Web Development Fundamentals'),
    ('DB103', 'Database Management Systems');

-- Insert Enrolments (6 enrolments across the courses)
INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 'A'),   -- Alice in CS101
    (1, 2, 'B+'),  -- Alice in WEB102
    (2, 1, 'B'),   -- Bob in CS101
    (2, 3, 'A-'),  -- Bob in DB103
    (3, 2, 'B'),   -- Charlie in WEB102
    (3, 3, 'C+');  -- Charlie in DB103

-- ========================================================
-- 3. Required Queries
-- ========================================================

-- Query 1: All courses for one student (by name)
SELECT 
    students.name AS student_name,
    courses.code AS course_code,
    courses.title AS course_title,
    enrolments.grade
FROM students
JOIN enrolments ON students.id = enrolments.student_id
JOIN courses ON enrolments.course_id = courses.id
WHERE students.name = 'Alice Smith';

-- Query 2: All students on one course (by course code/title)
SELECT 
    courses.code AS course_code,
    courses.title AS course_title,
    students.name AS student_name,
    students.email AS student_email,
    enrolments.grade
FROM courses
JOIN enrolments ON courses.id = enrolments.course_id
JOIN students ON enrolments.student_id = students.id
WHERE courses.code = 'CS101';

-- Query 3: The number of students per course (including courses with 0 students)
SELECT 
    courses.code AS course_code,
    courses.title AS course_title,
    COUNT(enrolments.student_id) AS student_count
FROM courses
LEFT JOIN enrolments ON courses.id = enrolments.course_id
GROUP BY courses.id, courses.code, courses.title;

-- Query 4: Students who have no enrolments
SELECT 
    students.id AS student_id,
    students.name AS student_name,
    students.email AS student_email
FROM students
LEFT JOIN enrolments ON students.id = enrolments.student_id
WHERE enrolments.id IS NULL;

-- Query 5: An update of one enrolment's grade
UPDATE enrolments
SET grade = 'A'
WHERE student_id = (SELECT id FROM students WHERE name = 'Alice Smith')
  AND course_id = (SELECT id FROM courses WHERE code = 'WEB102');

-- Verification for Query 5: Display updated enrolment record
SELECT 
    students.name AS student_name,
    courses.code AS course_code,
    courses.title AS course_title,
    enrolments.grade AS updated_grade
FROM enrolments
JOIN students ON enrolments.student_id = students.id
JOIN courses ON enrolments.course_id = courses.id
WHERE students.name = 'Alice Smith' 
  AND courses.code = 'WEB102';
