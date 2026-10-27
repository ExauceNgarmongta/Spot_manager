(function () {
  const grid = document.getElementById('offer-grid');
  const dialog = document.getElementById('offer-dialog');
  const form = document.getElementById('offer-form');
  const title = document.getElementById('offer-dialog-title');
  const errorBox = document.getElementById('offer-form-error');
  const toast = document.getElementById('offer-toast');
  const authDialog = document.getElementById('offers-auth-dialog');
  const authForm = document.getElementById('offers-auth-form');
  const authError = document.getElementById('offers-auth-error');
  const quotaInput = form.elements.quotaGb;
  const unlimitedInput = form.elements.unlimited;
  let adminToken = sessionStorage.getItem('spotmanager-admin-token') || '';
  let offers = [];
  let editingId = null;
  let pendingMode = null;
  let toastTimer;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function formatFcfa(value) {
    return `${new Intl.NumberFormat('fr-CM', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  async function apiRequest(action, options = {}, token = adminToken) {
    const response = await fetch(`../offers-api.php?action=${encodeURIComponent(action)}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Admin-Token': token } : {}),
        ...(options.headers || {})
      }
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Réponse serveur invalide (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      const error = new Error(result.error || `Erreur HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function shareUrl(offer) {
    const url = new URL('offre.html', window.location.href);
    url.searchParams.set('id', offer.shareId);
    return url.toString();
  }

  function render() {
    grid.hidden = false;
    if (offers.length === 0) {
      grid.innerHTML = '<p class="empty-state">Aucune offre. Créez votre première offre.</p>';
      return;
    }

    grid.innerHTML = offers.map(offer => {
      const volume = offer.quotaGb === null ? 'Illimité' : `${Number(offer.quotaGb).toFixed(1)} GB`;
      const duration = Number(offer.durationDays) === 1
        ? '1 jour'
        : `${escapeHtml(offer.durationDays)} jours`;
      const url = shareUrl(offer);
      return `<article class="offer-item ${offer.active ? '' : 'is-inactive'}" data-offer-id="${escapeHtml(offer.id)}">
        <div class="offer-header">
          <div class="offer-amount">${escapeHtml(formatFcfa(offer.price))}</div>
          <div class="offer-actions">
            <button type="button" class="mini-action" data-action="copy" aria-label="Dupliquer l’offre de ${escapeHtml(offer.price)} francs" title="Dupliquer">⧉</button>
            <button type="button" class="mini-action" data-action="edit" aria-label="Modifier l’offre de ${escapeHtml(offer.price)} francs" title="Modifier">✎</button>
            <button type="button" class="mini-action" data-action="delete" aria-label="Supprimer l’offre de ${escapeHtml(offer.price)} francs" title="Supprimer">×</button>
          </div>
        </div>
        <div class="offer-status-row">
          <span class="status-text ${offer.active ? 'is-active' : ''}">${offer.active ? 'Actif' : 'Inactif'}</span>
          <button type="button" class="offer-switch ${offer.active ? 'is-on' : ''}" aria-label="Activer ou désactiver l’offre" aria-pressed="${offer.active}">
            <span class="switch-thumb"></span>
          </button>
          ${offer.portal ? '<span class="portal-pill">Portal</span>' : ''}
        </div>
        <div class="detail-row"><span class="detail-icon" aria-hidden="true">◔</span> ${escapeHtml(duration)}</div>
        <div class="detail-row"><span class="detail-icon" aria-hidden="true">◉</span> ${escapeHtml(volume)}</div>
        <div class="detail-row price-row"><span class="detail-icon" aria-hidden="true">FCFA</span> ${escapeHtml(formatFcfa(offer.price))}</div>
        ${offer.active ? `<div class="offer-share-row">
          <a class="offer-share-url" href="${escapeHtml(url)}" title="${escapeHtml(url)}">Lien de partage</a>
          <button class="offer-share-button" type="button" data-action="share" aria-label="Copier le lien de l’offre" title="Copier le lien">Copier le lien</button>
        </div>` : '<div class="offer-share-row"><span class="offer-share-url">Réactivez l’offre pour partager son lien.</span></div>'}
      </article>`;
    }).join('');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  function setFormError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function setAuthError(message) {
    authError.textContent = message;
    authError.hidden = !message;
  }

  function openForm(mode, offer = null) {
    if (!adminToken) {
      pendingMode = mode;
      setAuthError('');
      authDialog.showModal();
      return;
    }
    form.reset();
    setFormError('');
    editingId = mode === 'edit' ? offer.id : null;
    title.textContent = mode === 'edit'
      ? 'Modifier l’offre'
      : mode === 'copy'
        ? 'Dupliquer l’offre'
        : 'Nouvelle offre';
    if (offer) {
      form.elements.price.value = offer.price;
      form.elements.durationDays.value = offer.durationDays;
      form.elements.unlimited.checked = offer.quotaGb === null;
      form.elements.quotaGb.value = offer.quotaGb ?? '';
      form.elements.active.checked = offer.active;
    }
    updateQuotaField();
    dialog.showModal();
    form.elements.price.focus();
  }

  function updateQuotaField() {
    quotaInput.disabled = unlimitedInput.checked;
    quotaInput.required = !unlimitedInput.checked;
    quotaInput.closest('label').classList.toggle('is-disabled', unlimitedInput.checked);
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = value;
    temporaryInput.style.position = 'fixed';
    temporaryInput.style.opacity = '0';
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand('copy');
    temporaryInput.remove();
    if (!copied) throw new Error('Le navigateur a refusé la copie.');
  }

  async function loadOffers(token) {
    const result = await apiRequest('list', {}, token);
    offers = result.offers;
    adminToken = token;
    sessionStorage.setItem('spotmanager-admin-token', token);
    render();
  }

  document.getElementById('offer-create-open').addEventListener('click', () => openForm('create'));
  document.querySelectorAll('[data-close-offer-dialog]').forEach(button => {
    button.addEventListener('click', () => dialog.close());
  });
  document.querySelectorAll('[data-close-auth-dialog]').forEach(button => {
    button.addEventListener('click', () => authDialog.close());
  });
  unlimitedInput.addEventListener('change', updateQuotaField);

  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    setAuthError('');
    const token = String(new FormData(authForm).get('token') || '').trim();
    try {
      await loadOffers(token);
      authForm.reset();
      authDialog.close();
      const requestedMode = pendingMode;
      pendingMode = null;
      if (requestedMode) openForm(requestedMode);
      showToast('Connexion administrateur réussie.');
    } catch (error) {
      adminToken = '';
      sessionStorage.removeItem('spotmanager-admin-token');
      setAuthError(error.message);
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setFormError('');
    const data = new FormData(form);
    const payload = {
      price: Number(data.get('price')),
      durationDays: Number(data.get('durationDays')),
      quotaGb: data.get('unlimited') === 'on' ? null : Number(data.get('quotaGb')),
      active: data.get('active') === 'on'
    };
    const action = editingId ? 'update' : 'create';
    if (editingId) payload.id = editingId;
    try {
      const result = await apiRequest(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (editingId) {
        offers = offers.map(offer => offer.id === editingId ? result.offer : offer);
      } else {
        offers.unshift(result.offer);
      }
      render();
      dialog.close();
      showToast(editingId ? 'Offre modifiée.' : 'Offre créée avec un lien unique.');
    } catch (error) {
      setFormError(error.message);
      if (error.status === 401) {
        adminToken = '';
        sessionStorage.removeItem('spotmanager-admin-token');
      }
    }
  });

  grid.addEventListener('click', async event => {
    const switchButton = event.target.closest('.offer-switch');
    if (switchButton) {
      const card = switchButton.closest('.offer-item');
      const offer = offers.find(item => item.id === card.dataset.offerId);
      try {
        const result = await apiRequest('update', {
          method: 'POST',
          body: JSON.stringify({ ...offer, active: !offer.active })
        });
        offers = offers.map(item => item.id === offer.id ? result.offer : item);
        render();
      } catch (error) {
        showToast(`Impossible de modifier l’offre : ${error.message}`);
      }
      return;
    }

    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('.offer-item');
    const offer = offers.find(item => item.id === card.dataset.offerId);
    if (!offer) return;

    if (button.dataset.action === 'copy') {
      openForm('copy', offer);
    } else if (button.dataset.action === 'edit') {
      openForm('edit', offer);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('Supprimer cette offre ? Cette action est définitive.')) return;
      try {
        await apiRequest('delete', {
          method: 'POST',
          body: JSON.stringify({ id: offer.id })
        });
        offers = offers.filter(item => item.id !== offer.id);
        render();
        showToast('Offre supprimée.');
      } catch (error) {
        showToast(`Impossible de supprimer l’offre : ${error.message}`);
      }
    } else if (button.dataset.action === 'share') {
      try {
        await copyText(shareUrl(offer));
        showToast('Lien de partage copié.');
      } catch (error) {
        showToast(`Impossible de copier le lien : ${error.message}`);
      }
    }
  });

  if (adminToken) {
    loadOffers(adminToken).catch(error => {
      adminToken = '';
      sessionStorage.removeItem('spotmanager-admin-token');
      grid.hidden = false;
      grid.innerHTML = `<p class="offers-access-note">${escapeHtml(error.message)} Cliquez sur « Nouvelle offre » pour vous connecter et charger le catalogue.</p>`;
    });
  } else {
    grid.hidden = false;
    grid.innerHTML = '<p class="offers-access-note">Cliquez sur « Nouvelle offre » pour vous connecter et consulter le catalogue.</p>';
  }
})();
