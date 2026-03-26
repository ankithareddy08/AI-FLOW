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
// 3. HANDLE FILE & IMAGE UPLOAD
// ==========================================
fileUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    
    if (file) {
        fileNameDisplay.innerText = file.name;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            selectedFileBase64 = reader.result; 
        };
        reader.readAsDataURL(file);
    } else {
        fileNameDisplay.innerText = "";
        selectedFileBase64 = null;
    }
});

// ==========================================
// 4. CONNECT TO PYTHON WHEN "RUN AI" IS CLICKED
// ==========================================
runButton.addEventListener('click', async () => {
    const userInput = inputArea.value;

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
            body: JSON.stringify({
                action: selectedAction,
                text: userInput,
                file: selectedFileBase64 
            })
        });

        const data = await response.json();
        outputText.innerHTML = marked.parse(data.result);
        
        // --- NEW: SMART TITLE GENERATION ---
        let chatTitle = "New Task";
        if (userInput.trim() !== "") {
            // Grab the first 4 words of the user's text
            const words = userInput.trim().split(/\s+/);
            chatTitle = words.slice(0, 4).join(" ") + (words.length > 4 ? "..." : "");
        } else if (fileUpload.files.length > 0) {
            // If they attached a file, use the file name as the title!
            chatTitle = fileUpload.files[0].name;
        }

        // --- NEW: SAVE TO HISTORY ---
        const historyItem = {
            title: chatTitle,        // The dynamic name we just created
            task: selectedAction,    // The tool used (e.g., "Summarize Text")
            result: data.result,
            time: new Date().toLocaleTimeString()
        };

        let history = JSON.parse(localStorage.getItem('aiFlowHistory')) || [];
        history.unshift(historyItem); 
        localStorage.setItem('aiFlowHistory', JSON.stringify(history));
        
        loadSidebarHistory(); 
        // ------------------------------
        
        inputArea.value = ""; 
        fileNameDisplay.innerText = "";
        selectedFileBase64 = null;
        fileUpload.value = ""; 

    } catch (error) {
        outputText.innerText = "Error: Could not connect to the server. Is your Python backend running?";
        console.error(error);
    } finally {
        runButton.innerText = "Run AI";
        runButton.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});

// ==========================================
// 5. GEMINI-STYLE SIDEBAR HISTORY
// ==========================================

function loadSidebarHistory() {
    const history = JSON.parse(localStorage.getItem('aiFlowHistory')) || [];
    sidebarHistoryList.innerHTML = ""; 

    if (history.length === 0) {
        sidebarHistoryList.innerHTML = `<p class="text-xs text-slate-400 px-2 italic">No recent tasks.</p>`;
        return;
    }

    history.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = "text-left py-2.5 px-3 text-sm font-medium rounded-xl hover:bg-slate-100 transition-all text-slate-600 flex items-center gap-3 w-full";
        
        btn.innerHTML = `
            <span class="material-symbols-outlined text-[18px] text-slate-400">chat_bubble</span>
            <div class="flex flex-col overflow-hidden w-full">
                <span class="truncate text-slate-700 font-bold">${item.title || item.inputSnippet || "Past Task"}</span>
                <span class="text-[10px] text-slate-400 font-normal truncate">${item.task}</span>
            </div>
        `;

        btn.addEventListener('click', () => {
            // Keep the tool name in the main workspace header so they know what tool they used
            outputTitle.innerText = `Past Task: ${item.task}`;
            outputText.innerHTML = marked.parse(item.result);
            
            document.querySelectorAll('#sidebar-history-list button').forEach(b => b.classList.remove('bg-slate-200'));
            btn.classList.add('bg-slate-200');
        });

        sidebarHistoryList.appendChild(btn);
    });
}

// Wire up the "New Task" button to clear the screen
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

// Clear History Button
clearHistoryBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to delete all history?")) {
        localStorage.removeItem('aiFlowHistory');
        loadSidebarHistory();
        newTaskBtn.click(); 
    }
});

// Load the history immediately when the page opens!
loadSidebarHistory();

// ==========================================
// 6. COPY & REFRESH BUTTON LOGIC
// ==========================================

// Copy Button Logic
copyBtn.addEventListener('click', async () => {
    // Prevent copying if the box is empty or has the default placeholder
    if (outputText.innerText.includes("Select a tool from the left menu")) return;

    try {
        // Ask the browser to copy the raw text (ignoring HTML tags)
        await navigator.clipboard.writeText(outputText.innerText);
        
        // Visual feedback: change the icon to a green checkmark!
        const icon = copyBtn.querySelector('span');
        icon.innerText = "check";
        icon.classList.add("text-green-500");
        
        // Wait 2 seconds, then change it back to the copy icon
        setTimeout(() => {
            icon.innerText = "content_copy";
            icon.classList.remove("text-green-500");
        }, 2000);

    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert("Sorry, your browser blocked the copy action.");
    }
});

// Refresh Button Logic
resetBtn.addEventListener('click', () => {
    // We already wrote the code to clear the screen for the "New Task" button!
    // So we can just tell JS to virtually "click" that button for us.
    newTaskBtn.click(); 
});