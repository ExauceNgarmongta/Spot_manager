(function () {
  const container = document.getElementById('public-offer');
  const shareId = new URLSearchParams(window.location.search).get('id');

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

  function showError(message) {
    container.innerHTML = `<article class="public-offer-card"><h1 class="public-offer-error">${escapeHtml(message)}</h1></article>`;
  }

  if (!shareId || !/^[a-f0-9]{32}$/.test(shareId)) {
    showError('Le lien de cette offre est invalide.');
    return;
  }

  fetch(`../offers-api.php?action=public&id=${encodeURIComponent(shareId)}`)
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Cette offre est indisponible.');
      return result.offer;
    })
    .then(offer => {
      const volume = offer.quotaGb === null ? 'Volume illimité' : `${Number(offer.quotaGb).toFixed(1)} GB`;
      const duration = Number(offer.durationDays) === 1
        ? '1 jour'
        : `${escapeHtml(offer.durationDays)} jours`;
      const formattedPrice = formatFcfa(offer.price);
      document.title = `${formattedPrice} · SpotManager`;
      container.innerHTML = `<article class="public-offer-card">
        <p class="public-offer-brand">Forfait WiFi · Portal</p>
        <h1>Votre offre d’accès</h1>
        <p class="public-offer-price">${escapeHtml(formattedPrice)}</p>
        <div class="public-offer-details">
          <span>${duration}</span>
          <span>${escapeHtml(volume)}</span>
        </div>
        <a class="button-primary" href="offres.html">Découvrir les autres offres</a>
      </article>`;
    })
    .catch(error => showError(error.message));
})();
