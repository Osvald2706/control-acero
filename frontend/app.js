const API = '';
let state = { user: null, token: null, inventory: [], steelTypes: [], movements: [], fabOpen: false, searchTerm: '' };

function apiBlob(path) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  return fetch(`${API}${path}`, { headers });
}

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

function showLoading() { $('loading-screen').style.display = 'flex'; $('login-screen').style.display = 'none'; $('app-screen').style.display = 'none'; }
function showLogin() { $('loading-screen').style.display = 'none'; $('login-screen').style.display = 'flex'; $('app-screen').style.display = 'none'; }
function showApp() { $('loading-screen').style.display = 'none'; $('login-screen').style.display = 'none'; $('app-screen').style.display = 'block'; }

async function handleLogin() {
  const u = $('login-user').value.trim();
  const p = $('login-pass').value;
  const btn = $('login-btn'); btn.disabled = true; btn.textContent = 'Ingresando...';
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    state.token = data.token; state.user = data.user;
    localStorage.setItem('acero_token', data.token);
    localStorage.setItem('acero_user', JSON.stringify(data.user));
    await initApp();
  } catch (e) { alert(e.message); }
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

async function exportExcel() {
  try {
    const res = await apiBlob('/api/inventory/export');
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventario_acero.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) { alert(e.message); }
}

function renderTopbar() {
  $('topbar').innerHTML = `
    <div class="topbar-left"><h2>⚙ Control Acero</h2></div>
    <div class="topbar-right">
      <span class="user-badge">${state.user.name}</span>
      <button class="topbar-btn" onclick="showModal('Historial', renderHistory)" title="Historial">📋</button>
      <button class="topbar-btn" onclick="exportExcel()" title="Exportar Excel">📥</button>
      ${state.user.role === 'admin' ? `<button class="topbar-btn" onclick="showModal('Panel Admin', renderAdminPanel)" title="Admin">⚙️</button>` : ''}
      <button class="topbar-btn" onclick="handleLogout()" title="Salir">🚪</button>
    </div>
  `;
}

function renderDashboard() {
  const searchTerm = (state.searchTerm || '').toLowerCase();
  const filtered = state.inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm) ||
    (item.description && item.description.toLowerCase().includes(searchTerm))
  );

  const cards = state.inventory.map(item => {
    const isLow = item.stock < 5;
    const visible = !searchTerm || item.name.toLowerCase().includes(searchTerm) ||
      (item.description && item.description.toLowerCase().includes(searchTerm));
    return `
      <div class="card" data-search="${(item.name + ' ' + (item.description || '')).toLowerCase()}" style="${visible ? '' : 'display:none'}">
        <div class="card-header">
          <div class="card-title">${item.name}${item.description ? `<br><small style="font-weight:400;color:var(--gray-400);font-size:.75rem">${item.description}</small>` : ''}</div>
          <div class="stock-badge ${isLow ? 'low' : 'ok'}">${item.stock}</div>
        </div>
        ${isLow ? '<div class="low-stock-alert">⚠️ Bajo stock</div>' : ''}
        <div class="card-meta">
          ${item.last_movement ? `<span>Último: ${item.last_movement.type === 'entry' ? 'Entrada' : 'Salida'} por ${item.last_movement.by} — ${formatDate(item.last_movement.date)}</span>` : '<span>Sin movimientos</span>'}
        </div>
      </div>
    `;
  }).join('');

  $('dashboard').innerHTML = `
    <div style="margin-bottom:.75rem">
      <input type="text" id="search-input" placeholder="Buscar material..." oninput="filterInventory(this.value)" style="width:100%;padding:.75rem 1rem;border:2px solid var(--gray-200);border-radius:12px;font-size:.9375rem;font-family:inherit;background:white;color:var(--gray-800);box-sizing:border-box">
    </div>
    <div style="margin-bottom:1rem;font-size:.75rem;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:.08em">
      Inventario actual
    </div>
    ${state.inventory.length === 0 ? '<div class="empty-state"><div class="icon">📦</div><p>No hay tipos de acero registrados</p></div>' : cards}
    <div id="search-empty" class="empty-state" style="display:none;margin-top:.75rem"><div class="icon">🔍</div><p>Sin resultados para "<span id="search-term-display"></span>"</p></div>
  `;
  if (searchTerm) $('search-input').value = state.searchTerm;
}

function filterInventory(value) {
  state.searchTerm = value;
  const term = value.toLowerCase();
  let visibleCount = 0;
  document.querySelectorAll('.card').forEach(el => {
    const visible = !term || el.dataset.search.includes(term);
    el.style.display = visible ? '' : 'none';
    if (visible) visibleCount++;
  });
  const emptyMsg = document.getElementById('search-empty');
  const termDisplay = document.getElementById('search-term-display');
  if (emptyMsg) {
    emptyMsg.style.display = visibleCount === 0 && term ? '' : 'none';
    if (termDisplay) termDisplay.textContent = value;
  }
}

