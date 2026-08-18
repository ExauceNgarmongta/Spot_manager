// Frontend-only demo behaviors: mock offers and online users
(function(){
  const offersEl = document.getElementById('offers');
  const onlineEl = document.getElementById('online-users');
  const demoBtn = document.getElementById('demo-offer');
  const refreshBtn = document.getElementById('refresh-users');

  const sampleOffers = [
    {id:1,title:'Livraison express',price:'5€',desc:'Livraison en moins de 2h'},
    {id:2,title:'Transport premium',price:'12€',desc:'Prise en charge VIP'},
    {id:3,title:'Navette partagée',price:'3€',desc:'Option budget pour trajets courts'}
  ];

  const sampleUsers = ['Alice','Bruno','Camille','David','Emma'];

  function renderOffers(){
    if(!offersEl) return;
    offersEl.innerHTML = sampleOffers.map(o => `
      <div class="offer">
        <div class="offer-main">
          <strong>${o.title}</strong>
          <span class="offer-price">${o.price}</span>
        </div>
        <p class="offer-desc">${o.desc}</p>
      </div>
    `).join('');
  }

  function renderUsers(){
    if(!onlineEl) return;
    // random subset
    const count = Math.max(1, Math.floor(Math.random()*sampleUsers.length)+1);
    const shuffled = sampleUsers.sort(()=>0.5-Math.random()).slice(0,count);
    onlineEl.innerHTML = shuffled.map(u=>`<li>${u}</li>`).join('');
  }

  if(demoBtn){
    demoBtn.addEventListener('click', function(){
      // add a new demo offer
      const id = sampleOffers.length + 1;
      sampleOffers.unshift({id,title:`Offre démo ${id}`,price:'Gratuit',desc:'Créée depuis l’interface demo.'});
      renderOffers();
      demoBtn.textContent = 'Offre créée';
      setTimeout(()=> demoBtn.textContent = 'Créer une offre (demo)',1200);
    });
  }

  if(refreshBtn){
    refreshBtn.addEventListener('click', function(){
      renderUsers();
      refreshBtn.textContent = 'Actualisé';
      setTimeout(()=> refreshBtn.textContent = 'Actualiser',900);
    });
  }

  // initial render
  renderOffers();
  renderUsers();

})();
