// Event Splitter — pure JS (no framework)
// Storage key
const LS_EVENTS_KEY = "eventSplitter_events";
const LS_THEME_KEY = "eventSplitter_theme";
const LS_SETTLED_KEY = "eventSplitter_settled"; // map of {eventId: {"from->to": true}}

const $app = document.getElementById("app");

// Firebase (Auth ready; data stays local in V1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Your config (provided)
const firebaseConfig = {
  apiKey: "AIzaSyBnVNIMeJxm_fXcpfBGg-BbdIe5WL8drXg",
  authDomain: "new-app-9fbd8.firebaseapp.com",
  projectId: "new-app-9fbd8",
  storageBucket: "new-app-9fbd8.firebasestorage.app",
  messagingSenderId: "784160013930",
  appId: "1:784160013930:web:2a44217c7e4c435a951413",
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const provider = new GoogleAuthProvider();

// State
let state = {
  view: "dashboard", // 'dashboard' | 'event'
  events: readLS(LS_EVENTS_KEY, []),
  currentEventId: null,
  user: null,
  settled: readLS(LS_SETTLED_KEY, {}), // { [eventId]: { "from->to": true } }
};

// Init theme
const initialTheme = readLS(LS_THEME_KEY, "dark");
if (initialTheme === "light") document.documentElement.classList.remove("dark");

// Auth state
onAuthStateChanged(auth, (u) => {
  state.user = u ? { uid: u.uid, name: u.displayName, photo: u.photoURL } : null;
  render();
});

// Utils
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function randColor() {
  const palette = ["#0ea5e9", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#f97316", "#14b8a6"];
  return palette[Math.floor(Math.random() * palette.length)];
}
function formatCurrency(amount, currency = "৳") {
  return `${currency}${Number(amount || 0).toFixed(2)}`;
}
function getTotalExpenses(event) {
  return (event.expenses || []).reduce((t, e) => t + Number(e.amount || 0), 0);
}
function getMemberExpenses(event, memberId) {
  return (event.expenses || [])
    .filter((e) => e.paidBy === memberId)
    .reduce((t, e) => t + Number(e.amount || 0), 0);
}
function calculateBalances(event) {
  const balances = {};
  event.members.forEach((m) => {
    balances[m.id] = { memberId: m.id, paid: 0, share: 0, balance: 0 };
  });
  (event.expenses || []).forEach((ex) => {
    if (!balances[ex.paidBy]) return;
    balances[ex.paidBy].paid += Number(ex.amount || 0);
    const share = Number(ex.amount || 0) / (ex.sharedBy?.length || 1);
    (ex.sharedBy || []).forEach((id) => {
      if (!balances[id]) return;
      balances[id].share += share;
    });
  });
  Object.values(balances).forEach((b) => (b.balance = b.paid - b.share));
  return Object.values(balances);
}
function calculateSettlements(balances) {
  const settlements = [];
  const creditors = balances.filter((b) => b.balance > 0.01).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.balance < -0.01).map((b) => ({ ...b, balance: Math.abs(b.balance) }));
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);
  let i = 0,
    j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i];
    const d = debtors[j];
    const amt = Math.min(c.balance, d.balance);
    if (amt > 0.01) {
      settlements.push({
        from: d.memberId,
        to: c.memberId,
        amount: Math.round(amt * 100) / 100,
      });
    }
    c.balance -= amt;
    d.balance -= amt;
    if (c.balance < 0.01) i++;
    if (d.balance < 0.01) j++;
  }
  return settlements;
}

// Render
function render() {
  if (state.view === "dashboard") {
    renderDashboard();
  } else if (state.view === "event") {
    renderEvent();
  }
}

