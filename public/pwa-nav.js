// PWA Bottom Navigation - Automatically injected into every page
// Only need to update this one file to change nav on all pages

(function() {
  // Determine which page is active
  const currentPage = window.location.pathname;
  
  const isActive = (page) => {
    if (page === '/home.html' && (currentPage === '/home.html' || currentPage === '/')) return ' active';
    if (page === '/tee-room.html' && currentPage === '/tee-room.html') return ' active';
    if (page === '/fairway.html' && currentPage === '/fairway.html') return ' active';
    if (page === '/profile.html' && currentPage === '/profile.html') return ' active';
    if (page === '/admin.html' && currentPage === '/admin.html') return ' active';
    return '';
  };

  // Create the bottom nav HTML
  const navHTML = `
    <nav class="pwa-bottom-nav" id="pwa-bottom-nav">
      <div class="pwa-bottom-nav-inner">
        <a href="/home.html" class="pwa-nav-item${isActive('/home.html')}">
          <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>Home</span>
        </a>
        <a href="/tee-room.html" class="pwa-nav-item${isActive('/tee-room.html')}">
          <svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path></svg>
          <span>Tee Room</span>
        </a>
        <a href="/fairway.html" class="pwa-nav-item${isActive('/fairway.html')}">
          <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <span>Fairway</span>
        </a>
        <a href="/profile.html" class="pwa-nav-item${isActive('/profile.html')}">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span>Profile</span>
        </a>
        <a href="/admin.html" class="pwa-nav-item${isActive('/admin.html')}" id="admin-nav-link" style="display: none;">
          <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span>Admin</span>
        </a>
      </div>
    </nav>
  `;

  // Inject nav before </body>
  document.addEventListener('DOMContentLoaded', function() {
    // Remove any existing bottom nav (to avoid duplicates)
    const existingNav = document.querySelector('.pwa-bottom-nav');
    if (existingNav) existingNav.remove();
    
    // Insert the nav
    document.body.insertAdjacentHTML('beforeend', navHTML);
    
    // Check if user is pin #01 for admin access
    checkAdminAccess();
  });

  // Show admin link for pin #01 only
  async function checkAdminAccess() {
    try {
      const res = await fetch('/api/members/me');
      if (res.ok) {
        const member = await res.json();
        if (member.pin_number === 1) {
          const adminLink = document.getElementById('admin-nav-link');
          if (adminLink) adminLink.style.display = 'flex';
        }
      }
    } catch (err) {
      // Not logged in or error - admin link stays hidden
    }
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registered:', registration.scope);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed:', error);
        });
    });
  }
})();
