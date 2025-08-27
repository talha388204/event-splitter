// Event Splitter — app.js (deploy-ready)

// ---- Storage & State -------------------------------------------------------
const STORAGE_KEY = "event_splitter_v1";

const State = {
  data: load(),
  ui: {
    currentView: "home", // 'home' | 'event' | 'settings'
    currentEventId: null,
  },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    events: [],
    settings: { theme: "dark", locale: "en" },
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(State.data));
}

// ---- Utilities -------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtAmt = (v, cur) => `${cur} ${Number(v || 0).toFixed(2)}`;
const uid = () => Math.random().toString(36).slice(2, 10);

function initials(name) {
  return name?.trim()?.split(/\s+/).map(s => s[0]).slice(0,2).join("").toUpperCase() || "?";
}

function toast(msg) {
  const t = $("#toast");
  if (!t) return alert(msg);
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function setTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  State.data.settings.theme = mode;
  save();
}

// ---- Routing ---------------------------------------------------------------
function goHome() {
  State.ui.currentView = "home";
  State.ui.currentEventId = null;
  render();
}

function openEvent(id) {
  State.ui.currentView = "event";
  State.ui.currentEventId = id;
  render();
}

function openSettings() {
  State.ui.currentView = "settings";
  render();
}

// ---- Render Root -----------------------------------------------------------
function render() {
  const app = $("#app");
  const view = State.ui.currentView;
  if (view === "home") renderHome(app);
  if (view === "event") renderEvent(app);
  if (view === "settings") renderSettings(app);
}

// ---- Home view -------------------------------------------------------------
function renderHome(app) {
  const events = State.data.events;
  app.innerHTML = "";

  if (!events.length) {
    const card = document.createElement("div");
    card.className = "card empty";
    card.innerHTML = `
      <div class="emoji">🎉</div>
      <h3>No events yet</h3>
      <p>Create your first event to start splitting expenses with friends and family</p>
      <div><button class="btn primary" id="createEventBtn">＋ Create new event</button></div>
    `;
    app.appendChild(card);
  } else {
    const header = document.createElement("div");
    header.className = "card card-header";
    header.innerHTML = `
      <div class="card-title">Your events</div>
      <button class="btn primary" id="createEventBtn">＋ Create new event</button>
    `;
    app.appendChild(header);

    const wrap = document.createElement("div");
    wrap.className = "grid grid-2";
    events
      .slice()
      .sort((a,b)=> (b.createdAt||0)-(a.createdAt||0))
      .forEach(ev => {
        const total = ev.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const card = document.createElement("div");
        card.className = "card event-card";
        card.innerHTML = `
          <div class="event-emoji">${ev.emoji || "📅"}</div>
          <div class="event-meta">
            <div class="title">${ev.title}</div>
            <div class="line">
              <span>${ev.currency}</span>
              <span>•</span>
              <span>${ev.members.length} members</span>
              <span>•</span>
              <span>Total: <span class="mono">${fmtAmt(total, ev.currency)}</span></span>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn">Open</button>
          </div>
        `;
        card.querySelector(".btn").addEventListener("click", () => openEvent(ev.id));
        wrap.appendChild(card);
      });
    app.appendChild(wrap);
  }

  // Wire create buttons
  const c1 = $("#createEventBtn");
  const fab = $("#globalFab");
  if (c1) c1.onclick = () => showEventModal();
  if (fab) {
    fab.onclick = () => showEventModal();
    fab.setAttribute("aria-label", "Create event");
  }
}

// ---- Event helpers ---------------------------------------------------------
function getCurrentEvent() {
  return State.data.events.find(e => e.id === State.ui.currentEventId);
}

