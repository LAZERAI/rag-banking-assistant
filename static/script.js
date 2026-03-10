/* ═══════════════════════════════════════════════════════════════════════════
   BankRAG — Frontend Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// DOM
const chatArea      = document.getElementById("chatArea");
const messagesEl    = document.getElementById("messages");
const welcomeScreen = document.getElementById("welcomeScreen");
const questionInput = document.getElementById("questionInput");
const sendBtn       = document.getElementById("sendBtn");
const charCount     = document.getElementById("charCount");
const sidebar       = document.getElementById("sidebar");
const overlay       = document.getElementById("sidebarOverlay");
const scrollBtn     = document.getElementById("scrollBtn");
const statusDot     = document.getElementById("statusDot");
const statusText    = document.getElementById("statusText");
const topbarSub     = document.getElementById("topbarSub");
const docBadgeText  = document.getElementById("docBadgeText");

let isLoading = false;
let messageCount = 0;

// ── Chat History (localStorage) ──────────────────────────────────────────
const STORAGE_KEY = "bankrag_conversations";
let conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let activeConvoId = null;   // currently loaded conversation

function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Create or get the active conversation object */
function ensureConversation() {
  if (activeConvoId) {
    const c = conversations.find(c => c.id === activeConvoId);
    if (c) return c;
  }
  // Create a new conversation
  const convo = {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  conversations.unshift(convo);
  activeConvoId = convo.id;
  saveConversations();
  renderHistoryList();
  return convo;
}

/** Save a message into the active conversation */
function saveMessage(role, text, sources = [], elapsed = "") {
  const convo = ensureConversation();
  convo.messages.push({ role, text, sources, elapsed, time: new Date().toISOString() });
  // Auto-title from first user message
  if (convo.title === "New Chat" && role === "user") {
    convo.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }
  convo.updatedAt = new Date().toISOString();
  saveConversations();
  renderHistoryList();
}

/** Render conversation list in sidebar */
function renderHistoryList() {
  const list = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  const clearBtn = document.getElementById("clearHistoryBtn");

  if (!conversations.length) {
    list.innerHTML = '<div class="history-empty" id="historyEmpty">No saved conversations</div>';
    clearBtn.style.display = "none";
    return;
  }

  clearBtn.style.display = "flex";
  list.innerHTML = conversations.map(c => {
    const isActive = c.id === activeConvoId;
    const msgCount = c.messages.length;
    const timeAgo = formatTimeAgo(c.updatedAt);
    return `
      <div class="history-item${isActive ? " active" : ""}" data-id="${c.id}" onclick="loadConversation('${c.id}')">
        <div class="history-item-body">
          <div class="history-item-title">${escapeHtml(c.title)}</div>
          <div class="history-item-meta">${msgCount} msg${msgCount !== 1 ? "s" : ""} · ${timeAgo}</div>
        </div>
        <button class="history-del-btn" onclick="event.stopPropagation(); deleteConversation('${c.id}')" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }).join("");
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTimeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

/** Load a conversation into the chat area */
function loadConversation(id) {
  const convo = conversations.find(c => c.id === id);
  if (!convo) return;

  activeConvoId = id;
  messagesEl.innerHTML = "";
  messageCount = 0;

  if (convo.messages.length === 0) {
    messagesEl.style.display = "none";
    welcomeScreen.style.display = "flex";
  } else {
    welcomeScreen.style.display = "none";
    messagesEl.style.display = "flex";
    convo.messages.forEach(m => {
      appendMessageDOM(m.role, m.text, m.sources || [], m.elapsed || "");
    });
  }

  renderHistoryList();
  closeSidebar();
  questionInput.focus();
}

/** Delete a conversation */
function deleteConversation(id) {
  conversations = conversations.filter(c => c.id !== id);
  saveConversations();

  if (activeConvoId === id) {
    activeConvoId = null;
    messagesEl.innerHTML = "";
    messagesEl.style.display = "none";
    welcomeScreen.style.display = "flex";
    messageCount = 0;
    topbarSub.textContent = "Ask anything about banking policies";
  }

  renderHistoryList();
  showToast("Conversation deleted", "success");
}

/** Clear all history */
function clearAllHistory() {
  if (!confirm("Delete all saved conversations?")) return;
  conversations = [];
  activeConvoId = null;
  saveConversations();
  messagesEl.innerHTML = "";
  messagesEl.style.display = "none";
  welcomeScreen.style.display = "flex";
  messageCount = 0;
  topbarSub.textContent = "Ask anything about banking policies";
  renderHistoryList();
  showToast("All history cleared", "success");
}

/** Start a fresh conversation */
function newConversation() {
  activeConvoId = null;
  messagesEl.innerHTML = "";
  messagesEl.style.display = "none";
  welcomeScreen.style.display = "flex";
  questionInput.value = "";
  questionInput.style.height = "auto";
  charCount.textContent = "";
  sendBtn.disabled = true;
  messageCount = 0;
  topbarSub.textContent = "Ask anything about banking policies";
  renderHistoryList();
  questionInput.focus();
  closeSidebar();
}

// Render history on load
renderHistoryList();

// ── Textarea auto-resize ─────────────────────────────────────────────────
questionInput.addEventListener("input", () => {
  questionInput.style.height = "auto";
  questionInput.style.height = Math.min(questionInput.scrollHeight, 160) + "px";
  const len = questionInput.value.length;
  charCount.textContent = len > 0 ? len : "";
  sendBtn.disabled = !questionInput.value.trim();
});

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!isLoading && questionInput.value.trim()) handleSubmit();
  }
});

// ── Scroll detection for button ──────────────────────────────────────────
chatArea.addEventListener("scroll", () => {
  const fromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
  scrollBtn.style.display = fromBottom > 200 ? "flex" : "none";
});

// ── Health check ─────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    statusDot.className = "status-dot " + (data.index_loaded ? "online" : "offline");
    statusText.textContent = data.index_loaded
      ? `Online · ${data.chunks_count.toLocaleString()} chunks`
      : "Index not loaded";
    docBadgeText.textContent = data.index_loaded ? data.chunks_count.toLocaleString() : "—";
  } catch {
    statusDot.className = "status-dot offline";
    statusText.textContent = "Server offline";
    docBadgeText.textContent = "—";
  }
}
checkHealth();
setInterval(checkHealth, 30000);

// ── Submit ───────────────────────────────────────────────────────────────
async function handleSubmit(e) {
  if (e) e.preventDefault();
  const question = questionInput.value.trim();
  if (!question || isLoading) return;

  // Hide welcome
  welcomeScreen.style.display = "none";
  messagesEl.style.display = "flex";

  appendMessage("user", question);
  questionInput.value = "";
  questionInput.style.height = "auto";
  charCount.textContent = "";
  sendBtn.disabled = true;

  const typingEl = appendTyping();
  isLoading = true;
  topbarSub.textContent = "Thinking…";

  const startTime = Date.now();

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error (${res.status})`);
    }

    const data = await res.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    typingEl.remove();
    appendMessage("assistant", data.answer, data.sources, elapsed);
    topbarSub.textContent = `Responded in ${elapsed}s`;
  } catch (err) {
    typingEl.remove();
    appendMessage("assistant", "Something went wrong: " + err.message);
    topbarSub.textContent = "Error occurred";
    showToast(err.message, "error");
  } finally {
    isLoading = false;
    sendBtn.disabled = !questionInput.value.trim();
  }
}

