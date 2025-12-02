// Shared member functions for all pages

function getInitials(name) {
  if (!name) return 'FM';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Load member data for header initials
async function loadMemberHeader() {
  try {
    const res = await fetch('/api/members/me');
    if (!res.ok) {
      window.location.href = '/member-login.html';
      return null;
    }
    const member = await res.json();
    const initialsEl = document.getElementById('user-initials');
    if (initialsEl) {
      initialsEl.textContent = getInitials(member.name);
    }
    return member;
  } catch (err) {
    console.error('Error loading member:', err);
    return null;
  }
}

// Auto-run when script loads
loadMemberHeader();
