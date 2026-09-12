/* ─────────────────────────────────────────────
   FINCOACH — Frontend Application Logic
───────────────────────────────────────────── */

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let allTransactions = [];
let allGoals = [];
let barChart = null;
let donutChart = null;
let currentFilter = "all";

const CATEGORY_COLORS = [
  "#C9A84C","#5CBF8A","#6FA3E0","#D4806A","#A87CC8",
  "#5BBFB5","#E0A84C","#8ABF5C","#E05C8A","#6AB0D4"
];

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("current-date").textContent =
    new Date().toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  document.getElementById("txn-date").valueAsDate = new Date();
  loadAll();
  loadChatHistory();
});

async function loadAll() {
  await Promise.all([loadSummary(), loadTransactions(), loadGoals(), loadCharts()]);
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    switchView(view);
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + view).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function loadSummary() {
  try {
    const res = await fetch("/api/summary");
    const data = await res.json();

    const fmt = v => "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    document.getElementById("stat-income").textContent    = fmt(data.monthly_income);
    document.getElementById("stat-expenses").textContent  = fmt(data.monthly_expenses);
    document.getElementById("stat-savings").textContent   = fmt(data.monthly_savings);

    const rate = data.monthly_income > 0
      ? Math.round((data.monthly_savings / data.monthly_income) * 100)
      : 0;
    document.getElementById("stat-rate").textContent = rate + "%";

    // Health score (simple heuristic)
    let score = 50;
    if (rate >= 20) score += 20;
    else if (rate >= 10) score += 10;
    if (data.monthly_savings > 0) score += 15;
    if (data.active_goals.length > 0) score += 15;
    score = Math.min(100, score);
    document.getElementById("health-score").textContent = score + "/100";

  } catch(e) { console.error("Summary load error:", e); }
}

async function loadCharts() {
  try {
    const [monthly, summary] = await Promise.all([
      fetch("/api/monthly-chart").then(r => r.json()),
      fetch("/api/summary").then(r => r.json())
    ]);

    renderBarChart(monthly);
    renderDonutChart(summary.top_categories);
  } catch(e) { console.error("Chart load error:", e); }
}

function renderBarChart(data) {
  const ctx = document.getElementById("barChart").getContext("2d");
  const labels = data.map(d => {
    const [y, m] = d.month.split("-");
    return new Date(y, m-1).toLocaleString("en-IN", { month: "short" });
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Income",
          data: data.map(d => d.income),
          backgroundColor: "rgba(92,191,138,0.4)",
          borderColor: "#5CBF8A",
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: "Expenses",
          data: data.map(d => d.expenses),
          backgroundColor: "rgba(201,168,76,0.3)",
          borderColor: "#C9A84C",
          borderWidth: 1.5,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "rgba(240,237,228,0.6)", font: { family: "DM Sans", size: 11 }, boxWidth: 12 } }
      },
      scales: {
        x: { ticks: { color: "rgba(240,237,228,0.5)", font: { family: "DM Sans" } }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { ticks: { color: "rgba(240,237,228,0.5)", font: { family: "DM Sans" }, callback: v => "₹" + v.toLocaleString("en-IN") }, grid: { color: "rgba(255,255,255,0.04)" } }
      }
    }
  });
}

