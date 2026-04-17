// ===================== API URL =====================
const API = 'http://localhost:3000/api';

// ===================== STATE =====================
let currentUser    = null;
let allIssues      = [];
let editingTicket  = null;
let isRegistering  = false;
let chartInstances = {};

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  const session = localStorage.getItem('campusdesk_session');
  if (session) {
    currentUser = JSON.parse(session);
    showMainApp();
  }
  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
});

// ===================== LOGIN =====================
function switchLoginTab(tab) {
  document.querySelectorAll('.ltab').forEach((b, i) => {
    b.classList.toggle('active', (tab === 'student' && i === 0) || (tab === 'admin' && i === 1));
  });
  document.getElementById('login-register-toggle').style.display = tab === 'admin' ? 'none' : 'block';
  document.getElementById('register-fields').style.display = 'none';
  isRegistering = false;
  document.getElementById('login-btn').textContent = 'Login →';
}

function toggleRegister() {
  isRegistering = !isRegistering;
  document.getElementById('register-fields').style.display = isRegistering ? 'block' : 'none';
  document.getElementById('login-btn').textContent = isRegistering ? 'Register & Login →' : 'Login →';
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please enter email and password'; return; }

  if (isRegistering) {
    const name = document.getElementById('reg-name').value.trim();
    const roll = document.getElementById('reg-roll').value.trim();
    const role = document.getElementById('reg-role').value;
    const dept = document.getElementById('reg-dept').value;
    if (!name || !roll || !role || !dept) { errEl.textContent = 'Please fill all fields'; return; }

    const res  = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, roll, email, password, role, dept })
    });
    const data = await res.json();
    if (!data.success) { errEl.textContent = data.message; return; }
    currentUser = data.user;
    localStorage.setItem('campusdesk_session', JSON.stringify(currentUser));
    showMainApp();

  } else {
    const res  = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!data.success) { errEl.textContent = data.message; return; }
    currentUser = data.user;
    localStorage.setItem('campusdesk_session', JSON.stringify(currentUser));
    showMainApp();
  }
}

function handleLogout() {
  localStorage.removeItem('campusdesk_session');
  currentUser = null;
  allIssues   = [];
  document.getElementById('main-app').style.display   = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
  showPage('home');
}

async function showMainApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-app').style.display   = 'block';

  if (currentUser.role === 'admin') {
    document.getElementById('nav-admin').style.display    = 'block';
    document.getElementById('nav-raise').style.display    = 'none';
    document.getElementById('nav-newissue').style.display = 'none';
  }

  await loadIssues();
  updateStats();
}

