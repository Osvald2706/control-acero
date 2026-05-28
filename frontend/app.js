const API = '';
let state = { user: null, token: null, inventory: [], steelTypes: [], movements: [], fabOpen: false };

function $(id) { return document.getElementById(id); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de conexión' }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

function apiBlob(path) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  return fetch(`${API}${path}`, { headers });
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✕', info: '●' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-text">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(el);
  setTimeout(() => {
    if (el.parentElement) { el.style.opacity = '0'; el.style.transform = 'translateY(-20px)'; el.style.transition = 'all .3s ease'; setTimeout(() => el.remove(), 300); }
  }, 3500);
}

/* ===== AUTH ===== */
function showLoading() { $('loading-screen').style.display = 'flex'; $('login-screen').style.display = 'none'; $('app-screen').style.display = 'none'; }
function showLogin() { $('loading-screen').style.display = 'none'; $('login-screen').style.display = 'flex'; $('app-screen').style.display = 'none'; }
function showApp() { $('loading-screen').style.display = 'none'; $('login-screen').style.display = 'none'; $('app-screen').style.display = 'block'; }

async function handleLogin() {
  const u = $('login-user').value.trim();
  const p = $('login-pass').value;
  if (!u || !p) return toast('Ingresa usuario y contraseña', 'error');
  const btn = $('login-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;border-color:rgba(255,255,255,.2);border-top-color:white"></span>';
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    state.token = data.token; state.user = data.user;
    localStorage.setItem('acero_token', data.token);
    localStorage.setItem('acero_user', JSON.stringify(data.user));
    await initApp();
  } catch (e) { toast(e.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Ingresar';
}

async function handleLogout() {
  try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
  state.token = null; state.user = null;
  localStorage.removeItem('acero_token'); localStorage.removeItem('acero_user');
  showLogin();
}

async function initApp() { showApp(); renderTopbar(); await loadData(); }

async function loadData() {
  try {
    const [inventory, movements, steelTypes] = await Promise.all([
      api('/api/inventory'),
      api('/api/movements'),
      api('/api/steel-types'),
    ]);
    state.inventory = inventory;
    state.movements = movements;
    state.steelTypes = steelTypes;
    renderDashboard();
  } catch (e) { if (e.message.includes('Token') || e.message.includes('401')) handleLogout(); }
}

/* ===== TOPBAR ===== */
async function exportExcel() {
  try {
    const res = await apiBlob('/api/inventory/export');
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inventario_acero.xlsx';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Excel descargado', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function renderTopbar() {
  const totalTypes = state.inventory.length;
  const totalStock = state.inventory.reduce((s, i) => s + i.stock, 0);
  $('topbar').innerHTML = `
    <div class="topbar-left">
      <h2><span class="logo-dot"></span> Control Acero</h2>
    </div>
    <div class="topbar-right">
      <span class="user-badge">${state.user.name}</span>
      <button class="topbar-btn" onclick="showModal('Historial', renderHistory)" title="Historial">📋</button>
      <button class="topbar-btn" onclick="exportExcel()" title="Exportar Excel">📥</button>
      ${state.user.role === 'admin' ? `<button class="topbar-btn" onclick="showModal('Panel Admin', renderAdminPanel)" title="Admin">⚙️</button>` : ''}
      <button class="topbar-btn" onclick="handleLogout()" title="Salir">🚪</button>
    </div>
  `;
}

/* ===== DASHBOARD ===== */
function renderDashboard() {
  const totalTypes = state.inventory.length;
  const totalStock = state.inventory.reduce((s, i) => s + i.stock, 0);
  const lowItems = state.inventory.filter(i => i.stock < 5);

  const cards = state.inventory.length === 0
    ? `<div class="empty-state">
        <div class="icon">📦</div>
        <h4>Sin tipos de acero</h4>
        <p>Registra tu primer tipo de acero desde el panel de administración</p>
      </div>`
    : state.inventory.map(item => {
        const isLow = item.stock < 5;
        const isCritical = item.stock === 0;
        const stockClass = isCritical ? 'critical' : isLow ? 'warning' : 'ok';
        const badge = isCritical
          ? '<span class="inv-card-badge badge-low">⚠ Sin stock</span>'
          : isLow
          ? '<span class="inv-card-badge badge-warning">⚠ Bajo stock</span>'
          : '<span class="inv-card-badge badge-ok">✓ Disponible</span>';
        const codeLabel = item.code ? `<span style="font-size:.75rem;color:var(--gray-400);font-weight:500;background:var(--gray-100);padding:.125rem .5rem;border-radius:6px;display:inline-block;margin-bottom:.375rem">${item.code}</span>` : '';
        return `
          <div class="inv-card">
            <div class="inv-card-top">
              <div>
                ${codeLabel}
                <div class="inv-card-name">${item.name}</div>
              </div>
              <div class="inv-card-stock ${stockClass}">${item.stock}</div>
            </div>
            <div class="inv-card-bottom">
              <div class="inv-card-meta">
                ${item.last_movement
                  ? `${item.last_movement.type === 'entry' ? '📥' : '📤'} ${item.last_movement.by} · ${formatDate(item.last_movement.date)}`
                  : 'Sin movimientos'}
              </div>
              ${badge}
            </div>
          </div>
        `;
      }).join('');

  $('dashboard').innerHTML = `
    <div class="dash-header">
      <div class="dash-header-left">
        <h3>Inventario</h3>
        <p>${totalTypes} tipo${totalTypes !== 1 ? 's' : ''} · ${totalStock} pieza${totalStock !== 1 ? 's' : ''} en total</p>
      </div>
      <div class="dash-header-right">
        ${lowItems.length > 0 ? `<div class="stat-chip">⚠ <strong>${lowItems.length}</strong> bajo stock</div>` : ''}
      </div>
    </div>
    <div class="inventory-grid">${cards}</div>
  `;
}

/* ===== FAB ===== */
function toggleFabMenu() {
  state.fabOpen = !state.fabOpen;
  $('fab-menu').className = `fab-menu ${state.fabOpen ? 'show' : ''}`;
  $('fab').style.transform = state.fabOpen ? 'rotate(45deg)' : 'rotate(0deg)';
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  state.fabOpen = false;
  $('fab-menu').className = 'fab-menu';
}

/* ===== MODAL ===== */
async function showModal(title, renderFn, detailClass = false) {
  const inner = `<div class="load-spinner"></div>`;
  $('modal-inner').innerHTML = inner;
  $('modal-overlay').classList.add('open');
  if (detailClass) $('modal').classList.add('detail-modal');
  try {
    const content = await renderFn();
    $('modal-inner').innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      ${content}
    `;
  } catch (e) {
    $('modal-inner').innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="alert alert-error">${e.message}</div>
    `;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/* ===== HISTORY ===== */
async function deleteMovement(id) {
  if (!confirm('¿Eliminar este movimiento? El stock se recalculará.')) return;
  try {
    await api(`/api/movements/${id}`, { method: 'DELETE' });
    toast('Movimiento eliminado', 'success');
    showModal('Historial', renderHistory);
    await loadData();
  } catch (e) { toast(e.message, 'error'); }
}

async function renderHistory() {
  const movements = state.movements;
  if (movements.length === 0) {
    return `<div class="empty-state"><div class="icon">📋</div><h4>Sin movimientos</h4><p>Los movimientos de entrada y salida aparecerán aquí</p></div>`;
  }
  return `<div class="history-list">${movements.map(m => {
    const cls = m.movement_type === 'entry' ? '' : ' exit';
    const qtyCls = m.movement_type === 'entry' ? 'positive' : 'negative';
    const sign = m.movement_type === 'entry' ? '+' : '−';
    const typeLabel = m.movement_type === 'entry' ? 'Entrada' : 'Salida';
    const codeLabel = m.steel_type_code ? `<span style="font-size:.6875rem;color:var(--gray-400);font-weight:500">${m.steel_type_code}</span> ` : '';
    return `
      <div class="history-item${cls}">
        <div class="info">
          <strong class="type-name">${codeLabel}${m.steel_type_name}</strong>
          <span class="meta">
            <span>👤 ${m.registered_by_name}</span>
            ${m.person_name ? `<span>· 🚶 ${m.person_name}</span>` : ''}
            ${m.note ? `<span>· ${m.note}</span>` : ''}
          </span>
        </div>
        <div class="side">
          <div class="qty ${qtyCls}">${sign}${m.quantity}</div>
          <div class="date">${formatDate(m.created_at)}</div>
          ${state.user.role === 'admin' ? `<button class="del-btn" onclick="deleteMovement(${m.id})">Eliminar</button>` : ''}
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

/* ===== ADMIN ===== */
async function renderAdminPanel() {
  const [users, steelTypes] = await Promise.all([
    api('/api/users'),
    api('/api/steel-types'),
  ]);
  return `
    <div class="admin-tabs">
      <button class="tab active" onclick="switchAdminTab('users', this)">👥 Usuarios</button>
      <button class="tab" onclick="switchAdminTab('steel', this)">🔩 Tipos de Acero</button>
    </div>
    <div id="admin-users">
      <div class="admin-section-header">
        <h4>Usuarios (${users.length})</h4>
        <button class="btn btn-sm btn-primary" onclick="showCreateUserForm()">+ Nuevo</button>
      </div>
      ${users.length === 0 ? '<p class="text-sm text-muted">Sin usuarios</p>' :
      users.map(u => `
        <div class="user-row">
          <div class="info">
            <strong>${u.name}</strong>
            <small>@${u.username}</small>
          </div>
          <span class="role-badge role-admin">${u.role}</span>
          <button class="btn btn-sm btn-ghost" onclick="changeUserPassword(${u.id})" title="Cambiar contraseña">🔑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.name.replace(/'/g, "\\'")}')" title="Eliminar">✕</button>
        </div>
      `).join('')}
    </div>
    <div id="admin-steel" style="display:none">
      <div class="admin-section-header">
        <h4>Tipos de Acero (${steelTypes.length})</h4>
        <button class="btn btn-sm btn-primary" onclick="showCreateSteelForm()">+ Nuevo</button>
      </div>
      ${steelTypes.length === 0 ? '<div class="empty-state" style="padding:2rem"><div class="icon" style="width:48px;height:48px;font-size:1.25rem">🔩</div><h4 style="font-size:.875rem">Sin tipos registrados</h4><p style="font-size:.8125rem">Agrega tipos de acero para comenzar</p></div>' :
      steelTypes.map(s => `
        <div class="steel-row">
          <div class="info">
            <strong>${s.name}</strong>
            ${s.code ? `<small>Código: ${s.code}</small>` : ''}
          </div>
          <button class="btn btn-sm btn-danger" onclick="deleteSteelType(${s.id}, '${s.name.replace(/'/g, "\\'")}')" title="Eliminar">✕</button>
        </div>
      `).join('')}
    </div>
  `;
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-users').style.display = tab === 'users' ? 'block' : 'none';
  document.getElementById('admin-steel').style.display = tab === 'steel' ? 'block' : 'none';
}

/* ===== CREATE USER ===== */
async function showCreateUserForm() {
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>Nuevo Usuario</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-form">
      <div class="form-group"><label>Nombre</label><input type="text" id="form-name" placeholder="Nombre completo"></div>
      <div class="form-group"><label>Usuario</label><input type="text" id="form-username" placeholder="usuario"></div>
      <div class="form-group"><label>Contraseña</label><input type="password" id="form-password" placeholder="Mín. 4 caracteres"></div>
      <button class="btn btn-primary btn-block mt-1" onclick="createUser()">Crear Usuario</button>
    </div>
  `;
}

async function createUser() {
  const name = $('form-name').value.trim();
  const username = $('form-username').value.trim();
  const password = $('form-password').value;
  if (!name || !username || !password) return toast('Todos los campos son obligatorios', 'error');
  try {
    await api('/api/users', { method: 'POST', body: JSON.stringify({ name, username, password, role: 'admin' }) });
    toast('Usuario creado', 'success');
    closeModal();
    showModal('Panel Admin', renderAdminPanel);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm(`¿Eliminar a ${name}?`)) return;
  try {
    await api(`/api/users/${id}`, { method: 'DELETE' });
    toast('Usuario eliminado', 'success');
    showModal('Panel Admin', renderAdminPanel);
  } catch (e) { toast(e.message, 'error'); }
}

async function changeUserPassword(id) {
  const pwd = prompt('Nueva contraseña (mín. 4 caracteres):');
  if (!pwd || pwd.length < 4) return toast('Mínimo 4 caracteres', 'error');
  try {
    await api(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password: pwd }) });
    toast('Contraseña actualizada', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ===== CREATE STEEL TYPE ===== */
async function showCreateSteelForm() {
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>Nuevo Tipo de Acero</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-form">
      <div class="form-group"><label>Código</label><input type="text" id="form-steel-code" placeholder="Ej: HSS-100 (opcional)"></div>
      <div class="form-group"><label>Nombre</label><input type="text" id="form-steel-name" placeholder="Ej: Perfil HSS 100x100"></div>
      <button class="btn btn-primary btn-block mt-1" onclick="createSteelType()">Crear Tipo</button>
    </div>
  `;
}

async function createSteelType() {
  const name = $('form-steel-name').value.trim();
  const code = $('form-steel-code').value.trim();
  if (!name) return toast('Nombre requerido', 'error');
  try {
    await api('/api/steel-types', { method: 'POST', body: JSON.stringify({ name, code }) });
    toast('Tipo de acero creado', 'success');
    closeModal();
    await loadData();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSteelType(id, name) {
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  try {
    await api(`/api/steel-types/${id}`, { method: 'DELETE' });
    toast('Tipo de acero eliminado', 'success');
    showModal('Panel Admin', renderAdminPanel);
    await loadData();
  } catch (e) { toast(e.message, 'error'); }
}

/* ===== ENTRY/EXIT ===== */
function openEntryModal() {
  state.fabOpen = false;
  $('fab-menu').className = 'fab-menu';
  $('fab').style.transform = 'rotate(0deg)';
  if (state.steelTypes.length === 0) return toast('Primero crea un tipo de acero en Admin', 'info');
  const opts = state.steelTypes.map(s => `<option value="${s.id}">${s.code ? '[' + s.code + '] ' : ''}${s.name}</option>`).join('');
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>📥 Registrar Entrada</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-form">
      <div class="form-group"><label>Tipo de acero</label><select id="entry-type">${opts}</select></div>
      <div class="form-group"><label>Cantidad (piezas)</label><input type="number" id="entry-qty" min="1" value="1"></div>
      <div class="form-group"><label>Nota</label><textarea id="entry-note" placeholder="Opcional" rows="2"></textarea></div>
      <button class="btn btn-green btn-block mt-1" onclick="submitEntry()">Registrar Entrada</button>
    </div>
  `;
  $('modal-overlay').classList.add('open');
}

async function submitEntry() {
  const steel_type_id = parseInt($('entry-type').value);
  const quantity = parseInt($('entry-qty').value);
  const note = $('entry-note').value.trim();
  if (!quantity || quantity < 1) return toast('Cantidad inválida', 'error');
  try {
    await api('/api/movements/entry', { method: 'POST', body: JSON.stringify({ steel_type_id, quantity, note }) });
    toast(`Entrada registrada: +${quantity}`, 'success');
    closeModal();
    await loadData();
  } catch (e) { toast(e.message, 'error'); }
}

function openExitModal() {
  state.fabOpen = false;
  $('fab-menu').className = 'fab-menu';
  $('fab').style.transform = 'rotate(0deg)';
  if (state.steelTypes.length === 0) return toast('Primero crea un tipo de acero en Admin', 'info');
  const opts = state.steelTypes.map(s => `<option value="${s.id}">${s.code ? '[' + s.code + '] ' : ''}${s.name}</option>`).join('');
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>📤 Registrar Salida</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-form">
      <div class="form-group"><label>Tipo de acero</label><select id="exit-type">${opts}</select></div>
      <div class="form-group"><label>Cantidad (piezas)</label><input type="number" id="exit-qty" min="1" value="1"></div>
      <div class="form-group"><label>🚶 Nombre de quién sacó</label><input type="text" id="exit-person" placeholder="Obligatorio"></div>
      <div class="form-group"><label>Nota</label><textarea id="exit-note" placeholder="Opcional" rows="2"></textarea></div>
      <button class="btn btn-amber btn-block mt-1" onclick="submitExit()">Registrar Salida</button>
    </div>
  `;
  $('modal-overlay').classList.add('open');
}

async function submitExit() {
  const steel_type_id = parseInt($('exit-type').value);
  const quantity = parseInt($('exit-qty').value);
  const person_name = $('exit-person').value.trim();
  const note = $('exit-note').value.trim();
  if (!quantity || quantity < 1) return toast('Cantidad inválida', 'error');
  if (!person_name) return toast('Nombre de quién sacó es obligatorio', 'error');
  try {
    await api('/api/movements/exit', { method: 'POST', body: JSON.stringify({ steel_type_id, quantity, person_name, note }) });
    toast(`Salida registrada: −${quantity}`, 'success');
    closeModal();
    await loadData();
  } catch (e) { toast(e.message, 'error'); }
}

/* ===== AUTO-LOGIN ===== */
(async function() {
  const token = localStorage.getItem('acero_token');
  const userStr = localStorage.getItem('acero_user');
  if (token && userStr) {
    try {
      state.token = token;
      state.user = JSON.parse(userStr);
      const me = await api('/api/me');
      state.user = me;
      await initApp();
      return;
    } catch (_) {
      localStorage.removeItem('acero_token');
      localStorage.removeItem('acero_user');
    }
  }
  showLogin();
})();
