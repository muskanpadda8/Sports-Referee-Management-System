/* =========================================================
   RefereePro – Sports Tournament Referee Management System
   script.js  (Vanilla JavaScript, no libraries)

   Sections:
   1.  Constants, state & storage
   2.  Utility helpers
   3.  Sample (seed) data
   4.  Core business logic (availability, conflicts, allocation)
   5.  Notifications, modals & validation helpers
   6.  Renderers (one per module)
   7.  CRUD handlers (referees, matches, slots)
   8.  CSV export
   9.  Event wiring & initialisation
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   1. CONSTANTS, STATE & STORAGE
   --------------------------------------------------------- */
const STORAGE_KEY = 'refereepro_data_v1';
const THEME_KEY   = 'refereepro_theme';
const SPORTS = ['Football', 'Cricket', 'Basketball', 'Volleyball', 'Badminton', 'Hockey'];
const VIEW_TITLES = {
  dashboard: 'Dashboard', referees: 'Referee Management', availability: 'Referee Availability',
  matches: 'Match Management', allocation: 'Referee Allocation', conflicts: 'Conflict Detection',
  history: 'Assignment History', reports: 'Reports & Export'
};

let state = null;            // { referees, matches, history, conflictLog }
const ui = {                 // transient UI state (not saved)
  matchTab: 'all',
  assignMatchId: null,
  assignReplaceRef: null,
  confirmCb: null
};

/** Save the whole state to localStorage. */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save data (storage full or blocked).', 'error'); }
}

/** Load state from localStorage, or create sample data on first run. */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.referees) && Array.isArray(d.matches)) {
        d.history = d.history || [];
        d.conflictLog = d.conflictLog || [];
        return d;
      }
    }
  } catch (e) { /* corrupted data – fall through to seed */ }
  return seedData();
}