function toggleFabMenu() {
  state.fabOpen = !state.fabOpen;
  $('fab-menu').className = `fab-menu ${state.fabOpen ? 'open' : ''}`;
  $('fab').textContent = state.fabOpen ? '×' : '+';
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  state.fabOpen = false;
  $('fab-menu').className = 'fab-menu';
  $('fab').textContent = '+';
}

async function showModal(title, renderFn) {
  $('modal-inner').innerHTML = '<div class="load-spinner" style="text-align:center;padding:2rem"><div style="display:inline-block;width:32px;height:32px;border:3px solid var(--gray-200);border-top-color:var(--primary);border-radius:50%;animation:spin .7s linear infinite"></div></div>';
  $('modal-overlay').classList.add('open');
  try {
    const content = await renderFn();
    $('modal-inner').innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
      </div>
      ${content}
    `;
  } catch (e) {
    $('modal-inner').innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
      </div>
      <div class="alert alert-error">${e.message}</div>
    `;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function deleteMovement(id) {
  if (!confirm('¿Eliminar este movimiento? El stock se recalculará automáticamente.')) return;
  try {
    await api(`/api/movements/${id}`, { method: 'DELETE' });
    showModal('Historial', renderHistory);
    await loadData();
  } catch (e) { alert(e.message); }
}

async function renderHistory() {
  let movements = state.movements;
  if (movements.length === 0) return '<div class="empty-state"><div class="icon">📋</div><p>Sin movimientos</p></div>';
  return movements.map(m => {
    const cls = m.movement_type === 'entry' ? '' : ' exit';
    const qtyCls = m.movement_type === 'entry' ? 'positive' : 'negative';
    const sign = m.movement_type === 'entry' ? '+' : '−';
    return `
      <div class="history-item${cls}">
        <div class="info">
          <strong>${m.steel_type_name}</strong>
          <small>${m.registered_by_name}${m.person_name ? ' · ' + m.person_name : ''}${m.note ? ' · ' + m.note : ''}</small>
        </div>
        <div style="text-align:right">
          <div class="qty ${qtyCls}">${sign}${m.quantity}</div>
          <div class="date">${formatDate(m.created_at)}</div>
          ${state.user.role === 'admin' ? `<button class="btn btn-sm btn-danger" style="margin-top:4px;padding:2px 8px;font-size:11px" onclick="deleteMovement(${m.id})">×</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function renderAdminPanel() {
  const [users, steelTypes] = await Promise.all([
    api('/api/users'),
    api('/api/steel-types'),
  ]);
  return `
    <div class="admin-tabs" id="admin-tabs">
      <button class="tab active" onclick="switchAdminTab('users', this)">Usuarios</button>
      <button class="tab" onclick="switchAdminTab('steel', this)">Tipos de Acero</button>
    </div>
    <div id="admin-users">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <strong style="font-size:.875rem">Usuarios (${users.length})</strong>
        <button class="btn btn-sm btn-primary" onclick="showCreateUserForm()">+ Nuevo</button>
      </div>
      ${users.map(u => `
        <div class="user-row">
          <div class="info">
            <strong>${u.name}</strong>
            <small>@${u.username}</small>
          </div>
          <span class="role-badge role-admin">${u.role}</span>
          <button class="btn btn-sm btn-ghost" onclick="changeUserPassword(${u.id})">🔑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.name}')">×</button>
        </div>
      `).join('')}
    </div>
    <div id="admin-steel" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <strong style="font-size:.875rem">Tipos de Acero (${steelTypes.length})</strong>
        <button class="btn btn-sm btn-primary" onclick="showCreateSteelForm()">+ Nuevo</button>
      </div>
      ${steelTypes.map(s => `
        <div class="steel-row">
          <div class="info"><strong>${s.name}</strong>${s.description ? `<br><small>${s.description}</small>` : ''}</div>
          <button class="btn btn-sm btn-danger" onclick="deleteSteelType(${s.id}, '${s.name.replace(/'/g, "\\'")}')">×</button>
        </div>
      `).join('')}
    </div>
  `;
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('#admin-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-users').style.display = tab === 'users' ? 'block' : 'none';
  document.getElementById('admin-steel').style.display = tab === 'steel' ? 'block' : 'none';
}

async function showCreateUserForm() {
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>Nuevo Usuario</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
    </div>
    <div class="form-group"><label>Nombre</label><input type="text" id="form-name" placeholder="Nombre completo"></div>
    <div class="form-group"><label>Usuario</label><input type="text" id="form-username" placeholder="usuario"></div>
    <div class="form-group"><label>Contraseña</label><input type="password" id="form-password" placeholder="Contraseña"></div>
    <button class="btn btn-primary btn-block" onclick="createUser()">Crear Usuario</button>
  `;
}

async function createUser() {
  const name = $('form-name').value.trim();
  const username = $('form-username').value.trim();
  const password = $('form-password').value;
  if (!name || !username || !password) return alert('Todos los campos son obligatorios');
  try {
    await api('/api/users', { method: 'POST', body: JSON.stringify({ name, username, password, role: 'admin' }) });
    closeModal();
    showModal('Panel Admin', renderAdminPanel);
  } catch (e) { alert(e.message); }
}

async function deleteUser(id, name) {
  if (!confirm(`¿Eliminar a ${name}?`)) return;
  try {
    await api(`/api/users/${id}`, { method: 'DELETE' });
    showModal('Panel Admin', renderAdminPanel);
  } catch (e) { alert(e.message); }
}

async function changeUserPassword(id) {
  const pwd = prompt('Nueva contraseña (mín. 4 caracteres):');
  if (!pwd || pwd.length < 4) return alert('Contraseña debe tener al menos 4 caracteres');
  try {
    await api(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password: pwd }) });
    alert('Contraseña actualizada');
  } catch (e) { alert(e.message); }
}

async function showCreateSteelForm() {
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>Nuevo Tipo de Acero</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
    </div>
    <div class="form-group"><label>Nombre</label><input type="text" id="form-steel-name" placeholder="Ej: Perfil HSS 100x100"></div>
    <div class="form-group"><label>Descripción</label><textarea id="form-steel-desc" placeholder="Opcional" rows="2"></textarea></div>
    <button class="btn btn-primary btn-block" onclick="createSteelType()">Crear</button>
  `;
}

async function createSteelType() {
  const name = $('form-steel-name').value.trim();
  const description = $('form-steel-desc').value.trim();
  if (!name) return alert('Nombre requerido');
  try {
    await api('/api/steel-types', { method: 'POST', body: JSON.stringify({ name, description }) });
    closeModal();
    await loadData();
  } catch (e) { alert(e.message); }
}

async function deleteSteelType(id, name) {
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  try {
    await api(`/api/steel-types/${id}`, { method: 'DELETE' });
    showModal('Panel Admin', renderAdminPanel);
    await loadData();
  } catch (e) { alert(e.message); }
}

function openEntryModal() {
  state.fabOpen = false;
  $('fab-menu').className = 'fab-menu';
  $('fab').textContent = '+';
  const opts = state.steelTypes.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>Registrar Entrada</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
    </div>
    <div class="form-group"><label>Tipo de acero</label><select id="entry-type">${opts}</select></div>
    <div class="form-group"><label>Cantidad (piezas)</label><input type="number" id="entry-qty" min="1" value="1"></div>
    <div class="form-group"><label>Nota</label><textarea id="entry-note" placeholder="Opcional"></textarea></div>
    <button class="btn btn-green btn-block" onclick="submitEntry()">Registrar Entrada</button>
  `;
  $('modal-overlay').classList.add('open');
}

async function submitEntry() {
  const steel_type_id = parseInt($('entry-type').value);
  const quantity = parseInt($('entry-qty').value);
  const note = $('entry-note').value.trim();
  if (!quantity || quantity < 1) return alert('Cantidad inválida');
  try {
    await api('/api/movements/entry', { method: 'POST', body: JSON.stringify({ steel_type_id, quantity, note }) });
    closeModal();
    await loadData();
  } catch (e) { alert(e.message); }
}

function openExitModal() {
  state.fabOpen = false;
  $('fab-menu').className = 'fab-menu';
  $('fab').textContent = '+';
  const opts = state.steelTypes.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  $('modal-inner').innerHTML = `
    <div class="modal-header">
      <h3>Registrar Salida</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">×</button>
    </div>
    <div class="form-group"><label>Tipo de acero</label><select id="exit-type">${opts}</select></div>
    <div class="form-group"><label>Cantidad (piezas)</label><input type="number" id="exit-qty" min="1" value="1"></div>
    <div class="form-group"><label>Nombre de quién sacó</label><input type="text" id="exit-person" placeholder="Obligatorio"></div>
    <div class="form-group"><label>Nota</label><textarea id="exit-note" placeholder="Opcional"></textarea></div>
    <button class="btn btn-amber btn-block" onclick="submitExit()">Registrar Salida</button>
  `;
  $('modal-overlay').classList.add('open');
}

async function submitExit() {
  const steel_type_id = parseInt($('exit-type').value);
  const quantity = parseInt($('exit-qty').value);
  const person_name = $('exit-person').value.trim();
  const note = $('exit-note').value.trim();
  if (!quantity || quantity < 1) return alert('Cantidad inválida');
  if (!person_name) return alert('Nombre de quién sacó es obligatorio');
  try {
    await api('/api/movements/exit', { method: 'POST', body: JSON.stringify({ steel_type_id, quantity, person_name, note }) });
    closeModal();
    await loadData();
  } catch (e) { alert(e.message); }
}

// Auto-login
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
