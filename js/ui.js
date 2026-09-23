/* UI helpers: sidebar collapsé avec tooltips et thème sombre */
(function(){
  const sidebar = document.getElementById('sidebar');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;

  if(sidebar){
    sidebar.classList.add('collapsed');
  }

  const savedTheme = localStorage.getItem('spotmanager-theme') || 'light';
  applyTheme(savedTheme);

  if(themeToggle){
    themeToggle.addEventListener('click', function () {
      const nextTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  document.querySelectorAll('.offer-switch').forEach(function (switchBtn) {
    switchBtn.addEventListener('click', function () {
      const isOn = switchBtn.classList.toggle('is-on');
      switchBtn.setAttribute('aria-pressed', String(isOn));
      const statusText = switchBtn.closest('.offer-item')?.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = isOn ? 'Actif' : 'Inactif';
      }
    });
  });

  document.querySelectorAll('.mini-action').forEach(function (button) {
    const action = button.dataset.action;
    const svgMap = {
      copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9.75A2.75 2.75 0 0 1 11.75 7h6.5A2.75 2.75 0 0 1 21 9.75v6.5A2.75 2.75 0 0 1 18.25 19h-6.5A2.75 2.75 0 0 1 9 16.25v-6.5Z"/><path d="M15 7V5.75A2.75 2.75 0 0 0 12.25 3h-6.5A2.75 2.75 0 0 0 3 5.75v6.5A2.75 2.75 0 0 0 5.75 15H7"/></svg>',
      edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/></svg>',
      delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>'
    };
    if (svgMap[action]) {
      button.innerHTML = svgMap[action];
    }
  });

  document.querySelectorAll('[data-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      const action = button.dataset.action;
      const offer = button.closest('.offer-item');
      const label = offer ? offer.querySelector('.offer-amount')?.textContent : 'offre';
      console.log(action + ': ' + label);
    });
  });

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('spotmanager-theme', theme);

    if(themeIcon){
      themeIcon.textContent = theme === 'dark' ? '☀' : '☾';
    }
  }
})();