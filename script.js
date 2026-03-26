// ==========================================
// 0. FIREBASE AUTHENTICATION & DATABASE SETUP
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// NEW: Import the Firestore Database tools!
import { getFirestore, collection, addDoc, getDocs, query, where } 
from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeJpF5RfSEmiyFefGFdDRuUWAtngUrc4s",
  authDomain: "ai-flow-3d061.firebaseapp.com",
  projectId: "ai-flow-3d061",
  storageBucket: "ai-flow-3d061.firebasestorage.app",
  messagingSenderId: "123471058769",
  appId: "1:123471058769:web:8bbf03e9d632692651e570"
};

// Initialize Firebase App, Auth, and Database
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// Global Variable to track who is logged in
let currentUser = null;

// Auth Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');

// Login Function
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
    }
});

// Logout Function
logoutBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to log out?")) {
        signOut(auth);
    }
});

// Monitor Login State 
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        userName.innerText = user.displayName;
        userAvatar.src = user.photoURL;
        
        // As soon as they log in, fetch their history from the cloud!
        loadCloudHistory();
    } else {
        currentUser = null;
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
        userName.innerText = "";
        userAvatar.src = "";
        
        // If logged out, lock the sidebar
        document.getElementById('sidebar-history-list').innerHTML = `<p class="text-xs text-slate-400 px-4 py-2 italic text-center border border-slate-200 rounded-xl bg-slate-50">Please sign in to save and view your history.</p>`;
    }
});

// ==========================================
// 1. VARIABLES & ELEMENTS 
// ==========================================
const fileUpload = document.getElementById('file-upload'); 
const fileNameDisplay = document.getElementById('file-name');
let selectedFileBase64 = null; 

const actionButtons = document.querySelectorAll('.tool-btn');
const runButton = document.getElementById('run-btn');
const inputArea = document.getElementById('user-input');
const outputText = document.getElementById('output-text');
const outputTitle = document.getElementById('output-title');

const newTaskBtn = document.getElementById('new-task-btn');
const sidebarHistoryList = document.getElementById('sidebar-history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const copyBtn = document.getElementById('copy-btn');
const resetBtn = document.getElementById('reset-btn');

let selectedAction = null;

// ==========================================
// 2. HANDLE SIDEBAR TOOL SELECTION
// ==========================================
actionButtons.forEach(button => {
    button.addEventListener('click', () => {
        actionButtons.forEach(btn => {
            btn.classList.remove('bg-slate-100', 'text-slate-900', 'font-bold');
            btn.classList.add('text-slate-700');
        });

        button.classList.add('bg-slate-100', 'text-slate-900', 'font-bold');
        button.classList.remove('text-slate-700');

        selectedAction = button.innerText;
        inputArea.placeholder = `Paste text here to ${selectedAction}...`;
        outputTitle.innerText = `Task: ${selectedAction}`;
    });
});

// ==========================================
// 3. HANDLE FILE UPLOAD
// ==========================================
fileUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        fileNameDisplay.innerText = file.name;
        const reader = new FileReader();
        reader.onloadend = () => { selectedFileBase64 = reader.result; };
        reader.readAsDataURL(file);
    } else {
        fileNameDisplay.innerText = "";
        selectedFileBase64 = null;
    }
});

// ==========================================
// 4. RUN AI & SAVE TO CLOUD
// ==========================================
runButton.addEventListener('click', async () => {
    const userInput = inputArea.value;

    if (!currentUser) {
        alert("Please sign in with Google first to use the AI!");
        return;
    }
    if (!selectedAction) {
        alert("Please select a tool from the left menu first!");
        return;
    }
    if (userInput.trim() === "" && !selectedFileBase64) {
        alert("Please paste some text or attach a file first!");
        return;
    }

    runButton.innerText = "Processing...";
    runButton.classList.add('opacity-75', 'cursor-not-allowed');
    outputText.innerText = "The AI is thinking...";

    try {
        const response = await fetch("http://localhost:8000/api/run-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: selectedAction, text: userInput, file: selectedFileBase64 })
        });

        const data = await response.json();
        outputText.innerHTML = marked.parse(data.result);
        
        let chatTitle = "New Task";
        if (userInput.trim() !== "") {
            const words = userInput.trim().split(/\s+/);
            chatTitle = words.slice(0, 4).join(" ") + (words.length > 4 ? "..." : "");
        } else if (fileUpload.files.length > 0) {
            chatTitle = fileUpload.files[0].name;
        }

        // --- NEW: BEAM TO FIRESTORE DATABASE ---
        await addDoc(collection(db, "history"), {
            userId: currentUser.uid, // Tie this data securely to the logged-in user!
            title: chatTitle,
            task: selectedAction,
            result: data.result,
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now() // For sorting
        });
        
        loadCloudHistory(); // Refresh the sidebar
        // --------------------------------------
        
        inputArea.value = ""; 
        fileNameDisplay.innerText = "";
        selectedFileBase64 = null;
        fileUpload.value = ""; 

    } catch (error) {
        outputText.innerText = "Error: Could not connect to the server.";
        console.error(error);
    } finally {
        runButton.innerText = "Run AI";
        runButton.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});

