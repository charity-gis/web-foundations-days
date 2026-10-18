# Library REST API Design

A RESTful API specification for managing a library's `books` collection.

---

## Base URL
* `https://api.library.example.com/api/v1`

---

## Endpoints

### 1. List All Books
* **Method**: `GET`
* **Path**: `/api/v1/books`
* **Description**: Retrieves a paginated list of all books in the library catalog.
* **Request Body**: None
* **Success Status Code**: `200 OK`
* **Example Success Response**:
  ```json
  [
    {
      "id": 1,
      "title": "To Kill a Mockingbird",
      "author": "Harper Lee",
      "isbn": "978-0061120084",
      "publishedYear": 1960,
      "genre": "Fiction",
      "copiesAvailable": 3
    },
    {
      "id": 2,
      "title": "1984",
      "author": "George Orwell",
      "isbn": "978-0451524935",
      "publishedYear": 1949,
      "genre": "Dystopian",
      "copiesAvailable": 5
    }
  ]
  ```

---

### 2. Get One Book
* **Method**: `GET`
* **Path**: `/api/v1/books/:id`
* **Description**: Retrieves the complete details of a specific book by its unique identifier.
* **Request Body**: None
* **Success Status Code**: `200 OK`
* **Example Success Response**:
  ```json
  {
    "id": 1,
    "title": "To Kill a Mockingbird",
    "author": "Harper Lee",
    "isbn": "978-0061120084",
    "publishedYear": 1960,
    "genre": "Fiction",
    "copiesAvailable": 3
  }
  ```

---

### 3. Create a Book
* **Method**: `POST`
* **Path**: `/api/v1/books`
* **Description**: Creates and adds a new book record to the library catalog.
* **Request Body**:
  ```json
  {
    "title": "The Pragmatic Programmer",
    "author": "Andrew Hunt, David Thomas",
    "isbn": "978-0135957059",
    "publishedYear": 2019,
    "genre": "Software Engineering",
    "copiesAvailable": 4
  }
  ```
* **Success Status Code**: `201 Created`
* **Example Success Response**:
  ```json
  {
    "id": 3,
    "title": "The Pragmatic Programmer",
    "author": "Andrew Hunt, David Thomas",
    "isbn": "978-0135957059",
    "publishedYear": 2019,
    "genre": "Software Engineering",
    "copiesAvailable": 4,
    "createdAt": "2026-10-18T12:00:00Z"
  }
  ```

---

### 4. Update a Book
* **Method**: `PUT`
* **Path**: `/api/v1/books/:id`
* **Description**: Updates the complete information of an existing book identified by its ID.
* **Request Body**:
  ```json
  {
    "title": "The Pragmatic Programmer: 20th Anniversary Edition",
    "author": "Andrew Hunt, David Thomas",
    "isbn": "978-0135957059",
    "publishedYear": 2019,
    "genre": "Software Engineering",
    "copiesAvailable": 6
  }
  ```
* **Success Status Code**: `200 OK`
* **Example Success Response**:
  ```json
  {
    "id": 3,
    "title": "The Pragmatic Programmer: 20th Anniversary Edition",
    "author": "Andrew Hunt, David Thomas",
    "isbn": "978-0135957059",
    "publishedYear": 2019,
    "genre": "Software Engineering",
    "copiesAvailable": 6,
    "updatedAt": "2026-10-18T12:15:00Z"
  }
  ```

---

### 5. Delete a Book
* **Method**: `DELETE`
* **Path**: `/api/v1/books/:id`
* **Description**: Removes an existing book record from the library catalog by its ID.
* **Request Body**: None
* **Success Status Code**: `204 No Content`

---

### 6. List Books by an Author (Query Parameter)
* **Method**: `GET`
* **Path**: `/api/v1/books?author={authorName}`
* **Description**: Filters and retrieves all books written by a specific author using the `author` query parameter.
* **Request Body**: None
* **Success Status Code**: `200 OK`
* **Example Request**:
  * `GET /api/v1/books?author=George+Orwell`
* **Example Success Response**:
  ```json
  [
    {
      "id": 2,
      "title": "1984",
      "author": "George Orwell",
      "isbn": "978-0451524935",
      "publishedYear": 1949,
      "genre": "Dystopian",
      "copiesAvailable": 5
    },
    {
      "id": 4,
      "title": "Animal Farm",
      "author": "George Orwell",
      "isbn": "978-0451526342",
      "publishedYear": 1945,
      "genre": "Political Satire",
      "copiesAvailable": 2
    }
  ]
  ```

---

## Error Handling

### Error Code 400 (Bad Request)
* **Meaning**: The request could not be processed due to invalid syntax, missing required fields, or validation errors in the client's request payload.
* **When It Happens**:
  * Attempting to create a book (`POST /api/v1/books`) without providing the mandatory `title` or `author` field.
  * Sending an invalid data type, such as a negative number for `copiesAvailable` (e.g., `copiesAvailable: -2`).
  * Supplying malformed JSON in the request body.
* **Example Request Payload (Invalid)**:
  ```json
  {
    "author": "Chinua Achebe",
    "copiesAvailable": -1
  }
  ```
* **Example Error Response**:
  ```json
  {
    "status": 400,
    "error": "Bad Request",
    "message": "Validation failed: 'title' is required, and 'copiesAvailable' must be a non-negative integer."
  }
  ```

---

### Error Code 404 (Not Found)
* **Meaning**: The requested resource does not exist on the server.
* **When It Happens**:
  * A client attempts to retrieve, update, or delete a book with an ID that is not present in the library database (e.g., `GET /api/v1/books/999` or `DELETE /api/v1/books/999`).
  * Requesting an unmapped endpoint or route on the server.
* **Example Request**:
  * `GET /api/v1/books/999`
* **Example Error Response**:
  ```json
  {
    "status": 404,
    "error": "Not Found",
    "message": "Book with ID 999 not found."
  }
  ```
