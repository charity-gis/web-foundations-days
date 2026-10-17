// Select required DOM elements
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// Updates character counter, word counter, and warning classes
function updateCounts() {
    const text = noteText.value;
    const chars = text.length;

    // 1. Update character count: "N / 200 characters"
    charCount.textContent = `${chars} / 200 characters`;

    // 2. Update word count: "N words"
    const trimmed = text.trim();
    const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
    wordCount.textContent = `${words} words`;

    // 3. Update warning classes:
    // warning class when over 180 characters, over class when over 200
    if (chars > 200) {
        charCount.classList.add("over");
        charCount.classList.remove("warning");
    } else if (chars > 180) {
        charCount.classList.add("warning");
        charCount.classList.remove("over");
    } else {
        charCount.classList.remove("warning", "over");
    }
}

// Empties the textarea, resets counters, and removes saved draft
function clearNote() {
    noteText.value = "";
    localStorage.removeItem("draft");
    localStorage.removeItem("noteDraft");
    updateCounts();
}

// Save draft and update counters on input
noteText.addEventListener("input", () => {
    updateCounts();
    localStorage.setItem("draft", noteText.value);
    localStorage.setItem("noteDraft", noteText.value);
});

// Clear button clears note and removes draft
clearBtn.addEventListener("click", clearNote);

// Pressing Escape inside the textarea clears it
noteText.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        clearNote();
    }
});

// Toggle dark theme, update button label, and persist choice in localStorage
themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

// Restore saved theme on page load
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
} else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
}

// Restore saved draft on page load
const savedDraft = localStorage.getItem("draft") ?? localStorage.getItem("noteDraft");
if (savedDraft !== null) {
    noteText.value = savedDraft;
}

// Initial counter and class update
updateCounts();
