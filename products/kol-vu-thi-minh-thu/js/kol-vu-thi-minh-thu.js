// ── PAGE NAVIGATION ─────────────────────────────────────
const PAGE_ORDER = ['hero','about','gallery','platforms','collabs','mediakit','milestone','contact'];
let currentPage = 'hero';

function showPage(id) {
  if (id === currentPage) return;
  document.getElementById('page-' + currentPage).classList.remove('active');
  document.getElementById('page-' + id).classList.add('active');
  currentPage = id;
  window.scrollTo(0, 0);

  // Nav links
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === id);
  });
  // Tab items
  document.querySelectorAll('.tab-item').forEach(t => {
    t.classList.toggle('active', t.dataset.page === id);
  });
  // Dots
  document.querySelectorAll('.page-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.page === id);
  });

  history.pushState(null, '', '#' + id);

  // Trigger animations on new page
  const pg = document.getElementById('page-' + id);
  setTimeout(() => {
    pg.querySelectorAll('.fade-in').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(24px)';
      setTimeout(() => { el.style.opacity='1'; el.style.transform='translateY(0)'; }, i * 80);
    });
    pg.querySelectorAll('.audience-bar').forEach(bar => {
      setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, 350);
    });
    pg.querySelectorAll('.timeline-item').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 150 + 200);
    });
  }, 30);
}

// Init
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
});
document.querySelector('.nav-logo').addEventListener('click', e => { e.preventDefault(); showPage('hero'); });

// Handle hash on load
const initHash = location.hash.replace('#','');
if (PAGE_ORDER.includes(initHash)) showPage(initHash);

window.addEventListener('popstate', () => {
  const h = location.hash.replace('#','') || 'hero';
  if (PAGE_ORDER.includes(h)) showPage(h);
});

// ── FILTER ──────────────────────────────────────────────
function filterCollabs(platform, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.collab-card').forEach(c => {
    c.classList.toggle('hidden', platform !== 'all' && c.dataset.platform !== platform);
  });
}

// ── FLOAT BUTTON ────────────────────────────────────────
var floatOpen = false;
function toggleFloatMenu() {
  floatOpen = !floatOpen;
  document.querySelectorAll('.float-social-btn').forEach((btn, i) => {
    setTimeout(() => btn.classList.toggle('show', floatOpen), i * 60);
  });
  var icon = document.getElementById('floatIcon');
  var tb = document.getElementById('floatToggleBtn');
  if (icon) icon.style.transform = floatOpen ? 'rotate(45deg)' : 'rotate(0)';
  if (tb) tb.style.background = floatOpen ? '#2A1F1C' : 'var(--rose)';
}
document.addEventListener('click', e => {
  var g = document.getElementById('floatGroup');
  if (g && !g.contains(e.target) && floatOpen) toggleFloatMenu();
});

// ── LOADER ──────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hide');
    document.body.classList.remove('loading');
    // Animate hero on first load
    document.querySelectorAll('#page-hero .fade-in').forEach((el, i) => {
      setTimeout(() => { el.style.opacity='1'; el.style.transform='translateY(0)'; }, i * 100 + 200);
    });
  }, 2600);
});

// ── SCROLL OBSERVER ─────────────────────────────────────
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      // Audience bars
      e.target.querySelectorAll && e.target.querySelectorAll('.audience-bar').forEach(bar => {
        bar.style.width = bar.dataset.width + '%';
      });
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.fade-in, .timeline-item, .audience-block').forEach(el => obs.observe(el));