// ===================== LOAD ISSUES FROM MYSQL =====================
async function loadIssues() {
  try {
    let url = `${API}/issues`;
    if (currentUser.role !== 'admin') url = `${API}/issues/user/${currentUser.email}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.success) allIssues = data.issues;
  } catch (e) {
    console.error('Error loading issues:', e);
  }
}

// ===================== SUBCATEGORIES =====================
const subcatMap = {
  'IT & Technical':  ['WiFi / Network Not Working','Lab Computer Issue','Printer Not Working','Projector / Display Issue','Software Installation Request','Email Access Problem','Portal / Website Error','VPN / Remote Access','Hardware Malfunction','Other IT Issue'],
  'Infrastructure':  ['Classroom Cleanliness','Lab Equipment Broken','Power Outage / Electrical Issue','Water Supply Issue','Washroom Maintenance','Furniture Broken','Air Conditioning / Fan Issue','Leakage / Flood','Lighting Issue','Other Infrastructure'],
  'Academic':        ['Timetable Conflict','Attendance Discrepancy','Marks / Grade Error','Exam Schedule Issue','Course Registration Problem','Faculty Absence','Certificate / Transcript Request','Syllabus Related Issue','Other Academic'],
  'Administration':  ['ID Card Issue','Fee Receipt Error','Scholarship Query','NOC Request','Bonafide Letter','Migration Certificate','Character Certificate','Admission Query','Other Admin Issue'],
  'Hostel & Mess':   ['Room Maintenance','Mess Food Quality','Hostel Security Concern','Laundry Service','Water/Electricity in Hostel','Roommate Conflict','Hostel Internet Issue','Other Hostel Issue'],
  'Library':         ['Book Not Available','Library Access Card Issue','Digital Resource Access','Fine Dispute','Noise Complaint','Library Timing','Other Library Issue'],
  'Sports & Events': ['Sports Equipment Request','Ground / Court Booking','Event Permission','Auditorium Booking','Sports Injury Report','Other Sports/Event Issue'],
  'Health & Safety': ['Medical Facility Required','Safety Hazard Report','Harassment Complaint','Emergency Response','Ambulance Request','Mental Health Support','Other Safety Issue'],
  'Other':           ['General Query','Suggestion / Feedback','Other']
};

function updateSubcategory(preset) {
  const cat = preset || document.getElementById('f-category').value;
  const sel = document.getElementById('f-subcategory');
  sel.innerHTML = '<option value="">— Select Sub-Category —</option>';
  if (subcatMap[cat]) subcatMap[cat].forEach(s => {
    const o = document.createElement('option');
    o.value = o.textContent = s;
    sel.appendChild(o);
  });
}

function openCategory(cat) {
  showPage('raise');
  setTimeout(() => { document.getElementById('f-category').value = cat; updateSubcategory(cat); }, 50);
}

// ===================== PRIORITY =====================
let currentPriority = 'medium';
function setPriority(btn) {
  document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPriority = btn.dataset.p;
}

// ===================== SUBMIT ISSUE =====================
async function submitIssue() {
  const name     = document.getElementById('f-name').value.trim();
  const roll     = document.getElementById('f-roll').value.trim();
  const email    = document.getElementById('f-email').value.trim();
  const role     = document.getElementById('f-role').value;
  const dept     = document.getElementById('f-dept').value;
  const category = document.getElementById('f-category').value;
  const subcat   = document.getElementById('f-subcategory').value;
  const title    = document.getElementById('f-title').value.trim();
  const desc     = document.getElementById('f-desc').value.trim();

  if (!name || !roll || !email || !role || !dept || !category || !subcat || !title || !desc) {
    const fc = document.querySelector('.form-card');
    fc.style.animation = 'none'; fc.offsetHeight; fc.style.animation = 'shake 0.4s ease';
    showToast('⚠️ Missing Fields', 'Please fill all required fields', '#f59e0b');
    return;
  }

  const issue = {
    name, roll, email,
    phone:       document.getElementById('f-phone').value.trim(),
    role, dept, category, subcategory: subcat, title,
    description: desc,
    location:    document.getElementById('f-location').value.trim(),
    issue_date:  document.getElementById('f-date').value || new Date().toISOString().split('T')[0],
    deadline:    document.getElementById('f-deadline').value,
    attachment:  document.getElementById('f-attach').value.trim(),
    priority:    currentPriority,
    uid:         currentUser.uid
  };

  try {
    const res  = await fetch(`${API}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issue)
    });
    const data = await res.json();
    if (!data.success) { showToast('❌ Error', data.message, '#ef4444'); return; }

    await loadIssues();
    resetForm();
    updateStats();
    showToast('✅ Issue Submitted!', 'Ticket ' + data.ticket_id + ' saved to MySQL!', '#10b981');
    setTimeout(() => showPage('track'), 1800);
  } catch (e) {
    showToast('❌ Error', 'Server se connect nahi ho pa raha!', '#ef4444');
  }
}