/** appendMessage = render DOM + persist to history */
function appendMessage(role, text, sources = [], elapsed = "") {
  saveMessage(role, text, sources, elapsed);
  appendMessageDOM(role, text, sources, elapsed);
}

// ── Render message (DOM only — no save) ──────────────────────────────────
function appendMessageDOM(role, text, sources = [], elapsed = "") {
  messageCount++;
  const msg = document.createElement("div");
  msg.className = `message ${role}`;

  const avatar = role === "user" ? "U" : "🏦";
  const name = role === "user" ? "You" : "BankRAG";
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let sourcesHTML = "";
  if (sources.length) {
    sourcesHTML = `<div class="msg-footer">${sources
      .map(s => `<span class="source-tag">📄 ${s}</span>`)
      .join("")}${elapsed ? `<span class="source-tag">⚡ ${elapsed}s</span>` : ""}</div>`;
  }

  const actionsHTML = role === "assistant" ? `
    <div class="msg-actions">
      <button class="action-btn" onclick="copyMessage(this)" title="Copy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
    </div>` : "";

  msg.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-name">${name}</span>
        <span class="msg-time">${time}</span>
      </div>
      <div class="msg-content">${formatMarkdown(text)}</div>
      ${sourcesHTML}
      ${actionsHTML}
    </div>
  `;

  // Store raw text for copy
  msg.dataset.rawText = text;

  messagesEl.appendChild(msg);
  scrollToBottom();
}

function appendTyping() {
  const msg = document.createElement("div");
  msg.className = "message assistant";
  msg.innerHTML = `
    <div class="msg-avatar">🏦</div>
    <div class="msg-body">
      <div class="msg-header"><span class="msg-name">BankRAG</span></div>
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>
  `;
  messagesEl.appendChild(msg);
  scrollToBottom();
  return msg;
}

// ── Markdown-ish rendering ───────────────────────────────────────────────
function formatMarkdown(text) {
  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Blockquote
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Bullet lists
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    // Numbered lists
    .replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/gs, "<ul>$1</ul>");

  // Paragraphs
  html = html
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap in paragraphs if not already
  if (!html.startsWith("<h") && !html.startsWith("<ul") && !html.startsWith("<blockquote")) {
    html = "<p>" + html + "</p>";
  }

  return html;
}

// ── Copy message ─────────────────────────────────────────────────────────
async function copyMessage(btn) {
  const msg = btn.closest(".message");
  const text = msg.dataset.rawText || msg.querySelector(".msg-content").innerText;
  try {
    await navigator.clipboard.writeText(text);
    btn.classList.add("copied");
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
    }, 2000);
  } catch {
    showToast("Failed to copy", "error");
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function scrollToBottom() {
  chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" });
}

function clearChat() {
  newConversation();
}

function askSuggestion(el) {
  // Get the descriptive text from the card
  const descEl = el.querySelector(".wc-desc") || el.querySelector("span:last-child");
  const text = descEl ? descEl.textContent : el.textContent;
  questionInput.value = text.trim();
  charCount.textContent = text.trim().length;
  sendBtn.disabled = false;
  handleSubmit();
  closeSidebar();
}

function toggleSidebar() { sidebar.classList.toggle("open"); }
function closeSidebar() { sidebar.classList.remove("open"); }

// Close sidebar on outside click (mobile)
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768 && sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) && !e.target.closest(".menu-btn")) {
    closeSidebar();
  }
});

// ── Theme toggle ─────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateThemeUI(next);
}

function updateThemeUI(theme) {
  document.getElementById("themeIcon").textContent = theme === "dark" ? "🌙" : "☀️";
  document.getElementById("themeLabel").textContent = theme === "dark" ? "Dark Mode" : "Light Mode";
}

// Load saved theme
(function() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeUI(saved);
})();

// ── Toast ────────────────────────────────────────────────────────────────
function showToast(msg, type = "error") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
