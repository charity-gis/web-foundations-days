// Select DOM Elements
const loadUsersBtn = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusEl = document.getElementById("status");
const usersList = document.getElementById("users-list");

// API Endpoint
const API_URL = "https://jsonplaceholder.typicode.com/users";

// In-memory array to store fetched users
let users = [];

/**
 * Renders an array of user objects into the DOM.
 * Strictly uses createElement and textContent for all user data.
 * @param {Array} list - Array of user objects to render
 */
function renderUsers(list) {
    // Clear existing contents of the list
    usersList.innerHTML = "";

    // If no users match the filter criteria
    if (list.length === 0) {
        if (users.length > 0) {
            const emptyItem = document.createElement("li");
            emptyItem.className = "no-matches";
            emptyItem.textContent = "No users match your filter.";
            usersList.appendChild(emptyItem);
        }
        return;
    }

    // Render each user card
    list.forEach(user => {
        const li = document.createElement("li");
        li.className = "user-card";

        // User Name
        const nameHeading = document.createElement("h3");
        nameHeading.className = "user-name";
        nameHeading.textContent = user.name;
        li.appendChild(nameHeading);

        // User Email
        const emailP = document.createElement("p");
        emailP.className = "user-detail user-email";
        emailP.textContent = `Email: ${user.email}`;
        li.appendChild(emailP);

        // User City
        const cityP = document.createElement("p");
        cityP.className = "user-detail user-city";
        const cityName = user.address && user.address.city ? user.address.city : "N/A";
        cityP.textContent = `City: ${cityName}`;
        li.appendChild(cityP);

        // User Company Name
        const companyP = document.createElement("p");
        companyP.className = "user-detail user-company";
        const companyName = user.company && user.company.name ? user.company.name : "N/A";
        companyP.textContent = `Company: ${companyName}`;
        li.appendChild(companyP);

        // Append user card to the unordered list
        usersList.appendChild(li);
    });
}

/**
 * Asynchronously fetches users from the JSONPlaceholder API.
 * Uses try / catch / finally to manage loading, success, and error states.
 */
async function loadUsers() {
    try {
        // Disable button while loading
        loadUsersBtn.disabled = true;

        // Show loading status
        statusEl.textContent = "Loading users...";
        statusEl.className = "status-message loading";

        // Fetch user data
        const response = await fetch(API_URL);

        // Check response status
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse JSON
        const data = await response.json();

        // Store loaded users in array
        users = data;

        // Reset filter input if any previous filter was typed
        filterInput.value = "";

        // Render loaded users
        renderUsers(users);

        // Show success status
        statusEl.textContent = `Successfully loaded ${users.length} users.`;
        statusEl.className = "status-message success";
    } catch (error) {
        // Show error status
        console.error("Failed to load users:", error);
        statusEl.textContent = `Failed to load users: ${error.message}`;
        statusEl.className = "status-message error";
        usersList.innerHTML = "";
    } finally {
        // Re-enable button when request completes
        loadUsersBtn.disabled = false;
    }
}

/**
 * Filter users by name as the user types into the filter input.
 * Does not make any new network requests.
 */
function handleFilter() {
    const query = filterInput.value.toLowerCase().trim();

    // Filter stored users where name includes the query string (case-insensitive)
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(query)
    );

    renderUsers(filteredUsers);
}

// Event Listeners
loadUsersBtn.addEventListener("click", loadUsers);
filterInput.addEventListener("input", handleFilter);
