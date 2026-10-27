(function () {
  const ticketRows = document.getElementById('ticket-rows');
  const navToggle = document.getElementById('nav-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const state = { tickets: [] };
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

  function quotaPercent(ticket) {
    return ticket.quotaMb ? Math.min(100, Math.floor(ticket.usedMb / ticket.quotaMb * 100)) : null;
  }

  function render() {
    const search = document.getElementById('ticket-search').value.trim().toLocaleLowerCase('fr');
    const visibleTickets = state.tickets.filter(ticket =>
      [ticket.username, ticket.profile, ticket.comment].some(value => String(value || '').toLocaleLowerCase('fr').includes(search))
    );

    ticketRows.innerHTML = visibleTickets.map(ticket => {
      const percent = quotaPercent(ticket);
      const usageClass = percent >= 95 ? 'over-limit' : percent >= 80 ? 'near-limit' : '';
      const exhausted = ticket.timeExpired || (percent !== null && percent >= 100);
      const stateLabel = ticket.active ? 'Connecté' : exhausted ? 'Épuisé' : 'Disponible';
      const stateClass = ticket.active ? '' : exhausted ? 'alert' : 'inactive';
      return `<tr>
        <td><span class="router-name">${escapeHtml(ticket.username)}</span>${ticket.comment ? `<span class="router-subtitle">${escapeHtml(ticket.comment)}</span>` : ''}</td>
        <td>${escapeHtml(ticket.profile)}</td>
        <td class="usage-cell"><div class="usage-value"><span>${percent === null ? `${ticket.usedMb} Mo utilisés` : `${ticket.usedMb} / ${ticket.quotaMb} Mo`}</span><strong>${percent === null ? '—' : `${percent}%`}</strong></div><div class="usage-track"><div class="usage-fill ${usageClass}" style="width:${percent ?? 0}%"></div></div></td>
        <td>${escapeHtml(ticket.remaining)}</td>
        <td><span class="session-status ${stateClass}">${stateLabel}</span></td>
      </tr>`;
    }).join('');
    document.getElementById('ticket-empty').hidden = visibleTickets.length > 0;
    document.getElementById('ticket-empty').textContent = liveMode
      ? (search ? 'Aucun ticket ne correspond à cette recherche.' : 'Aucun ticket enregistré sur le routeur.')
      : 'Connectez le routeur pour afficher les tickets.';
    document.getElementById('ticket-count').textContent = liveMode ? visibleTickets.length : '—';
    document.getElementById('active-count').textContent = liveMode ? state.tickets.filter(ticket => ticket.active).length : '—';
    document.getElementById('quota-alert-count').textContent = liveMode
      ? state.tickets.filter(ticket => quotaPercent(ticket) !== null && quotaPercent(ticket) >= 100).length
      : '—';
    document.getElementById('last-check').textContent = liveMode
      ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
      : '—';
    document.getElementById('demo-notice').hidden = liveMode;
    document.getElementById('connection-state').innerHTML = `<span class="mode-dot ${liveMode ? 'connected' : ''}"></span>${liveMode ? 'Routeur connecté' : 'Routeur déconnecté'}`;
    document.getElementById('connect-router-open').hidden = liveMode;
    document.getElementById('disconnect-router').hidden = !liveMode;
    document.getElementById('create-ticket-open').disabled = !liveMode;
  }

  async function apiRequest(action, options = {}) {
    const response = await fetch(`../api.php?action=${encodeURIComponent(action)}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken, ...(options.headers || {}) }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Erreur HTTP ${response.status}`);
    return result;
  }

  async function refreshTickets() {
    const data = await apiRequest('tickets');
    state.tickets = data.tickets;
    liveMode = true;
    render();
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

  document.getElementById('create-ticket-open').addEventListener('click', () => openDialog('ticket-dialog'));
  document.getElementById('connect-router-open').addEventListener('click', () => openDialog('connect-dialog'));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.getElementById('ticket-search').addEventListener('input', render);
  document.getElementById('refresh-tickets').addEventListener('click', () => {
    if (!liveMode) return openDialog('connect-dialog');
    refreshTickets().then(() => showToast('Tickets actualisés.')).catch(error => showToast(error.message));
  });

  document.getElementById('connect-form').addEventListener('submit', async event => {
    event.preventDefault();
    adminToken = String(new FormData(event.currentTarget).get('token')).trim();
    try {
      await refreshTickets();
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
    state.tickets = [];
    sessionStorage.removeItem('spotmanager-admin-token');
    render();
  });

  document.getElementById('ticket-form').addEventListener('submit', event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!/^\d+(?:\.\d+)?\s*(?:M|G)$/i.test(String(form.get('quota')).trim())) {
      showToast('Indiquez un quota au format 500M ou 1G.');
      return;
    }
    apiRequest('create_user', {
      method: 'POST',
      body: JSON.stringify({
        username: String(form.get('username')).trim(),
        password: form.get('password'),
        profile: form.get('profile'),
        limitUptime: String(form.get('duration')).trim(),
        limitBytes: String(form.get('quota')).trim()
      })
    }).then(async () => {
      await refreshTickets();
      formElement.reset();
      document.getElementById('ticket-dialog').close();
      showToast('Ticket créé sur le routeur.');
    }).catch(error => showToast(error.message));
  });

  render();
  if (adminToken) refreshTickets().catch(error => {
    adminToken = '';
    sessionStorage.removeItem('spotmanager-admin-token');
    showToast(error.message);
  });
})();