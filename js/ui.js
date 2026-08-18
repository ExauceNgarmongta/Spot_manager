/* UI helpers: sidebar collapsé fixe avec tooltips */
(function(){
  const sidebar = document.getElementById('sidebar');
  
  // Sidebar est TOUJOURS collapsé - pas de toggle
  if(sidebar){
    sidebar.classList.add('collapsed');
  }
})();