/**
 * TeilnehmerTable – wiederverwendbare Teilnehmer-Komponente
 *
 * Verwendung:
 *   new TeilnehmerTable(container)
 *   new TeilnehmerTable(container, { fixedEventId: 'evt_123' })
 *
 * Öffentliche Eigenschaften:
 *   .participants  → aktuelles Array aller geladenen Teilnehmer (für externe Nutzung z.B. Dankes-Mail)
 */
(function () {

// ── CSS (einmalig injiziert) ───────────────────────────────────
const CSS = `
  .teilnehmer-layout {
    display: grid; grid-template-columns: 1fr 380px;
    gap: 32px; align-items: start;
  }
  .stats-bar { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 28px; }
  .stat-chip {
    display: flex; align-items: center; gap: 8px; padding: 10px 18px;
    background: var(--white, #fff); border: 1px solid rgba(0,34,77,0.1);
    border-radius: 2px; font-size: 13px;
  }
  .stat-chip .stat-num { font-family: 'Fredoka', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; }
  .stat-chip .stat-label { color: rgba(0,34,77,0.55); }
  .stat-chip.total .stat-num     { color: var(--navy, #00224d); }
  .stat-chip.pending .stat-num   { color: var(--yellow, #d97706); }
  .stat-chip.confirmed .stat-num { color: var(--green, #16a34a); }
  .stat-chip.cancelled .stat-num { color: var(--red, #dc2626); }

  .event-toggle-bar {
    display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; align-items: center;
    background: rgba(0,34,77,0.05); border-radius: 4px; padding: 4px; width: fit-content;
  }
  .event-view-btn {
    font-family: 'Orbitron', monospace; font-size: 9px; font-weight: 700;
    letter-spacing: .14em; text-transform: uppercase;
    padding: 6px 14px; border-radius: 2px; border: none;
    background: transparent; color: rgba(0,34,77,0.45);
    cursor: pointer; transition: all .15s; user-select: none;
  }
  .event-view-btn:hover { color: var(--navy, #00224d); }
  .event-view-btn.active { background: var(--orange, #ff6300); color: #fff; box-shadow: 0 2px 8px rgba(255,99,0,0.3); }

  .controls-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
  .controls-row select, .controls-row input[type=search] {
    padding: 9px 14px; border: 1px solid rgba(0,34,77,0.18); border-radius: 2px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--navy, #00224d);
    background: var(--white, #fff); outline: none; transition: border-color .2s;
  }
  .controls-row select:focus, .controls-row input[type=search]:focus { border-color: var(--orange, #ff6300); }
  .controls-row select { min-width: 180px; }
  .controls-row input[type=search] { flex: 1; min-width: 200px; }
  .btn-add-participant {
    background: var(--orange, #ff6300); color: #fff; border: none;
    padding: 10px 16px; font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 500; cursor: pointer; border-radius: 2px;
    letter-spacing: .02em; white-space: nowrap; transition: background .2s;
  }
  .btn-add-participant:hover { background: #e55700; }

  .table-wrap { background: var(--white, #fff); border: 1px solid rgba(0,34,77,0.1); border-radius: 2px; overflow-x: auto; }
  .table-wrap table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .table-wrap thead th {
    text-align: left; font-family: 'Orbitron', monospace;
    font-size: 8px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
    color: rgba(0,34,77,0.45); padding: 14px 16px;
    border-bottom: 1px solid rgba(0,34,77,0.1); white-space: nowrap; background: #fafaf9;
  }
  .table-wrap tbody tr { border-bottom: 1px solid rgba(0,34,77,0.07); }
  .table-wrap tbody tr:last-child { border-bottom: none; }
  .table-wrap tbody tr:hover { background: rgba(0,34,77,0.025); }
  .table-wrap tbody td { padding: 13px 16px; vertical-align: middle; color: var(--navy, #00224d); }
  .table-wrap td.name-col  { font-weight: 500; }
  .table-wrap td.email-col { color: rgba(0,34,77,0.65); font-size: 13px; }
  .table-wrap td.phone-col { color: rgba(0,34,77,0.65); font-size: 13px; white-space: nowrap; }
  .table-wrap td.event-col { font-size: 13px; max-width: 200px; }
  .table-wrap td.ticket-col { font-size: 13px; }
  .table-wrap td.price-col  { font-size: 13px; white-space: nowrap; }
  .table-wrap td.date-col   { font-size: 12px; color: rgba(0,34,77,0.5); white-space: nowrap; }
  .table-wrap td.action-col { text-align: right; white-space: nowrap; }
  .table-wrap tbody tr[data-id] { cursor: pointer; }
  .table-wrap tbody tr.selected-row { background: rgba(255,99,0,0.06); }

  .btn-delete-row {
    background: rgba(220,38,38,0.08); color: var(--red, #dc2626);
    border: 1px solid rgba(220,38,38,0.2); border-radius: 2px;
    cursor: pointer; font-size: 14px; padding: 6px 10px; transition: background .15s;
  }
  .btn-delete-row:hover { background: rgba(220,38,38,0.15); }

  .status-select {
    padding: 5px 10px; border-radius: 2px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    cursor: pointer; outline: none; transition: opacity .2s;
  }
  .status-select:hover { opacity: .85; }
  .status-select.pending   { background: rgba(217,119,6,0.12); color: var(--yellow, #d97706); border: 1px solid rgba(217,119,6,0.3); }
  .status-select.confirmed { background: rgba(22,163,74,0.1);  color: var(--green, #16a34a);  border: 1px solid rgba(22,163,74,0.3); }
  .status-select.cancelled { background: rgba(220,38,38,0.08); color: var(--red, #dc2626);    border: 1px solid rgba(220,38,38,0.25); }
  .status-select option { background: var(--white, #fff); color: var(--navy, #00224d); font-weight: 400; }

  .empty-state { text-align: center; padding: 60px 20px; color: rgba(0,34,77,0.4); }
  .empty-state .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-state p { font-size: 15px; }
  .loading-row td { text-align: center; padding: 40px; color: rgba(0,34,77,0.4); font-size: 14px; }

  .form-panel {
    background: var(--white, #fff); border: 1px solid rgba(0,34,77,0.1);
    padding: 28px; position: sticky; top: 88px;
    box-shadow: 0 8px 32px rgba(0,34,77,0.08);
  }
  .form-panel .section-label {
    font-family: 'Orbitron', monospace; font-size: 9px; font-weight: 700;
    letter-spacing: .22em; text-transform: uppercase;
    color: var(--orange, #ff6300); margin-bottom: 10px; display: block;
  }
  .form-panel .form-title { font-family: 'Fredoka', sans-serif; font-size: 20px; font-weight: 700; color: var(--navy, #00224d); margin-bottom: 18px; }
  .form-panel .form-placeholder { font-size: 13px; color: rgba(0,34,77,0.4); line-height: 1.6; }
  .form-panel .field-group { margin-bottom: 14px; }
  .form-panel .field-group label {
    font-family: 'Orbitron', monospace; font-size: 9px; font-weight: 700;
    letter-spacing: .18em; text-transform: uppercase;
    color: var(--navy, #00224d); opacity: .7; display: block; margin-bottom: 6px;
  }
  .form-panel .field-group input, .form-panel .field-group select {
    width: 100%; background: #f4f4f2; border: 1px solid rgba(0,34,77,0.15);
    border-radius: 2px; padding: 9px 12px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--navy, #00224d);
    outline: none; transition: border-color .2s, background .2s;
  }
  .form-panel .field-group input:focus, .form-panel .field-group select:focus {
    border-color: var(--orange, #ff6300); background: #fff; box-shadow: 0 0 0 3px rgba(255,99,0,0.1);
  }
  .form-panel .field-group input:disabled { background: rgba(0,34,77,0.03); color: rgba(0,34,77,0.5); }
  .form-panel .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .form-panel .form-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .form-panel .btn-save {
    flex: 1; background: var(--orange, #ff6300); color: #fff; border: none;
    padding: 11px 18px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; border-radius: 2px; letter-spacing: .03em; transition: background .2s;
  }
  .form-panel .btn-save:hover { background: #e55700; }
  .form-panel .btn-cancel-form {
    background: transparent; border: 1px solid rgba(0,34,77,0.2); color: #888;
    padding: 11px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    cursor: pointer; border-radius: 2px; transition: background .15s;
  }
  .form-panel .btn-cancel-form:hover { background: rgba(0,34,77,0.04); color: var(--navy, #00224d); }

  @media (max-width: 640px) {
    .teilnehmer-layout { grid-template-columns: 1fr; }
    .form-panel { position: static; }
    .table-wrap td.phone-col,
    .table-wrap td.event-col,
    .table-wrap td.ticket-col,
    .table-wrap td.date-col { display: none; }
  }
`;

function ensureCSS() {
  if (document.getElementById('tt-styles')) return;
  const s = document.createElement('style');
  s.id = 'tt-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ── Hilfsfunktionen ────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(isoStr) {
  if (!isoStr) return '–';
  const d = new Date(isoStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── Globale Registry für Inline-Handler ────────────────────────
window._tt = window._tt || {};
let _counter = 0;

// ── Klasse ─────────────────────────────────────────────────────
class TeilnehmerTable {
  constructor(container, options = {}) {
    this._n   = ++_counter;
    this._con = container;
    this._fixedEventId    = options.fixedEventId  || null;
    this._showTimeFilter  = options.showTimeFilter  ?? !this._fixedEventId;
    this._showEventFilter = options.showEventFilter ?? !this._fixedEventId;

    this._allParticipants = [];
    this._eventsMap       = {};
    this._selectedId      = null;
    this._activeTimeView  = 'upcoming';
    this._TODAY = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    window._tt[this._n] = this;
    ensureCSS();
    this._render();
    this._bind();
    this._load();
  }

  // Öffentlich: Zugriff auf geladene Teilnehmer (z.B. für Dankes-Mail)
  get participants() { return this._allParticipants; }

  // ── DOM helper ──────────────────────────────────────────────
  _e(id) { return document.getElementById('tt' + this._n + '-' + id); }

  _toast(msg, type = '') {
    const t = document.getElementById('toast') || this._e('toast');
    if (!t) return;
    clearTimeout(t._ttTimer);
    t.textContent = msg;
    t.className = 'show' + (type ? ' ' + type : '');
    t._ttTimer = setTimeout(() => { t.className = ''; }, 2800);
  }

  // ── HTML rendern ────────────────────────────────────────────
  _render() {
    const n  = this._n;
    const fe = this._fixedEventId;
    const sf = this._showTimeFilter;
    const se = this._showEventFilter;
    const cols = fe ? 8 : 9;

    this._con.innerHTML = `
<div class="teilnehmer-layout">
  <div>
    <div class="stats-bar">
      <div class="stat-chip total"><span class="stat-num" id="tt${n}-stat-total">–</span><span class="stat-label">Gesamt</span></div>
      <div class="stat-chip pending"><span class="stat-num" id="tt${n}-stat-pending">–</span><span class="stat-label">Registriert</span></div>
      <div class="stat-chip confirmed"><span class="stat-num" id="tt${n}-stat-confirmed">–</span><span class="stat-label">Bezahlt</span></div>
      <div class="stat-chip cancelled"><span class="stat-num" id="tt${n}-stat-cancelled">–</span><span class="stat-label">Storniert</span></div>
    </div>
    ${sf ? `<div class="event-toggle-bar">
      <button class="event-view-btn active" data-view="upcoming">Kommende</button>
      <button class="event-view-btn" data-view="past">Vergangene</button>
      <button class="event-view-btn" data-view="all">Alle</button>
    </div>` : ''}
    <div class="controls-row">
      ${se ? `<select id="tt${n}-filter-event"><option value="">Alle Events</option></select>` : ''}
      <select id="tt${n}-filter-status">
        <option value="">Alle Status</option>
        <option value="pending">Registriert</option>
        <option value="confirmed">Bezahlt</option>
        <option value="cancelled">Storniert</option>
      </select>
      <input type="search" id="tt${n}-filter-search" placeholder="Name oder E-Mail suchen…">
      <button type="button" class="btn-add-participant" id="tt${n}-btn-add">+ Teilnehmer hinzufügen</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Name</th><th>E-Mail</th>
          <th class="phone-col">Telefon</th>
          ${!fe ? '<th class="event-col">Event</th>' : ''}
          <th class="ticket-col">Ticket</th>
          <th class="price-col">Preis</th>
          <th>Status</th>
          <th class="date-col">Angemeldet</th>
          <th class="action-col"></th>
        </tr></thead>
        <tbody id="tt${n}-tbody">
          <tr class="loading-row"><td colspan="${cols}">Wird geladen…</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="form-panel" id="tt${n}-form-panel">
    <span class="section-label">Teilnehmer</span>
    <div class="form-title" id="tt${n}-form-title">Daten bearbeiten</div>
    <p class="form-placeholder" id="tt${n}-form-placeholder">Klicke in der Liste auf einen Teilnehmer, um dessen Daten zu bearbeiten.</p>
    <form id="tt${n}-form" style="display:none;" novalidate>
      ${!fe ? `<div class="field-group">
        <label for="tt${n}-pf-event">Event</label>
        <select id="tt${n}-pf-event"></select>
      </div>` : ''}
      <div class="field-row">
        <div class="field-group"><label for="tt${n}-pf-vorname">Vorname *</label><input type="text" id="tt${n}-pf-vorname" maxlength="80"></div>
        <div class="field-group"><label for="tt${n}-pf-nachname">Nachname *</label><input type="text" id="tt${n}-pf-nachname" maxlength="80"></div>
      </div>
      <div class="field-group"><label for="tt${n}-pf-email">E-Mail *</label><input type="email" id="tt${n}-pf-email" maxlength="120"></div>
      <div class="field-row">
        <div class="field-group"><label for="tt${n}-pf-handy">Telefon</label><input type="text" id="tt${n}-pf-handy" maxlength="40"></div>
        <div class="field-group"><label for="tt${n}-pf-ort">Ort</label><input type="text" id="tt${n}-pf-ort" maxlength="80"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label for="tt${n}-pf-ticket">Ticket</label><input type="text" id="tt${n}-pf-ticket" maxlength="60"></div>
        <div class="field-group"><label for="tt${n}-pf-price">Preis</label><input type="text" id="tt${n}-pf-price" maxlength="40"></div>
      </div>
      <div class="field-group">
        <label for="tt${n}-pf-status">Status</label>
        <select id="tt${n}-pf-status">
          <option value="pending">Registriert</option>
          <option value="confirmed">Bezahlt</option>
          <option value="cancelled">Storniert</option>
        </select>
      </div>
      <div class="field-group"><label>Angemeldet am</label><input type="text" id="tt${n}-pf-registered" disabled></div>
      <div class="form-actions">
        <button type="submit" class="btn-save" id="tt${n}-pf-save">Speichern</button>
        <button type="button" class="btn-cancel-form" id="tt${n}-pf-close">Schließen</button>
      </div>
    </form>
  </div>
</div>`;
  }

  // ── Event-Listener ─────────────────────────────────────────
  _bind() {
    if (this._showTimeFilter) {
      this._con.querySelectorAll('.event-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._activeTimeView = btn.dataset.view;
          this._con.querySelectorAll('.event-view-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._updateStats(); this._renderTable();
        });
      });
    }
    if (this._showEventFilter) this._e('filter-event').addEventListener('change', () => { this._updateStats(); this._renderTable(); });
    this._e('filter-status').addEventListener('change', () => { this._updateStats(); this._renderTable(); });
    this._e('filter-search').addEventListener('input',  () => { this._updateStats(); this._renderTable(); });
    this._e('tbody').addEventListener('click', e => {
      if (e.target.closest('select, button')) return;
      const tr = e.target.closest('tr[data-id]');
      if (tr) this._selectParticipant(tr.dataset.id);
    });
    this._e('pf-close').addEventListener('click', () => this._closeForm());
    this._e('btn-add').addEventListener('click',  () => this._openNewForm());
    this._e('form').addEventListener('submit',    e => this._submitForm(e));
  }

  // ── Daten laden ────────────────────────────────────────────
  async _load() {
    let parQ = db.from('event_participations')
      .select('*, participants(vorname, nachname, email, handy, ort)')
      .order('registered_at', { ascending: false });
    if (this._fixedEventId) parQ = parQ.eq('event_id', this._fixedEventId);

    const [evRes, parRes] = await Promise.all([
      db.from('events').select('id, name, year, month, day').order('year').order('month').order('day'),
      parQ
    ]);

    this._eventsMap = {};
    (evRes.data || []).forEach(ev => { this._eventsMap[ev.id] = ev; });

    this._allParticipants = (parRes.data || []).map(ep => ({
      id:             ep.id,
      event_id:       ep.event_id,
      participant_id: ep.participant_id,
      vorname:        ep.participants?.vorname  || '',
      nachname:       ep.participants?.nachname || '',
      email:          ep.participants?.email    || '',
      handy:          ep.participants?.handy    || '',
      ort:            ep.participants?.ort      || '',
      ticket_name:    ep.ticket_name,
      ticket_price:   ep.ticket_price,
      payment_status: ep.payment_status,
      registered_at:  ep.registered_at
    }));

    if (this._showEventFilter) this._populateEventFilter();
    this._populateFormEventSelect();
    this._updateStats();
    this._renderTable();
  }

  _populateEventFilter() {
    const sel = this._e('filter-event');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    Object.values(this._eventsMap).forEach(ev => {
      const o = document.createElement('option');
      o.value = ev.id;
      o.textContent = ev.day + '.' + String(ev.month + 1).padStart(2,'0') + '.' + ev.year + ' – ' + ev.name;
      sel.appendChild(o);
    });
  }

  _populateFormEventSelect() {
    const sel = this._e('pf-event');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    Object.values(this._eventsMap).forEach(ev => {
      const o = document.createElement('option');
      o.value = ev.id;
      o.textContent = ev.name + ' – ' + ev.day + '.' + String(ev.month + 1).padStart(2,'0') + '.' + ev.year;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  // ── Filter ─────────────────────────────────────────────────
  _filtered() {
    const eventId = this._showEventFilter
      ? (this._e('filter-event')?.value || '')
      : (this._fixedEventId || '');
    const status = this._e('filter-status').value;
    const search = this._e('filter-search').value.trim().toLowerCase();

    return this._allParticipants.filter(p => {
      if (eventId && p.event_id !== eventId) return false;
      if (status  && p.payment_status !== status) return false;
      if (this._showTimeFilter && this._activeTimeView !== 'all') {
        const ev = this._eventsMap[p.event_id];
        if (ev) {
          const isUpcoming = new Date(ev.year, ev.month, ev.day) >= this._TODAY;
          if (this._activeTimeView === 'upcoming' && !isUpcoming) return false;
          if (this._activeTimeView === 'past'     &&  isUpcoming) return false;
        }
      }
      if (search) {
        const hay = ((p.vorname || '') + ' ' + (p.nachname || '') + ' ' + (p.email || '')).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  _updateStats() {
    const list = this._filtered();
    this._e('stat-total').textContent     = list.length;
    this._e('stat-pending').textContent   = list.filter(p => p.payment_status === 'pending').length;
    this._e('stat-confirmed').textContent = list.filter(p => p.payment_status === 'confirmed').length;
    this._e('stat-cancelled').textContent = list.filter(p => p.payment_status === 'cancelled').length;
  }

  // ── Tabelle rendern ────────────────────────────────────────
  _renderTable() {
    const tbody  = this._e('tbody');
    const list   = this._filtered();
    const n      = this._n;
    const fe     = this._fixedEventId;
    const cols   = fe ? 8 : 9;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📋</div><p>Keine Anmeldungen gefunden.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const ev       = this._eventsMap[p.event_id] || null;
      const evLabel  = ev
        ? esc(ev.name) + '<br><small>' + ev.day + '.' + String(ev.month+1).padStart(2,'0') + '.' + ev.year + '</small>'
        : (p.event_id ? '<small style="color:rgba(0,34,77,0.4)">' + esc(p.event_id) + '</small>' : '–');
      const status   = p.payment_status || 'pending';
      const fullName = ((p.vorname || '') + ' ' + (p.nachname || '')).trim();
      return `<tr data-id="${p.id}"${p.id === this._selectedId ? ' class="selected-row"' : ''}>
        <td class="name-col">${esc(p.vorname)} ${esc(p.nachname)}</td>
        <td class="email-col">${esc(p.email || '–')}</td>
        <td class="phone-col">${esc(p.handy || '–')}</td>
        ${!fe ? `<td class="event-col">${evLabel}</td>` : ''}
        <td class="ticket-col">${esc(p.ticket_name || '–')}</td>
        <td class="price-col">${esc(p.ticket_price || '–')}</td>
        <td><select class="status-select ${status}" data-id="${p.id}" onchange="_tt[${n}].changeStatus(this)">
          <option value="pending"   ${status==='pending'   ? 'selected':''}>Registriert</option>
          <option value="confirmed" ${status==='confirmed' ? 'selected':''}>Bezahlt</option>
          <option value="cancelled" ${status==='cancelled' ? 'selected':''}>Storniert</option>
        </select></td>
        <td class="date-col">${fmtDate(p.registered_at)}</td>
        <td class="action-col"><button class="btn-delete-row" data-id="${p.id}" data-name="${esc(fullName || 'diesen Teilnehmer')}" onclick="_tt[${n}].deleteParticipant(this)" title="Löschen">🗑</button></td>
      </tr>`;
    }).join('');
  }

  // ── Status ändern (public – inline-Handler) ────────────────
  async changeStatus(sel) {
    const id  = sel.dataset.id;
    const val = sel.value;
    sel.className = 'status-select ' + val;
    const { error } = await db.from('event_participations').update({ payment_status: val }).eq('id', id);
    if (error) {
      this._toast('Fehler: ' + error.message, 'error');
      const p = this._allParticipants.find(x => x.id === id);
      if (p) { sel.value = p.payment_status; sel.className = 'status-select ' + p.payment_status; }
      return;
    }
    const p = this._allParticipants.find(x => x.id === id);
    if (p) p.payment_status = val;
    const pfSt = this._e('pf-status');
    if (pfSt && this._selectedId === id) pfSt.value = val;
    this._updateStats();
    this._toast('Status gespeichert', 'success');
  }

  // ── Teilnehmer löschen (public – inline-Handler) ──────────
  async deleteParticipant(btn) {
    if (!confirm('"' + btn.dataset.name + '" wirklich unwiderruflich löschen?')) return;
    btn.disabled = true;
    const id = btn.dataset.id;
    const { error } = await db.from('event_participations').delete().eq('id', id);
    if (error) { this._toast('Fehler: ' + error.message, 'error'); btn.disabled = false; return; }
    this._allParticipants = this._allParticipants.filter(x => x.id !== id);
    if (this._selectedId === id) this._closeForm();
    this._updateStats(); this._renderTable();
    this._toast('Teilnehmer gelöscht', 'success');
  }

  // ── Formular ───────────────────────────────────────────────
  _selectParticipant(id) {
    const p = this._allParticipants.find(x => x.id === id);
    if (!p) return;
    this._selectedId = id;
    this._e('form-title').textContent = 'Daten bearbeiten';
    this._e('pf-save').textContent    = 'Speichern';
    const pfEv = this._e('pf-event'); if (pfEv) pfEv.value = p.event_id || '';
    this._e('pf-vorname').value    = p.vorname  || '';
    this._e('pf-nachname').value   = p.nachname || '';
    this._e('pf-email').value      = p.email    || '';
    this._e('pf-handy').value      = p.handy    || '';
    this._e('pf-ort').value        = p.ort      || '';
    this._e('pf-ticket').value     = p.ticket_name  || '';
    this._e('pf-price').value      = p.ticket_price || '';
    this._e('pf-status').value     = p.payment_status || 'pending';
    this._e('pf-registered').value = fmtDate(p.registered_at);
    this._e('form-placeholder').style.display = 'none';
    this._e('form').style.display = '';
    this._e('tbody').querySelectorAll('tr.selected-row').forEach(tr => tr.classList.remove('selected-row'));
    const row = this._e('tbody').querySelector(`tr[data-id="${id}"]`);
    if (row) row.classList.add('selected-row');
  }

  _closeForm() {
    this._selectedId = null;
    this._e('form').style.display = 'none';
    this._e('form-placeholder').style.display = '';
    this._e('tbody').querySelectorAll('tr.selected-row').forEach(tr => tr.classList.remove('selected-row'));
  }

  _openNewForm() {
    this._selectedId = null;
    const pfEv = this._e('pf-event');
    if (pfEv) pfEv.value = this._showEventFilter ? (this._e('filter-event')?.value || '') : (this._fixedEventId || '');
    ['pf-vorname','pf-nachname','pf-email','pf-handy','pf-ort','pf-ticket','pf-price'].forEach(id => { this._e(id).value = ''; });
    this._e('pf-status').value     = 'pending';
    this._e('pf-registered').value = '– (wird beim Speichern gesetzt)';
    this._e('form-title').textContent = 'Teilnehmer anlegen';
    this._e('pf-save').textContent    = 'Anlegen';
    this._e('form-placeholder').style.display = 'none';
    this._e('form').style.display = '';
    this._e('tbody').querySelectorAll('tr.selected-row').forEach(tr => tr.classList.remove('selected-row'));
  }

  async _submitForm(e) {
    e.preventDefault();
    const vorname  = this._e('pf-vorname').value.trim();
    const nachname = this._e('pf-nachname').value.trim();
    const email    = this._e('pf-email').value.trim();
    if (!vorname || !nachname || !email) { this._toast('Vorname, Nachname und E-Mail sind erforderlich.', 'error'); return; }

    const pfEv    = this._e('pf-event');
    const eventId = pfEv ? pfEv.value : (this._fixedEventId || null);
    const handy   = this._e('pf-handy').value.trim();
    const epFields   = { event_id: eventId, ticket_name: this._e('pf-ticket').value.trim(), ticket_price: this._e('pf-price').value.trim(), payment_status: this._e('pf-status').value };
    const partFields = { vorname, nachname, email, handy, ort: this._e('pf-ort').value.trim() };

    if (this._selectedId) {
      const p = this._allParticipants.find(x => x.id === this._selectedId);
      const { error: e1 } = await db.from('event_participations').update(epFields).eq('id', this._selectedId);
      if (e1) { this._toast('Fehler: ' + e1.message, 'error'); return; }
      if (p?.participant_id) {
        const { error: e2 } = await db.from('participants').update(partFields).eq('id', p.participant_id);
        if (e2) { this._toast('Fehler: ' + e2.message, 'error'); return; }
      }
      if (this._fixedEventId && eventId !== this._fixedEventId) {
        this._allParticipants = this._allParticipants.filter(x => x.id !== this._selectedId);
        this._closeForm();
      } else {
        if (p) Object.assign(p, { ...epFields, ...partFields });
      }
      this._updateStats(); this._renderTable();
      this._toast('Teilnehmer aktualisiert ✓', 'success');
    } else {
      const { data: pd, error: e1 } = handy
        ? await db.from('participants').upsert({ ...partFields }, { onConflict: 'handy' }).select('id').single()
        : await db.from('participants').insert(partFields).select('id').single();
      if (e1) { this._toast('Fehler: ' + e1.message, 'error'); return; }
      const { data: epd, error: e2 } = await db.from('event_participations').insert({ ...epFields, participant_id: pd.id }).select().single();
      if (e2) { this._toast('Fehler: ' + e2.message, 'error'); return; }
      const entry = { id: epd.id, participant_id: pd.id, ...epFields, ...partFields, registered_at: epd.registered_at };
      this._allParticipants.unshift(entry);
      this._selectedId = epd.id;
      this._e('pf-registered').value = fmtDate(epd.registered_at);
      this._e('form-title').textContent = 'Daten bearbeiten';
      this._e('pf-save').textContent = 'Speichern';
      this._updateStats(); this._renderTable();
      this._toast('Teilnehmer angelegt ✓', 'success');
      const row = this._e('tbody').querySelector(`tr[data-id="${epd.id}"]`);
      if (row) row.classList.add('selected-row');
    }
  }
}

window.TeilnehmerTable = TeilnehmerTable;

})();