function renderDonutChart(categories) {
  const ctx = document.getElementById("donutChart").getContext("2d");
  const legend = document.getElementById("donut-legend");

  if (!categories || categories.length === 0) {
    legend.innerHTML = '<span style="color:rgba(240,237,228,0.35);font-size:0.78rem">No expense data yet</span>';
    return;
  }

  const labels = categories.map(c => c.category);
  const values = categories.map(c => c.amount);
  const colors = CATEGORY_COLORS.slice(0, labels.length);

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      cutout: "70%",
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ₹${Number(ctx.raw).toLocaleString("en-IN")}` }
      }}
    }
  });

  legend.innerHTML = labels.map((l, i) =>
    `<span class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>${l}
    </span>`
  ).join("");
}

// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────
async function loadTransactions() {
  try {
    const res = await fetch("/api/transactions");
    allTransactions = await res.json();
    renderTransactions();
  } catch(e) { console.error("Txn load error:", e); }
}

function renderTransactions() {
  const tbody = document.getElementById("txn-tbody");
  const filtered = currentFilter === "all"
    ? allTransactions
    : allTransactions.filter(t => t.type === currentFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No transactions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const sign = t.type === "income" ? "+" : "−";
    return `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${t.description || "—"}</td>
        <td>${t.category}</td>
        <td><span class="type-badge ${t.type}">${t.type}</span></td>
        <td class="amount-cell ${t.type}">${sign}₹${Number(t.amount).toLocaleString("en-IN")}</td>
        <td><button class="delete-btn" onclick="deleteTransaction(${t.id})">✕</button></td>
      </tr>
    `;
  }).join("");
}

function filterTxns(btn) {
  currentFilter = btn.dataset.filter;
  document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderTransactions();
}

async function addTransaction() {
  const type     = document.getElementById("txn-type").value;
  const amount   = parseFloat(document.getElementById("txn-amount").value);
  const category = document.getElementById("txn-category").value;
  const desc     = document.getElementById("txn-desc").value.trim();
  const date     = document.getElementById("txn-date").value;

  if (!amount || amount <= 0 || !date) {
    showToast("Please fill all required fields.");
    return;
  }

  try {
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount, category, description: desc, date })
    });
    closeModal("txn-modal");
    showToast("Transaction added ✓");
    resetTransactionForm();
    await loadAll();
  } catch(e) { showToast("Failed to add transaction."); }
}

async function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;
  await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  showToast("Deleted.");
  await loadAll();
}

function resetTransactionForm() {
  document.getElementById("txn-amount").value = "";
  document.getElementById("txn-desc").value = "";
  document.getElementById("txn-date").valueAsDate = new Date();
  document.getElementById("txn-type").value = "expense";
  document.querySelectorAll(".toggle-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.val === "expense");
  });
}

// ─────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────
async function loadGoals() {
  try {
    const res = await fetch("/api/goals");
    allGoals = await res.json();
    renderGoals();
  } catch(e) { console.error("Goals load error:", e); }
}

function renderGoals() {
  const grid = document.getElementById("goals-grid");
  const active = allGoals.filter(g => g.status === "active");

  if (active.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p class="empty-icon">◎</p><p>No goals yet. Set your first financial goal!</p></div>`;
    return;
  }

  grid.innerHTML = active.map(g => {
    const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
    const fmt = v => "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return `
      <div class="goal-card">
        <span class="goal-percent">${pct}%</span>
        <p class="goal-name">${g.name}</p>
        <div class="goal-amounts">
          <span>Saved: <strong>${fmt(g.current_amount)}</strong></span>
          <span>Target: <strong>${fmt(g.target_amount)}</strong></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        ${g.deadline ? `<p class="goal-deadline">🗓 Target date: ${formatDate(g.deadline)}</p>` : ""}
        <div class="goal-actions">
          <button class="ghost-btn" style="font-size:0.78rem;padding:6px 12px" onclick="markGoalDone(${g.id})">Mark Complete</button>
          <button class="delete-btn" onclick="deleteGoal(${g.id})">✕</button>
        </div>
      </div>
    `;
  }).join("");
}

async function addGoal() {
  const name    = document.getElementById("goal-name").value.trim();
  const target  = parseFloat(document.getElementById("goal-target").value);
  const current = parseFloat(document.getElementById("goal-current").value) || 0;
  const deadline = document.getElementById("goal-deadline").value;

  if (!name || !target || target <= 0) {
    showToast("Please enter a goal name and target amount.");
    return;
  }

  await fetch("/api/goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, target_amount: target, current_amount: current, deadline })
  });

  closeModal("goal-modal");
  showToast("Goal created ✓");
  document.getElementById("goal-name").value = "";
  document.getElementById("goal-target").value = "";
  document.getElementById("goal-current").value = "";
  document.getElementById("goal-deadline").value = "";
  await loadGoals();
}

async function markGoalDone(id) {
  const goal = allGoals.find(g => g.id === id);
  if (!goal) return;
  await fetch(`/api/goals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_amount: goal.target_amount, status: "completed" })
  });
  showToast("🎉 Goal completed!");
  await loadGoals();
}

async function deleteGoal(id) {
  if (!confirm("Delete this goal?")) return;
  await fetch(`/api/goals/${id}`, { method: "DELETE" });
  showToast("Goal deleted.");
  await loadGoals();
}

// ─────────────────────────────────────────────
// AI CHAT
// ─────────────────────────────────────────────
async function loadChatHistory() {
  try {
    const res = await fetch("/api/chat/history");
    const history = await res.json();
    if (history.length > 0) {
      const container = document.getElementById("chat-messages");
      // Clear default message if we have history
      container.innerHTML = "";
      history.forEach(msg => appendBubble(msg.role, msg.content));
    }
  } catch(e) {}
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  appendBubble("user", msg);
  const typingId = appendTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    removeTyping(typingId);
    appendBubble("assistant", data.reply || "Sorry, I couldn't process that.");
  } catch(e) {
    removeTyping(typingId);
    appendBubble("assistant", "Connection error. Please check your server is running.");
  }
}

function sendSuggestion(btn) {
  document.getElementById("chat-input").value = btn.textContent;
  sendMessage();
}

function appendBubble(role, content) {
  const container = document.getElementById("chat-messages");
  const isUser = role === "user";
  const div = document.createElement("div");
  div.className = `chat-bubble ${role}`;
  div.innerHTML = `
    <div class="bubble-avatar">${isUser ? "◉" : "◈"}</div>
    <div class="bubble-body">${escapeHtml(content).replace(/\n/g, "<br>")}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendTyping() {
  const container = document.getElementById("chat-messages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.className = "chat-bubble assistant";
  div.id = id;
  div.innerHTML = `
    <div class="bubble-avatar">◈</div>
    <div class="bubble-body typing">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function clearChat() {
  if (!confirm("Clear all chat history?")) return;
  await fetch("/api/chat/clear", { method: "POST" });
  document.getElementById("chat-messages").innerHTML = `
    <div class="chat-bubble assistant">
      <div class="bubble-avatar">◈</div>
      <div class="bubble-body">Chat cleared! How can I help you with your finances today?</div>
    </div>
  `;
  showToast("Chat cleared.");
}

// ─────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// ─────────────────────────────────────────────
// TOGGLE BUTTONS
// ─────────────────────────────────────────────
function selectToggle(btn, targetId) {
  const group = btn.closest(".toggle-group");
  group.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(targetId).value = btn.dataset.val;
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