/* ---------------------------------------------------------
   2. UTILITY HELPERS
   --------------------------------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD" in LOCAL time (avoids UTC off-by-one issues). */
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dstr(new Date());
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`; };
const fmtRange = (s, e) => `${fmtTime(s)} – ${fmtTime(e)}`;
const fmtDate = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtStamp = iso => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Escape user text before inserting into HTML (prevents HTML injection). */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const getRef   = id => state.referees.find(r => r.id === id);
const getMatch = id => state.matches.find(m => m.id === id);

/** A match is completed once its end date-time has passed. */
function isCompleted(m) {
  const [y, mo, d] = m.date.split('-').map(Number);
  const [h, mi] = m.end.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi) < new Date();
}
const sortByTime = (a, b) => (a.date + a.start).localeCompare(b.date + b.start);

/** Assignment status of a match based on required vs assigned referees. */
function assignStatus(m) {
  const n = m.refereeIds.length;
  if (n === 0) return 'Unassigned';
  if (n < m.required) return 'Partially Assigned';
  return 'Fully Assigned';
}
const statusBadge = s => `<span class="badge ${s === 'Fully Assigned' ? 'success' : s === 'Partially Assigned' ? 'warning' : 'danger'}">${s}</span>`;
const sportBadge = s => `<span class="badge info">${esc(s)}</span>`;

/** Number of upcoming (not completed) matches a referee is assigned to. */
const workload = refId => state.matches.filter(m => m.refereeIds.includes(refId) && !isCompleted(m)).length;

/* ---------------------------------------------------------
   3. SAMPLE (SEED) DATA
   --------------------------------------------------------- */
function seedData() {
  const R = [
    ['REF-001', 'Rajesh Kumar',     '9876543210', 'rajesh.kumar@example.com',   'Football',   12],
    ['REF-002', 'Amandeep Singh',   '9815012345', 'amandeep.singh@example.com', 'Football',    8],
    ['REF-003', 'Priya Sharma',     '9988776655', 'priya.sharma@example.com',   'Basketball',  6],
    ['REF-004', 'Harpreet Kaur',    '9872233445', 'harpreet.kaur@example.com',  'Volleyball',  9],
    ['REF-005', 'Vikram Malhotra',  '9811122233', 'vikram.m@example.com',       'Cricket',    15],
    ['REF-006', 'Sandeep Gill',     '9855566677', 'sandeep.gill@example.com',   'Cricket',     7],
    ['REF-007', 'Neha Verma',       '9899900011', 'neha.verma@example.com',     'Badminton',   5],
    ['REF-008', 'Gurpreet Sandhu',  '9876501234', 'gurpreet.s@example.com',     'Hockey',     11],
    ['REF-009', 'Anil Thakur',      '9418123456', 'anil.thakur@example.com',    'Basketball', 10],
    ['REF-010', 'Simran Bedi',      '9779988776', 'simran.bedi@example.com',    'Volleyball',  4],
    ['REF-011', 'Karan Mehta',      '9814455667', 'karan.mehta@example.com',    'Football',    3],
    ['REF-012', 'Rohit Bansal',     '9888877665', 'rohit.bansal@example.com',   'Badminton',   8]
  ];
  const referees = R.map((r, i) => ({
    id: r[0], name: r[1], contact: r[2], email: r[3], sport: r[4], experience: r[5], availability: []
  }));

  // Availability windows for the last 3 days and next 7 days (some days skipped on purpose)
  referees.forEach((r, i) => {
    for (let off = -3; off <= 7; off++) {
      if (r.id !== 'REF-008' && (off + i + 12) % 6 === 0) continue; // referee off that day
      const pattern = r.id === 'REF-008' ? 0 : (i + off + 12) % 3;
      const w = pattern === 0 ? ['08:00', '20:00'] : pattern === 1 ? ['08:00', '17:00'] : ['11:00', '20:00'];
      r.availability.push({ date: addDays(off), start: w[0], end: w[1] });
    }
  });

  // [id, name, sport, dayOffset, start, end, venue, required]
  const M = [
    ['M-101', 'Punjab Cup – Quarter Final 1',  'Football',   -2, '10:00', '12:00', 'Guru Nanak Stadium',   2],
    ['M-102', 'Inter-College T20 – Match 4',   'Cricket',    -2, '13:00', '17:00', 'PCA Ground',           1],
    ['M-103', 'Hoops League – Semi Final',     'Basketball', -1, '16:00', '18:00', 'Indoor Arena Block A', 1],
    ['M-104', 'Spike Series – Pool A',         'Volleyball', -1, '09:00', '11:00', 'Sports Complex Hall 2', 1],
    ['M-105', 'Shuttle Open – Round of 16',    'Badminton',  -1, '14:00', '16:00', 'Shuttle Dome',         1],
    ['M-106', 'Punjab Cup – Quarter Final 2',  'Football',    0, '18:00', '20:00', 'Guru Nanak Stadium',   2],
    ['M-107', 'National Hockey Cup – Match 1', 'Hockey',      1, '10:00', '12:00', 'Astro Turf Ground',    1],
    ['M-108', 'Inter-College T20 – Match 5',   'Cricket',     1, '11:00', '15:00', 'PCA Ground',           1],
    ['M-109', 'Punjab Cup – Semi Final 1',     'Football',    1, '15:00', '17:00', 'Guru Nanak Stadium',   2],
    ['M-110', 'Hoops League – Final',          'Basketball',  2, '15:00', '17:00', 'Indoor Arena Block A', 1],
    ['M-111', 'Spike Series – Pool B',         'Volleyball',  2, '10:00', '12:00', 'Sports Complex Hall 2', 1],
    ['M-112', 'Shuttle Open – Quarter Final',  'Badminton',   3, '12:00', '14:00', 'Shuttle Dome',         1],
    ['M-113', 'Inter-College T20 – Match 6',   'Cricket',     3, '12:00', '16:00', 'PCA Ground',           1],
    ['M-114', 'Inter-College T20 – Match 7',   'Cricket',     3, '13:00', '17:00', 'City Cricket Oval',    2],
    ['M-115', 'Punjab Cup – Final',            'Football',    4, '16:00', '18:00', 'Guru Nanak Stadium',   2],
    ['M-116', 'National Hockey Cup – Match 2', 'Hockey',      4, '09:00', '11:00', 'Astro Turf Ground',    1]
  ];
  const matches = M.map(m => ({
    id: m[0], name: m[1], sport: m[2], date: addDays(m[3]), start: m[4], end: m[5],
    venue: m[6], required: m[7], refereeIds: []
  }));

  state = { referees, matches, history: [], conflictLog: [] };

  // Pre-assign most matches with the smart allocator (leaving a few open for the demo)
  const leaveOpen = ['M-111', 'M-116'];
  matches.slice().sort(sortByTime).forEach((m, idx) => {
    if (leaveOpen.includes(m.id)) return;
    const limit = m.id === 'M-109' ? 1 : m.required;      // M-109 stays "Partially Assigned"
    let picks = smartPick(m, limit);
    if (picks.length < limit && isCompleted(m)) {          // past matches: make sample history complete
      const extra = state.referees.filter(r => r.sport === m.sport && !findOverlap(r.id, m) && !picks.some(p => p.ref.id === r.id))
        .sort((a, b) => b.experience - a.experience).slice(0, limit - picks.length);
      extra.forEach(r => {
        r.availability.push({ date: m.date, start: m.start, end: m.end });
        picks.push({ ref: r, score: scoreRef(r) });
      });
    }
    const ts = new Date(Date.now() - (matches.length - idx) * 4 * 3600 * 1000).toISOString();
    picks.forEach(p => {
      m.refereeIds.push(p.ref.id);
      state.history.push(makeHistory('Auto-Assigned', p.ref, m, ts));
    });
  });
  return state;
}

/* ---------------------------------------------------------
   4. CORE BUSINESS LOGIC
   --------------------------------------------------------- */

/** Two matches overlap if same date and time ranges intersect (touching ends are OK). */
function overlaps(a, b) {
  return a.date === b.date && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

/** Referee is available if one availability slot fully covers the match window. */
function isAvailable(ref, match) {
  return ref.availability.some(s => s.date === match.date && toMin(s.start) <= toMin(match.start) && toMin(s.end) >= toMin(match.end));
}

/** Another match (not `match`) that this referee is already assigned to and that overlaps. */
function findOverlap(refId, match) {
  return state.matches.find(o => o.id !== match.id && o.refereeIds.includes(refId) && overlaps(o, match));
}

/** List the reasons (if any) why `ref` cannot work `match`. Empty array = eligible. */
function reasonsFor(ref, match) {
  const reasons = [];
  if (ref.sport !== match.sport) reasons.push(`Sport mismatch (referee is ${ref.sport}, match is ${match.sport})`);
  if (!isAvailable(ref, match)) reasons.push(`Not available on ${fmtDate(match.date)} for ${fmtRange(match.start, match.end)}`);
  const o = findOverlap(ref.id, match);
  if (o) reasons.push(`Overlaps with ${o.id} "${o.name}" (${fmtRange(o.start, o.end)})`);
  return reasons;
}

/** Full pre-save check used by manual & automatic assignment. */
function evaluate(ref, match) {
  const reasons = reasonsFor(ref, match);
  if (match.refereeIds.includes(ref.id)) reasons.unshift('Already assigned to this match');
  if (isCompleted(match)) reasons.unshift('Match is already completed');
  return { ok: reasons.length === 0, reasons };
}

/** Smart score: experienced referees with a lighter workload rank higher. */
const scoreRef = ref => ref.experience * 2 - workload(ref.id) * 4;

/** Return up to `limit` best eligible referees [{ref, score}] for a match. */
function smartPick(match, limit) {
  const picks = [];
  const taken = [];   // referees picked in this run (so multi-referee matches stay consistent)
  const candidates = state.referees
    .filter(r => r.sport === match.sport && isAvailable(r, match) && !findOverlap(r.id, match) && !match.refereeIds.includes(r.id))
    .map(r => ({ ref: r, score: scoreRef(r) }))
    .sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (picks.length >= limit) break;
    if (taken.includes(c.ref.id)) continue;
    picks.push(c); taken.push(c.ref.id);
  }
  return picks;
}

/** Build a history record (snapshot of names/dates so it survives deletions). */
function makeHistory(action, ref, match, ts, extra) {
  return {
    ts: ts || new Date().toISOString(), action,
    refId: ref.id, refName: ref.name,
    matchId: match.id, matchName: match.name,
    date: match.date, start: match.start, end: match.end,
    note: extra || ''
  };
}

/** Status shown in the history table, derived from live data. */
function histStatus(h) {
  if (h.action === 'Removed') return 'Removed';
  const m = getMatch(h.matchId);
  if (!m || !m.refereeIds.includes(h.refId)) return 'Superseded';
  return isCompleted(m) ? 'Completed' : 'Active';
}
const histBadge = s => `<span class="badge ${s === 'Active' ? 'info' : s === 'Completed' ? 'success' : s === 'Removed' ? 'danger' : 'neutral'}">${s}</span>`;

/** Record a blocked attempt in the conflict log (keeps latest 100). */
function logConflict(ref, match, reasons) {
  state.conflictLog.unshift({
    ts: new Date().toISOString(), refId: ref.id, refName: ref.name,
    matchId: match.id, matchName: match.name, reasons
  });
  state.conflictLog = state.conflictLog.slice(0, 100);
}

/**
 * Manual assignment (also used for replacing a referee).
 * Conflicts are detected BEFORE anything is saved.
 * Returns { ok, reasons }.
 */
function assignReferee(refId, matchId, replaceRefId) {
  const ref = getRef(refId), match = getMatch(matchId);
  if (!ref || !match) return { ok: false, reasons: ['Referee or match not found'] };

  const res = evaluate(ref, match);
  if (!res.ok) {
    logConflict(ref, match, res.reasons);
    save(); renderAll();
    return res;
  }
  if (replaceRefId) {
    const idx = match.refereeIds.indexOf(replaceRefId);
    if (idx > -1) match.refereeIds.splice(idx, 1);
  }
  match.refereeIds.push(refId);
  const old = replaceRefId ? getRef(replaceRefId) : null;
  state.history.push(makeHistory(old ? 'Reassigned' : 'Assigned', ref, match, null, old ? `Replaced ${old.name}` : ''));
  save(); renderAll();
  toast(`${ref.name} ${old ? 'replaced ' + old.name + ' for' : 'assigned to'} ${match.id}.`, 'success');
  return { ok: true, reasons: [] };
}

/** Remove a referee from a match. */
function unassignReferee(refId, matchId, silent) {
  const match = getMatch(matchId), ref = getRef(refId);
  if (!match) return;
  const i = match.refereeIds.indexOf(refId);
  if (i === -1) return;
  match.refereeIds.splice(i, 1);
  if (ref) state.history.push(makeHistory('Removed', ref, match));
  if (!silent) { save(); renderAll(); toast(`${ref ? ref.name : refId} removed from ${match.id}.`, 'warning'); }
}

/** Smart automatic allocation for one match. Returns number assigned. */
function autoAllocate(matchId, quiet) {
  const match = getMatch(matchId);
  if (!match || isCompleted(match)) return 0;
  const need = match.required - match.refereeIds.length;
  if (need <= 0) { if (!quiet) toast(`${match.id} already has all required referees.`, 'info'); return 0; }
  const picks = smartPick(match, need);
  picks.forEach(p => {
    match.refereeIds.push(p.ref.id);
    state.history.push(makeHistory('Auto-Assigned', p.ref, match, null, `Smart score ${p.score}`));
  });
  if (!quiet) {
    save(); renderAll();
    if (picks.length === 0) toast(`No eligible referee is available for ${match.id}.`, 'error');
    else if (picks.length < need) toast(`${match.id}: only ${picks.length} of ${need} needed referee(s) could be allocated.`, 'warning');
    else toast(`${match.id}: ${picks.map(p => p.ref.name).join(', ')} auto-assigned.`, 'success');
  }
  return picks.length;
}

/**
 * Scan the current schedule for problems (e.g. after editing a match time or
 * removing an availability slot). Returns a list of conflict objects.
 */
function activeConflicts() {
  const out = [];
  state.matches.filter(m => !isCompleted(m)).forEach(m => {
    m.refereeIds.forEach(rid => {
      const ref = getRef(rid);
      if (!ref) return;
      const problems = [];
      if (ref.sport !== m.sport) problems.push('Sport mismatch');
      if (!isAvailable(ref, m)) problems.push('Referee not available for this time window');
      // Report overlaps once per pair (under the later match ID)
      state.matches.forEach(o => {
        if (o.id !== m.id && o.id < m.id && o.refereeIds.includes(rid) && overlaps(o, m)) {
          problems.push(`Overlaps with ${o.id} "${o.name}"`);
        }
      });
      if (problems.length) out.push({ matchId: m.id, refId: rid, problems });
    });
  });
  return out;
}

/* ---------------------------------------------------------
   5. NOTIFICATIONS, MODALS & VALIDATION HELPERS
   --------------------------------------------------------- */
function toast(msg, type = 'info') {
  const box = $('#toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); }, 3800);
}

function openModal(id) { const m = $('#' + id); m.classList.add('show'); m.setAttribute('aria-hidden', 'false'); }
function closeModal(id) { const m = $('#' + id); m.classList.remove('show'); m.setAttribute('aria-hidden', 'true'); }
function closeAllModals() { $$('.modal-backdrop.show').forEach(m => closeModal(m.id)); }

function confirmBox(message, cb) {
  $('#confirmMsg').textContent = message;
  ui.confirmCb = cb;
  openModal('modalConfirm');
}

function clearErrors(form) {
  $$('.err', form).forEach(e => e.textContent = '');
  $$('.input', form).forEach(i => i.classList.remove('invalid'));
}
function setError(form, name, msg) {
  const e = $(`[data-for="${name}"]`, form);
  if (e) e.textContent = msg;
  const input = form.elements[name];
  if (input) input.classList.add('invalid');
}

/* ---------------------------------------------------------
   6. RENDERERS
   --------------------------------------------------------- */
function renderAll() {
  renderDashboard();
  renderReferees();
  renderAvailability();
  renderMatches();
  renderAllocation();
  renderConflicts();
  renderHistory();
  renderReports();
  renderAssignModal();
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const refs = state.referees;
  const assigned = refs.filter(r => workload(r.id) > 0).length;
  const conflicts = activeConflicts();
  const needing = state.matches.filter(m => !isCompleted(m) && assignStatus(m) !== 'Fully Assigned').length;

  $('#statReferees').textContent = refs.length;
  $('#statMatches').textContent = state.matches.length;
  $('#statAssigned').textContent = assigned;
  $('#statAvailable').textContent = refs.length - assigned;
  $('#statConflicts').textContent = conflicts.length;
  $('#statConflictsSub').textContent = `${state.conflictLog.length} blocked attempt(s) logged`;
  $('#statUnassigned').textContent = needing;

  const badge = $('#navConflictBadge');
  badge.hidden = conflicts.length === 0;
  badge.textContent = conflicts.length;

  $('#dashConflictBanner').innerHTML = conflicts.length
    ? `<div class="banner">⚠️ ${conflicts.length} scheduling conflict(s) in the current schedule. <a href="#conflicts">Resolve now →</a></div>` : '';

  // Matches by sport
  const bySport = SPORTS.map(s => ({ name: s, val: state.matches.filter(m => m.sport === s).length }));
  $('#chartSport').innerHTML = barRows(bySport);

  // Referee workload (total assignments, top 8)
  const load = refs.map(r => ({ name: r.name, val: state.matches.filter(m => m.refereeIds.includes(r.id)).length }))
    .sort((a, b) => b.val - a.val).slice(0, 8);
  $('#chartWorkload').innerHTML = barRows(load);

  // Next upcoming matches
  const upcoming = state.matches.filter(m => !isCompleted(m)).sort(sortByTime).slice(0, 5);
  $('#upcomingList').innerHTML = upcoming.length ? upcoming.map(m => `
    <div class="list-item">
      <div><div class="t">${esc(m.name)}</div><div class="s">${sportBadge(m.sport)} ${fmtDate(m.date)} · ${fmtRange(m.start, m.end)}</div></div>
      ${statusBadge(assignStatus(m))}
    </div>`).join('') : '<div class="list-empty">No upcoming matches.</div>';

  // Recent activity
  const recent = state.history.slice(-6).reverse();
  $('#activityList').innerHTML = recent.length ? recent.map(h => `
    <div class="list-item">
      <div><div class="t">${esc(h.refName)} → ${esc(h.matchId)}</div><div class="s">${esc(h.action)} · ${fmtStamp(h.ts)}</div></div>
      ${histBadge(histStatus(h))}
    </div>`).join('') : '<div class="list-empty">No activity yet.</div>';
}

function barRows(rows) {
  const max = Math.max(1, ...rows.map(r => r.val));
  return rows.map(r => `
    <div class="bar-row">
      <span class="name" title="${esc(r.name)}">${esc(r.name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.val / max) * 100}%"></div></div>
      <span class="val">${r.val}</span>
    </div>`).join('');
}

/* ---------- Referees ---------- */
function renderReferees() {
  const q = $('#refSearch').value.trim().toLowerCase();
  const sport = $('#refSportFilter').value;
  const list = state.referees.filter(r =>
    (!sport || r.sport === sport) &&
    (!q || [r.id, r.name, r.contact, r.sport, r.email].join(' ').toLowerCase().includes(q))
  );
  $('#refTableBody').innerHTML = list.length ? list.map(r => `
    <tr>
      <td class="mono">${esc(r.id)}</td>
      <td><strong>${esc(r.name)}</strong>${r.email ? `<span class="sub">${esc(r.email)}</span>` : ''}</td>
      <td>${sportBadge(r.sport)}</td>
      <td>${esc(r.contact)}</td>
      <td>${r.experience} yr${r.experience === 1 ? '' : 's'}</td>
      <td>${workload(r.id)} match(es)</td>
      <td class="right">
        <button class="btn btn-ghost btn-sm" data-action="edit-ref" data-id="${esc(r.id)}">✏️ Edit</button>
        <button class="btn btn-danger-ghost btn-sm" data-action="del-ref" data-id="${esc(r.id)}">🗑 Delete</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty">No referees found.</td></tr>';
  $('#refCount').textContent = `Showing ${list.length} of ${state.referees.length} referees`;
}