// ==========================================
// 5. FETCH CLOUD HISTORY
// ==========================================
async function loadCloudHistory() {
    if (!currentUser) return;

    sidebarHistoryList.innerHTML = `<p class="text-xs text-slate-400 px-2 italic">Syncing with cloud...</p>`;

    try {
        // Go to the database, find the "history" folder, and get ONLY the documents that belong to this user
        const q = query(collection(db, "history"), where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        let historyArray = [];
        querySnapshot.forEach((doc) => {
            historyArray.push(doc.data());
        });

        // Sort them so the newest ones are at the top
        historyArray.sort((a, b) => b.timestamp - a.timestamp);

        sidebarHistoryList.innerHTML = ""; 

        if (historyArray.length === 0) {
            sidebarHistoryList.innerHTML = `<p class="text-xs text-slate-400 px-2 italic">No recent tasks.</p>`;
            return;
        }

        historyArray.forEach((item) => {
            const btn = document.createElement('button');
            btn.className = "text-left py-2.5 px-3 text-sm font-medium rounded-xl hover:bg-slate-100 transition-all text-slate-600 flex items-center gap-3 w-full";
            
            btn.innerHTML = `
                <span class="material-symbols-outlined text-[18px] text-slate-400">cloud_done</span>
                <div class="flex flex-col overflow-hidden w-full">
                    <span class="truncate text-slate-700 font-bold">${item.title}</span>
                    <span class="text-[10px] text-slate-400 font-normal truncate">${item.task} • ${item.time}</span>
                </div>
            `;

            btn.addEventListener('click', () => {
                outputTitle.innerText = `Past Task: ${item.task}`;
                outputText.innerHTML = marked.parse(item.result);
                document.querySelectorAll('#sidebar-history-list button').forEach(b => b.classList.remove('bg-slate-200'));
                btn.classList.add('bg-slate-200');
            });

            sidebarHistoryList.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching history:", error);
        sidebarHistoryList.innerHTML = `<p class="text-xs text-red-400 px-2 italic">Failed to load history.</p>`;
    }
}

// ==========================================
// 6. UTILITY BUTTONS
// ==========================================
newTaskBtn.addEventListener('click', () => {
    outputTitle.innerText = "New Task";
    outputText.innerHTML = "<p>Select a tool from the left menu and run the AI to see your results here.</p>";
    inputArea.value = "";
    inputArea.placeholder = "Paste your text here...";
    selectedAction = null;
    actionButtons.forEach(btn => {
        btn.classList.remove('bg-slate-100', 'text-slate-900', 'font-bold');
        btn.classList.add('text-slate-700');
    });
    document.querySelectorAll('#sidebar-history-list button').forEach(b => b.classList.remove('bg-slate-200'));
});

copyBtn.addEventListener('click', async () => {
    if (outputText.innerText.includes("Select a tool from the left menu")) return;
    try {
        await navigator.clipboard.writeText(outputText.innerText);
        const icon = copyBtn.querySelector('span');
        icon.innerText = "check";
        icon.classList.add("text-green-500");
        setTimeout(() => {
            icon.innerText = "content_copy";
            icon.classList.remove("text-green-500");
        }, 2000);
    } catch (err) { console.error('Failed to copy', err); }
});

resetBtn.addEventListener('click', () => newTaskBtn.click());