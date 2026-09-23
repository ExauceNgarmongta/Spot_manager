// Mode lecture publique par défaut.
// L'authentification Google ne s'active que si un vrai Client ID est fourni.

function handleCredentialResponse(response){
  console.log('ID token reçu (exemple):', response.credential);
  const card = document.querySelector('.card');
  if (!card) return;

  const p = document.createElement('p');
  p.textContent = 'Connexion réussie (prototype). Token reçu côté client.';
  p.style.color = 'green';
  card.appendChild(p);
}

window.addEventListener('DOMContentLoaded', function(){
  const signInEl = document.querySelector('.g_id_signin');
  const onloadEl = document.getElementById('g_id_onload');
  const clientId = onloadEl ? onloadEl.dataset.client_id : '';
  const hasValidClientId = Boolean(clientId) && clientId !== 'REPLACE_WITH_GOOGLE_CLIENT_ID';

  if (!hasValidClientId) {
    if (signInEl) signInEl.style.display = 'none';
    const customBtn = document.getElementById('custom-google-btn');
    if (customBtn) customBtn.style.display = 'none';
    console.info('Mode lecture activé : aucune connexion requise pour lire le contenu.');
    return;
  }

  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
    });

    if (signInEl) {
      google.accounts.id.renderButton(signInEl, { theme: 'outline', size: 'large' });
    }

    window.customSignIn = function(){
      try {
        google.accounts.id.prompt();
      } catch (e) {
        console.warn('Impossible de lancer google.accounts.id.prompt()', e);
      }
    };

    const customBtn = document.getElementById('custom-google-btn');
    if (customBtn) customBtn.addEventListener('click', function(e){
      e.preventDefault();
      window.customSignIn();
    });
  } else {
    console.warn('Google Identity Services non chargé. Le mode lecture reste accessible sans connexion.');
  }
});