/* ---------- Availability ---------- */
function renderAvailability() {
  // Referee dropdown (preserve selection)
  const sel = $('#availRef');
  const prev = sel.value;
  sel.innerHTML = state.referees.map(r => `<option value="${esc(r.id)}">${esc(r.name)} (${esc(r.id)} · ${esc(r.sport)})</option>`).join('');
  if (state.referees.some(r => r.id === prev)) sel.value = prev;
  const ref = getRef(sel.value);

  // Timeline for chosen date
  const date = $('#availDate').value;
  if (!ref) {
    $('#timeline').innerHTML = '<div class="list-empty">Add a referee first.</div>';
    $('#slotTableBody').innerHTML = '<tr><td colspan="4" class="empty">No referee selected.</td></tr>';
  } else {
    const START = 6 * 60, END = 22 * 60, SPAN = END - START;
    const pos = (a, b) => {
      const l = Math.max(START, Math.min(END, a)), r = Math.max(START, Math.min(END, b));
      return `left:${((l - START) / SPAN) * 100}%;width:${((r - l) / SPAN) * 100}%`;
    };
    const slots = ref.availability.filter(s => s.date === date);
    const busy = state.matches.filter(m => m.date === date && m.refereeIds.includes(ref.id));
    const ticks = [];
    for (let h = 6; h <= 22; h += 2) ticks.push(`<span>${h % 12 || 12}${h >= 12 ? 'p' : 'a'}</span>`);
    $('#timeline').innerHTML = `
      <div class="timeline">
        ${slots.map(s => `<div class="seg av" style="${pos(toMin(s.start), toMin(s.end))}" title="Available ${fmtRange(s.start, s.end)}">${fmtTime(s.start)}–${fmtTime(s.end)}</div>`).join('')}
        ${busy.map(m => `<div class="seg busy" style="${pos(toMin(m.start), toMin(m.end))}" title="${esc(m.id)} ${esc(m.name)}">${esc(m.id)}</div>`).join('')}
      </div>
      <div class="ticks">${ticks.join('')}</div>
      ${!slots.length ? '<p class="hint">No availability declared on this date – referee is unavailable all day.</p>' : ''}`;

    // Slot table
    const rows = ref.availability.map((s, i) => ({ s, i })).sort((a, b) => (a.s.date + a.s.start).localeCompare(b.s.date + b.s.start));
    $('#slotTableBody').innerHTML = rows.length ? rows.map(({ s, i }) => {
      const booked = state.matches.some(m => m.refereeIds.includes(ref.id) && m.date === s.date && toMin(m.start) < toMin(s.end) && toMin(m.end) > toMin(s.start));
      const past = s.date < todayStr();
      const badge = past ? '<span class="badge neutral">Past</span>' : booked ? '<span class="badge warning">Partly booked</span>' : '<span class="badge success">Free</span>';
      return `<tr><td>${fmtDate(s.date)}</td><td>${fmtRange(s.start, s.end)}</td><td>${badge}</td>
        <td class="right"><button class="btn btn-danger-ghost btn-sm" data-action="del-slot" data-idx="${i}">Remove</button></td></tr>`;
    }).join('') : '<tr><td colspan="4" class="empty">No availability slots yet. Add one above.</td></tr>';
  }

  // "Check availability for a match" panel
  const msel = $('#availMatch');
  const mprev = msel.value;
  const matches = state.matches.slice().sort(sortByTime);
  msel.innerHTML = matches.map(m => `<option value="${esc(m.id)}">${esc(m.id)} – ${esc(m.name)} (${fmtDate(m.date)})</option>`).join('');
  if (matches.some(m => m.id === mprev)) msel.value = mprev;
  const match = getMatch(msel.value);
  if (!match) {
    $('#availMatchInfo').innerHTML = '';
    $('#availCheckBody').innerHTML = '<tr><td colspan="5" class="empty">No matches available.</td></tr>';
    return;
  }
  $('#availMatchInfo').innerHTML = `<b>${esc(match.name)}</b> · ${esc(match.sport)} · ${fmtDate(match.date)} · ${fmtRange(match.start, match.end)} · needs ${match.required} referee(s) · ${assignStatus(match)}`;
  const rows = state.referees.map(r => {
    const already = match.refereeIds.includes(r.id);
    const reasons = reasonsFor(r, match);
    return { r, already, reasons, score: scoreRef(r) };
  }).sort((a, b) => (a.reasons.length - b.reasons.length) || (b.score - a.score));
  $('#availCheckBody').innerHTML = rows.map(({ r, already, reasons }) => {
    const status = already ? '<span class="badge info">Assigned to this match</span>'
      : reasons.length === 0 ? '<span class="badge success">✔ Available &amp; eligible</span>'
      : `<span class="badge danger">✖ ${esc(reasons[0])}</span>`;
    const canAssign = !already && reasons.length === 0 && !isCompleted(match);
    return `<tr><td><strong>${esc(r.name)}</strong><span class="sub">${esc(r.id)}</span></td><td>${sportBadge(r.sport)}</td><td>${r.experience} yrs</td><td>${status}</td>
      <td class="right">${canAssign ? `<button class="btn btn-primary btn-sm" data-action="quick-assign" data-ref="${esc(r.id)}" data-match="${esc(match.id)}">Assign</button>` : ''}</td></tr>`;
  }).join('');
}

