// Prototype client-side pour afficher le bouton Google Identity Services.
// Remplacez 'REPLACE_WITH_GOOGLE_CLIENT_ID' dans le HTML par votre Client ID réel.

function handleCredentialResponse(response){
  // Ici on reçoit le credential JWT côté client. Pour un vrai flux sécurisé,
  // envoyez-le à votre serveur pour vérification et création de session.
  console.log('ID token reçu (exemple):', response.credential);
  // Afficher un message basique
  const card = document.querySelector('.card');
  const p = document.createElement('p');
  p.textContent = 'Connexion réussie (prototype). Token reçu côté client.';
  p.style.color = 'green';
  card.appendChild(p);
}

window.onload = function(){
  if(window.google && google.accounts && google.accounts.id){
    google.accounts.id.initialize({
      client_id: 'REPLACE_WITH_GOOGLE_CLIENT_ID',
      callback: handleCredentialResponse,
    });

    google.accounts.id.renderButton(
      document.querySelector('.g_id_signin'),
      { theme: 'outline', size: 'large' }
    );

    // Optionnel: prompt automatique
    // google.accounts.id.prompt();
    // Exposer une fonction pour le bouton custom
    window.customSignIn = function(){
      try{
        google.accounts.id.prompt();
      }catch(e){
        console.warn('Impossible de lancer google.accounts.id.prompt()', e);
      }
    };

    // Lier le bouton fallback si présent
    const customBtn = document.getElementById('custom-google-btn');
    if(customBtn) customBtn.addEventListener('click', function(e){
      e.preventDefault(); window.customSignIn();
    });
  } else {
    console.warn('Google Identity Services non chargé. Vérifiez la connexion réseau.');
  }
};