// ---- Event view ------------------------------------------------------------
function renderEvent(app) {
  const ev = getCurrentEvent();
  if (!ev) return goHome();
  app.innerHTML = "";

  // Mobile tabs
  const tabs = document.createElement("div");
  tabs.className = "tabs";
  tabs.innerHTML = `
    <div class="tab active" data-tab="members">Members</div>
    <div class="tab" data-tab="expenses">Expenses</div>
    <div class="tab" data-tab="summary">Summary</div>
  `;
  app.appendChild(tabs);

  // Header
  const head = document.createElement("div");
  head.className = "card card-header";
  head.innerHTML = `
    <div class="card-title">
      <button class="btn ghost" id="backBtn">← Back</button>
      <span style="margin-left:8px">${ev.emoji || "📅"} <strong>${ev.title}</strong> <span class="subtle">• ${ev.currency}</span></span>
    </div>
    <div class="row-actions">
      <button class="btn" id="exportBtn">Export JSON</button>
      <button class="btn danger" id="resetBtn">Reset event</button>
    </div>
  `;
  app.appendChild(head);

  // Panels container
  const panels = document.createElement("div");
  panels.className = "panels";

  // Members panel
  const p1 = document.createElement("div");
  p1.className = "card";
  p1.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">👥 Members (${ev.members.length})</div>
      <div class="row-actions">
        <button class="btn" id="addMemberBtn">＋ Add member</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="list" id="memberList"></div>
    </div>
  `;

  // Expenses panel
  const p2 = document.createElement("div");
  p2.className = "card";
  p2.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">💸 Expenses (${ev.expenses.length})</div>
      <div class="row-actions">
        <button class="btn primary" id="addExpenseBtn">＋ Add expense</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="list" id="expenseList"></div>
    </div>
  `;

  // Summary panel
  const p3 = document.createElement("div");
  p3.className = "card";
  p3.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">📊 Summary & Settlement</div>
    </div>
    <div class="panel-body" id="summaryPanel"></div>
  `;

  panels.appendChild(p1); panels.appendChild(p2); panels.appendChild(p3);
  app.appendChild(panels);

  // FAB repurposed to add expense inside event
  const fab = $("#globalFab");
  if (fab) {
    fab.onclick = () => showExpenseModal(ev.id);
    fab.setAttribute("aria-label", "Add expense");
  }

  // Bind header actions
  $("#backBtn").onclick = goHome;
  $("#exportBtn").onclick = () => exportEvent(ev);
  $("#resetBtn").onclick = () => {
    if (confirm("Reset this event? This removes all members and expenses.")) {
      ev.members = [];
      ev.expenses = [];
      save(); render();
    }
  };

  // Populate members
  const memberList = $("#memberList");
  if (!ev.members.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = `
      <div class="emoji">🫂</div>
      <h3>No members yet</h3>
      <p>Add members to start tracking expenses</p>
      <div><button class="btn" id="addFirstMemberBtn">＋ Add first member</button></div>
    `;
    memberList.appendChild(empty);
    empty.querySelector("#addFirstMemberBtn").onclick = () => showMemberModal(ev.id);
  } else {
    ev.members.forEach(m => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="left">
          <div class="avatar" style="background:${m.color || '#9cf0f2'}">${initials(m.name)}</div>
          <div>
            <div><strong contenteditable="true" data-inline="memberName" data-id="${m.id}">${m.name}</strong></div>
            <div class="subtle">${m.role === "admin" ? '<span class="badge admin">Admin</span>' : '<span class="badge">Member</span>'}</div>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn" data-edit="${m.id}">Edit</button>
          <button class="btn danger" data-remove="${m.id}">Remove</button>
        </div>
      `;
      memberList.appendChild(row);

      row.querySelector('[data-inline="memberName"]').addEventListener("blur", (e) => {
        m.name = e.target.textContent.trim() || m.name;
        save(); render(); // refresh initials
      });
      row.querySelector(`[data-edit="${m.id}"]`).onclick = () => showMemberModal(ev.id, m.id);
      row.querySelector(`[data-remove="${m.id}"]`).onclick = () => removeMember(ev, m.id);
    });
  }

  // Populate expenses
  const expenseList = $("#expenseList");
  if (!ev.expenses.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = `
      <div class="emoji">🧾</div>
      <h3>No expenses yet</h3>
      <p>Add members first, then add expenses</p>
      <div><button class="btn primary" id="addFirstExpenseBtn">＋ Add expense</button></div>
    `;
    expenseList.appendChild(empty);
    empty.querySelector("#addFirstExpenseBtn").onclick = () => showExpenseModal(ev.id);
  } else {
    ev.expenses.slice().reverse().forEach(exp => {
      const payer = ev.members.find(m => m.id === exp.paidBy)?.name || "Unknown";
      const sharedNames = exp.sharedBy.map(id => ev.members.find(m => m.id === id)?.name || "?").join(", ");
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="left">
          <div class="chip">${exp.category}</div>
          <div>
            <div><strong contenteditable="true" data-inline="expenseTitle" data-id="${exp.id}">${exp.title}</strong></div>
            <div class="subtle">${exp.date} • Paid by ${payer} • Shared by ${sharedNames}</div>
          </div>
        </div>
        <div class="row-actions">
          <div class="mono" style="margin-right:8px">${fmtAmt(exp.amount, ev.currency)}</div>
          <button class="btn" data-edit-exp="${exp.id}">Edit</button>
          <button class="btn danger" data-del-exp="${exp.id}">Delete</button>
        </div>
      `;
      expenseList.appendChild(row);

      row.querySelector('[data-inline="expenseTitle"]').addEventListener("blur", (e) => {
        exp.title = e.target.textContent.trim() || exp.title;
        save();
      });
      row.querySelector(`[data-edit-exp="${exp.id}"]`).onclick = () => showExpenseModal(ev.id, exp.id);
      row.querySelector(`[data-del-exp="${exp.id}"]`).onclick = () => {
        if (confirm("Delete this expense?")) {
          ev.expenses = ev.expenses.filter(x => x.id !== exp.id);
          save(); render();
        }
      };
    });
  }

  // Summary
  renderSummary(ev, $("#summaryPanel"));

  // Tabs behavior (mobile)
  const tabEls = $$(".tab");
  const panelEls = [p1, p2, p3];
  tabEls.forEach((t, i) => t.addEventListener("click", () => {
    tabEls.forEach(el => el.classList.remove("active"));
    t.classList.add("active");
    if (window.matchMedia("(max-width: 1023px)").matches) {
      panelEls.forEach((p, idx) => p.style.display = (idx === i ? "block" : "none"));
    }
  }));
  if (window.matchMedia("(max-width: 1023px)").matches) {
    p1.style.display = "block"; p2.style.display = "none"; p3.style.display = "none";
  }

  // Bind add buttons
  $("#addMemberBtn").onclick = () => showMemberModal(ev.id);
  $("#addExpenseBtn").onclick = () => showExpenseModal(ev.id);
}

// ---- Summary & Settlement --------------------------------------------------
function computeSummary(ev) {
  const memberIds = ev.members.map(m => m.id);
  const paidMap = Object.fromEntries(memberIds.map(id => [id, 0]));
  const shareMap = Object.fromEntries(memberIds.map(id => [id, 0]));

  ev.expenses.forEach(exp => {
    const amount = Number(exp.amount || 0);
    if (exp.paidBy && paidMap[exp.paidBy] != null) paidMap[exp.paidBy] += amount;

    const sharers = (exp.sharedBy && exp.sharedBy.length) ? exp.sharedBy : memberIds;
    const validSharers = sharers.filter(id => shareMap[id] != null);
    const split = validSharers.length ? amount / validSharers.length : 0;
    validSharers.forEach(id => { shareMap[id] += split; });
  });

  const balances = memberIds.map(id => ({
    id,
    name: ev.members.find(m => m.id === id)?.name || "?",
    paid: paidMap[id],
    share: shareMap[id],
    balance: (paidMap[id] - shareMap[id]) // + means others owe them
  }));

  return { balances, settlements: minimizeCashFlow(balances) };
}

function minimizeCashFlow(balances) {
  const creditors = [];
  const debtors = [];
  balances.forEach(b => {
    const v = Number(b.balance.toFixed(2));
    if (v > 0.009) creditors.push({ id: b.id, name: b.name, amount: v });
    if (v < -0.009) debtors.push({ id: b.id, name: b.name, amount: -v });
  });
  creditors.sort((a,b) => b.amount - a.amount);
  debtors.sort((a,b) => b.amount - a.amount);

  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    const pay = Math.min(d.amount, c.amount);
    settlements.push({ from: d.id, fromName: d.name, to: c.id, toName: c.name, amount: Number(pay.toFixed(2)) });
    d.amount -= pay; c.amount -= pay;
    if (d.amount <= 0.009) i++;
    if (c.amount <= 0.009) j++;
  }
  return settlements;
}

function renderSummary(ev, container) {
  container.innerHTML = "";
  const { balances, settlements } = computeSummary(ev);

  // Totals
  const total = ev.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const head = document.createElement("div");
  head.innerHTML = `
    <div class="row">
      <div>Total expenses</div>
      <div class="mono"><strong>${fmtAmt(total, ev.currency)}</strong></div>
    </div>
  `;
  container.appendChild(head);

  // Person-wise
  const list = document.createElement("div");
  list.className = "list";
  balances.forEach(b => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="left">
        <div><strong>${b.name}</strong></div>
      </div>
      <div class="row-actions">
        <span class="subtle">Paid</span> <span class="mono">${fmtAmt(b.paid, ev.currency)}</span>
        <span class="subtle" style="margin-left:8px">Share</span> <span class="mono">${fmtAmt(b.share, ev.currency)}</span>
        <span class="subtle" style="margin-left:8px">Balance</span>
        <span class="mono" style="color:${b.balance >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmtAmt(b.balance, ev.currency)}</span>
      </div>
    `;
    list.appendChild(row);
  });
  container.appendChild(list);

  container.appendChild(divider());

  // Settlement suggestions
  const setTitle = document.createElement("div");
  setTitle.className = "subtle";
  setTitle.textContent = "Suggested settlements";
  container.appendChild(setTitle);

  if (!settlements.length) {
    const done = document.createElement("div");
    done.className = "empty";
    done.innerHTML = `
      <div class="emoji">✅</div>
      <h3>All settled</h3>
      <p>No one owes anything.</p>
    `;
    container.appendChild(done);
  } else {
    const list2 = document.createElement("div");
    list2.className = "list";
    settlements.forEach(s => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="left">
          <div class="chip">Pay</div>
          <div><strong>${s.fromName}</strong> ➜ <strong>${s.toName}</strong></div>
        </div>
        <div class="row-actions">
          <div class="mono" style="margin-right:8px">${fmtAmt(s.amount, ev.currency)}</div>
          <button class="btn" data-mark="paid">Mark as paid</button>
        </div>
      `;
      row.querySelector('[data-mark="paid"]').onclick = () => {
        row.style.opacity = 0.5;
        row.querySelector('[data-mark="paid"]').disabled = true;
        confetti();
      };
      list2.appendChild(row);
    });
    container.appendChild(list2);
  }
}

function divider() {
  const d = document.createElement("div");
  d.className = "hr";
  return d;
}

// ---- Modals core -----------------------------------------------------------
function showBackdrop(show) {
  const bd = $("#modalBackdrop");
  if (!bd) return;
  bd.hidden = !show;
  if (show) bd.onclick = closeAllModals;
  else bd.onclick = null;
}

function openModal(id) {
  showBackdrop(true);
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
  showBackdrop(false);
}

function closeAllModals() {
  ["eventModal","memberModal","expenseModal"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  showBackdrop(false);
}

// ---- Modals: Event ---------------------------------------------------------
const EMOJIS = ["🏖️","🎉","🧳","🎮","🎵","🍽️","🚌","🏕️","🏙️","🏟️","🏝️","🍔","🍕","🍛","🍣","🍻","☕","🛍️","🎂","🧉"];

function showEventModal() {
  const picker = $("#emojiPicker");
  if (picker) {
    picker.innerHTML = "";
    EMOJIS.forEach((emo, idx) => {
      const it = document.createElement("div");
      it.className = "emoji-item" + (idx === 0 ? " active" : "");
      it.textContent = emo;
      it.onclick = () => {
        $$(".emoji-item").forEach(e => e.classList.remove("active"));
        it.classList.add("active");
        const hidden = $('#eventForm [name="emoji"]');
        if (hidden) hidden.value = emo;
      };
      picker.appendChild(it);
    });
  }

  const form = $("#eventForm");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = (fd.get("title") || "").toString().trim();
      if (!title) return toast("Title required");
      const ev = {
        id: uid(),
        title,
        emoji: fd.get("emoji") || "📅",
        currency: fd.get("currency") || "BDT",
        members: [],
        expenses: [],
        createdAt: Date.now(),
      };
      State.data.events.push(ev);
      save();
      closeModal("eventModal");
      toast("Event created");
      openEvent(ev.id);
    };
  }

  $$('[data-close="eventModal"]').forEach(b => b.onclick = () => closeModal("eventModal"));
  openModal("eventModal");
}

// ---- Modals: Member --------------------------------------------------------
const COLORS = ["#9cf0f2","#a78bfa","#f472b6","#60a5fa","#34d399","#fbbf24","#fb7185","#f59e0b","#22d3ee","#c7d2fe"];

function showMemberModal(eventId, memberId = null) {
  const ev = State.data.events.find(e => e.id === eventId);
  if (!ev) return;

  const form = $("#memberForm");
  const title = $("#memberModalTitle");
  const colorPicker = $("#colorPicker");
  if (!form || !title || !colorPicker) return;

  form.reset();
  colorPicker.innerHTML = "";

  // Populate color choices
  COLORS.forEach((c, idx) => {
    const it = document.createElement("div");
    it.className = "color-item" + (idx === 0 ? " active" : "");
    it.style.background = c;
    it.onclick = () => {
      $$(".color-item").forEach(e => e.classList.remove("active"));
      it.classList.add("active");
      form.color.value = c;
    };
    colorPicker.appendChild(it);
  });
  form.color.value = COLORS[0];

  if (memberId) {
    const m = ev.members.find(x => x.id === memberId);
    if (!m) return;
    title.textContent = "Edit member";
    form.memberId.value = m.id;
    form.name.value = m.name;
    form.role.value = m.role;
    form.color.value = m.color || COLORS[0];
    // highlight selected color
    $$(".color-item").forEach(el => {
      if (el.style.background === m.color) el.classList.add("active");
      else el.classList.remove("active");
    });
  } else {
    title.textContent = "Add new member";
    form.memberId.value = "";
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const id = fd.get("memberId");
    const name = (fd.get("name") || "").toString().trim();
    if (!name) return toast("Name required");

    const payload = {
      id: id || uid(),
      name,
      role: fd.get("role"),
      color: fd.get("color"),
    };
    if (id) {
      const idx = ev.members.findIndex(m => m.id === id);
      if (idx >= 0) ev.members[idx] = { ...ev.members[idx], ...payload };
    } else {
      ev.members.push(payload);
    }
    save(); closeModal("memberModal"); render();
  };

  $$('[data-close="memberModal"]').forEach(b => b.onclick = () => closeModal("memberModal"));
  openModal("memberModal");
}

// ---- Modals: Expense -------------------------------------------------------
function showExpenseModal(eventId, expenseId = null) {
  const ev = State.data.events.find(e => e.id === eventId);
  if (!ev) return;

  if (!ev.members.length) {
    toast("Add members first");
    return;
  }

  const form = $("#expenseForm");
  const paidBySel = form?.paidBy;
  const sharedBox = $("#sharedByList");
  if (!form || !paidBySel || !sharedBox) return;

  form.reset();
  sharedBox.innerHTML = "";

  // Build member checkboxes
  ev.members.forEach(m => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.gap = "8px";
    label.style.alignItems = "center";
    label.innerHTML = `<input type="checkbox" name="sharedBy" value="${m.id}" checked> ${m.name}`;
    sharedBox.appendChild(label);
  });

  // PaidBy dropdown
  paidBySel.innerHTML = "";
  ev.members.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    paidBySel.appendChild(opt);
  });

  // If editing, hydrate values
  if (expenseId) {
    const exp = ev.expenses.find(x => x.id === expenseId);
    if (!exp) return;
    form.expenseId.value = exp.id;
    form.title.value = exp.title;
    form.amount.value = exp.amount;
    form.date.value = exp.date;
    form.paidBy.value = exp.paidBy;
    form.category.value = exp.category;
    form.note.value = exp.note || "";
    $$('#sharedByList input[type="checkbox"]').forEach(cb => {
      cb.checked = exp.sharedBy.includes(cb.value);
    });
  } else {
    form.expenseId.value = "";
    form.date.value = new Date().toISOString().split("T")[0];
    // default paidBy to first member
    if (ev.members[0]) paidBySel.value = ev.members[0].id;
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const id = fd.get("expenseId");
    const title = (fd.get("title") || "").toString().trim();
    const amount = parseFloat((fd.get("amount") || "0").toString().replace(",", "."));
    const date = fd.get("date");
    const paidBy = fd.get("paidBy");
    const sharedBy = fd.getAll("sharedBy");
    const category = fd.get("category");
    const note = fd.get("note") || "";

    if (!title) return toast("Title required");
    if (!(amount >= 0)) return toast("Enter valid amount");
    if (!sharedBy.length) return toast("Select at least one person");

    const payload = {
      id: id || uid(),
      title, amount, date, paidBy, sharedBy, category, note
    };

    if (id) {
      const idx = ev.expenses.findIndex(x => x.id === id);
      if (idx >= 0) ev.expenses[idx] = { ...ev.expenses[idx], ...payload };
    } else {
      ev.expenses.push(payload);
    }
    save();
    closeModal("expenseModal");
    render();
  };

  $$('[data-close="expenseModal"]').forEach(b => b.onclick = () => closeModal("expenseModal"));
  openModal("expenseModal");
}

// ---- Helpers: members, export, confetti -----------------------------------
function removeMember(ev, memberId) {
  const member = ev.members.find(m => m.id === memberId);
  if (!member) return;
  if (!confirm(`Remove ${member.name}? Expenses paid by them will show as "Unknown".`)) return;

  // Remove from members
  ev.members = ev.members.filter(m => m.id !== memberId);

  // Clean expenses: remove from sharedBy; keep expense even if empty — summary defaults to all members
  ev.expenses.forEach(exp => {
    exp.sharedBy = (exp.sharedBy || []).filter(id => id !== memberId);
    if (exp.paidBy === memberId) exp.paidBy = null;
  });

  save();
  render();
}

function exportEvent(ev) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ev, null, 2));
  const dl = document.createElement("a");
  dl.href = dataStr;
  dl.download = `${ev.title}.json`;
  document.body.appendChild(dl);
  dl.click();
  dl.remove();
}

function confetti() {
  // Minimal celebratory feedback
  toast("🎉 Settlement marked as paid!");
}

// ---- Settings view ---------------------------------------------------------
function renderSettings(app) {
  app.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">Settings</div>
    </div>
    <div class="panel-body">
      <div class="row">
        <div>Theme</div>
        <div class="row-actions">
          <button class="btn" id="toggleThemeBtn">Toggle Dark/Light</button>
        </div>
      </div>
      <div class="row">
        <div>Export all data</div>
        <div class="row-actions">
          <button class="btn" id="exportAllBtn">Export JSON</button>
        </div>
      </div>
      <div class="row">
        <div>Import data</div>
        <div class="row-actions">
          <input type="file" id="importFile" accept="application/json" />
        </div>
      </div>
      <div class="row">
        <div>Reset app</div>
        <div class="row-actions">
          <button class="btn danger" id="resetAppBtn">Reset</button>
        </div>
      </div>
    </div>
  `;
  app.appendChild(card);

  $("#toggleThemeBtn").onclick = () => {
    setTheme(State.data.settings.theme === "dark" ? "light" : "dark");
  };

  $("#exportAllBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(State.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "event-splitter-backup.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  $("#importFile").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || typeof json !== "object") throw new Error();
      State.data = json;
      save();
      toast("Imported successfully");
      goHome();
    } catch {
      toast("Invalid file");
    } finally {
      e.target.value = "";
    }
  };

  $("#resetAppBtn").onclick = () => {
    if (confirm("Reset all data? This cannot be undone.")) {
      State.data = { events: [], settings: { theme: "dark", locale: "en" } };
      save();
      toast("App reset");
      goHome();
    }
  };
}

// ---- Global bindings -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Initial theme + first render
  setTheme(State.data.settings.theme || "dark");
  render();

  // Topbar buttons
  const themeToggle = $("#themeToggle");
  if (themeToggle) {
    themeToggle.onclick = () => {
      setTheme(State.data.settings.theme === "dark" ? "light" : "dark");
    };
  }
  const settingsBtn = $("#settingsBtn");
  if (settingsBtn) settingsBtn.onclick = () => openSettings();

  // Bottom nav
  $$('.bn-item').forEach(btn => {
    btn.onclick = () => {
      const nav = btn.getAttribute("data-nav");
      if (nav === "home") goHome();
      else if (nav === "settings") openSettings();
    };
  });

  // Close modals with Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
});
