// Shared member functions for all pages

function getInitials(name) {
  if (!name) return 'FM';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Load member data for header initials + admin check
async function loadMemberHeader() {
  try {
    const res = await fetch('/api/members/me');
    if (!res.ok) {
      window.location.href = '/member-login.html';
      return null;
    }
    const member = await res.json();
    
    // Update initials
    const initialsEl = document.getElementById('user-initials');
    if (initialsEl) {
      initialsEl.textContent = getInitials(member.name);
    }
    
    // Show admin link if pin #01 (Dr. TMac)
    if (member.pin_number === 1) {
      addAdminLink();
    }
    
    return member;
  } catch (err) {
    console.error('Error loading member:', err);
    return null;
  }
}

// Add admin link to navigation
function addAdminLink() {
  // Desktop nav
  const headerNav = document.querySelector('.header-nav');
  if (headerNav) {
    const adminLink = document.createElement('a');
    adminLink.href = '/admin.html';
    adminLink.className = 'nav-link admin-link';
    adminLink.textContent = 'Admin';
    adminLink.style.color = '#e8ccc8';
    headerNav.appendChild(adminLink);
  }
  
  // Mobile nav
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav) {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      const adminLink = document.createElement('a');
      adminLink.href = '/admin.html';
      adminLink.className = 'mobile-nav-link admin-link';
      adminLink.textContent = 'Admin';
      adminLink.style.color = '#e8ccc8';
      mobileNav.insertBefore(adminLink, logoutLink);
    }
  }
}

// Auto-run when script loads
loadMemberHeader();