function renderTopBar({ showBack = false } = {}) {
  const user = state.user;
  return `
    <div class="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
      <div class="max-w-6xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            ${
              showBack
                ? `<button class="btn text-slate-400 hover:text-white" data-action="go-dashboard" title="Back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="stroke-current"><path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>`
                : ""
            }
            <div>
              <h1 class="text-2xl font-extrabold bg-gradient-to-r from-teal-300 to-blue-300 bg-clip-text text-transparent">
                Event Splitter
              </h1>
              <p class="text-slate-400 text-sm">Manage your group expenses</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn px-3 py-1.5 rounded-md bg-slate-800/60 hover:bg-slate-700 border border-slate-600 text-slate-200" data-action="toggle-theme">
              Theme
            </button>
            <div class="relative">
              <button class="btn px-3 py-1.5 rounded-md bg-slate-800/60 hover:bg-slate-700 border border-slate-600 text-slate-200" data-action="open-settings">
                Settings
              </button>
            </div>
            ${
              user
                ? `<button class="btn flex items-center gap-2 px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white" data-action="signout">
                      <img src="${user.photo || ""}" alt="" class="w-5 h-5 rounded-full border border-teal-300/40"/>
                      <span>${user.name?.split(" ")[0] || "User"}</span>
                   </button>`
                : `<button class="btn px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white" data-action="signin">
                    Sign in with Google
                   </button>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const events = state.events;
  $app.innerHTML = `
    ${renderTopBar({ showBack: false })}
    <div class="max-w-6xl mx-auto px-4 py-8">
      ${
        events.length === 0
          ? `
      <div class="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div class="text-6xl mb-6">🎉</div>
        <h2 class="text-2xl font-semibold text-white mb-2">No Events Yet</h2>
        <p class="text-slate-400 mb-8 max-w-md">
          Create your first event to start splitting expenses with friends and family
        </p>
        <button class="btn px-5 py-3 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 text-white shadow-lg hover:shadow-xl" data-action="open-create-event">
          <span class="mr-2">➕</span> Create New Event
        </button>
      </div>
      `
          : `
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-xl font-semibold text-white">Your Events</h2>
          <p class="text-slate-400 text-sm">${events.length} ${events.length === 1 ? "event" : "events"} total</p>
        </div>
        <button class="btn px-4 py-2 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 text-white shadow-lg hover:shadow-xl" data-action="open-create-event">
          <span class="mr-2">➕</span> Create New Event
        </button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${events.map(renderEventCard).join("")}
      </div>
      `
      }
    </div>

    ${renderCreateEventModal()}
    ${renderSettingsModal()}
  `;
  bindDashboardEvents();
}

function renderEventCard(event) {
  const total = getTotalExpenses(event);
  return `
    <div class="card rounded-xl p-0 cursor-pointer hover:scale-[1.02]" data-action="open-event" data-id="${event.id}">
      <div class="p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="text-3xl">${event.emoji}</div>
            <div>
              <h3 class="font-semibold text-lg text-white hover:text-teal-300 transition-colors">${event.title}</h3>
              <div class="flex items-center gap-4 mt-1 text-slate-400 text-sm">
                <span class="flex items-center gap-1">👥 <span>${event.members.length}</span></span>
                <span class="flex items-center gap-1">🧾 <span>${event.expenses.length}</span></span>
              </div>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-teal-300 bg-teal-900/40 border border-teal-700">${event.currency}</span>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-slate-400 text-sm">Total Expenses</span>
            <span class="font-semibold text-white">${formatCurrency(total, event.currency)}</span>
          </div>
          ${
            event.members.length > 0
              ? `<div class="flex justify-between items-center">
                  <span class="text-slate-400 text-sm">Per Person</span>
                  <span class="text-slate-300 text-sm">${formatCurrency(total / event.members.length, event.currency)}</span>
                </div>`
              : ""
          }
        </div>
        <div class="flex -space-x-2 mt-4">
          ${event.members
            .slice(0, 4)
            .map(
              (m) => `
            <div class="w-8 h-8 rounded-full border-2 border-slate-700 flex items-center justify-center text-xs font-medium text-white" style="background-color:${m.color}">
              ${m.name.charAt(0).toUpperCase()}
            </div>`
            )
            .join("")}
          ${
            event.members.length > 4
              ? `<div class="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-xs font-medium text-slate-300">
                   +${event.members.length - 4}
                 </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function renderCreateEventModal() {
  const emojis = ["🎉", "🍕", "✈️", "🏠", "🍽️", "🎬", "🎵", "🏖️", "🎮", "📚"];
  const currencies = ["৳", "$", "€", "£", "¥", "₹"];
  return `
    <div class="modal-overlay" id="create-event-overlay">
      <div class="modal glass">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold">Create New Event</h3>
          <button data-action="close-create-event" class="text-slate-300 hover:text-white">✕</button>
        </div>
        <form id="create-event-form" class="space-y-4">
          <div>
            <label class="block text-sm text-slate-300 mb-1" for="event-title">Event Title</label>
            <input id="event-title" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500" placeholder="Trip to Cox's Bazar" required />
          </div>

          <div>
            <div class="block text-sm text-slate-300 mb-2">Choose an Emoji</div>
            <div class="grid grid-cols-5 gap-2" id="emoji-grid">
              ${emojis
                .map(
                  (e, i) => `<button type="button" class="emoji-option p-3 text-2xl rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 ${i===0 ? 'selected border-teal-400 bg-teal-600/40' : ''}" data-emoji="${e}">${e}</button>`
                )
                .join("")}
            </div>
            <input type="hidden" id="event-emoji" value="${emojis[0]}" />
          </div>

          <div>
            <div class="block text-sm text-slate-300 mb-1">Currency</div>
            <select id="event-currency" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500">
              ${currencies.map((c) => `<option value="${c}" ${c==="৳"?"selected":""}>${c}</option>`).join("")}
            </select>
          </div>

          <div class="flex gap-3 pt-2">
            <button type="button" class="btn flex-1 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 px-4 py-2" data-action="close-create-event">Cancel</button>
            <button type="submit" class="btn flex-1 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white px-4 py-2">Create Event</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderSettingsModal() {
  return `
    <div class="modal-overlay" id="settings-overlay">
      <div class="modal glass">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold">Settings & Data</h3>
          <button data-action="close-settings" class="text-slate-300 hover:text-white">✕</button>
        </div>
        <div class="space-y-3">
          <button class="btn w-full rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2" data-action="export-json">Export JSON</button>
          <label class="block w-full">
            <span class="block mb-1 text-sm text-slate-300">Import JSON</span>
            <input type="file" accept="application/json" id="import-input" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"/>
          </label>
          <button class="btn w-full rounded-md bg-red-600 hover:bg-red-700 text-white px-4 py-2" data-action="reset-data">Reset All Events</button>
          <div class="pt-2 text-sm text-slate-400">
            V2 ideas: Analytics, Image Upload, Cloud Sync (Firestore), Reminders
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindDashboardEvents() {
  // Open event
  document.querySelectorAll("[data-action='open-event']").forEach((el) =>
    el.addEventListener("click", () => {
      state.currentEventId = el.getAttribute("data-id");
      state.view = "event";
      render();
    })
  );

  // Create event modal
  const openBtn = document.querySelector("[data-action='open-create-event']");
  const overlay = document.getElementById("create-event-overlay");
  const closeBtns = document.querySelectorAll("[data-action='close-create-event']");

  openBtn && openBtn.addEventListener("click", () => overlay.classList.add("show"));
  closeBtns.forEach((b) => b.addEventListener("click", () => overlay.classList.remove("show")));

  // Emoji selection
  const emojiGrid = document.getElementById("emoji-grid");
  const emojiInput = document.getElementById("event-emoji");
  if (emojiGrid && emojiInput) {
    emojiGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".emoji-option");
      if (!btn) return;
      emojiGrid.querySelectorAll(".emoji-option").forEach((x) => x.classList.remove("selected", "border-teal-400", "bg-teal-600/40"));
      btn.classList.add("selected", "border-teal-400", "bg-teal-600/40");
      emojiInput.value = btn.getAttribute("data-emoji");
    });
  }

  // Create event submit
  const form = document.getElementById("create-event-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("event-title").value.trim();
      const emoji = document.getElementById("event-emoji").value;
      const currency = document.getElementById("event-currency").value;
      if (!title) return;

      const newEvent = {
        id: generateId(),
        title,
        emoji,
        currency,
        members: [],
        expenses: [],
        createdAt: new Date().toISOString(),
      };
      state.events = [newEvent, ...state.events];
      writeLS(LS_EVENTS_KEY, state.events);
      overlay.classList.remove("show");
      render();
    });
  }

  // Settings modal
  const settingsOverlay = document.getElementById("settings-overlay");
  const openSettings = document.querySelector("[data-action='open-settings']");
  const closeSettings = document.querySelector("[data-action='close-settings']");
  openSettings && openSettings.addEventListener("click", () => settingsOverlay.classList.add("show"));
  closeSettings && closeSettings.addEventListener("click", () => settingsOverlay.classList.remove("show"));

  // Export
  const exportBtn = document.querySelector("[data-action='export-json']");
  exportBtn &&
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ events: state.events, settled: state.settled }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "event-splitter-data.json";
      a.click();
      URL.revokeObjectURL(url);
    });

  // Import
  const importInput = document.getElementById("import-input");
  importInput &&
    importInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data.events)) {
          state.events = data.events;
          writeLS(LS_EVENTS_KEY, state.events);
        }
        if (data.settled && typeof data.settled === "object") {
          state.settled = data.settled;
          writeLS(LS_SETTLED_KEY, state.settled);
        }
        settingsOverlay.classList.remove("show");
        render();
      } catch {
        alert("Invalid JSON");
      }
    });

  // Reset
  const resetBtn = document.querySelector("[data-action='reset-data']");
  resetBtn &&
    resetBtn.addEventListener("click", () => {
      if (!confirm("Reset all events? This cannot be undone.")) return;
      state.events = [];
      state.settled = {};
      writeLS(LS_EVENTS_KEY, state.events);
      writeLS(LS_SETTLED_KEY, state.settled);
      render();
    });

  // Theme toggle
  const themeBtn = document.querySelector("[data-action='toggle-theme']");
  themeBtn &&
    themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark");
      writeLS(LS_THEME_KEY, isDark ? "dark" : "light");
    });

  // Back not present on dashboard
  const backBtn = document.querySelector("[data-action='go-dashboard']");
  backBtn && backBtn.addEventListener("click", () => {});

  // Auth
  const signinBtn = document.querySelector("[data-action='signin']");
  signinBtn && signinBtn.addEventListener("click", () => signInWithPopup(auth, provider).catch(console.warn));
  const signoutBtn = document.querySelector("[data-action='signout']");
  signoutBtn && signoutBtn.addEventListener("click", () => signOut(auth).catch(console.warn));
}

// Event details
function renderEvent() {
  const event = state.events.find((e) => e.id === state.currentEventId);
  if (!event) {
    state.view = "dashboard";
    render();
    return;
  }
  const total = getTotalExpenses(event);
  const balances = calculateBalances(event);
  const settlements = calculateSettlements(balances);

  $app.innerHTML = `
    ${renderTopBar({ showBack: true })}
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="text-4xl">${event.emoji}</div>
          <div>
            <h2 class="text-2xl font-bold">${event.title}</h2>
            <div class="text-slate-400 text-sm">${event.members.length} members · ${event.expenses.length} expenses</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-slate-400 text-sm">Total</div>
          <div class="text-xl font-semibold">${formatCurrency(total, event.currency)}</div>
        </div>
      </div>

      <!-- Desktop 3-column / Mobile stacked -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Members -->
        <div class="card rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">👥 Members</h3>
            <button class="btn px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600" data-action="add-member">Add</button>
          </div>
          <div id="members-list" class="space-y-2">
            ${event.members
              .map(
                (m) => `
              <div class="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white" style="background:${m.color}">${m.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div class="font-medium">${m.name}</div>
                    <div class="text-xs text-slate-400">${m.role === "admin" ? "Admin" : "Member"}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button class="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" data-action="edit-member" data-id="${m.id}">Edit</button>
                  <button class="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white" data-action="remove-member" data-id="${m.id}">Remove</button>
                </div>
              </div>`
              )
              .join("")}
          </div>
        </div>

        <!-- Expenses -->
        <div class="card rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">💸 Expenses</h3>
            <button class="btn px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white" data-action="add-expense">Add</button>
          </div>
          <div id="expenses-list" class="space-y-2">
            ${event.expenses
              .slice()
              .reverse()
              .map(renderExpenseRow.bind(null, event))
              .join("")}
          </div>
        </div>

        <!-- Summary / Settlement -->
        <div class="card rounded-xl p-4">
          <h3 class="font-semibold mb-3">⚖ Summary & Settlement</h3>
          <div class="space-y-3">
            <div class="rounded-lg border border-slate-700/60 bg-slate-800/60">
              ${balances
                .map((b) => {
                  const m = event.members.find((x) => x.id === b.memberId);
                  return `
                  <div class="flex items-center justify-between p-2 border-b border-slate-700/50 last:border-0">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-full text-[10px] flex items-center justify-center text-white" style="background:${m?.color || "#334155"}">${m?.name?.charAt(0)?.toUpperCase() || "?"}</div>
                      <div class="text-sm">
                        <div class="font-medium">${m?.name || "Unknown"}</div>
                        <div class="text-xs text-slate-400">Paid ${formatCurrency(b.paid, event.currency)} · Share ${formatCurrency(b.share, event.currency)}</div>
                      </div>
                    </div>
                    <div class="text-sm font-semibold ${b.balance >= 0 ? "text-teal-300" : "text-rose-300"}">
                      ${b.balance >= 0 ? "Gets" : "Owes"} ${formatCurrency(Math.abs(b.balance), event.currency)}
                    </div>
                  </div>`;
                })
                .join("")}
            </div>

            <div>
              <h4 class="font-medium mb-2">Settlements</h4>
              <div id="settlements" class="space-y-2">
                ${
                  settlements.length === 0
                    ? `<div class="text-sm text-slate-400">All settled 🎉</div>`
                    : settlements
                        .map((s) => {
                          const from = event.members.find((m) => m.id === s.from)?.name || "Someone";
                          const to = event.members.find((m) => m.id === s.to)?.name || "Someone";
                          const key = `${s.from}->${s.to}`;
                          const paid = !!(state.settled[event.id]?.[key]);
                          return `
                          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                            <div class="text-sm">
                              <span class="mr-2">➡️</span>
                              <b>${from}</b> will pay <b>${to}</b> ${formatCurrency(s.amount, event.currency)}
                            </div>
                            <label class="text-sm flex items-center gap-2">
                              <input type="checkbox" data-action="toggle-paid" data-key="${key}" ${paid ? "checked" : ""}/>
                              <span>Mark as Paid</span>
                            </label>
                          </div>`;
                        })
                        .join("")
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${renderExpenseModal(event)}
    ${renderMemberModal()}
  `;

  bindEventScreen(event);
}
function bindEventScreen(event) {
  // Back to dashboard
  const backBtn = document.querySelector("[data-action='go-dashboard']");
  backBtn &&
    backBtn.addEventListener("click", () => {
      state.view = "dashboard";
      state.currentEventId = null;
      render();
    });

  // Member overlay open/close
  const memberOverlay = document.getElementById("member-overlay");
  const closeMemberBtns = document.querySelectorAll("[data-action='close-member']");
  closeMemberBtns.forEach((b) => b.addEventListener("click", () => memberOverlay.classList.remove("show")));

  const openAddMember = document.querySelector("[data-action='add-member']");
  openAddMember &&
    openAddMember.addEventListener("click", () => {
      document.getElementById("member-modal-title").textContent = "Add Member";
      document.getElementById("member-id").value = "";
      document.getElementById("m-name").value = "";
      document.getElementById("m-role").value = "member";
      document.getElementById("m-color").value = "#14b8a6";
      memberOverlay.classList.add("show");
    });

  // Member edit/remove
  document.querySelectorAll("[data-action='edit-member']").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const m = event.members.find((x) => x.id === id);
      if (!m) return;
      document.getElementById("member-modal-title").textContent = "Edit Member";
      document.getElementById("member-id").value = m.id;
      document.getElementById("m-name").value = m.name;
      document.getElementById("m-role").value = m.role || "member";
      document.getElementById("m-color").value = m.color || "#14b8a6";
      memberOverlay.classList.add("show");
    })
  );

  document.querySelectorAll("[data-action='remove-member']").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      // Safety: block if referenced in expenses
      const used =
        event.expenses.some((ex) => ex.paidBy === id) ||
        event.expenses.some((ex) => (ex.sharedBy || []).includes(id));
      if (used) {
        alert("This member is used in expenses. Edit or remove those expenses first.");
        return;
      }
      if (!confirm("Remove this member?")) return;
      event.members = event.members.filter((m) => m.id !== id);
      persistEvent(event);
      render();
    })
  );

  // Member form submit
  const memberForm = document.getElementById("member-form");
  memberForm &&
    memberForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("member-id").value;
      const name = document.getElementById("m-name").value.trim();
      const role = document.getElementById("m-role").value || "member";
      const color = document.getElementById("m-color").value || "#14b8a6";
      if (!name) return;

      if (id) {
        const idx = event.members.findIndex((m) => m.id === id);
        if (idx >= 0) event.members[idx] = { ...event.members[idx], name, role, color };
      } else {
        event.members.push({ id: generateId(), name, role, color });
      }
      memberOverlay.classList.remove("show");
      persistEvent(event);
      render();
    });

  // Expense overlay open/close
  const expenseOverlay = document.getElementById("expense-overlay");
  const closeExpenseBtns = document.querySelectorAll("[data-action='close-expense']");
  closeExpenseBtns.forEach((b) => b.addEventListener("click", () => expenseOverlay.classList.remove("show")));

  const openAddExpense = document.querySelector("[data-action='add-expense']");
  openAddExpense &&
    openAddExpense.addEventListener("click", () => {
      if (event.members.length === 0) {
        alert("Add at least one member first.");
        return;
      }
      setupExpenseModalMembers(event);
      document.getElementById("expense-modal-title").textContent = "Add Expense";
      document.getElementById("expense-id").value = "";
      document.getElementById("ex-title").value = "";
      document.getElementById("ex-amount").value = "";
      document.getElementById("ex-date").value = new Date().toISOString().slice(0, 10);
      document.getElementById("ex-category").value = "";
      document.getElementById("ex-note").value = "";
      expenseOverlay.classList.add("show");
    });

  // Expense edit/delete
  document.querySelectorAll("[data-action='edit-expense']").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const ex = event.expenses.find((x) => x.id === id);
      if (!ex) return;
      setupExpenseModalMembers(event, ex);
      document.getElementById("expense-modal-title").textContent = "Edit Expense";
      document.getElementById("expense-id").value = ex.id;
      document.getElementById("ex-title").value = ex.title || "";
      document.getElementById("ex-amount").value = ex.amount || 0;
      document.getElementById("ex-date").value = ex.date || new Date().toISOString().slice(0, 10);
      document.getElementById("ex-category").value = ex.category || "";
      document.getElementById("ex-note").value = ex.note || "";
      expenseOverlay.classList.add("show");
    })
  );

  document.querySelectorAll("[data-action='delete-expense']").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this expense?")) return;
      event.expenses = event.expenses.filter((x) => x.id !== id);
      persistEvent(event);
      render();
    })
  );

  // Expense form submit
  const expenseForm = document.getElementById("expense-form");
  expenseForm &&
    expenseForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const eid = document.getElementById("expense-id").value;
      const title = document.getElementById("ex-title").value.trim();
      const amount = parseFloat(document.getElementById("ex-amount").value || "0");
      const date = document.getElementById("ex-date").value;
      const paidBy = document.getElementById("ex-paidBy").value;
      const category = document.getElementById("ex-category").value.trim();
      const note = document.getElementById("ex-note").value.trim();
      const sharedBy = Array.from(document.querySelectorAll("input[name='ex-sharedBy']:checked")).map((i) => i.value);

      if (!title || !Number.isFinite(amount) || amount <= 0 || !paidBy || sharedBy.length === 0) {
        alert("Please fill all required fields (title, amount > 0, paidBy, at least one sharedBy).");
        return;
      }

      const payload = { id: eid || generateId(), title, amount, date, paidBy, sharedBy, category, note };

      if (eid) {
        const idx = event.expenses.findIndex((x) => x.id === eid);
        if (idx >= 0) event.expenses[idx] = payload;
      } else {
        event.expenses.push(payload);
      }

      expenseOverlay.classList.remove("show");
      persistEvent(event);
      render();
    });

  // Settlement toggle
  document.querySelectorAll("input[data-action='toggle-paid']").forEach((cb) =>
    cb.addEventListener("change", () => {
      const key = cb.getAttribute("data-key");
      const evId = event.id;
      state.settled[evId] = state.settled[evId] || {};
      state.settled[evId][key] = cb.checked;
      writeLS(LS_SETTLED_KEY, state.settled);
    })
  );
}

function setupExpenseModalMembers(event, existing) {
  // PaidBy select
  const paidSel = document.getElementById("ex-paidBy");
  paidSel.innerHTML = event.members.map((m, i) => `<option value="${m.id}" ${existing ? (existing.paidBy===m.id?"selected":"") : (i===0?"selected":"")}>${m.name}</option>`).join("");

  // SharedBy checkboxes
  const grid = document.getElementById("ex-sharedBy");
  const existingSet = new Set(existing?.sharedBy || event.members.map((m) => m.id)); // default all
  grid.innerHTML = event.members
    .map(
      (m) => `
      <label class="flex items-center gap-2 p-2 rounded-md bg-slate-800/60 border border-slate-700/60">
        <input type="checkbox" name="ex-sharedBy" value="${m.id}" ${existingSet.has(m.id) ? "checked" : ""}/>
        <span class="text-sm">${m.name}</span>
      </label>`
    )
    .join("");
}


// Persist helper
function persistEvent(event) {
  const idx = state.events.findIndex((e) => e.id === event.id);
  if (idx >= 0) {
    state.events[idx] = event;
    writeLS(LS_EVENTS_KEY, state.events);
  }
}


function renderExpenseRow(event, ex) {
  const payer = event.members.find((m) => m.id === ex.paidBy)?.name || "Unknown";
  const who = (ex.sharedBy || [])
    .map((id) => event.members.find((m) => m.id === id)?.name || "Unknown")
    .join(", ");
  return `
    <div class="flex items-start justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
      <div>
        <div class="font-medium">${ex.title} <span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-700/70">${ex.category || "General"}</span></div>
        <div class="text-xs text-slate-400 mt-0.5">${ex.date || ""}</div>
        <div class="text-xs text-slate-400 mt-1">Paid by <b>${payer}</b> · Shared by <b>${who || "—"}</b></div>
        ${ex.note ? `<div class="text-xs text-slate-300 mt-1">${ex.note}</div>` : ""}
      </div>
      <div class="text-right">
        <div class="font-semibold">${formatCurrency(ex.amount, event.currency)}</div>
        <div class="mt-2 flex items-center gap-2">
          <button class="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" data-action="edit-expense" data-id="${ex.id}">Edit</button>
          <button class="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white" data-action="delete-expense" data-id="${ex.id}">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function renderExpenseModal(event) {
  // Build members list for selects dynamically via JS in binder
  return `
  <div class="modal-overlay" id="expense-overlay">
    <div class="modal glass">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold" id="expense-modal-title">Add Expense</h3>
        <button data-action="close-expense" class="text-slate-300 hover:text-white">✕</button>
      </div>
      <form id="expense-form" class="space-y-3">
        <input type="hidden" id="expense-id" />
        <div>
          <label class="block text-sm text-slate-300 mb-1">Title</label>
          <input id="ex-title" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500" required/>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-slate-300 mb-1">Amount</label>
            <input type="number" min="0" step="0.01" id="ex-amount" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500" required/>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">Date</label>
            <input type="date" id="ex-date" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500"/>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-slate-300 mb-1">Who Paid</label>
            <select id="ex-paidBy" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500"></select>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">Category</label>
            <input id="ex-category" placeholder="Food / Travel / Stay" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500"/>
          </div>
        </div>
        <div>
          <div class="block text-sm text-slate-300 mb-1">Shared By</div>
          <div id="ex-sharedBy" class="grid grid-cols-2 sm:grid-cols-3 gap-2"></div>
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1">Note (optional)</label>
          <textarea id="ex-note" rows="2" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500"></textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" class="btn flex-1 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 px-4 py-2" data-action="close-expense">Cancel</button>
          <button type="submit" class="btn flex-1 rounded-md bg-gradient-to-r from-teal-600
          

  function renderMemberModal() {
      return `
    <div class="modal-overlay" id="member-overlay">
      <div class="modal glass">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold" id="member-modal-title">Add Member</h3>
          <button data-action="close-member" class="text-slate-300 hover:text-white">✕</button>
        </div>
        <form id="member-form" class="space-y-3">
          <input type="hidden" id="member-id" />
          <div>
            <label class="block text-sm text-slate-300 mb-1">Name</label>
            <input id="m-name" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500" required/>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-slate-300 mb-1">Role</label>
              <select id="m-role" class="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">Color</label>
              <input id="m-color" type="color" class="w-full h-10 rounded-md border border-slate-600 bg-slate-800 px-2 py-1"/>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" class="btn flex-1 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 px-4 py-2" data-action="close-member">Cancel</button>
            <button type="submit" class="btn flex-1 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white px-4 py-2">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

