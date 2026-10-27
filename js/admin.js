(function () {
  localStorage.removeItem('spotmanager-network-demo-v1');

  const routerRows = document.getElementById('router-rows');
  const sessionRows = document.getElementById('session-rows');
  const navToggle = document.getElementById('nav-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const state = { routers: [], sessions: [] };
  let adminToken = sessionStorage.getItem('spotmanager-admin-token') || '';
  let liveMode = false;
  let toastTimer;

  function closeMobileMenu() {
    document.body.classList.remove('mobile-nav-open');
    navToggle.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-visible');
    overlay.hidden = true;
  }

  navToggle.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('mobile-nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    sidebar.setAttribute('aria-hidden', String(!isOpen));
    overlay.hidden = !isOpen;
    overlay.classList.toggle('is-visible', isOpen);
  });
  overlay.addEventListener('click', closeMobileMenu);
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('mobile-nav-open')) closeMobileMenu();
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function routerFor(session) {
    return state.routers.find(router => router.id === session.routerId);
  }

  function render() {
    const search = document.getElementById('session-search').value.trim().toLowerCase();
    const visibleSessions = state.sessions.filter(session => {
      const router = routerFor(session);
      return session.username.toLowerCase().includes(search) || (router && router.name.toLowerCase().includes(search));
    });

    routerRows.innerHTML = state.routers.map(router => {
      const sessions = state.sessions.filter(session => session.routerId === router.id).length;
      return `<tr>
        <td><span class="router-name">${escapeHtml(router.name)}</span><span class="router-subtitle">API REST · RouterOS v7</span></td>
        <td class="mono">${escapeHtml(router.host)}</td>
        <td>${escapeHtml(router.location)}</td>
        <td><span class="status-pill ${router.online ? '' : 'offline'}">${router.online ? 'En ligne' : 'Hors ligne'}</span></td>
        <td>${sessions}</td>
        <td><button class="row-action" type="button" data-router-action="check" data-id="${escapeHtml(router.id)}">Actualiser</button></td>
      </tr>`;
    }).join('');
    document.getElementById('router-empty').hidden = state.routers.length > 0;

    sessionRows.innerHTML = visibleSessions.map(session => {
      const router = routerFor(session);
      const percent = session.quota ? Math.min(100, Math.round((session.used / session.quota) * 100)) : null;
      const usageClass = percent >= 95 ? 'over-limit' : percent >= 80 ? 'near-limit' : '';
      return `<tr>
        <td class="router-name">${escapeHtml(session.username)}</td>
        <td>${escapeHtml(router ? router.name : 'Routeur retiré')}</td>
        <td>${escapeHtml(session.profile)}</td>
        <td>${escapeHtml(session.remaining)}</td>
        <td class="usage-cell"><div class="usage-value"><span>${percent === null ? `${session.used} Mo utilisés` : `${session.used} / ${session.quota} Mo`}</span><strong>${percent === null ? '—' : `${percent}%`}</strong></div><div class="usage-track"><div class="usage-fill ${usageClass}" style="width:${percent ?? 0}%"></div></div></td>
        <td><span class="session-status ${percent !== null && percent >= 95 ? 'alert' : ''}">${percent !== null && percent >= 95 ? 'Quota presque atteint' : 'Connecté'}</span></td>
        <td><button class="row-action" type="button" data-session-action="disconnect" data-id="${escapeHtml(session.id)}">Déconnecter</button></td>
      </tr>`;
    }).join('');
    document.getElementById('session-empty').hidden = visibleSessions.length > 0;
    document.getElementById('session-empty').textContent = search
      ? 'Aucune session ne correspond à cette recherche.'
      : 'Aucune session active remontée par le routeur.';

    document.getElementById('online-count').textContent = state.routers.filter(router => router.online).length;
    document.getElementById('session-count').textContent = state.sessions.length;
    document.getElementById('alert-count').textContent = state.sessions.filter(session => session.quota && session.used / session.quota >= .95).length;
    document.getElementById('last-check').textContent = liveMode
      ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
      : '—';
    document.getElementById('demo-notice').hidden = liveMode;
    document.getElementById('connection-state').innerHTML = `<span class="mode-dot ${liveMode ? 'connected' : ''}"></span>${liveMode ? 'Routeur connecté' : 'Routeur déconnecté'}`;
    document.getElementById('connect-router-open').hidden = liveMode;
    document.getElementById('disconnect-router').hidden = !liveMode;
    updateRouterOptions();
  }

  async function apiRequest(action, options = {}) {
    const response = await fetch(`../api.php?action=${encodeURIComponent(action)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
        ...(options.headers || {})
      }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Erreur HTTP ${response.status}`);
    return result;
  }

  async function refreshLiveData() {
    const data = await apiRequest('overview');
    state.routers = [data.router];
    state.sessions = data.sessions.map(session => ({ ...session, quota: session.quota || null }));
    liveMode = true;
    render();
  }

  function updateRouterOptions() {
    const select = document.getElementById('access-router');
    select.innerHTML = state.routers.map(router => `<option value="${escapeHtml(router.id)}">${escapeHtml(router.name)}</option>`).join('');
    document.getElementById('create-access-open').disabled = !liveMode || state.routers.length === 0;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog.showModal) dialog.showModal();
    else showToast('Cette fenêtre nécessite un navigateur récent.');
  }

  document.getElementById('create-access-open').addEventListener('click', () => openDialog('access-dialog'));
  document.getElementById('connect-router-open').addEventListener('click', () => openDialog('connect-dialog'));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.getElementById('session-search').addEventListener('input', render);

  document.getElementById('connect-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    adminToken = String(form.get('token')).trim();
    try {
      await refreshLiveData();
      sessionStorage.setItem('spotmanager-admin-token', adminToken);
      event.currentTarget.reset();
      document.getElementById('connect-dialog').close();
      showToast('Connexion au routeur réussie.');
    } catch (error) {
      adminToken = '';
      showToast(error.message);
    }
  });

  document.getElementById('disconnect-router').addEventListener('click', () => {
    adminToken = '';
    liveMode = false;
    sessionStorage.removeItem('spotmanager-admin-token');
    render();
    showToast('Déconnecté du routeur.');
  });

  document.getElementById('access-form').addEventListener('submit', event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const quotaMatch = String(form.get('quota')).trim().match(/^(\d+(?:\.\d+)?)\s*(M|G)$/i);
    if (!quotaMatch) {
      showToast('Indiquez un quota au format 500M ou 1G.');
      return;
    }
    apiRequest('create_user', {
      method: 'POST',
      body: JSON.stringify({
        username: form.get('username').trim(),
        password: form.get('password'),
        profile: form.get('profile'),
        limitUptime: form.get('duration').trim(),
        limitBytes: form.get('quota').trim()
      })
    }).then(async () => {
      await refreshLiveData();
      formElement.reset();
      document.getElementById('access-dialog').close();
      showToast('Compte hotspot créé sur le routeur.');
    }).catch(error => showToast(error.message));
  });

  routerRows.addEventListener('click', event => {
    const button = event.target.closest('[data-router-action]');
    if (!button) return;
    const router = state.routers.find(item => item.id === button.dataset.id);
    if (!router) return;
    if (button.dataset.routerAction === 'check' && liveMode) {
      refreshLiveData().then(() => showToast('État du routeur actualisé.')).catch(error => showToast(error.message));
    }
  });

  sessionRows.addEventListener('click', event => {
    const button = event.target.closest('[data-session-action="disconnect"]');
    if (!button) return;
    const session = state.sessions.find(item => item.id === button.dataset.id);
    if (!session || !window.confirm(`Déconnecter ${session.username} du routeur ?`)) return;
    apiRequest('disconnect', { method: 'POST', body: JSON.stringify({ username: session.username }) })
      .then(async result => {
        await refreshLiveData();
        showToast(result.disconnected ? 'Session déconnectée du routeur.' : 'Aucune session active trouvée.');
      })
      .catch(error => showToast(error.message));
  });

  document.getElementById('refresh-network').addEventListener('click', () => {
    if (liveMode) {
      refreshLiveData().then(() => showToast('Données MikroTik actualisées.')).catch(error => showToast(error.message));
      return;
    }
    render();
    showToast('Connectez le routeur pour charger les données réelles.');
  });

  render();
  if (adminToken) {
    refreshLiveData().catch(error => {
      adminToken = '';
      sessionStorage.removeItem('spotmanager-admin-token');
      showToast(error.message);
    });
  }
})();