function resetForm() {
  ['f-name','f-roll','f-email','f-phone','f-title','f-desc','f-location','f-deadline','f-attach'].forEach(id => document.getElementById(id).value = '');
  ['f-role','f-dept','f-category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('f-subcategory').innerHTML = '<option value="">— Select Category First —</option>';
  currentPriority = 'medium';
  document.querySelectorAll('.priority-btn').forEach(b => b.classList.toggle('active', b.dataset.p === 'medium'));
}

// ===================== RENDER TICKETS =====================
function renderTickets() {
  const search  = (document.getElementById('search-input')?.value || '').toLowerCase();
  const fStatus = document.getElementById('filter-status')?.value || '';

  let filtered = allIssues.filter(t => {
    const ms  = !search || t.title.toLowerCase().includes(search) || t.roll.toLowerCase().includes(search) || t.category.toLowerCase().includes(search) || t.name.toLowerCase().includes(search) || t.ticket_id.toLowerCase().includes(search);
    const mSt = !fStatus || t.status === fStatus;
    return ms && mSt;
  });

  const sub = document.getElementById('track-subtitle');
  if (sub) sub.textContent = currentUser.role === 'admin' ? 'All issues — ' + filtered.length + ' total' : 'Your submitted issues';

  const container = document.getElementById('tickets-list');
  if (!container) return;
  if (filtered.length === 0) { container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No issues found.</p></div>`; return; }

  container.innerHTML = filtered.map(t => {
    const sc = statusClass(t.status);
    return `<div class="ticket-card" onclick="openModal('${t.ticket_id}')">
      <div class="priority-dot dot-${t.priority}"></div>
      <div class="ticket-id">${t.ticket_id}</div>
      <div class="ticket-info">
        <div class="ticket-title">${t.title}</div>
        <div class="ticket-meta"><span>👤 ${t.name}</span><span>🏷️ ${t.category}</span><span>📅 ${t.issue_date}</span></div>
      </div>
      <span class="status-badge status-${sc}">${t.status}</span>
    </div>`;
  }).join('');
}

// ===================== ADMIN TICKETS =====================
function renderAdminTickets() {
  const search    = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const fStatus   = document.getElementById('admin-filter-status')?.value || '';
  const fPriority = document.getElementById('admin-filter-priority')?.value || '';

  let filtered = allIssues.filter(t => {
    const ms  = !search || t.title.toLowerCase().includes(search) || t.roll.toLowerCase().includes(search) || t.name.toLowerCase().includes(search);
    const mSt = !fStatus   || t.status   === fStatus;
    const mPr = !fPriority || t.priority === fPriority;
    return ms && mSt && mPr;
  });

  const container = document.getElementById('admin-tickets-list');
  if (!container) return;
  if (filtered.length === 0) { container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No issues found.</p></div>`; return; }

  container.innerHTML = filtered.map(t => {
    const sc = statusClass(t.status);
    return `<div class="ticket-card">
      <div class="priority-dot dot-${t.priority}"></div>
      <div class="ticket-id">${t.ticket_id}</div>
      <div class="ticket-info">
        <div class="ticket-title">${t.title}</div>
        <div class="ticket-meta">
          <span>👤 ${t.name} (${t.roll})</span>
          <span>🏷️ ${t.category}</span>
          <span>⚡ ${t.priority}</span>
          ${t.assigned_to ? '<span>📌 ' + t.assigned_to + '</span>' : ''}
        </div>
      </div>
      <div class="ticket-actions">
        <span class="status-badge status-${sc}">${t.status}</span>
        <button class="btn-sm btn-edit" onclick="openAdminEdit('${t.ticket_id}')">✏️ Edit</button>
      </div>
    </div>`;
  }).join('');
}

// ===================== ADMIN EDIT =====================
function openAdminEdit(id) {
  editingTicket = allIssues.find(x => x.ticket_id === id);
  if (!editingTicket) return;
  document.getElementById('admin-modal-id').textContent = editingTicket.ticket_id + ' — ' + editingTicket.title;
  document.getElementById('edit-status').value  = editingTicket.status;
  document.getElementById('edit-assign').value  = editingTicket.assigned_to || '';
  document.getElementById('edit-remark').value  = editingTicket.admin_remark || '';
  document.getElementById('admin-modal-overlay').classList.add('open');
}

async function saveAdminEdit() {
  if (!editingTicket) return;
  const status      = document.getElementById('edit-status').value;
  const assigned_to = document.getElementById('edit-assign').value;
  const admin_remark = document.getElementById('edit-remark').value;

  try {
    const res  = await fetch(`${API}/issues/${editingTicket.ticket_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, assigned_to, admin_remark })
    });
    const data = await res.json();
    if (!data.success) { showToast('❌ Error', data.message, '#ef4444'); return; }

    await loadIssues();
    closeAdminModalDirect();
    renderAdminTickets();
    updateStats();
    showToast('✅ Updated!', 'Ticket ' + editingTicket.ticket_id + ' → ' + status, '#10b981');
  } catch (e) {
    showToast('❌ Error', 'Server se connect nahi ho pa raha!', '#ef4444');
  }
}

function closeAdminModal(e) { if (e.target.id === 'admin-modal-overlay') closeAdminModalDirect(); }
function closeAdminModalDirect() { document.getElementById('admin-modal-overlay').classList.remove('open'); editingTicket = null; }

// ===================== VIEW MODAL =====================
function openModal(id) {
  const t = allIssues.find(x => x.ticket_id === id);
  if (!t) return;
  document.getElementById('modal-ticket-id').textContent = t.ticket_id;
  const sc = statusClass(t.status);
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-grid">
      <div class="modal-field"><div class="modal-label">Name</div><div class="modal-value">${t.name}</div></div>
      <div class="modal-field"><div class="modal-label">Roll No.</div><div class="modal-value">${t.roll}</div></div>
      <div class="modal-field"><div class="modal-label">Email</div><div class="modal-value">${t.email}</div></div>
      <div class="modal-field"><div class="modal-label">Phone</div><div class="modal-value">${t.phone || '—'}</div></div>
      <div class="modal-field"><div class="modal-label">Role</div><div class="modal-value">${t.role}</div></div>
      <div class="modal-field"><div class="modal-label">Department</div><div class="modal-value">${t.dept}</div></div>
    </div>
    <hr class="form-divider"/>
    <div class="modal-grid">
      <div class="modal-field"><div class="modal-label">Category</div><div class="modal-value">${t.category}</div></div>
      <div class="modal-field"><div class="modal-label">Sub-Category</div><div class="modal-value">${t.subcategory}</div></div>
    </div>
    <div class="modal-field"><div class="modal-label">Issue Title</div><div class="modal-value" style="font-weight:600;font-size:1.05rem">${t.title}</div></div>
    <div class="modal-field"><div class="modal-label">Description</div><div class="modal-value" style="line-height:1.7;color:var(--muted)">${t.description}</div></div>
    <div class="modal-grid" style="margin-top:12px">
      <div class="modal-field"><div class="modal-label">Location</div><div class="modal-value">${t.location || '—'}</div></div>
      <div class="modal-field"><div class="modal-label">Date</div><div class="modal-value">${t.issue_date}</div></div>
      <div class="modal-field"><div class="modal-label">Priority</div><div class="modal-value">${t.priority.toUpperCase()}</div></div>
      <div class="modal-field"><div class="modal-label">Status</div><div class="modal-value"><span class="status-badge status-${sc}">${t.status}</span></div></div>
    </div>
    ${t.assigned_to  ? `<div class="modal-field"><div class="modal-label">Assigned To</div><div class="modal-value">${t.assigned_to}</div></div>` : ''}
    ${t.admin_remark ? `<div class="modal-field"><div class="modal-label">Admin Remark</div><div class="modal-value" style="color:var(--accent2)">${t.admin_remark}</div></div>` : ''}
    ${t.attachment   ? `<div class="modal-field"><div class="modal-label">Attachment</div><div class="modal-value"><a href="${t.attachment}" target="_blank" style="color:var(--accent2)">View ↗</a></div></div>` : ''}
    <div class="modal-field" style="margin-top:16px"><div class="modal-label">Submitted At</div><div class="modal-value" style="color:var(--muted);font-size:0.85rem">${new Date(t.created_at).toLocaleString()}</div></div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) { if (e.target.id === 'modal-overlay') closeModalDirect(); }
function closeModalDirect() { document.getElementById('modal-overlay').classList.remove('open'); }

// ===================== DASHBOARD =====================
function renderDashboard() {
  const total    = allIssues.length;
  const open     = allIssues.filter(t => t.status === 'Open').length;
  const inprog   = allIssues.filter(t => t.status === 'In Progress').length;
  const resolved = allIssues.filter(t => t.status === 'Resolved').length;
  const urgent   = allIssues.filter(t => t.priority === 'urgent').length;

  document.getElementById('dash-stats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-label">Total</div><div class="dash-stat-num" style="color:var(--accent2)">${total}</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Open</div><div class="dash-stat-num" style="color:var(--accent)">${open}</div></div>
    <div class="dash-stat"><div class="dash-stat-label">In Progress</div><div class="dash-stat-num" style="color:var(--warning)">${inprog}</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Resolved</div><div class="dash-stat-num" style="color:var(--success)">${resolved}</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Urgent</div><div class="dash-stat-num" style="color:var(--danger)">${urgent}</div></div>
  `;
  buildCharts();

  const recent = allIssues.slice(0, 5);
  const cont   = document.getElementById('dash-recent');
  if (recent.length === 0) { cont.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>No data yet!</p></div>`; return; }
  cont.innerHTML = recent.map(t => {
    const sc = statusClass(t.status);
    return `<div class="ticket-card" onclick="openModal('${t.ticket_id}')">
      <div class="priority-dot dot-${t.priority}"></div>
      <div class="ticket-id">${t.ticket_id}</div>
      <div class="ticket-info"><div class="ticket-title">${t.title}</div><div class="ticket-meta"><span>👤 ${t.name}</span><span>🏷️ ${t.category}</span></div></div>
      <span class="status-badge status-${sc}">${t.status}</span>
    </div>`;
  }).join('');
}

function buildCharts() {
  const cats = {}, stats = {}, pris = {}, depts = {};
  allIssues.forEach(t => {
    cats[t.category]  = (cats[t.category]  || 0) + 1;
    stats[t.status]   = (stats[t.status]   || 0) + 1;
    pris[t.priority]  = (pris[t.priority]  || 0) + 1;
    depts[t.dept]     = (depts[t.dept]     || 0) + 1;
  });
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

  function makeChart(id, type, labels, data) {
    if (chartInstances[id]) chartInstances[id].destroy();
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    chartInstances[id] = new Chart(ctx, {
      type,
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: 'transparent' }] },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#7c8db5', font: { size: 11 } } } },
        scales: type === 'bar' ? { x: { ticks: { color: '#7c8db5' }, grid: { color: '#1e2d45' } }, y: { ticks: { color: '#7c8db5' }, grid: { color: '#1e2d45' } } } : {}
      }
    });
  }
  makeChart('chart-category', 'doughnut', Object.keys(cats),  Object.values(cats));
  makeChart('chart-status',   'doughnut', Object.keys(stats), Object.values(stats));
  makeChart('chart-priority', 'bar',      Object.keys(pris),  Object.values(pris));
  makeChart('chart-dept',     'bar',      Object.keys(depts), Object.values(depts));
}

// ===================== EXPORT PDF =====================
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.setFontSize(18);
  pdf.text('CampusDesk — NIET College', 14, 20);
  pdf.setFontSize(11);
  pdf.text('Issue Report — ' + new Date().toLocaleString(), 14, 30);
  let y = 45;
  pdf.setFontSize(9);
  pdf.text('ID', 14, y); pdf.text('Title', 35, y); pdf.text('Category', 95, y); pdf.text('Status', 140, y); pdf.text('Priority', 168, y);
  y += 5; pdf.line(14, y, 200, y); y += 5;
  allIssues.slice(0, 40).forEach(t => {
    if (y > 270) { pdf.addPage(); y = 20; }
    pdf.text(t.ticket_id, 14, y);
    pdf.text((t.title || '').substring(0, 30), 35, y);
    pdf.text((t.category || '').substring(0, 16), 95, y);
    pdf.text(t.status || '', 140, y);
    pdf.text(t.priority || '', 168, y);
    y += 7;
  });
  pdf.save('CampusDesk_Issues.pdf');
  showToast('📄 PDF Exported!', allIssues.length + ' issues downloaded', '#10b981');
}

// ===================== EXPORT EXCEL =====================
function exportExcel() {
  const data = allIssues.map(t => ({
    'Ticket ID': t.ticket_id, 'Name': t.name, 'Roll No': t.roll,
    'Email': t.email, 'Role': t.role, 'Department': t.dept,
    'Category': t.category, 'Sub-Category': t.subcategory,
    'Title': t.title, 'Description': t.description,
    'Location': t.location, 'Date': t.issue_date,
    'Priority': t.priority, 'Status': t.status,
    'Assigned To': t.assigned_to, 'Admin Remark': t.admin_remark,
    'Created At': t.created_at
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Issues');
  XLSX.writeFile(wb, 'CampusDesk_Issues.xlsx');
  showToast('📊 Excel Exported!', allIssues.length + ' issues downloaded', '#10b981');
}

// ===================== STATS =====================
function updateStats() {
  animateCount('stat-total',    allIssues.length);
  animateCount('stat-resolved', allIssues.filter(x => x.status === 'Resolved').length);
  animateCount('stat-open',     allIssues.filter(x => x.status === 'Open').length);
}
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let n = 0;
  const step = () => { n = Math.min(n + 1, target); el.textContent = n; if (n < target) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ===================== PAGE NAV =====================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'track')     renderTickets();
  if (id === 'dashboard') renderDashboard();
  if (id === 'admin')     renderAdminTickets();
  if (id === 'home')      updateStats();
  window.scrollTo(0, 0);
}

// ===================== TOAST =====================
function showToast(title, sub, color) {
  color = color || '#10b981';
  const t = document.getElementById('toast');
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-sub').textContent   = sub;
  t.style.borderColor = color; t.style.borderLeftColor = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ===================== HELPER =====================
function statusClass(s) {
  return s === 'Open' ? 'open' : s === 'In Progress' ? 'progress' : s === 'Resolved' ? 'resolved' : 'closed';
}
// ===================== AI CHATBOT =====================
function toggleChat() {
  const box = document.getElementById('chat-box');
  box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}

function quickMsg(msg) {
  document.getElementById('chat-input').value = msg;
  sendChat();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = input.value.trim();
  if (!msg) return;

  addChatMsg(msg, 'user');
  input.value = '';

  // Typing indicator
  const typingId = addTyping();

  const reply = await getBotReply(msg);
  removeTyping(typingId);
  addChatMsg(reply, 'bot');
}

function addChatMsg(msg, type) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = type === 'bot' ? 'bot-msg' : 'user-msg';
  div.innerHTML = msg;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function addTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'bot-msg';
  div.id = 'typing-' + Date.now();
  div.innerHTML = '⏳ CampusBot soch raha hai...';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div.id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function getBotReply(msg) {
  const lower = msg.toLowerCase();

  // Issues related
  if (lower.includes('mere issue') || lower.includes('my issue') || lower.includes('ticket')) {
    if (!currentUser) return '🔐 Pehle login karo — phir main aapke issues dikha sakta hun!';
    const count = allIssues.length;
    if (count === 0) return '📭 Abhi aapka koi issue nahi hai. <b>Raise Issue</b> pe jaake naya issue add karo!';
    return `🎫 Aapke <b>${count} issue(s)</b> hain! Track Issues page pe jaao dekhne ke liye.`;
  }

  // WiFi
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('network')) {
    return '📶 <b>WiFi/Network Issue ke liye:</b><br>1. Raise Issue pe jaao<br>2. Category: <b>IT & Technical</b> select karo<br>3. Sub-category: <b>WiFi / Network Not Working</b><br>4. Location aur description bharo<br>5. Submit karo! IT Department resolve karega. ✅';
  }

  // Attendance
  if (lower.includes('attendance') || lower.includes('absent')) {
    return '📋 <b>Attendance Issue ke liye:</b><br>1. Raise Issue pe jaao<br>2. Category: <b>Academic</b> select karo<br>3. Sub-category: <b>Attendance Discrepancy</b><br>4. Detail mein explain karo<br>5. Academic Office resolve karega! ✅';
  }

  // Fee
  if (lower.includes('fee') || lower.includes('receipt') || lower.includes('payment')) {
    return '💰 <b>Fee/Receipt Issue ke liye:</b><br>1. Raise Issue pe jaao<br>2. Category: <b>Administration</b><br>3. Sub-category: <b>Fee Receipt Error</b><br>4. Submit karo — Admin Office contact karega! ✅';
  }

  // Marks
  if (lower.includes('marks') || lower.includes('grade') || lower.includes('result')) {
    return '📊 <b>Marks/Grade Issue ke liye:</b><br>1. Category: <b>Academic</b><br>2. Sub-category: <b>Marks / Grade Error</b><br>3. Exam name aur roll number mention karo<br>4. Faculty resolve karega! ✅';
  }

  // Hostel
  if (lower.includes('hostel') || lower.includes('mess') || lower.includes('room')) {
    return '🏠 <b>Hostel/Mess Issue ke liye:</b><br>1. Category: <b>Hostel & Mess</b> select karo<br>2. Apni problem sub-category mein dhundho<br>3. Room number zaroor likho<br>4. Hostel Office resolve karega! ✅';
  }

  // Library
  if (lower.includes('library') || lower.includes('book') || lower.includes('fine')) {
    return '📖 <b>Library Issue ke liye:</b><br>1. Category: <b>Library</b> select karo<br>2. Book name ya problem detail mein likho<br>3. Library staff resolve karega! ✅';
  }

  // ID Card
  if (lower.includes('id card') || lower.includes('identity')) {
    return '🪪 <b>ID Card Issue ke liye:</b><br>1. Category: <b>Administration</b><br>2. Sub-category: <b>ID Card Issue</b><br>3. Admin Office se contact hoga! ✅';
  }

  // Status
  if (lower.includes('status') || lower.includes('resolved') || lower.includes('pending')) {
    return '🔍 <b>Issue Status check karne ke liye:</b><br>1. Upar <b>Track Issues</b> pe click karo<br>2. Apna ticket ID ya name se search karo<br>3. Status badge dekho — Open/In Progress/Resolved!';
  }

  // Admin
  if (lower.includes('admin') || lower.includes('login')) {
    return '⚙️ <b>Admin Login:</b><br>Email: <b>admin@niet.ac.in</b><br>Password: <b>admin123</b><br><br>Admin issues manage kar sakta hai, status change kar sakta hai!';
  }

  // Help
  if (lower.includes('help') || lower.includes('kya kar') || lower.includes('how')) {
    return '🤖 <b>Main aapki help kar sakta hun:</b><br>• WiFi/Network problem<br>• Attendance issue<br>• Fee/Receipt problem<br>• Marks/Grade error<br>• Hostel/Mess complaint<br>• Library issue<br>• ID Card problem<br><br>Koi bhi topic likhо! 😊';
  }

  // Hello
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('helo') || lower.includes('hey')) {
    return `👋 Hello ${currentUser?.name || 'Student'}! Main CampusDesk ka AI Assistant hun. Aapki kya problem hai? Issue raise karne mein help chahiye? 😊`;
  }

  // Thanks
  if (lower.includes('thanks') || lower.includes('thank') || lower.includes('shukriya') || lower.includes('dhanyawad')) {
    return '😊 Aapka swagat hai! Koi aur problem ho toh zaroor batao. CampusDesk hamesha aapke saath hai! 🎓';
  }

  // Default
  return `🤔 Samajh nahi aaya! Try karo:<br>• "WiFi issue"<br>• "Attendance problem"<br>• "Mere issues dikhao"<br>• "Fee receipt chahiye"<br><br>Ya seedha <b>Raise Issue</b> pe jaao! 😊`;
}