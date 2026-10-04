let notes = [
    { id: 1, text: "Buy milk and bread", category: "personal" },
    { id: 2, text: "Finish the Day 3 assignment", category: "study" },
    { id: 3, text: "Email the project report to Grace", category: "work" },
    { id: 4, text: "Revise JavaScript arrays", category: "study" },
    { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
    const searchTerm = word.toLowerCase();
    return notes.filter(note => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
    if (notes.length === 0) return null;

    let longest = notes[0];
    for (let i = 1; i < notes.length; i++) {
        if (notes[i].text.length > longest.text.length) {
            longest = notes[i];
        }
    }
    return longest;
}

function countByCategory() {
    const counts = {};
    for (const note of notes) {
        if (counts[note.category]) {
            counts[note.category]++;
        } else {
            counts[note.category] = 1;
        }
    }
    return counts;
}

function getSummary() {
    const counts = countByCategory();
    const total = notes.length;
    const noun = total === 1 ? "note" : "notes";

    const categoryStrings = [];
    for (const category in counts) {
        categoryStrings.push(`${counts[category]} ${category}`);
    }

    return `${total} ${noun}: ${categoryStrings.join(", ")}.`;
}

// uses some() to check if the text matches any existing note
function isDuplicate(text) {
    const checkText = text.trim().toLowerCase();
    return notes.some(note => note.text.trim().toLowerCase() === checkText);
}

// checks all rules before adding
function addNote(text, category) {
    if (text.length < 1 || text.length > 200) {
        console.log("failed: needs to be 1-200 chars");
        return false;
    }

    if (category !== "personal" && category !== "work" && category !== "study") {
        console.log("failed: bad category");
        return false;
    }

    if (isDuplicate(text)) {
        console.log("failed: already exists");
        return false;
    }

    // get the highest id and add 1
    const nextId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
    notes.push({ id: nextId, text: text, category: category });
    return true;
}


// tests

// searchNotes
console.log(searchNotes("day")); // finds the day 3 assignment
console.log(searchNotes("xyz")); // no results, should be empty []

// longestNote
console.log(longestNote()); // should print the email report to grace

// countByCategory
console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }

// getSummary
console.log(getSummary()); // prints the sentence

// isDuplicate
console.log(isDuplicate("   cAlL mUm   ")); // true (ignores case/spaces)
console.log(isDuplicate("clean the house")); // false

// addNote
console.log(addNote("Buy apples", "personal")); // works, returns true
console.log(addNote("Learn Python", "coding")); // fails (bad category)
console.log(addNote("call mum", "personal")); // fails (duplicate)