/* ---------- Matches ---------- */
function renderMatches() {
  const q = $('#matchSearch').value.trim().toLowerCase();
  const sport = $('#matchSportFilter').value;
  const list = state.matches.filter(m => {
    const done = isCompleted(m);
    if (ui.matchTab === 'upcoming' && done) return false;
    if (ui.matchTab === 'completed' && !done) return false;
    if (sport && m.sport !== sport) return false;
    return !q || [m.id, m.name, m.venue, m.sport].join(' ').toLowerCase().includes(q);
  }).sort(sortByTime);

  $('#matchTableBody').innerHTML = list.length ? list.map(m => {
    const done = isCompleted(m);
    const names = m.refereeIds.map(id => (getRef(id) || { name: id }).name);
    return `<tr>
      <td class="mono">${esc(m.id)}</td>
      <td><strong>${esc(m.name)}</strong></td>
      <td>${sportBadge(m.sport)}</td>
      <td>${fmtDate(m.date)}<span class="sub">${fmtRange(m.start, m.end)}</span></td>
      <td>${esc(m.venue)}</td>
      <td><span class="badge ${done ? 'neutral' : 'info'}">${done ? 'Completed' : 'Upcoming'}</span></td>
      <td>${statusBadge(assignStatus(m))}</td>
      <td>${names.length ? names.map(esc).join(', ') : '<span class="sub">—</span>'}</td>
      <td class="right">
        ${done ? '' : `<button class="btn btn-primary btn-sm" data-action="open-assign" data-match="${esc(m.id)}">Assign</button>`}
        <button class="btn btn-ghost btn-sm" data-action="edit-match" data-id="${esc(m.id)}">✏️</button>
        <button class="btn btn-danger-ghost btn-sm" data-action="del-match" data-id="${esc(m.id)}">🗑</button>
      </td></tr>`;
  }).join('') : '<tr><td colspan="9" class="empty">No matches found.</td></tr>';
  $('#matchCount').textContent = `Showing ${list.length} of ${state.matches.length} matches`;
  $$('#matchTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === ui.matchTab));
}

/* ---------- Allocation ---------- */
function renderAllocation() {
  const q = $('#allocSearch').value.trim().toLowerCase();
  const sport = $('#allocSportFilter').value;
  const status = $('#allocStatusFilter').value;
  const conflicts = activeConflicts();
  const list = state.matches.filter(m =>
    !isCompleted(m) &&
    (!sport || m.sport === sport) &&
    (!status || assignStatus(m) === status) &&
    (!q || [m.id, m.name, m.venue].join(' ').toLowerCase().includes(q))
  ).sort(sortByTime);

  $('#allocList').innerHTML = list.length ? list.map(m => {
    const pct = Math.min(100, (m.refereeIds.length / m.required) * 100);
    const bad = conflicts.filter(c => c.matchId === m.id).map(c => c.refId);
    const chips = m.refereeIds.map(id => {
      const r = getRef(id);
      return `<span class="chip ${bad.includes(id) ? 'bad' : ''}" title="${bad.includes(id) ? 'Conflict!' : ''}">${esc(r ? r.name : id)}
        <button data-action="open-replace" data-match="${esc(m.id)}" data-ref="${esc(id)}" title="Change referee">⇄</button>
        <button data-action="unassign" data-match="${esc(m.id)}" data-ref="${esc(id)}" title="Remove">✕</button></span>`;
    }).join('');
    return `<article class="alloc-card ${bad.length ? 'warn' : ''}">
      <div class="alloc-head"><div><span class="mono">${esc(m.id)}</span><h4>${esc(m.name)}</h4></div>${statusBadge(assignStatus(m))}</div>
      <div class="alloc-meta"><span>🏅 ${esc(m.sport)}</span><span>📅 ${fmtDate(m.date)}</span><span>🕒 ${fmtRange(m.start, m.end)}</span><span>📍 ${esc(m.venue)}</span></div>
      <div class="alloc-refs">${chips || '<span class="sub">No referee assigned yet</span>'}</div>
      <div><div class="progress"><span style="width:${pct}%"></span></div><span class="sub">${m.refereeIds.length} / ${m.required} referee(s) assigned</span></div>
      <div class="alloc-actions">
        <button class="btn btn-accent btn-sm" data-action="auto-match" data-match="${esc(m.id)}" ${m.refereeIds.length >= m.required ? 'disabled' : ''}>⚡ Auto</button>
        <button class="btn btn-primary btn-sm" data-action="open-assign" data-match="${esc(m.id)}">＋ Assign</button>
        <button class="btn btn-ghost btn-sm" data-action="clear-match" data-match="${esc(m.id)}" ${m.refereeIds.length ? '' : 'disabled'}>Clear</button>
      </div></article>`;
  }).join('') : '<div class="card list-empty">No upcoming matches match your filters.</div>';
}

/* ---------- Assign modal (manual assignment / replacement) ---------- */
function renderAssignModal() {
  if (!$('#modalAssign').classList.contains('show')) return;
  const m = getMatch(ui.assignMatchId);
  if (!m) { closeModal('modalAssign'); return; }
  const replacing = ui.assignReplaceRef ? getRef(ui.assignReplaceRef) : null;
  $('#assignTitle').textContent = replacing ? `Change referee for ${m.id}` : `Assign referee to ${m.id}`;
  $('#assignInfo').innerHTML = `<b>${esc(m.name)}</b> · ${esc(m.sport)} · ${fmtDate(m.date)} · ${fmtRange(m.start, m.end)} · ${m.refereeIds.length}/${m.required} assigned` +
    (replacing ? ` · replacing <b>${esc(replacing.name)}</b>` : '');

  const rows = state.referees
    .filter(r => !(replacing && r.id === replacing.id))
    .map(r => ({ r, reasons: m.refereeIds.includes(r.id) ? ['Already assigned to this match'] : reasonsFor(r, m), score: scoreRef(r) }))
    .sort((a, b) => (a.reasons.length - b.reasons.length) || (b.score - a.score));
  const bestId = rows.length && rows[0].reasons.length === 0 ? rows[0].r.id : null;

  $('#assignList').innerHTML = rows.map(({ r, reasons }) => {
    const ok = reasons.length === 0;
    return `<tr>
      <td><strong>${esc(r.name)}</strong> ${r.id === bestId ? '<span class="badge warning">★ Recommended</span>' : ''}<span class="sub">${esc(r.id)} · ${esc(r.sport)}</span></td>
      <td>${r.experience} yrs</td>
      <td>${workload(r.id)}</td>
      <td>${ok ? '<span class="badge success">✔ Eligible</span>' : `<span class="badge danger">✖ ${esc(reasons[0])}</span>${reasons.length > 1 ? `<span class="sub">+${reasons.length - 1} more issue(s)</span>` : ''}`}</td>
      <td class="right"><button class="btn ${ok ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="do-assign" data-ref="${esc(r.id)}">${replacing ? 'Replace' : 'Assign'}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No referees registered.</td></tr>';
}

function openAssign(matchId, replaceRefId) {
  const m = getMatch(matchId);
  if (!m) return;
  if (isCompleted(m)) { toast('This match is already completed.', 'warning'); return; }
  ui.assignMatchId = matchId;
  ui.assignReplaceRef = replaceRefId || null;
  $('#assignWarn').hidden = true;
  openModal('modalAssign');
  renderAssignModal();
}

/* ---------- Conflicts ---------- */
function renderConflicts() {
  const list = activeConflicts();
  $('#conflictActive').innerHTML = list.length ? list.map(c => {
    const r = getRef(c.refId), m = getMatch(c.matchId);
    return `<div class="list-item danger">
      <div><div class="t">⚠️ ${esc(r ? r.name : c.refId)} in ${esc(m.id)} "${esc(m.name)}"</div>
      <div class="s">${c.problems.map(esc).join(' · ')}</div></div>
      <div class="actions">
        <button class="btn btn-primary btn-sm" data-action="open-replace" data-match="${esc(m.id)}" data-ref="${esc(c.refId)}">Change referee</button>
        <button class="btn btn-danger-ghost btn-sm" data-action="unassign" data-match="${esc(m.id)}" data-ref="${esc(c.refId)}">Remove</button>
      </div></div>`;
  }).join('') : '<div class="list-empty">✅ No conflicts. Every assignment is available and overlap-free.</div>';

  $('#conflictLogBody').innerHTML = state.conflictLog.length ? state.conflictLog.map(l => `
    <tr><td>${fmtStamp(l.ts)}</td><td><strong>${esc(l.refName)}</strong><span class="sub">${esc(l.refId)}</span></td>
    <td>${esc(l.matchId)}<span class="sub">${esc(l.matchName)}</span></td>
    <td>${l.reasons.map(r => `<span class="badge danger" style="margin:2px 4px 2px 0">${esc(r)}</span>`).join('')}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">No blocked attempts yet. Try assigning an unavailable referee to see conflict detection in action.</td></tr>';
}

/* ---------- History ---------- */
function filteredHistory() {
  const q = $('#histSearch').value.trim().toLowerCase();
  const st = $('#histStatusFilter').value;
  return state.history.slice().reverse().filter(h =>
    (!st || histStatus(h) === st) &&
    (!q || [h.refName, h.refId, h.matchId, h.matchName, h.action].join(' ').toLowerCase().includes(q))
  );
}
function renderHistory() {
  const list = filteredHistory();
  $('#histBody').innerHTML = list.length ? list.map(h => `
    <tr><td>${fmtStamp(h.ts)}</td>
    <td><strong>${esc(h.refName)}</strong><span class="sub">${esc(h.refId)}</span></td>
    <td>${esc(h.matchId)}<span class="sub">${esc(h.matchName)}</span></td>
    <td>${fmtDate(h.date)}<span class="sub">${fmtRange(h.start, h.end)}</span></td>
    <td>${esc(h.action)}${h.note ? `<span class="sub">${esc(h.note)}</span>` : ''}</td>
    <td>${histBadge(histStatus(h))}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">No history records found.</td></tr>';
  $('#histCount').textContent = `Showing ${list.length} of ${state.history.length} records`;
}

/* ---------- Reports ---------- */
function matchReportRows() {
  return state.matches.slice().sort(sortByTime).map(m => ({
    m, names: m.refereeIds.map(id => (getRef(id) || { name: id }).name)
  }));
}
function refReportRows() {
  return state.referees.map(r => {
    const ms = state.matches.filter(m => m.refereeIds.includes(r.id)).sort(sortByTime);
    const up = ms.filter(m => !isCompleted(m)).length;
    return { r, ms, total: ms.length, up, done: ms.length - up };
  });
}
function renderReports() {
  $('#reportMatchBody').innerHTML = matchReportRows().map(({ m, names }) => `
    <tr><td class="mono">${esc(m.id)}</td><td>${esc(m.name)}</td><td>${sportBadge(m.sport)}</td><td>${fmtDate(m.date)}</td>
    <td>${fmtRange(m.start, m.end)}</td><td>${esc(m.venue)}</td><td>${m.required}</td>
    <td>${names.length ? names.map(esc).join(', ') : '—'}</td><td>${statusBadge(assignStatus(m))}</td></tr>`).join('')
    || '<tr><td colspan="9" class="empty">No matches.</td></tr>';

  $('#reportRefBody').innerHTML = refReportRows().map(({ r, ms, total, up, done }) => `
    <tr><td class="mono">${esc(r.id)}</td><td><strong>${esc(r.name)}</strong></td><td>${sportBadge(r.sport)}</td>
    <td>${total}</td><td>${up}</td><td>${done}</td><td>${ms.length ? ms.map(m => esc(m.id)).join(', ') : '—'}</td></tr>`).join('')
    || '<tr><td colspan="7" class="empty">No referees.</td></tr>';
}

/* ---------- Navigation ---------- */
function showView(name) {
  if (!VIEW_TITLES[name]) name = 'dashboard';
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === name));
  $('#pageTitle').textContent = VIEW_TITLES[name];
  document.title = `${VIEW_TITLES[name]} – RefereePro`;
  closeSidebar();
  window.scrollTo({ top: 0 });
}
function openSidebar()  { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); }

/* ---------------------------------------------------------
   7. CRUD HANDLERS
   --------------------------------------------------------- */

/* ----- Referees ----- */
function nextId(prefix, items) {
  let n = items.reduce((mx, x) => {
    const num = parseInt(String(x.id).replace(/\D/g, ''), 10);
    return isNaN(num) ? mx : Math.max(mx, num);
  }, 0);
  return `${prefix}-${String(n + 1).padStart(3, '0')}`;
}

function openRefereeModal(id) {
  const f = $('#refForm');
  clearErrors(f);
  f.reset();
  const ref = id ? getRef(id) : null;
  f.dataset.editing = ref ? ref.id : '';
  $('#refModalTitle').textContent = ref ? 'Edit Referee' : 'Add Referee';
  f.elements.refId.readOnly = !!ref;
  if (ref) {
    f.elements.refId.value = ref.id; f.elements.refName.value = ref.name;
    f.elements.refContact.value = ref.contact; f.elements.refEmail.value = ref.email || '';
    f.elements.refSport.value = ref.sport; f.elements.refExp.value = ref.experience;
  } else {
    f.elements.refId.value = nextId('REF', state.referees);
  }
  openModal('modalReferee');
  f.elements.refName.focus();
}

function saveReferee(e) {
  e.preventDefault();
  const f = e.target;
  clearErrors(f);
  const editing = f.dataset.editing;
  const v = {
    id: f.elements.refId.value.trim().toUpperCase(),
    name: f.elements.refName.value.trim(),
    contact: f.elements.refContact.value.trim(),
    email: f.elements.refEmail.value.trim(),
    sport: f.elements.refSport.value,
    exp: f.elements.refExp.value.trim()
  };
  let ok = true;
  const bad = (field, msg) => { setError(f, field, msg); ok = false; };

  if (!/^[A-Z0-9-]{3,15}$/.test(v.id)) bad('refId', 'Use 3–15 letters, digits or hyphens.');
  else if (!editing && state.referees.some(r => r.id === v.id)) bad('refId', 'This ID already exists.');
  if (!/^[A-Za-z][A-Za-z .'-]{2,59}$/.test(v.name)) bad('refName', 'Enter a valid name (letters only, min 3 characters).');
  if (!/^[6-9]\d{9}$/.test(v.contact)) bad('refContact', 'Enter a valid 10-digit mobile number.');
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) bad('refEmail', 'Enter a valid email address.');
  if (!v.sport) bad('refSport', 'Please select a sport.');
  const exp = Number(v.exp);
  if (v.exp === '' || !Number.isInteger(exp) || exp < 0 || exp > 50) bad('refExp', 'Enter whole years between 0 and 50.');
  if (!ok) { toast('Please fix the highlighted fields.', 'error'); return; }

  if (editing) {
    const r = getRef(editing);
    Object.assign(r, { name: v.name, contact: v.contact, email: v.email, sport: v.sport, experience: exp });
    toast(`${r.name} updated.`, 'success');
  } else {
    state.referees.push({ id: v.id, name: v.name, contact: v.contact, email: v.email, sport: v.sport, experience: exp, availability: [] });
    toast(`${v.name} added. Don't forget to set their availability.`, 'success');
  }
  save(); closeModal('modalReferee'); renderAll();
  const nowConflicts = activeConflicts().length;
  if (editing && nowConflicts) toast(`${nowConflicts} conflict(s) detected after this change – see Conflicts.`, 'warning');
}

function deleteReferee(id) {
  const r = getRef(id);
  if (!r) return;
  const used = state.matches.filter(m => m.refereeIds.includes(id)).length;
  confirmBox(`Delete ${r.name} (${r.id})? ${used ? `They will be removed from ${used} match(es). ` : ''}History records are kept.`, () => {
    state.matches.forEach(m => { if (m.refereeIds.includes(id)) unassignReferee(id, m.id, true); });
    state.referees = state.referees.filter(x => x.id !== id);
    save(); renderAll();
    toast(`${r.name} deleted.`, 'warning');
  });
}

/* ----- Matches ----- */
function openMatchModal(id) {
  const f = $('#matchForm');
  clearErrors(f);
  f.reset();
  const m = id ? getMatch(id) : null;
  f.dataset.editing = m ? m.id : '';
  $('#matchModalTitle').textContent = m ? 'Edit Match' : 'Add Match';
  f.elements.mId.readOnly = !!m;
  if (m) {
    f.elements.mId.value = m.id; f.elements.mName.value = m.name; f.elements.mSport.value = m.sport;
    f.elements.mVenue.value = m.venue; f.elements.mDate.value = m.date; f.elements.mReq.value = m.required;
    f.elements.mStart.value = m.start; f.elements.mEnd.value = m.end;
  } else {
    f.elements.mId.value = nextId('M', state.matches);
    f.elements.mDate.value = addDays(1);
    f.elements.mStart.value = '10:00'; f.elements.mEnd.value = '12:00'; f.elements.mReq.value = 1;
  }
  openModal('modalMatch');
  f.elements.mName.focus();
}

function saveMatch(e) {
  e.preventDefault();
  const f = e.target;
  clearErrors(f);
  const editing = f.dataset.editing;
  const v = {
    id: f.elements.mId.value.trim().toUpperCase(), name: f.elements.mName.value.trim(),
    sport: f.elements.mSport.value, venue: f.elements.mVenue.value.trim(),
    date: f.elements.mDate.value, start: f.elements.mStart.value, end: f.elements.mEnd.value,
    req: Number(f.elements.mReq.value)
  };
  let ok = true;
  const bad = (field, msg) => { setError(f, field, msg); ok = false; };

  if (!/^[A-Z0-9-]{3,15}$/.test(v.id)) bad('mId', 'Use 3–15 letters, digits or hyphens.');
  else if (!editing && state.matches.some(m => m.id === v.id)) bad('mId', 'This match ID already exists.');
  if (v.name.length < 3) bad('mName', 'Enter a match name (min 3 characters).');
  if (!v.sport) bad('mSport', 'Please select a sport.');
  if (v.venue.length < 3) bad('mVenue', 'Enter the venue.');
  if (!v.date) bad('mDate', 'Select a date.');
  if (!v.start) bad('mStart', 'Select a start time.');
  if (!v.end) bad('mEnd', 'Select an end time.');
  if (v.start && v.end && toMin(v.end) <= toMin(v.start)) bad('mEnd', 'End time must be after start time.');
  if (!Number.isInteger(v.req) || v.req < 1 || v.req > 5) bad('mReq', 'Enter 1 to 5 referees.');
  if (!ok) { toast('Please fix the highlighted fields.', 'error'); return; }

  if (editing) {
    Object.assign(getMatch(editing), { name: v.name, sport: v.sport, venue: v.venue, date: v.date, start: v.start, end: v.end, required: v.req });
    toast(`${editing} updated.`, 'success');
  } else {
    state.matches.push({ id: v.id, name: v.name, sport: v.sport, venue: v.venue, date: v.date, start: v.start, end: v.end, required: v.req, refereeIds: [] });
    toast(`${v.id} added. Assign referees from the Allocation page.`, 'success');
  }
  save(); closeModal('modalMatch'); renderAll();
  if (editing && activeConflicts().length) toast('This change created scheduling conflict(s) – review them in Conflicts.', 'warning');
}

function deleteMatch(id) {
  const m = getMatch(id);
  if (!m) return;
  confirmBox(`Delete match ${m.id} "${m.name}"? Its assignments will be removed (history is kept).`, () => {
    [...m.refereeIds].forEach(rid => unassignReferee(rid, m.id, true));
    state.matches = state.matches.filter(x => x.id !== id);
    save(); renderAll();
    toast(`${id} deleted.`, 'warning');
  });
}

/* ----- Availability slots ----- */
function addSlot() {
  const ref = getRef($('#availRef').value);
  const err = $('#slotError');
  err.textContent = '';
  if (!ref) { err.textContent = 'Select a referee first.'; return; }
  const date = $('#slotDate').value, start = $('#slotStart').value, end = $('#slotEnd').value;
  if (!date || !start || !end) { err.textContent = 'Please fill in date, start and end time.'; return; }
  if (date < todayStr()) { err.textContent = 'Date cannot be in the past.'; return; }
  if (toMin(end) <= toMin(start)) { err.textContent = 'End time must be after start time.'; return; }

  ref.availability.push({ date, start, end });
  // Merge overlapping / touching slots on the same date
  ref.availability.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const merged = [];
  ref.availability.forEach(s => {
    const last = merged[merged.length - 1];
    if (last && last.date === s.date && toMin(s.start) <= toMin(last.end)) {
      if (toMin(s.end) > toMin(last.end)) last.end = s.end;
    } else merged.push({ ...s });
  });
  ref.availability = merged;
  $('#availDate').value = date;
  save(); renderAll();
  toast(`Availability added for ${ref.name} on ${fmtDate(date)}.`, 'success');
}

function removeSlot(idx) {
  const ref = getRef($('#availRef').value);
  if (!ref || !ref.availability[idx]) return;
  ref.availability.splice(idx, 1);
  save(); renderAll();
  toast('Availability slot removed.', 'warning');
  const n = activeConflicts().length;
  if (n) toast(`${n} assignment(s) now conflict with availability – see Conflicts.`, 'warning');
}

/* ---------------------------------------------------------
   8. CSV EXPORT
   --------------------------------------------------------- */
function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function downloadCSV(filename, header, rows) {
  const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM so Excel reads UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  toast(`${filename} downloaded.`, 'success');
}
function exportMatchCSV() {
  downloadCSV('match-wise-report.csv',
    ['Match ID', 'Match', 'Sport', 'Date', 'Start', 'End', 'Venue', 'Referees Required', 'Assigned Referees', 'Status'],
    matchReportRows().map(({ m, names }) => [m.id, m.name, m.sport, m.date, m.start, m.end, m.venue, m.required, names.join('; '), assignStatus(m)]));
}
function exportRefCSV() {
  downloadCSV('referee-wise-report.csv',
    ['Referee ID', 'Name', 'Sport', 'Experience (yrs)', 'Total Assignments', 'Upcoming', 'Completed', 'Matches'],
    refReportRows().map(({ r, ms, total, up, done }) => [r.id, r.name, r.sport, r.experience, total, up, done, ms.map(m => m.id).join('; ')]));
}
function exportHistCSV() {
  downloadCSV('assignment-history.csv',
    ['Logged At', 'Referee ID', 'Referee', 'Match ID', 'Match', 'Match Date', 'Start', 'End', 'Action', 'Status', 'Note'],
    state.history.slice().reverse().map(h => [new Date(h.ts).toLocaleString('en-IN'), h.refId, h.refName, h.matchId, h.matchName, h.date, h.start, h.end, h.action, histStatus(h), h.note]));
}

/* ---------------------------------------------------------
   9. EVENT WIRING & INITIALISATION
   --------------------------------------------------------- */
function populateSelects() {
  const withAll = '<option value="">All sports</option>' + SPORTS.map(s => `<option>${s}</option>`).join('');
  ['#refSportFilter', '#matchSportFilter', '#allocSportFilter'].forEach(id => $(id).innerHTML = withAll);
  const choose = '<option value="">Select sport…</option>' + SPORTS.map(s => `<option>${s}</option>`).join('');
  $('#refForm').elements.refSport.innerHTML = choose;
  $('#matchForm').elements.mSport.innerHTML = choose;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
}

function tickClock() {
  $('#clock').textContent = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** One delegated click handler for every data-action button. */
function handleAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const d = btn.dataset;
  switch (d.action) {
    case 'edit-ref':      openRefereeModal(d.id); break;
    case 'del-ref':       deleteReferee(d.id); break;
    case 'edit-match':    openMatchModal(d.id); break;
    case 'del-match':     deleteMatch(d.id); break;
    case 'del-slot':      removeSlot(Number(d.idx)); break;
    case 'open-assign':   openAssign(d.match); break;
    case 'open-replace':  openAssign(d.match, d.ref); break;
    case 'auto-match':    autoAllocate(d.match); break;
    case 'unassign':      unassignReferee(d.ref, d.match); break;
    case 'clear-match': {
      const m = getMatch(d.match);
      confirmBox(`Remove all referees from ${m.id} "${m.name}"?`, () => {
        [...m.refereeIds].forEach(rid => unassignReferee(rid, m.id, true));
        save(); renderAll(); toast(`All referees removed from ${m.id}.`, 'warning');
      });
      break;
    }
    case 'quick-assign':  assignReferee(d.ref, d.match); break;
    case 'do-assign': {
      const res = assignReferee(d.ref, ui.assignMatchId, ui.assignReplaceRef);
      const warn = $('#assignWarn');
      if (!res.ok) {
        const r = getRef(d.ref);
        warn.innerHTML = `<strong>⚠️ Conflict detected – ${esc(r.name)} cannot be assigned.</strong><ul>${res.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>Choose another referee or adjust the schedule.`;
        warn.hidden = false;
        warn.style.animation = 'none'; void warn.offsetWidth; warn.style.animation = '';
        toast('Assignment blocked: scheduling conflict.', 'error');
      } else {
        warn.hidden = true;
        const m = getMatch(ui.assignMatchId);
        if (ui.assignReplaceRef || m.refereeIds.length >= m.required) closeModal('modalAssign');
      }
      break;
    }
  }
}

function init() {
  state = load();
  populateSelects();
  applyTheme(localStorage.getItem(THEME_KEY) || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  // Default dates
  $('#slotDate').value = addDays(1);
  $('#availDate').value = todayStr();
  $('#slotDate').min = todayStr();

  // Navigation (hash based)
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  showView(location.hash.slice(1));
  $('#menuBtn').addEventListener('click', openSidebar);
  $('#overlay').addEventListener('click', closeSidebar);

  // Theme & reset
  $('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  $('#resetBtn').addEventListener('click', () => confirmBox('Restore the original sample data? All your changes will be lost.', () => {
    localStorage.removeItem(STORAGE_KEY);
    state = seedData(); save(); renderAll();
    toast('Sample data restored.', 'success');
  }));

  // Referee module
  $('#addRefBtn').addEventListener('click', () => openRefereeModal());
  $('#refForm').addEventListener('submit', saveReferee);
  $('#refSearch').addEventListener('input', renderReferees);
  $('#refSportFilter').addEventListener('change', renderReferees);

  // Availability module
  $('#availRef').addEventListener('change', renderAvailability);
  $('#availDate').addEventListener('change', renderAvailability);
  $('#availMatch').addEventListener('change', renderAvailability);
  $('#slotAddBtn').addEventListener('click', addSlot);

  // Match module
  $('#addMatchBtn').addEventListener('click', () => openMatchModal());
  $('#matchForm').addEventListener('submit', saveMatch);
  $('#matchSearch').addEventListener('input', renderMatches);
  $('#matchSportFilter').addEventListener('change', renderMatches);
  $('#matchTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) { ui.matchTab = t.dataset.tab; renderMatches(); }
  });

  // Allocation module
  $('#allocSearch').addEventListener('input', renderAllocation);
  $('#allocSportFilter').addEventListener('change', renderAllocation);
  $('#allocStatusFilter').addEventListener('change', renderAllocation);
  $('#autoAllBtn').addEventListener('click', () => {
    let total = 0, partial = 0;
    state.matches.filter(m => !isCompleted(m) && m.refereeIds.length < m.required).sort(sortByTime).forEach(m => {
      const need = m.required - m.refereeIds.length;
      const got = autoAllocate(m.id, true);
      total += got; if (got < need) partial++;
    });
    save(); renderAll();
    if (total === 0 && partial === 0) toast('Every upcoming match is already fully assigned.', 'info');
    else toast(`Auto-allocated ${total} assignment(s).${partial ? ` ${partial} match(es) still need referees (no eligible referee).` : ''}`, partial ? 'warning' : 'success');
  });

  // Conflicts, history, reports
  $('#clearLogBtn').addEventListener('click', () => { state.conflictLog = []; save(); renderAll(); toast('Conflict log cleared.', 'info'); });
  $('#histSearch').addEventListener('input', renderHistory);
  $('#histStatusFilter').addEventListener('change', renderHistory);
  $('#histExport').addEventListener('click', exportHistCSV);
  $('#expHist').addEventListener('click', exportHistCSV);
  $('#expMatch').addEventListener('click', exportMatchCSV);
  $('#expRef').addEventListener('click', exportRefCSV);

  // Modals
  document.addEventListener('click', handleAction);
  $$('.modal-backdrop').forEach(b => b.addEventListener('mousedown', e => { if (e.target === b) closeModal(b.id); }));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal-backdrop').id)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeAllModals(); closeSidebar(); } });
  $('#confirmOk').addEventListener('click', () => {
    const cb = ui.confirmCb; ui.confirmCb = null;
    closeModal('modalConfirm');
    if (cb) cb();
  });

  save();
  renderAll();
  tickClock();
  setInterval(tickClock, 30000);
  setInterval(renderAll, 60000);   // refresh "completed / upcoming" phases as time passes
}

document.addEventListener('DOMContentLoaded', init);
