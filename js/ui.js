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

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('spotmanager-theme', theme);

    if(themeIcon){
      themeIcon.textContent = theme === 'dark' ? '☀' : '☾';
    }
  }
})();