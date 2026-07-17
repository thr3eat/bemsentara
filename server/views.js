'use strict';

const { isSiteAdmin, isSiteStaff } = require("../utils/adminCheck");

// ─────────────────────────────────────────────
// SHARED LAYOUT HELPER  (declared ONCE at top)
// ─────────────────────────────────────────────
function _layout(title, user, content, extraHead = '', activePath = '') {
  const staffLinks = user && isSiteStaff(user)
    ? `<a href="/staff" class="nav-link staff-link${activePath === '/staff' ? ' nav-active' : ''}">👨‍💼 Staff</a>`
    : '';
  const adminLink = user && isSiteAdmin(user)
    ? `<a href="/admin" class="nav-link debug-link${activePath === '/admin' ? ' nav-active' : ''}">⚙️ Admin</a>`
    : '';

  const isOwner = user && user.discordUsername === "ekonqtx";
  const { groupAdmins } = require("../models/Store");
  const isGrpAdmin = user && (isOwner || groupAdmins.findOne({ username: user.discordUsername }));
  const groupAdminLink = isGrpAdmin
    ? `<a href="/group-admin" class="nav-link${activePath === '/group-admin' ? ' nav-active' : ''}">⚙️ Grup Yönetimi</a>`
    : '';

  function navLink(href, label) {
    const active = activePath === href ? ' nav-active' : '';
    return `<a href="${href}" class="nav-link${active}">${label}</a>`;
  }

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${_esc(title)} — Sentara Premium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  ${extraHead}
  <style>
    :root {
      --bg:       #06060e;
      --surface:  rgba(255,255,255,0.035);
      --border:   rgba(255,255,255,0.08);
      --accent:   #a78bfa;
      --accent2:  #818cf8;
      --text:     #f0f0f8;
      --muted:    #7c7c9a;
      --success:  #34d399;
      --warning:  #fbbf24;
      --danger:   #fb7185;
      --glass-blur: 20px;
      --glass-glow: inset 0 1px 0 rgba(255,255,255,0.06);
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      background: var(--bg);
      background-image:
        radial-gradient(ellipse 80% 60% at 10% 0%, rgba(99,102,241,0.08) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 90% 100%, rgba(139,92,246,0.06) 0%, transparent 50%),
        radial-gradient(ellipse 50% 40% at 50% 50%, rgba(99,102,241,0.03) 0%, transparent 50%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }
    body::before {
      content:'';
      position:fixed; inset:0; z-index:0; pointer-events:none;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E");
      opacity:0.4;
    }

    /* ── Ambient Glow ── */
    body::after {
      content:'';
      position:fixed; top:-30%; left:-10%; width:50vw; height:50vw;
      background: radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%);
      pointer-events:none; z-index:0;
      animation: ambientDrift 20s ease-in-out infinite alternate;
    }
    @keyframes ambientDrift {
      0%   { transform: translate(0, 0) scale(1); }
      100% { transform: translate(15vw, 20vh) scale(1.2); }
    }

    /* ── Header ── */
    header {
      background: rgba(6,6,14,0.45);
      backdrop-filter: blur(28px) saturate(1.2);
      -webkit-backdrop-filter: blur(28px) saturate(1.2);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 50px;
      padding: 0.6rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 1.5rem;
      z-index: 200;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5), var(--glass-glow);
      max-width: 1200px;
      margin: 1.5rem auto 0;
      width: calc(100% - 3rem);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: inherit;
      flex-shrink: 0;
    }
    .logo span {
      font-weight: 800;
      font-size: 1.4rem;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .nav-links {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .nav-link {
      color: var(--muted);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
      transition: color 0.3s, background 0.3s;
      padding: 0.45rem 0.9rem;
      border-radius: 30px;
      position: relative;
    }
    .nav-link::after {
      content:'';
      position: absolute;
      bottom: 0.2rem; left: 50%;
      width: 0; height: 2px;
      background: var(--accent);
      transition: width 0.3s ease, left 0.3s ease;
      border-radius: 1px;
    }
    .nav-link:hover { color: var(--text); background: rgba(255,255,255,0.04); }
    .nav-link:hover::after { width:40%; left:30%; }
    .nav-link.staff-link { color: var(--accent); }
    .nav-link.debug-link  { color: var(--danger); }
    .nav-link.logout-link { color: var(--danger); }
    .nav-link.logout-link::after { background: var(--danger); }
    .nav-link.nav-active { color: var(--text); background: rgba(255,255,255,0.05); }
    .nav-link.nav-active::after { width: 40%; left:30%; }

    /* ── Hamburger ── */
    .hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      cursor: pointer;
      padding: 0.5rem;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      transition: background 0.2s;
    }
    .hamburger:hover { background: rgba(255,255,255,0.06); }
    .hamburger span {
      display: block;
      width: 20px; height: 2px;
      background: var(--text);
      border-radius: 2px;
      transition: transform 0.3s, opacity 0.3s;
    }
    .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger.open span:nth-child(2) { opacity: 0; }
    .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    @media (max-width: 768px) {
      .hamburger { display: flex; }
      .nav-links {
        display: none;
        position: absolute;
        top: 100%;
        left: 0; right: 0;
        background: rgba(6,6,14,0.92);
        backdrop-filter: blur(28px);
        border-bottom: 1px solid rgba(255,255,255,0.05);
        padding: 1rem 2rem;
        flex-direction: column;
        gap: 0.25rem;
        z-index: 199;
      }
      .nav-links.open { display: flex; }
      .nav-link { padding: 0.7rem 0.75rem; font-size: 0.95rem; width:100%; }
    }

    /* ── Main & Card ── */
    main { max-width: 1000px; margin: 0 auto; padding: 3rem 2rem; position:relative; z-index:1; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 2rem;
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      box-shadow: 0 8px 32px rgba(0,0,0,0.2), var(--glass-glow);
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    .card:hover {
      border-color: rgba(255,255,255,0.12);
    }
    .card + .card { margin-top: 2rem; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.4rem;
      background: rgba(167,139,250,0.18);
      border: 1px solid rgba(167,139,250,0.25);
      color: var(--accent);
      border-radius: 12px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
      font-size: 0.95rem;
      text-decoration: none;
      transition: all 0.3s ease;
      box-shadow: 0 2px 12px rgba(167,139,250,0.1);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      position: relative;
      overflow: hidden;
    }
    .btn::before {
      content:''; position:absolute; inset:0;
      background: linear-gradient(135deg, rgba(167,139,250,0.08), rgba(129,140,248,0.04));
      opacity:0; transition: opacity 0.3s;
    }
    .btn:hover {
      background: rgba(167,139,250,0.28);
      border-color: rgba(167,139,250,0.4);
      color: #fff;
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(167,139,250,0.2);
    }
    .btn:hover::before { opacity:1; }
    .btn:active { transform: translateY(0); }
    .btn-sm { padding: 0.45rem 0.9rem; font-size: 0.82rem; border-radius:10px; }
    .btn-danger {
      background: rgba(251,113,133,0.15);
      border-color: rgba(251,113,133,0.25);
      color: var(--danger);
      box-shadow: 0 2px 12px rgba(251,113,133,0.1);
    }
    .btn-danger:hover {
      background: rgba(251,113,133,0.28);
      border-color: rgba(251,113,133,0.4);
      color:#fff;
      box-shadow: 0 6px 24px rgba(251,113,133,0.2);
    }
    .btn-success {
      background: rgba(52,211,153,0.15);
      border-color: rgba(52,211,153,0.25);
      color: var(--success);
      box-shadow: 0 2px 12px rgba(52,211,153,0.1);
    }
    .btn-success:hover {
      background: rgba(52,211,153,0.28);
      border-color: rgba(52,211,153,0.4);
      color:#fff;
      box-shadow: 0 6px 24px rgba(52,211,153,0.2);
    }
    .btn-ghost {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: var(--muted);
      box-shadow: none;
      backdrop-filter: none;
    }
    .btn-ghost:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.15);
      color: var(--text);
      box-shadow: none;
    }

    /* ── Form elements ── */
    label { display: block; margin-bottom: 0.4rem; color: var(--muted); font-size: 0.85rem; font-weight: 500; letter-spacing:0.3px; }
    input, textarea, select {
      width: 100%;
      padding: 0.85rem 1rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      color: var(--text);
      font-family: inherit;
      font-size: 0.92rem;
      margin-bottom: 1.2rem;
      outline: none;
      transition: border-color 0.3s, box-shadow 0.3s, background 0.3s;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    input:focus, textarea:focus, select:focus {
      border-color: rgba(167,139,250,0.4);
      box-shadow: 0 0 0 3px rgba(167,139,250,0.08), 0 0 20px rgba(167,139,250,0.05);
      background: rgba(255,255,255,0.04);
    }
    input::placeholder, textarea::placeholder { color: rgba(124,124,154,0.5); }
    select option { background: #0e0e1a; }

    /* ── Badges ── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.7rem;
      border-radius: 20px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      backdrop-filter: blur(8px);
    }
    .badge-open    { background: rgba(52,211,153,0.1);  color: var(--success); border: 1px solid rgba(52,211,153,0.2); }
    .badge-closed  { background: rgba(251,113,133,0.1); color: var(--danger);  border: 1px solid rgba(251,113,133,0.2); }
    .badge-pending { background: rgba(251,191,36,0.1);  color: var(--warning); border: 1px solid rgba(251,191,36,0.2); }
    .badge-admin   { background: rgba(129,140,248,0.1); color: var(--accent2); border: 1px solid rgba(129,140,248,0.2); }

    /* ── Toast ── */
    #toast-container {
      position: fixed;
      bottom: 2rem; right: 2rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }
    .toast {
      padding: 0.9rem 1.4rem;
      border-radius: 14px;
      font-weight: 600;
      font-size: 0.9rem;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid;
      animation: toastIn 0.35s ease, toastOut 0.35s ease 2.7s forwards;
      pointer-events: auto;
      max-width: 340px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), var(--glass-glow);
    }
    .toast-success { background: rgba(52,211,153,0.12);  color: var(--success); border-color: rgba(52,211,153,0.2); }
    .toast-error   { background: rgba(251,113,133,0.12); color: var(--danger);  border-color: rgba(251,113,133,0.2); }
    .toast-info    { background: rgba(167,139,250,0.12); color: var(--accent);  border-color: rgba(167,139,250,0.2); }
    .toast-warning { background: rgba(251,191,36,0.12);  color: var(--warning); border-color: rgba(251,191,36,0.2); }
    .toast-inner   { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; }
    .toast-close   { cursor:pointer; opacity:0.5; flex-shrink:0; font-size:0.9rem; background:none; border:none; color:inherit; padding:0; line-height:1; transition:opacity 0.2s; }
    .toast-close:hover { opacity:1; }
    @keyframes toastIn  { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes toastOut { from { opacity:1; } to { opacity:0; transform:translateY(-8px) scale(0.95); } }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }
    ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.15); }

    /* ── Misc ── */
    .text-muted  { color: var(--muted); }
    .text-accent { color: var(--accent); }
    .text-danger { color: var(--danger); }
    .text-success{ color: var(--success); }
    .mt-1 { margin-top: 0.5rem; }
    .mt-2 { margin-top: 1rem; }
    .mt-3 { margin-top: 1.5rem; }
    .mb-2 { margin-bottom: 1rem; }
    .mb-3 { margin-bottom: 1.5rem; }
    .d-flex { display:flex; }
    .align-center { align-items:center; }
    .gap-1 { gap:0.5rem; }
    .gap-2 { gap:1rem; }
    .w-full { width:100%; }
    hr.divider { border:none; border-top:1px solid rgba(255,255,255,0.06); margin:2rem 0; }

    /* ── Selection ── */
    ::selection { background: rgba(167,139,250,0.3); color:#fff; }

    /* ── Responsive ── */
    @media (max-width:768px) {
      header { flex-wrap:wrap; gap:0.75rem; }
      .nav-links { width:100%; flex-wrap:wrap; gap:0.75rem; }
      main { padding: 2rem 1rem; }
    }
  </style>
</head>
<body>
  <header>
    <a href="/dashboard" class="logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent2); filter: drop-shadow(0 0 8px var(--accent2));"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/></svg>
      <span>sentara</span>
    </a>
    <button class="hamburger" id="hamburger" aria-label="Menü" onclick="this.classList.toggle('open');document.getElementById('nav-links').classList.toggle('open')">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav-links" id="nav-links">
      ${navLink('/dashboard', 'Dashboard')}
      ${navLink('/profile', 'Profil')}
      ${navLink('/tickets', "Ticket'lar")}
      ${navLink('/notifications', '🔔 Bildirimler')}
      ${navLink('/leaderboard', 'Sıralama')}
      ${navLink('/shop', 'Mağaza')}
      ${navLink('/wiki', 'Wiki')}
      ${navLink('/settings', 'Ayarlar')}
      ${groupAdminLink}
      ${staffLinks}
      ${adminLink}
      ${user ? `<a href="/logout" class="nav-link logout-link">Çıkış</a>` : `<a href="/login" class="nav-link">Giriş</a>`}
    </nav>
  </header>

  <div id="toast-container"></div>

  <main>
    ${content}
  </main>

  <script>
    // ── Toast utility ──
    function showToast(msg, type = 'info', duration = 3500) {
      const c = document.getElementById('toast-container');
      if (!c) return;
      const t = document.createElement('div');
      t.className = 'toast toast-' + type;
      t.innerHTML = \`<div class="toast-inner"><span>\${msg}</span><button class="toast-close" onclick="this.closest('.toast').remove()">✕</button></div>\`;
      c.appendChild(t);
      const timer = setTimeout(() => t.remove(), duration);
      t.querySelector('.toast-close').addEventListener('click', () => clearTimeout(timer));
    }
    window.showToast = showToast;

    // ── Confirm util ──
    function confirmAction(msg) {
      return new Promise(resolve => resolve(window.confirm(msg)));
    }
    window.confirmAction = confirmAction;

    // ── Close mobile nav on outside click ──
    document.addEventListener('click', (e) => {
      const nav = document.getElementById('nav-links');
      const btn = document.getElementById('hamburger');
      if (nav && btn && !nav.contains(e.target) && !btn.contains(e.target)) {
        nav.classList.remove('open');
        btn.classList.remove('open');
      }
    });

    // ── Live Activity Tracker ──
    const ACT_PING_FREQ = 2000; // 2 seconds
    let actClicks = [];
    let actPos = { x: 0, y: 0 };
    
    document.addEventListener('mousemove', (e) => {
      actPos.x = e.clientX;
      actPos.y = e.clientY;
    }, { passive: true });

    document.addEventListener('click', (e) => {
      let tText = (e.target.innerText || e.target.tagName || "").trim().replace(/\n/g, ' ');
      if (tText.length > 50) tText = tText.substring(0, 50) + "...";
      actClicks.push({ x: e.clientX, y: e.clientY, t: Date.now(), element: tText });
    }, { passive: true });

    setInterval(() => {
      if (!document.hidden) {
        fetch('/api/activity/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            x: actPos.x,
            y: actPos.y,
            w: window.innerWidth,
            h: window.innerHeight,
            url: window.location.pathname,
            clicks: actClicks
          })
        }).catch(() => {});
        actClicks = [];
      }
    }, ACT_PING_FREQ);

    // ── Browser Notification System ──
    const userLoggedIn = ${user ? 'true' : 'false'};
    if (userLoggedIn && window.Notification) {
      function syncBrowserNotificationStatus() {
        if (Notification.permission === 'granted') {
          fetch('/api/notifications/browser-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
          }).catch(() => {});
        }
      }

      function askPermission() {
        if (Notification.permission === 'default') {
          try {
            const promise = Notification.requestPermission(permission => {
              if (permission === 'granted') {
                syncBrowserNotificationStatus();
              }
            });
            if (promise && typeof promise.then === 'function') {
              promise.then(permission => {
                if (permission === 'granted') {
                  syncBrowserNotificationStatus();
                }
              }).catch(() => {});
            }
          } catch (e) {
            Notification.requestPermission(permission => {
              if (permission === 'granted') {
                syncBrowserNotificationStatus();
              }
            });
          }
        }
      }

      // Try immediately on page load
      askPermission();

      // Fallback: ask on first click gesture if permission is still default
      document.addEventListener('click', () => {
        if (Notification.permission === 'default') {
          askPermission();
        }
      }, { once: true });

      // If already granted, sync status to backend
      if (Notification.permission === 'granted') {
        syncBrowserNotificationStatus();
      }
    }
      
      let shownNotifs = [];
      try {
        shownNotifs = JSON.parse(localStorage.getItem('shown_browser_notifications') || '[]');
      } catch (e) {
        shownNotifs = [];
      }
      
      function checkBrowserNotifications() {
        if (Notification.permission !== 'granted') return;
        
        fetch('/api/notifications/unread')
          .then(res => res.json())
          .then(data => {
            if (data.success && data.notifications) {
              let updated = false;
              data.notifications.forEach(n => {
                if (!shownNotifs.includes(n.id)) {
                  shownNotifs.push(n.id);
                  updated = true;
                  
                  // Trigger browser notification
                  new Notification(n.title || 'Sentara Bildirimi', {
                    body: n.message || '',
                    icon: '/favicon.ico'
                  });
                }
              });
              
              if (updated) {
                if (shownNotifs.length > 200) {
                  shownNotifs = shownNotifs.slice(-100);
                }
                localStorage.setItem('shown_browser_notifications', JSON.stringify(shownNotifs));
              }
            }
          })
          .catch(() => {});
      }
      
      // Poll every 10 seconds
      setInterval(checkBrowserNotifications, 10000);
      // Run once immediately on load
      setTimeout(checkBrowserNotifications, 1500);
    }
  </script>
</body>
</html>`;
}


// ─────────────────────────────────────────────
// UTILITY: HTML escape (XSS prevention)
// ─────────────────────────────────────────────
function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
function renderMainPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentara — Premium Destek Sistemi</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:      #06060e;
      --surface: rgba(255,255,255,0.035);
      --border:  rgba(255,255,255,0.08);
      --accent:  #a78bfa;
      --accent2: #818cf8;
      --text:    #f0f0f8;
      --muted:   #7c7c9a;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      background: var(--bg);
      background-image:
        radial-gradient(ellipse 80% 60% at 10% 0%, rgba(99,102,241,0.08) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 90% 100%, rgba(139,92,246,0.06) 0%, transparent 50%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .glow {
      position:fixed; width:500px; height:500px;
      border-radius:50%; opacity:0.06; z-index:0;
      filter:blur(180px); pointer-events:none;
      animation: floatGlow 18s infinite ease-in-out alternate;
    }
    .glow-1 { background:var(--accent2); top:-150px; right:-150px; }
    .glow-2 { background:var(--accent);  bottom:-150px; left:-150px; animation-delay:-9s; }
    @keyframes floatGlow {
      0%   { transform: scale(1) translate(0,0); }
      100% { transform: scale(1.1) translate(15px,20px); }
    }

    header {
      background: rgba(6,6,14,0.45);
      backdrop-filter: blur(28px) saturate(1.2);
      -webkit-backdrop-filter: blur(28px) saturate(1.2);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 50px;
      padding: 0.6rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 1.5rem;
      z-index: 200;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      max-width: 1200px;
      margin: 1.5rem auto 0;
      width: calc(100% - 3rem);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: inherit;
    }
    .logo span {
      font-weight: 800;
      font-size: 1.4rem;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    nav { display:flex; gap:1.2rem; align-items:center; }
    nav a {
      color:var(--muted); text-decoration:none; font-weight:500;
      transition:color 0.3s; position:relative; font-size:0.95rem;
    }
    nav a::after {
      content:''; position:absolute; bottom:-4px; left:50%;
      width:0; height:2px; background:var(--accent);
      transition:width 0.3s ease, left 0.3s ease; border-radius:1px;
    }
    nav a:hover { color:var(--text); }
    nav a:hover::after { width:100%; left:0; }

    .btn {
      padding:0.8rem 2rem;
      background:rgba(167,139,250,0.18);
      border:1px solid rgba(167,139,250,0.25);
      color:var(--accent); border-radius:30px;
      font-family:'Outfit',sans-serif; font-weight:600; font-size:1rem;
      cursor:pointer; text-decoration:none;
      transition:all 0.3s ease;
      box-shadow:0 2px 16px rgba(167,139,250,0.1);
      display:inline-flex; align-items:center; gap:0.5rem;
      position:relative; overflow:hidden;
      backdrop-filter:blur(8px);
    }
    .btn::after {
      content:''; position:absolute; top:0; left:-100%;
      width:100%; height:100%;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);
      transition:left 0.5s;
    }
    .btn:hover::after { left:100%; }
    .btn:hover {
      transform:translateY(-2px) scale(1.02);
      background:rgba(167,139,250,0.28);
      border-color:rgba(167,139,250,0.4);
      color:#fff;
      box-shadow:0 8px 28px rgba(167,139,250,0.2);
    }

    /* ── Hero ── */
    .hero {
      position:relative; z-index:1;
      max-width:1100px; margin:0 auto;
      padding:7rem 2rem 4rem;
      text-align:center;
    }
    .hero-badge {
      display:inline-flex; align-items:center; gap:0.5rem;
      background:rgba(167,139,250,0.08);
      border:1px solid rgba(167,139,250,0.15);
      padding:0.4rem 1rem; border-radius:30px;
      font-size:0.85rem; font-weight:500; color:var(--accent);
      margin-bottom:2rem;
      animation:fadeUp 0.8s ease forwards; opacity:0;
      backdrop-filter:blur(8px);
    }
    h1 {
      font-size:4.5rem; line-height:1.05; font-weight:800;
      margin-bottom:1.5rem;
      animation:fadeUp 0.9s ease 0.1s forwards; opacity:0;
      letter-spacing:-1px;
    }
    .grad {
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }
    .subtitle {
      color:var(--muted); font-size:1.15rem; max-width:640px;
      margin:0 auto 3rem;
      animation:fadeUp 0.9s ease 0.2s forwards; opacity:0;
      line-height:1.8; font-weight:300;
    }
    .hero-cta {
      display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;
      animation:fadeUp 0.9s ease 0.3s forwards; opacity:0;
    }
    .btn-outline {
      padding:0.8rem 2rem; background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.1); color:var(--text);
      border-radius:30px; font-family:'Outfit',sans-serif;
      font-weight:500; cursor:pointer; text-decoration:none;
      transition:all 0.3s; backdrop-filter:blur(8px);
    }
    .btn-outline:hover {
      border-color:rgba(167,139,250,0.35);
      color:var(--accent);
      background:rgba(167,139,250,0.05);
    }

    @keyframes fadeUp {
      to { opacity:1; transform:translateY(0); }
      from { opacity:0; transform:translateY(20px); }
    }

    /* ── Stats strip ── */
    .stats {
      display:flex; justify-content:center; gap:3rem; flex-wrap:wrap;
      padding:2.5rem; background:rgba(255,255,255,0.035);
      border:1px solid rgba(255,255,255,0.07); border-radius:20px;
      max-width:900px; margin:3rem auto 0;
      animation:fadeUp 1s ease 0.4s forwards; opacity:0;
      backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
      box-shadow:0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05);
    }
    .stat-item { text-align:center; }
    .stat-value { font-size:2.5rem; font-weight:800; }
    .stat-label { color:var(--muted); font-size:0.85rem; font-weight:300; }

    /* ── Features ── */
    #features {
      max-width:1100px; margin:6rem auto; padding:0 2rem;
    }
    .section-label {
      text-align:center; color:var(--accent); font-weight:600;
      font-size:0.8rem; letter-spacing:3px; text-transform:uppercase;
      margin-bottom:1rem;
    }
    .section-title { text-align:center; font-size:2.5rem; font-weight:800; margin-bottom:4rem; letter-spacing:-0.5px; }
    .features-grid {
      display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.25rem;
    }
    .feature {
      background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);
      border-radius:20px; padding:2rem;
      backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
      transition:transform 0.35s, border-color 0.35s, box-shadow 0.35s;
      position:relative; overflow:hidden;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .feature::before {
      content:''; position:absolute;
      inset:0; border-radius:20px;
      background:linear-gradient(135deg,rgba(167,139,250,0.04),transparent);
      opacity:0; transition:opacity 0.35s;
    }
    .feature:hover {
      transform:translateY(-6px);
      border-color:rgba(167,139,250,0.2);
      box-shadow:0 16px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .feature:hover::before { opacity:1; }
    .feature-icon {
      font-size:2.2rem; display:inline-flex;
      align-items:center; justify-content:center;
      width:56px; height:56px;
      background:rgba(167,139,250,0.08); border-radius:14px;
      margin-bottom:1.25rem;
      border:1px solid rgba(167,139,250,0.1);
    }
    .feature h3 { font-size:1.2rem; font-weight:700; margin-bottom:0.6rem; }
    .feature p  { color:var(--muted); line-height:1.7; font-size:0.92rem; font-weight:300; }

    /* ── Footer ── */
    footer {
      text-align:center; padding:3rem 2rem;
      border-top:1px solid rgba(255,255,255,0.05);
      color:var(--muted); background:rgba(6,6,14,0.8);
      position:relative; z-index:1;
      backdrop-filter:blur(10px);
    }
    footer .logo { font-size:1.4rem; display:block; margin-bottom:0.75rem; }
    .footer-links { display:flex; justify-content:center; gap:1.5rem; margin:1rem 0; flex-wrap:wrap; }
    .footer-links a { color:var(--muted); text-decoration:none; font-size:0.88rem; transition:color 0.2s; font-weight:300; }
    .footer-links a:hover { color:var(--text); }

    ::selection { background:rgba(167,139,250,0.3); color:#fff; }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }

    @media(max-width:768px) {
      header { padding:1rem; flex-direction:column; gap:1rem; }
      h1 { font-size:2.5rem; }
      .stats { gap:1.5rem; }
    }
  </style>
</head>
<body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <header>
    <a href="/" class="logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent2); filter: drop-shadow(0 0 8px var(--accent2));"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/></svg>
      <span>sentara</span>
    </a>
    <nav>
      <a href="#features">Özellikler</a>
      <a href="/legal/tos">Koşullar</a>
      <a href="/login" class="btn" style="background: #2563eb; border-color: #3b82f6; border-radius: 9999px; color: #fff; padding: 0.5rem 1.2rem; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg> Giriş Yap</a>
    </nav>
  </header>

  <div class="hero" style="position:relative;z-index:1;">
    <div class="hero-badge">✨ Discord Destek Platformu</div>
    <h1>Discord'da<br><span class="grad">Yeni Nesil Destek</span></h1>
    <p class="subtitle">Sentara ile sunucunuzdaki destek deneyimini tamamen değiştirin. Roblox entegrasyonu, premium tasarım ve kusursuz hız bir arada.</p>
    <div class="hero-cta">
      <a href="/login" class="btn" style="font-size:1.1rem;padding:1rem 2.5rem;">🚀 Hemen Başla</a>
      <a href="#features" class="btn-outline">Özellikleri İncele</a>
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-value grad">12K+</div>
        <div class="stat-label">Kayıtlı Kullanıcı</div>
      </div>
      <div class="stat-item">
        <div class="stat-value grad">98K+</div>
        <div class="stat-label">Çözülen Ticket</div>
      </div>
      <div class="stat-item">
        <div class="stat-value grad">99.9%</div>
        <div class="stat-label">Uptime</div>
      </div>
      <div class="stat-item">
        <div class="stat-value grad">&lt;2s</div>
        <div class="stat-label">Ortalama Yanıt</div>
      </div>
    </div>
  </div>

  <section id="features">
    <p class="section-label">Özellikler</p>
    <h2 class="section-title">Neden <span class="grad">Sentara</span>?</h2>
    <div class="features-grid">
      <div class="feature">
        <div class="feature-icon">🎮</div>
        <h3>Roblox Entegrasyonu</h3>
        <p>Kullanıcıların Roblox hesaplarını Discord ile eşleştirin. Destek taleplerinde güvenilir kimlik doğrulama sağlayın.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>Işık Hızında Panel</h3>
        <p>Premium web paneli sayesinde tüm destek işlemlerinizi saniyeler içinde yönetin. Gerçek zamanlı güncellemeler.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🎨</div>
        <h3>Modern Arayüz</h3>
        <p>Glass morphism tasarım dili ile hem takımınız hem de üyeleriniz için unutulmaz bir kullanıcı deneyimi.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h3>Gelişmiş Güvenlik</h3>
        <p>OAuth2 tabanlı kimlik doğrulama, rol yönetimi ve izin sistemi ile güvenli bir ortam.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Detaylı İstatistikler</h3>
        <p>Ticket metrikleri, personel performansı ve anlık durum raporlaması.</p>
      </div>
    </section>

    <!-- FOOTER -->
    <footer>
      <div class="footer-links">
        <a href="/legal/tos">Hizmet Şartları</a>
        <a href="/legal/privacy">Gizlilik Politikası</a>
        <a href="https://discord.gg/sentara">Destek Sunucusu</a>
      </div>
      <div class="copy">
        &copy; 2024 Sentara Premium. Tüm hakları saklıdır.
      </div>
    </footer>
  </main>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────
function renderLoginPage(errorMsg = null) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Giriş Yap — Sentara Premium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:      #06060e;
      --border:  rgba(255,255,255,0.08);
      --accent:  #a78bfa;
      --accent2: #818cf8;
      --text:    #f0f0f8;
      --muted:   #7c7c9a;
      --danger:  #fb7185;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: var(--bg);
      background-image:
        radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99,102,241,0.06) 0%, transparent 60%);
      color:var(--text); font-family:'Outfit',sans-serif;
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      overflow:hidden;
    }
    .glow {
      position:fixed; width:500px; height:500px; border-radius:50%;
      filter:blur(200px); pointer-events:none; z-index:0;
      animation:pulse 12s infinite alternate;
    }
    .glow-1 { background:var(--accent); top:-200px; left:-200px; opacity:0.05; }
    .glow-2 { background:var(--accent2); bottom:-200px; right:-200px; opacity:0.05; animation-delay:-6s; }
    @keyframes pulse {
      0%   { transform:scale(1); opacity:0.04; }
      100% { transform:scale(1.15); opacity:0.08; }
    }
    .container { position:relative; z-index:10; width:100%; max-width:420px; padding:1.5rem; }
    .card {
      background:rgba(255,255,255,0.035);
      backdrop-filter:blur(28px) saturate(1.2);
      -webkit-backdrop-filter:blur(28px) saturate(1.2);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:24px; padding:3rem 2.5rem;
      text-align:center;
      box-shadow:0 24px 48px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
      animation:popIn 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
    }
    @keyframes popIn {
      0%   { opacity:0; transform:scale(0.9) translateY(20px); }
      100% { opacity:1; transform:scale(1) translateY(0); }
    }
    .logo {
      font-size:2.5rem; font-weight:800; letter-spacing:-0.5px;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      margin-bottom:0.5rem; display:block;
    }
    .card h1 { font-size:1.4rem; font-weight:600; margin-bottom:0.4rem; }
    .card .subtitle { color:var(--muted); margin-bottom:2rem; font-size:0.92rem; font-weight:300; }
    .error-box {
      background:rgba(251,113,133,0.08); border:1px solid rgba(251,113,133,0.2);
      color:var(--danger); padding:0.8rem 1rem; border-radius:12px;
      margin-bottom:1.5rem; font-size:0.88rem;
      backdrop-filter:blur(8px);
      display: none;
    }
    .btn {
      width:100%; padding:1.05rem; border:none; border-radius:14px;
      font-family:'Outfit',sans-serif; font-weight:600; font-size:1rem;
      cursor:pointer; color:white;
      display:flex; align-items:center; justify-content:center; gap:10px;
      text-decoration:none;
      transition:all 0.3s ease;
      margin-bottom: 0.8rem;
    }
    .btn-discord { background:rgba(88,101,242,0.85); box-shadow:0 4px 20px rgba(88,101,242,0.2); }
    .btn-discord:hover { background:rgba(71,82,196,0.9); transform:translateY(-2px); box-shadow:0 8px 28px rgba(88,101,242,0.3); }
    .btn-primary { background:rgba(124,106,247,0.85); box-shadow:0 4px 20px rgba(124,106,247,0.2); }
    .btn-primary:hover { background:rgba(100,80,240,0.9); transform:translateY(-2px); box-shadow:0 8px 28px rgba(124,106,247,0.3); }
    .btn-success { background:rgba(16,185,129,0.85); box-shadow:0 4px 20px rgba(16,185,129,0.2); }
    .btn-success:hover { background:rgba(5,150,105,0.9); transform:translateY(-2px); box-shadow:0 8px 28px rgba(16,185,129,0.3); }
    
    .divider { color:var(--muted); font-size:0.85rem; margin:1.5rem 0; position:relative; display:flex; align-items:center; justify-content:center; }
    .divider::before, .divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.06); margin:0 10px; }
    
    .input-field {
      width:100%; padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.1); 
      background:rgba(0,0,0,0.2); color:#fff; margin-bottom:1rem; 
      font-family:'Outfit',sans-serif; font-size:0.95rem;
    }
    .remember-me {
      display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 1.5rem; color: var(--muted); font-size: 0.9rem;
    }
    .remember-me input { accent-color: var(--accent); width: 16px; height: 16px; }
    
    .link-btn { background:none;border:none;color:var(--muted);font-size:0.85rem;cursor:pointer;text-decoration:underline; font-family:'Outfit',sans-serif; }
    .link-btn:hover { color:var(--text); }
  </style>
</head>
<body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="container">
    <div class="card">
      <span class="logo">sentara</span>
      <h1>Hoş Geldiniz</h1>
      <p class="subtitle">Sisteme giriş yapmak için bir yöntem seçin</p>

      <div class="error-box" id="error-box">${errorMsg ? errorMsg : ''}</div>

      <!-- MAIN OPTIONS -->
      <div id="view-main">
        <div class="remember-me">
          <input type="checkbox" id="remember-discord">
          <label for="remember-discord">Beni Hatırla</label>
        </div>
        <a href="#" onclick="goDiscordAuth()" class="btn btn-discord">Discord ile Giriş Yap</a>
        <div class="divider">veya</div>
        <button onclick="showView('view-otp')" class="btn btn-primary">Discord Kod Gönder (DM)</button>
        <button onclick="showView('view-password')" class="btn btn-primary" style="background:rgba(255,255,255,0.1); color:#fff; box-shadow:none;">Site Şifresi ile Giriş</button>
      </div>

      <!-- OTP VIEW -->
      <div id="view-otp" style="display:none;">
        <h2 style="font-size:1.1rem; margin-bottom:1rem;">Discord Kodu ile Giriş</h2>
        <div class="remember-me">
          <input type="checkbox" id="remember-otp">
          <label for="remember-otp">Beni Hatırla</label>
        </div>
        <div id="otp-step-1">
          <input type="text" id="otp-username" class="input-field" placeholder="Discord Kullanıcı Adı (Örn: ekoyildiz)">
          <button id="btn-request" onclick="requestCode()" class="btn btn-primary">Kod Gönder</button>
        </div>
        <div id="otp-step-2" style="display:none;">
          <p style="font-size:0.85rem; color:var(--muted); margin-bottom:1rem;">Discord özel mesajlarınıza gelen 4 haneli kodu girin:</p>
          <input type="text" id="otp-code" class="input-field" placeholder="____" maxlength="4" style="text-align:center; letter-spacing:0.5rem; font-size:1.5rem;">
          <input type="hidden" id="otp-resolved-id">
          <button id="btn-verify" onclick="verifyCode()" class="btn btn-success">Doğrula ve Giriş Yap</button>
        </div>
        <button onclick="showView('view-main')" class="link-btn" style="margin-top:1rem;">← Geri dön</button>
      </div>

      <!-- PASSWORD VIEW -->
      <div id="view-password" style="display:none;">
        <h2 style="font-size:1.1rem; margin-bottom:1rem;">Site Şifresi ile Giriş</h2>
        <div class="remember-me">
          <input type="checkbox" id="remember-pwd">
          <label for="remember-pwd">Beni Hatırla</label>
        </div>
        <input type="text" id="pwd-username" class="input-field" placeholder="Discord Kullanıcı Adı">
        <input type="password" id="pwd-password" class="input-field" placeholder="Site Şifresi">
        <button id="btn-pwd-login" onclick="passwordLogin()" class="btn btn-success">Giriş Yap</button>
        <button onclick="forgotPassword()" class="link-btn" style="display:block; margin: 1rem auto 0.5rem;">Şifremi Unuttum</button>
        <button onclick="showView('view-main')" class="link-btn" style="display:block; margin:0 auto;">← Geri dön</button>
      </div>

      <script>
        // Init error box
        const srvErr = ${JSON.stringify(errorMsg || '')};
        if (srvErr) { document.getElementById('error-box').style.display = 'block'; }

        function showError(msg) {
          const box = document.getElementById('error-box');
          box.innerText = "⚠️ " + msg;
          box.style.display = 'block';
        }
        function hideError() {
          document.getElementById('error-box').style.display = 'none';
        }
        function showView(id) {
          hideError();
          document.getElementById('view-main').style.display = 'none';
          document.getElementById('view-otp').style.display = 'none';
          document.getElementById('view-password').style.display = 'none';
          document.getElementById(id).style.display = 'block';
        }

        // Discord OAuth2
        function goDiscordAuth() {
          const rem = document.getElementById('remember-discord').checked;
          window.location.href = '/auth/discord?remember=' + (rem ? 'true' : 'false');
        }

        // OTP Auth
        async function requestCode() {
          hideError();
          const username = document.getElementById('otp-username').value.trim();
          if (!username) return showError("Lütfen Discord Kullanıcı Adınızı girin.");
          
          const btn = document.getElementById('btn-request');
          btn.disabled = true; btn.innerText = "Gönderiliyor...";
          try {
            const res = await fetch('/api/auth/request-code', {
              method: 'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ username })
            });
            const data = await res.json();
            if(data.success) {
              document.getElementById('otp-resolved-id').value = data.discordId;
              document.getElementById('otp-step-1').style.display = 'none';
              document.getElementById('otp-step-2').style.display = 'block';
            } else {
              showError(data.error || "Bilinmeyen hata");
            }
          } catch(e) { showError("Bağlantı hatası."); }
          btn.disabled = false; btn.innerText = "Kod Gönder";
        }

        async function verifyCode() {
          hideError();
          const discordId = document.getElementById('otp-resolved-id').value;
          const code = document.getElementById('otp-code').value.trim();
          const rem = document.getElementById('remember-otp').checked;
          if(!code || code.length !== 4) return showError("Lütfen 4 haneli kodu girin.");
          
          const btn = document.getElementById('btn-verify');
          btn.disabled = true; btn.innerText = "Doğrulanıyor...";
          try {
            const res = await fetch('/api/auth/verify-code', {
              method: 'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ discordId, code, rememberMe: rem })
            });
            const data = await res.json();
            if(data.success) window.location.href = '/dashboard';
            else showError(data.error || "Hatalı kod.");
          } catch(e) { showError("Bağlantı hatası."); }
          btn.disabled = false; btn.innerText = "Doğrula ve Giriş Yap";
        }

        // Custom Password Auth
        async function passwordLogin() {
          hideError();
          const username = document.getElementById('pwd-username').value.trim();
          const password = document.getElementById('pwd-password').value.trim();
          const rem = document.getElementById('remember-pwd').checked;
          
          if (!username || !password) return showError("Lütfen tüm alanları doldurun.");
          
          const btn = document.getElementById('btn-pwd-login');
          btn.disabled = true; btn.innerText = "Giriş Yapılıyor...";
          
          try {
            const res = await fetch('/api/auth/site-login', {
              method: 'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ username, password, rememberMe: rem })
            });
            const data = await res.json();
            if(data.success) window.location.href = '/dashboard';
            else showError(data.error || "Bilinmeyen hata");
          } catch(e) { showError("Bağlantı hatası."); }
          
          btn.disabled = false; btn.innerText = "Giriş Yap";
        }

        async function forgotPassword() {
          hideError();
          const username = prompt("Lütfen Discord Kullanıcı Adınızı girin:");
          if(!username) return;
          
          try {
            const res = await fetch('/api/auth/forgot-password', {
              method: 'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ username })
            });
            const data = await res.json();
            if(data.success) {
              alert(data.message);
              // Wait for code
              const code = prompt("DM kutunuza gelen 6 haneli sıfırlama kodunu girin:");
              if(!code) return;
              const newPassword = prompt("Lütfen yeni Site Şifrenizi belirleyin (En az 8 karakter):");
              if(!newPassword || newPassword.length < 8) return alert("Geçersiz şifre.");
              
              const res2 = await fetch('/api/auth/reset-password', {
                method: 'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ discordId: data.discordId, code, password: newPassword })
              });
              const data2 = await res2.json();
              if(data2.success) alert("Şifreniz başarıyla sıfırlandı!");
              else alert("Sıfırlama başarısız: " + data2.error);
            } else {
              showError(data.error || "Hata oluştu.");
            }
          } catch(e) { showError("Bağlantı hatası."); }
        }
      </script>
    </div>
  </div>
</body>
</html>`;
}


// ─────────────────────────────────────────────
// DISCORD AUTHORIZE PAGE
// ─────────────────────────────────────────────
function renderAuthorizePage(scopes = []) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yetkilendirme — Sentara Premium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root { --bg:#06060e; --border:rgba(255,255,255,0.08); --accent:#a78bfa; --accent2:#818cf8; --text:#f0f0f8; --muted:#7c7c9a; }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    body {
      background:var(--bg);
      background-image:radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99,102,241,0.06) 0%, transparent 60%);
      color:var(--text); font-family:'Outfit',sans-serif;
      min-height:100vh; display:flex; align-items:center; justify-content:center;
    }
    .card {
      background:rgba(255,255,255,0.035); backdrop-filter:blur(28px) saturate(1.2);
      -webkit-backdrop-filter:blur(28px) saturate(1.2);
      border:1px solid rgba(255,255,255,0.07); border-radius:24px; padding:3rem 2.5rem;
      text-align:center; max-width:400px; width:100%; margin:1.5rem;
      box-shadow:0 24px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
      animation:popIn 0.5s ease forwards;
    }
    @keyframes popIn { from{opacity:0;transform:scale(0.92) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .logo { font-size:2rem; font-weight:800; background:linear-gradient(135deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; display:block; margin-bottom:1.5rem; letter-spacing:-0.5px; }
    h1 { font-size:1.3rem; margin-bottom:0.5rem; }
    p  { color:var(--muted); margin-bottom:2rem; font-size:0.92rem; line-height:1.6; font-weight:300; }
    .scope-list { text-align:left; margin-bottom:2rem; display:flex; flex-direction:column; gap:0.5rem; }
    .scope-item {
      display:flex; align-items:center; gap:0.75rem;
      background:rgba(167,139,250,0.06); border:1px solid rgba(167,139,250,0.12);
      padding:0.6rem 1rem; border-radius:12px; font-size:0.88rem;
      backdrop-filter:blur(8px);
    }
    .btn {
      width:100%; padding:0.95rem; border:none; border-radius:14px;
      font-family:'Outfit',sans-serif; font-weight:600; font-size:0.95rem;
      cursor:pointer; background:rgba(167,139,250,0.18); border:1px solid rgba(167,139,250,0.25);
      color:var(--accent); margin-bottom:0.75rem; transition:all 0.3s;
      text-decoration:none; display:block;
      backdrop-filter:blur(8px);
    }
    .btn:hover { transform:translateY(-1px); background:rgba(167,139,250,0.28); border-color:rgba(167,139,250,0.4); color:#fff; box-shadow:0 6px 24px rgba(167,139,250,0.15); }
    .btn-ghost { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:var(--muted); }
    .btn-ghost:hover { border-color:rgba(255,255,255,0.15); color:var(--text); background:rgba(255,255,255,0.06); box-shadow:none; }
    ::selection { background:rgba(167,139,250,0.3); color:#fff; }
  </style>
</head>
<body>
  <div class="card">
    <span class="logo">sentara</span>
    <h1>Uygulamayı Yetkilendir</h1>
    <p>Sentara şu izinlere erişmek istiyor:</p>
    <div class="scope-list">
      ${(scopes.length ? scopes : ['identify', 'email', 'guilds']).map(s => `
        <div class="scope-item">✅ <span><strong>${_esc(s)}</strong></span></div>
      `).join('')}
    </div>
    <a href="/auth/discord" class="btn">İzin Ver</a>
    <a href="/" class="btn btn-ghost">Reddet</a>
  </div>
</body>
</html>`;
}


// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard(user, staffProgress) {
  // Use isAuthorized flag instead of checking username, since username might be a fallback value
  const isRobloxLinked = user.isAuthorized && user.robloxId;
  const hasDiscordOAuth = Boolean(user.discordId);
  const usernameIsEkonqt = String(user.robloxUsername || '').toLowerCase() === 'damndoggii';
  const hasModeratorTeamMembership = Boolean(user.verificationStatus?.moderatorTeamMember || user.verificationStatus?.moderatorTeamGroupMember);
  const { SUPPORT_CATEGORIES } = require("../config");

  // Determine if staff promotion warning should be displayed
  const isStaff = user.isStaff || isSiteAdmin(user);
  let showPromotionWarning = false;
  if (isStaff) {
    if (!staffProgress || !staffProgress.promotedAt) {
      showPromotionWarning = true;
    } else {
      const daysSincePromotion = (Date.now() - new Date(staffProgress.promotedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePromotion >= 3) {
        showPromotionWarning = true;
      }
    }
  }

  // Create category grid cards
  const categoryCards = Object.entries(SUPPORT_CATEGORIES).map(([key, cat]) => {
    let desc = "";
    switch (key) {
      case "ban": desc = "Yasaklama ve sunucudaki cezalarınız hakkında itirazda bulunmak için talep oluşturun."; break;
      case "reklam": desc = "Reklam sponsorlukları ve iş ortaklıkları hakkında bilgi almak için başvurun."; break;
      case "report": desc = "Kuralları ihlal eden kullanıcıları moderatör ekibimize bildirin."; break;
      case "billing": desc = "EkoCoin ve diğer ödeme işlemleriyle ilgili karşılaştığınız sorunları iletin."; break;
      case "technical": desc = "Sistemlerimiz ve Discord botu ile ilgili teknik sorunları çözün."; break;
      case "account": desc = "Roblox hesabı eşleme veya yetki sorunlarınızı ekibimize iletin."; break;
      case "genel": desc = "Genel soru, öneri ve diğer konularda yardım almak için talep oluşturun."; break;
      default: desc = "Diğer kategorilere uymayan destek talepleriniz için başvurun."; break;
    }

    return `
      <div class="category-card" onclick="window.location.href='/tickets/new?category=${key}'">
        <div class="category-icon">${cat.name.split(" ")[0]}</div>
        <h3 class="category-title">${cat.name.split(" ").slice(1).join(" ")}</h3>
        <p class="category-desc">${desc}</p>
        <div class="category-btn">Talep Aç ➔</div>
      </div>
    `;
  }).join("");

  const content = `
    <!-- Welcome -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:2.5rem; animation:fadeUp 0.5s ease;">
      <div>
        <div style="color:var(--muted);font-size:0.9rem;margin-bottom:0.3rem;">Naber? 👋</div>
        <h1 style="font-size:2.4rem;font-weight:800;">${_esc(user.discordUsername)}</h1>
        <p class="text-muted mt-1">İşte destek sistemindeki güncel durumun.</p>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;background:rgba(255,255,255,0.03);padding:1rem 1.5rem;border-radius:16px;border:1px solid rgba(255,255,255,0.07);backdrop-filter:blur(16px);">
        <img src="${_esc(user.discordAvatar)}" alt="Avatar"
             style="width:50px;height:50px;border-radius:50%;border:2px solid var(--accent);box-shadow:0 0 12px rgba(167,139,250,0.2);">
        <div>
          <div style="font-weight:700;">${_esc(user.discordUsername)}</div>
          <div style="font-size:0.8rem;color:var(--muted);">
            ${user.isAdmin ? '<span style="color:var(--accent2);">👑 Admin</span>' :
      user.isStaff ? '<span style="color:var(--accent);">🛡 Staff</span>' : 'Kullanıcı'}
          </div>
          <a href="/logout" style="color:var(--danger);font-size:0.8rem;text-decoration:none;">Çıkış Yap</a>
        </div>
      </div>
    </div>

    <!-- Roblox Linked Status or Warning Alert -->
    ${isRobloxLinked ? `
    <div style="background:rgba(74,222,128,0.07);
                border:1px solid rgba(74,222,128,0.25);
                border-radius:16px;padding:1.25rem 1.5rem;
                display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
                margin-bottom:2rem;animation:fadeUp 0.5s ease;">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:1.5rem;">✅</span>
        <div>
          <div style="font-weight:700;color:var(--success);">
            Roblox Bağlandı
          </div>
          <div style="font-size:0.85rem;color:var(--muted);">
            Roblox Kullanıcı Adı: ${_esc(user.robloxUsername)}
          </div>
        </div>
      </div>
      <div>
        <button type="button" id="btn-sync-roles" class="btn btn-sm btn-success">🔄 Rolleri Güncelle</button>
      </div>
    </div>
    ` : `
    <div style="background:rgba(251,191,36,0.07);
                border:1px solid rgba(251,191,36,0.25);
                border-radius:16px;padding:1.25rem 1.5rem;
                display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
                margin-bottom:2rem;box-shadow:0 0 15px rgba(251,191,36,0.05);animation:fadeUp 0.5s ease;">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:1.5rem;">⚠️</span>
        <div>
          <div style="font-weight:800;color:var(--warning);letter-spacing:0.5px;">
            ROBLOX HESABINI DOĞRULADIN MI? HEMEN DOĞRULA!!
          </div>
          <div style="font-size:0.85rem;color:var(--muted);margin-top:0.25rem;">
            Ticket açabilmek ve yetkili/üye rollerini eşitlemek için Roblox hesabını bağlaman gerekmektedir.
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
        <a href="/auth/roblox" class="btn btn-sm">🌐 Web ile Bağla</a>
        <button type="button" onclick="showFriendVerifyModal()" class="btn btn-sm btn-ghost" style="border-color:var(--border);">🤖 Arkadaş İsteği ile Doğrula</button>
      </div>
    </div>
    `}

    <div id="role-sync-result" style="display:none;margin-bottom:2rem;"></div>

    <!-- Promotion Warning Banner -->
    ${showPromotionWarning ? `
    <div style="background:rgba(251,113,133,0.07);
                border:1px solid rgba(251,113,133,0.25);
                border-radius:16px;padding:1.25rem 1.5rem;
                display:flex;align-items:center;gap:1rem;
                margin-bottom:2rem;animation:pulseBorder 2s infinite alternate;">
      <span style="font-size:1.5rem;">📈</span>
      <div>
        <div style="font-weight:700;color:var(--danger);">
          Son birkaç gündür terfi almıyorsun veya rütben değişmiyor..
        </div>
        <div style="font-size:0.85rem;color:var(--muted);margin-top:0.25rem;">
          Aktifliğini artırarak ve daha fazla ticket çözerek rütbeni yükseltebilirsin!
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Terms Warning Banner -->
    <div style="background:rgba(129,140,248,0.07);
                border:1px solid rgba(129,140,248,0.25);
                border-radius:16px;padding:1.25rem 1.5rem;
                display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
                margin-bottom:1rem;animation:fadeUp 0.5s ease;">
      <div style="display:flex;align-items:center;gap:0.75rem;flex:1;">
        <span style="font-size:1.5rem;">🔗</span>
        <div>
          <div style="font-weight:700;color:var(--accent2);">Discord ile doğrulama ve bağlantılı roller</div>
          <div style="font-size:0.85rem;color:var(--muted);margin-top:0.25rem;">
            Roblox doğrulaması tamamlandığında Discord tarafında bağlantılı roller için şartlar otomatik güncellenir.
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
        <a href="/auth/discord" class="btn btn-sm btn-ghost" style="border-color:rgba(129,140,248,0.3);color:var(--accent2);font-weight:700;">Discord ile Giriş Yap</a>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:1rem 1.25rem;margin-bottom:2rem;">
      <div style="font-weight:800;margin-bottom:0.75rem;">📋 Doğrulama Şartları</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
        <div style="padding:0.75rem;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:0.9rem;color:var(--muted);margin-bottom:0.3rem;">Discord OAuth</div>
          <div style="font-weight:700;color:${hasDiscordOAuth ? 'var(--success)' : 'var(--warning)'};">${hasDiscordOAuth ? '✅ Tamamlandı' : '⏳ Bekliyor'}</div>
        </div>
        <div style="padding:0.75rem;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:0.9rem;color:var(--muted);margin-bottom:0.3rem;">Roblox Doğrulaması</div>
          <div style="font-weight:700;color:${isRobloxLinked ? 'var(--success)' : 'var(--warning)'};">${isRobloxLinked ? '✅ Tamamlandı' : '⏳ Bekliyor'}</div>
        </div>
        <div style="padding:0.75rem;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:0.9rem;color:var(--muted);margin-bottom:0.3rem;">Kullanıcı adı damndoggii mi?</div>
          <div style="font-weight:700;color:${usernameIsEkonqt ? 'var(--success)' : 'var(--warning)'};">${usernameIsEkonqt ? '✅ Tamamlandı' : '⏳ Bekliyor'}</div>
        </div>
      </div>
    </div>

    <div style="background:rgba(129,140,248,0.07);
                border:1px solid rgba(129,140,248,0.25);
                border-radius:16px;padding:1.25rem 1.5rem;
                display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
                margin-bottom:2rem;animation:fadeUp 0.5s ease;">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:1.5rem;">⚖️</span>
        <div>
          <div style="font-weight:700;color:var(--accent2);">
            Şartlarımızı kabul ettin mi?
          </div>
          <div style="font-size:0.85rem;color:var(--muted);margin-top:0.25rem;">
            Kullanım koşullarımızı ve gizlilik politikamızı okuyup onayladığınızdan emin olun.
          </div>
        </div>
      </div>
      <div>
        <a href="/legal/tos" class="btn btn-sm btn-ghost" style="border-color:rgba(129,140,248,0.3);color:var(--accent2);font-weight:700;">kabul et!</a>
      </div>
    </div>

    <!-- Ticket Categories Title -->
    <div style="margin-bottom: 1.5rem; animation:fadeUp 0.6s ease; margin-top:2rem;">
      <h2 style="font-size:1.8rem;font-weight:800;background:linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; display:inline-block;">🎫 Destek Kategorileri</h2>
      <p class="text-muted" style="margin-top:0.3rem;">Yaşadığınız soruna en uygun kategoriyi seçerek yeni bir destek talebi (ticket) başlatın.</p>
    </div>

    <!-- Categories Grid -->
    <div class="category-grid" style="animation:fadeUp 0.7s ease; margin-bottom:2.5rem;">
      ${categoryCards}
    </div>

    <style>
      .category-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1.5rem;
        margin-top: 1rem;
      }
      .category-card {
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 18px;
        padding: 1.5rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(8px);
      }
      .category-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(167, 139, 250, 0.05), rgba(129, 140, 248, 0.02));
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .category-card:hover {
        transform: translateY(-5px);
        border-color: rgba(167, 139, 250, 0.3);
        box-shadow: 0 12px 30px rgba(167, 139, 250, 0.1);
        background: rgba(255, 255, 255, 0.04);
      }
      .category-card:hover::before {
        opacity: 1;
      }
      .category-icon {
        font-size: 2.2rem;
        margin-bottom: 1rem;
        filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.2));
        transition: transform 0.3s ease;
      }
      .category-card:hover .category-icon {
        transform: scale(1.1) rotate(5deg);
      }
      .category-title {
        font-size: 1.15rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        color: var(--text);
        position: relative;
        z-index: 1;
      }
      .category-desc {
        font-size: 0.85rem;
        color: var(--muted);
        line-height: 1.5;
        margin-bottom: 1.25rem;
        flex-grow: 1;
        position: relative;
        z-index: 1;
      }
      .category-btn {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--accent);
        display: flex;
        align-items: center;
        gap: 0.25rem;
        transition: transform 0.2s ease;
        position: relative;
        z-index: 1;
      }
      .category-card:hover .category-btn {
        transform: translateX(4px);
        color: #fff;
      }
      
      @keyframes pulseBorder {
        0% { border-color: rgba(251, 113, 133, 0.25); box-shadow: 0 0 10px rgba(251, 113, 133, 0.05); }
        100% { border-color: rgba(251, 113, 133, 0.5); box-shadow: 0 0 20px rgba(251, 113, 133, 0.15); }
      }
      
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0); }
      }
    </style>

    <script>
      async function syncRolesFromWeb() {
        const btn = document.getElementById('btn-sync-roles');
        const box = document.getElementById('role-sync-result');
        if (!btn || !box) return;
        btn.disabled = true;
        btn.textContent = '⏳ Güncelleniyor...';
        box.style.display = 'block';
        box.innerHTML = '<div class="card" style="color:var(--muted);">Roller senkronize ediliyor...</div>';
        try {
          const res = await fetch('/api/roles/sync', { method: 'POST' });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Senkronizasyon başarısız');
          }
          const added = (data.added || []).map(r => r.name).join(', ') || 'Yok';
          const removed = (data.removed || []).map(r => r.name).join(', ') || 'Yok';
          box.innerHTML = '<div class="card" style="border-left:4px solid var(--success);">' +
            '<div style="font-weight:800;margin-bottom:0.75rem;">✅ Update — ' + (data.nickname || '') + '</div>' +
            '<div style="font-size:0.9rem;margin-bottom:0.4rem;"><strong>Rütbe:</strong> ' + (data.rankName || '—') + '</div>' +
            '<div style="font-size:0.9rem;margin-bottom:0.4rem;"><strong>Eklenen:</strong> ' + added + '</div>' +
            '<div style="font-size:0.9rem;"><strong>Kaldırılan:</strong> ' + removed + '</div></div>';
        } catch (err) {
          box.innerHTML = '<div class="card" style="border-left:4px solid var(--danger);color:var(--danger);">❌ ' + err.message + '</div>';
        } finally {
          btn.disabled = false;
          btn.textContent = '🔄 Rolleri Güncelle';
        }
      }

      const syncBtn = document.getElementById('btn-sync-roles');
      if (syncBtn) syncBtn.addEventListener('click', syncRolesFromWeb);
    </script>
    
    <!-- Modal HTML -->
    <div id="friend-verify-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:1000; align-items:center; justify-content:center; padding:1.5rem;">
      <div class="card" style="width:100%; max-width:480px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
        <button onclick="closeFriendVerifyModal()" style="position:absolute; top:1.25rem; right:1.25rem; background:none; border:none; color:var(--muted); font-size:1.5rem; cursor:pointer;">✕</button>
        <h3 style="font-size:1.5rem; font-weight:800; margin-bottom:1rem; background:linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; display:flex; align-items:center; gap:0.5rem; text-align:left;">🤖 Arkadaş İsteği Doğrulaması</h3>
        
        <div id="fv-step-1">
          <p style="color:var(--muted); font-size:0.95rem; line-height:1.6; margin-bottom:1.5rem; text-align:left;">
            Roblox kullanıcı adınızı girin. Botumuz size Roblox üzerinden bir arkadaşlık isteği gönderecektir.
          </p>
          <label for="fv-username" style="text-align:left;">Roblox Kullanıcı Adı</label>
          <input type="text" id="fv-username" placeholder="örn: RobloxUser" style="margin-bottom:1.5rem;">
          <button onclick="startFriendVerification()" id="fv-start-btn" class="btn w-full">Arkadaş İsteği Gönder</button>
        </div>
        
        <div id="fv-step-2" style="display:none;">
          <p style="color:var(--muted); font-size:0.95rem; line-height:1.6; margin-bottom:1.5rem; text-align:left;">
            Bot size arkadaşlık isteği gönderdi! Lütfen aşağıdaki profili ziyaret edip isteği kabul edin, ardından **Doğrulamayı Tamamla** butonuna tıklayın.
          </p>
          <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:10px; border:1px solid var(--border); text-align:center; margin-bottom:1.5rem;">
            <a id="fv-bot-profile" href="#" target="_blank" class="text-accent" style="font-weight:700; text-decoration:none; font-size:1.05rem;">🔗 Botun Roblox Profiline Git</a>
          </div>
          <button onclick="confirmFriendVerification()" id="fv-confirm-btn" class="btn w-full btn-success">✅ Doğrulamayı Tamamla</button>
        </div>
      </div>
    </div>

    <script>
      function showFriendVerifyModal() {
        document.getElementById('friend-verify-modal').style.display = 'flex';
        document.getElementById('fv-step-1').style.display = 'block';
        document.getElementById('fv-step-2').style.display = 'none';
        document.getElementById('fv-username').value = '';
      }
      
      function closeFriendVerifyModal() {
        document.getElementById('friend-verify-modal').style.display = 'none';
      }
      
      let pendingRobloxId = null;
      let pendingUsername = null;
      
      async function startFriendVerification() {
        const username = document.getElementById('fv-username').value.trim();
        if (!username) {
          showToast('Lütfen Roblox kullanıcı adınızı girin.', 'warning');
          return;
        }
        const btn = document.getElementById('fv-start-btn');
        btn.textContent = 'Gönderiliyor...';
        btn.disabled = true;
        try {
          const res = await fetch('/api/auth/roblox/friend-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            pendingRobloxId = data.robloxId;
            pendingUsername = username;
            document.getElementById('fv-bot-profile').href = data.botProfileUrl;
            document.getElementById('fv-step-1').style.display = 'none';
            document.getElementById('fv-step-2').style.display = 'block';
            showToast('Arkadaşlık isteği gönderildi!', 'success');
          } else {
            showToast(data.error || 'İstek gönderilirken bir hata oluştu.', 'error');
          }
        } catch (err) {
          showToast('Bağlantı hatası.', 'error');
        } finally {
          btn.textContent = 'Arkadaş İsteği Gönder';
          btn.disabled = false;
        }
      }
      
      async function confirmFriendVerification() {
        if (!pendingRobloxId || !pendingUsername) {
          showToast('Geçersiz doğrulama isteği.', 'error');
          return;
        }
        const btn = document.getElementById('fv-confirm-btn');
        btn.textContent = 'Kontrol ediliyor...';
        btn.disabled = true;
        try {
          const res = await fetch('/api/auth/roblox/friend-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ robloxId: pendingRobloxId, username: pendingUsername })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('Doğrulama başarılı! Sayfa yenileniyor...', 'success');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            showToast(data.error || 'Arkadaşlık isteği henüz kabul edilmemiş.', 'error');
          }
        } catch (err) {
          showToast('Bağlantı hatası.', 'error');
        } finally {
          btn.textContent = '✅ Doğrulamayı Tamamla';
          btn.disabled = false;
        }
      }
    </script>
  `;
  return _layout('Dashboard', user, content, '', '/dashboard');
}


// ─────────────────────────────────────────────
// TICKETS PAGE
// ─────────────────────────────────────────────
function renderTicketsPage(user) {
  const content = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <h1 style="font-size:2rem;font-weight:800;">🎫 Ticket'larım</h1>
        <a href="/tickets/new" class="btn btn-sm">➕ Yeni Ticket</a>
      </div>

      <!-- Search + Filter bar -->
      <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap;">
        <input id="search-input" type="text" placeholder="🔍 Ticket ara..." style="flex:1;min-width:180px;margin-bottom:0;">
        <select id="filter-status" style="width:auto;margin-bottom:0;font-size:0.9rem;">
          <option value="">Tümü</option>
          <option value="open">Açık</option>
          <option value="closed">Kapalı</option>
        </select>
        <select id="filter-cat" style="width:auto;margin-bottom:0;font-size:0.9rem;">
          <option value="">Tüm Kategoriler</option>
        </select>
      </div>

      <div id="ticket-count" style="color:var(--muted);font-size:0.85rem;margin-bottom:1rem;"></div>
      <div id="tickets-container">
        <div style="color:var(--muted);text-align:center;padding:3rem;">Yükleniyor...</div>
      </div>
    </div>

    <!-- Kapatma sebebi modal -->
    <div id="close-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
      <div style="background:rgba(14,14,26,0.9);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:2rem;max-width:480px;width:90%;box-shadow:0 16px 40px rgba(0,0,0,0.4);">
        <h3 style="margin-bottom:1rem;">🔒 Ticket'ı Kapat</h3>
        <textarea id="close-reason-input" rows="4" placeholder="Kapatma sebebi..." style="width:100%;margin-bottom:1rem;"></textarea>
        <div style="display:flex;gap:0.75rem;">
          <button class="btn btn-danger" onclick="confirmClose()" style="flex:1;">Kapat</button>
          <button class="btn btn-ghost" onclick="document.getElementById('close-modal').style.display='none'" style="flex:1;">İptal</button>
        </div>
      </div>
    </div>

    <style>
      .ticket-item {
        background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);
        border-radius:14px; padding:1.25rem 1.5rem;
        transition:border-color 0.3s, transform 0.3s, background 0.3s;
        margin-bottom:0.75rem;
        backdrop-filter:blur(8px);
      }
      .ticket-item:hover { border-color:rgba(167,139,250,0.2); transform:translateX(4px); background:rgba(255,255,255,0.04); }
      .ticket-item:last-child { margin-bottom:0; }
      .ticket-header { display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.5rem; }
      .ticket-meta { display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;font-size:0.8rem;color:var(--muted); }
      .ticket-actions { display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap; }
    </style>

    <script>
      let allTickets = [];
      let pendingCloseId = null;

      async function loadTickets() {
        try {
          const res  = await fetch('/api/tickets');
          const data = await res.json();
          if (!data.success) throw new Error(data.error);
          allTickets = data.tickets || [];

          const cats = [...new Set(allTickets.map(t => t.category).filter(Boolean))];
          const catSel = document.getElementById('filter-cat');
          cats.forEach(c => {
            const o = document.createElement('option');
            o.value = o.textContent = c;
            catSel.appendChild(o);
          });

          renderTickets();
        } catch (err) {
          document.getElementById('tickets-container').innerHTML =
            \`<div style="color:var(--danger);padding:1rem;">❌ \${err.message}</div>\`;
        }
      }

      function timeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'az önce';
        if (m < 60) return m + 'dk önce';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'sa önce';
        const d = Math.floor(h / 24);
        if (d < 30) return d + 'g önce';
        return Math.floor(d / 30) + 'ay önce';
      }

      function renderTickets() {
        const q      = (document.getElementById('search-input').value || '').toLowerCase();
        const status = document.getElementById('filter-status').value;
        const cat    = document.getElementById('filter-cat').value;
        const c      = document.getElementById('tickets-container');
        const countEl = document.getElementById('ticket-count');

        let tickets = allTickets;
        if (status) tickets = tickets.filter(t => t.status === status);
        if (cat)    tickets = tickets.filter(t => t.category === cat);
        if (q)      tickets = tickets.filter(t =>
          (t.ticketId || '').toLowerCase().includes(q) ||
          (t.subject  || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q)
        );

        countEl.textContent = tickets.length + ' ticket bulundu';

        if (!tickets.length) {
          c.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);">Eşleşen ticket bulunamadı.</div>';
          return;
        }

        c.innerHTML = tickets.map(t => {
          const isOpen = t.status === 'open';
          const ago = timeAgo(t.createdAt);
          const closedAgo = t.closedAt ? timeAgo(t.closedAt) : null;
          const hasChannel = t.channelId && !t.channelDeleted;
          const source = t.source === 'web' ? '🌐 Web' : '💬 Discord';

          const actions = isOpen
            ? \`<button class="btn btn-sm btn-danger" onclick="openCloseModal('\${t.ticketId}')">🔒 Kapat</button>
               \${hasChannel ? \`<a href="https://discord.com/channels/\${t.guildId || ''}/\${t.channelId}" target="_blank" class="btn btn-sm btn-ghost">💬 Kanala Git</a>\` : ''}
               <button class="btn btn-sm btn-danger btn-ghost" onclick="deleteTicket('\${t.ticketId}')">🗑️ Sil</button>\`
            : \`<button class="btn btn-sm btn-success" onclick="reopenTicket('\${t.ticketId}')">🔓 Tekrar Aç</button>
               <button class="btn btn-sm btn-danger btn-ghost" onclick="deleteTicket('\${t.ticketId}')">🗑️ Sil</button>\`;

          return \`<div class="ticket-item" id="ticket-\${t.ticketId}">
            <div class="ticket-header">
              <div>
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem;">
                  <span style="font-weight:800;color:var(--accent);">\${t.ticketId}</span>
                  \${t.category ? \`<span style="font-size:0.75rem;background:rgba(124,106,247,0.1);border:1px solid rgba(124,106,247,0.2);padding:0.1rem 0.5rem;border-radius:20px;color:var(--muted);">\${t.category}</span>\` : ''}
                  <span style="font-size:0.72rem;color:var(--muted);">\${source}</span>
                </div>
                <div style="font-weight:600;margin-bottom:0.2rem;">\${t.subject || 'Konu belirtilmedi'}</div>
              </div>
              <span class="badge badge-\${isOpen ? 'open' : 'closed'}">\${isOpen ? 'AÇIK' : 'KAPALI'}</span>
            </div>
            <div class="ticket-meta">
              \${ago ? \`<span>🕐 \${ago}</span>\` : ''}
              \${!isOpen && closedAgo ? \`<span>🔒 \${closedAgo} kapatıldı</span>\` : ''}
              \${t.closeReason ? \`<span title="\${t.closeReason}">� \${t.closeReason.slice(0,40)}\${t.closeReason.length>40?'…':''}</span>\` : ''}
            </div>
            <div class="ticket-actions">\${actions}</div>
          </div>\`;
        }).join('');
      }

      // ── Kapatma ──
      function openCloseModal(ticketId) {
        pendingCloseId = ticketId;
        document.getElementById('close-reason-input').value = '';
        document.getElementById('close-modal').style.display = 'flex';
      }

      async function confirmClose() {
        if (!pendingCloseId) return;
        const reason = document.getElementById('close-reason-input').value.trim() || 'Web üzerinden kapatıldı';
        document.getElementById('close-modal').style.display = 'none';
        try {
          const res = await fetch('/api/tickets/' + pendingCloseId + '/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
          });
          if (res.ok) { showToast('Ticket kapatıldı.', 'success'); await loadTickets(); }
          else { const d = await res.json().catch(()=>({})); showToast(d.error || 'Hata', 'error'); }
        } catch { showToast('Bağlantı hatası.', 'error'); }
        pendingCloseId = null;
      }

      // ── Tekrar Aç ──
      async function reopenTicket(ticketId) {
        if (!confirm('Bu ticket\\'ı yeniden açmak istiyor musun?')) return;
        try {
          const res = await fetch('/api/tickets/' + ticketId + '/reopen', { method: 'POST' });
          const d = await res.json().catch(() => ({}));
          if (res.ok) { showToast(d.message || 'Ticket yeniden açıldı.', 'success'); await loadTickets(); }
          else showToast(d.error || 'Hata', 'error');
        } catch { showToast('Bağlantı hatası.', 'error'); }
      }

      // ── Sil ──
      async function deleteTicket(ticketId) {
        if (!confirm('Bu ticket\\'ı tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
        try {
          const res = await fetch('/api/tickets/' + ticketId, { method: 'DELETE' });
          const d = await res.json().catch(() => ({}));
          if (res.ok) { showToast(d.message || 'Ticket başarıyla tamamen silindi.', 'success'); await loadTickets(); }
          else showToast(d.error || 'Hata', 'error');
        } catch { showToast('Bağlantı hatası.', 'error'); }
      }

      document.getElementById('filter-status').addEventListener('change', renderTickets);
      document.getElementById('filter-cat').addEventListener('change', renderTickets);
      document.getElementById('search-input').addEventListener('input', renderTickets);
      loadTickets();
    </script>
  `;
  return _layout("Ticket'larım", user, content, '', '/tickets');
}


// ─────────────────────────────────────────────
// STAFF PANEL
// ─────────────────────────────────────────────
function renderStaffPanel(user) {
  const content = `
    <!-- Sekme başlıkları -->
    <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0;">
      <button class="sf-tab sf-tab-active" onclick="switchTab('tickets',this)" style="padding:0.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid var(--accent);color:var(--text);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">🎫 Ticketlar</button>
      <button class="sf-tab" onclick="switchTab('ratings',this)" style="padding:0.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">⭐ Moderatör Puanları</button>
    </div>

    <!-- Ticket sekmesi -->
    <div id="tab-tickets" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <h1 style="font-size:2rem;font-weight:800;">👨‍💼 Staff Panel</h1>
        <div style="display:flex;gap:0.75rem;align-items:center;">
          <select id="sf-filter" style="width:auto;margin-bottom:0;font-size:0.9rem;">
            <option value="open">Açık</option>
            <option value="closed">Kapalı</option>
            <option value="">Tümü</option>
          </select>
          <button class="btn btn-sm" onclick="loadStaff()">🔄 Yenile</button>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;min-width:600px;">
          <thead>
            <tr style="background:rgba(167,139,250,0.06);border-bottom:1px solid rgba(255,255,255,0.06);">
              <th style="padding:0.9rem 1rem;color:var(--accent);">ID</th>
              <th style="padding:0.9rem 1rem;color:var(--accent);">Kullanıcı</th>
              <th style="padding:0.9rem 1rem;color:var(--accent);">Konu</th>
              <th style="padding:0.9rem 1rem;color:var(--accent);">Kategori</th>
              <th style="padding:0.9rem 1rem;color:var(--accent);">Durum</th>
              <th style="padding:0.9rem 1rem;color:var(--accent);">İşlem</th>
            </tr>
          </thead>
          <tbody id="sf-body">
            <tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--muted);">Yükleniyor...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Moderatör Puanları sekmesi -->
    <div id="tab-ratings" class="card" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 style="font-size:2rem;font-weight:800;">⭐ Moderatör Puan Sıralaması</h1>
          <p style="color:var(--muted);font-size:0.9rem;margin-top:0.25rem;">Kullanıcı değerlendirmelerine göre sıralama (anonim)</p>
        </div>
        <button class="btn btn-sm" onclick="loadRatings()">🔄 Yenile</button>
      </div>

      <div id="ratings-body">
        <div style="text-align:center;padding:3rem;color:var(--muted);">Yükleniyor...</div>
      </div>
    </div>

    <script>
      // ── Sekme geçişi ──────────────────────────────────────────────────────
      function switchTab(name, btn) {
        document.getElementById('tab-tickets').style.display = name === 'tickets' ? '' : 'none';
        document.getElementById('tab-ratings').style.display = name === 'ratings' ? '' : 'none';
        document.querySelectorAll('.sf-tab').forEach(t => {
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'var(--muted)';
        });
        btn.style.borderBottomColor = 'var(--accent)';
        btn.style.color = 'var(--text)';
        if (name === 'ratings') loadRatings();
      }

      // ── Ticket listesi ────────────────────────────────────────────────────
      async function loadStaff() {
        const filter = document.getElementById('sf-filter').value;
        try {
          const res  = await fetch('/api/tickets/staff');
          const data = await res.json();
          const rows = (data.tickets || [])
            .filter(t => !filter || t.status === filter);

          const tbody = document.getElementById('sf-body');
          if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--muted);">Ticket bulunamadı.</td></tr>';
            return;
          }

          tbody.innerHTML = rows.map(t => {
            const isOpen = t.status === 'open';
            return \`<tr style="border-bottom:1px solid var(--border);transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
              <td style="padding:1rem;font-weight:700;color:var(--accent);">\${t.ticketId}</td>
              <td style="padding:1rem;">\${t.userName || '—'}</td>
              <td style="padding:1rem;">\${t.subject || '—'}</td>
              <td style="padding:1rem;">\${t.category || '—'}</td>
              <td style="padding:1rem;"><span class="badge badge-\${isOpen ? 'open' : 'closed'}">\${isOpen ? 'AÇIK' : 'KAPALI'}</span></td>
              <td style="padding:1rem;">
                \${isOpen
                  ? \`<button class="btn btn-sm btn-danger" onclick="closeTicket('\${t.ticketId}')">Kapat</button>\`
                  : \`<button class="btn btn-sm btn-success" onclick="reopenTicket('\${t.ticketId}')">Yeniden Aç</button>\`
                }
                <button class="btn btn-sm btn-danger btn-ghost" onclick="deleteTicket('\${t.ticketId}')">Sil</button>
              </td>
            </tr>\`;
          }).join('');
        } catch (err) {
          document.getElementById('sf-body').innerHTML =
            \`<tr><td colspan="6" style="padding:1rem;color:var(--danger);">❌ \${err.message}</td></tr>\`;
        }
      }

      async function closeTicket(id) {
        if (!confirm('Bu ticket\\'ı kapatmak istediğine emin misin?')) return;
        try {
          const res = await fetch('/api/tickets/' + id + '/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Staff tarafından kapatıldı' })
          });
          if (res.ok) { showToast('Ticket kapatıldı.', 'success'); loadStaff(); }
          else showToast('İşlem başarısız.', 'error');
        } catch { showToast('Bağlantı hatası.', 'error'); }
      }

      async function reopenTicket(id) {
        try {
          const res = await fetch('/api/tickets/' + id + '/reopen', { method: 'POST' });
          if (res.ok) { showToast('Ticket yeniden açıldı.', 'success'); loadStaff(); }
          else showToast('İşlem başarısız.', 'error');
        } catch { showToast('Bağlantı hatası.', 'error'); }
      }

      async function deleteTicket(id) {
        if (!confirm('Bu ticket\\'ı tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve Discord kanalı da silinecektir.')) return;
        try {
          const res = await fetch('/api/tickets/' + id, { method: 'DELETE' });
          const d = await res.json().catch(() => ({}));
          if (res.ok) { showToast('Ticket tamamen silindi.', 'success'); loadStaff(); }
          else showToast(d.error || 'İşlem başarısız.', 'error');
        } catch { showToast('Bağlantı hatası.', 'error'); }
      }

      document.getElementById('sf-filter').addEventListener('change', loadStaff);
      loadStaff();

      // ── Moderatör puan sıralaması ─────────────────────────────────────────
      async function loadRatings() {
        const box = document.getElementById('ratings-body');
        box.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);">Yükleniyor...</div>';
        try {
          const res  = await fetch('/api/staff/ratings');
          const data = await res.json();
          const list = data.staff || [];

          if (!list.length) {
            box.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);">Henüz değerlendirme yok.</div>';
            return;
          }

          const medals = ['🥇','🥈','🥉'];
          const rankColors = ['#fbbf24','#9ca3af','#b45309'];

          box.innerHTML = list.map((s, i) => {
            const avg   = s.averageScore.toFixed(1);
            const stars = renderStars(s.averageScore);
            const medal = medals[i] || (i + 1);
            const color = rankColors[i] || 'var(--border)';
            const dist  = (s.distribution || [0,0,0,0,0]);
            const maxDist = Math.max(...dist, 1);

            const distBars = dist.map((cnt, idx) => {
              const pct = Math.round((cnt / maxDist) * 100);
              return \`<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:3px;">
                <span style="font-size:0.75rem;color:var(--muted);width:12px;">\${idx+1}</span>
                <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
                  <div style="width:\${pct}%;height:100%;background:var(--accent);border-radius:3px;transition:width 0.6s;"></div>
                </div>
                <span style="font-size:0.75rem;color:var(--muted);width:20px;text-align:right;">\${cnt}</span>
              </div>\`;
            }).join('');

            return \`
            <div style="display:flex;gap:1.5rem;align-items:flex-start;padding:1.5rem;
                        background:rgba(0,0,0,0.3);border:1px solid \${color};border-radius:18px;
                        margin-bottom:1rem;transition:transform 0.2s,box-shadow 0.2s;"
                 onmouseover="this.style.transform='translateX(4px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.4)'"
                 onmouseout="this.style.transform='none';this.style.boxShadow='none'">

              <!-- Sıra -->
              <div style="font-size:1.8rem;width:36px;text-align:center;flex-shrink:0;padding-top:0.25rem;">\${medal}</div>

              <!-- Avatar -->
              <img src="\${s.avatar}" alt="" style="width:52px;height:52px;border-radius:50%;border:2px solid \${color};flex-shrink:0;">

              <!-- Bilgi -->
              <div style="flex:1;min-width:0;">
                <div style="font-size:1.15rem;font-weight:800;margin-bottom:0.25rem;">\${s.username}</div>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">
                  <span style="font-size:1.3rem;">\${stars}</span>
                  <span style="font-size:1.4rem;font-weight:800;color:\${color};">\${avg}</span>
                  <span style="color:var(--muted);font-size:0.85rem;">/ 5.0</span>
                  <span style="background:rgba(124,106,247,0.12);color:var(--accent);border:1px solid rgba(124,106,247,0.3);
                               padding:0.2rem 0.6rem;border-radius:20px;font-size:0.78rem;font-weight:700;">
                    \${s.totalRatings} değerlendirme
                  </span>
                </div>
                <!-- Puan dağılımı -->
                <div style="max-width:220px;">\${distBars}</div>
              </div>
            </div>\`;
          }).join('');
        } catch (err) {
          box.innerHTML = \`<div style="text-align:center;padding:2rem;color:var(--danger);">❌ \${err.message}</div>\`;
        }
      }

      function renderStars(score) {
        const full  = Math.floor(score);
        const half  = score - full >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '⭐'.repeat(full) + (half ? '✨' : '') + '☆'.repeat(empty);
      }
    </script>
  `;
  return _layout('Staff Panel', user, content);
}


// ─────────────────────────────────────────────
// DEBUG PAGE  (fixed — was truncated)
// ─────────────────────────────────────────────
function renderDebugPage(user, stats = {}, logs = []) {
  const safeStats = stats || {};
  const safeLogs = Array.isArray(logs) ? logs : [];

  const content = `
    <h1 style="font-size:2rem;font-weight:800;margin-bottom:1.5rem;color:var(--danger);">🔍 Debug Panel</h1>

    <!-- Stats Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;">
      ${Object.entries(safeStats).map(([k, v]) => `
        <div class="card" style="padding:1.25rem;">
          <div style="color:var(--muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.4rem;">${_esc(k)}</div>
          <div style="font-size:2rem;font-weight:800;color:var(--accent);">${_esc(String(v))}</div>
        </div>
      `).join('') || '<div class="card" style="padding:1.25rem;color:var(--muted);">İstatistik yok.</div>'}
    </div>

    </div>

    <!-- Live Users -->
    <div class="card" style="margin-bottom:2rem;">
      <h2 style="font-size:1.4rem;font-weight:800;color:var(--success);margin-bottom:1rem;">🟢 Canlı Kullanıcılar</h2>
      <div id="live-users-output" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem;">
        <div style="color:var(--muted);">Yükleniyor...</div>
      </div>
    </div>

    <!-- Live Screen Modal -->
    <div id="live-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:999;backdrop-filter:blur(10px);padding:2rem;">
      <div class="card" style="max-width:1000px;margin:0 auto;height:100%;display:flex;flex-direction:column;position:relative;">
        <button onclick="closeLiveModal()" style="position:absolute;top:1rem;right:1rem;background:var(--danger);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-weight:bold;">X</button>
        <h3 id="live-modal-title" style="margin-bottom:1rem;font-size:1.2rem;">Canlı İzleme</h3>
        <p id="live-modal-url" style="color:var(--muted);margin-bottom:1rem;font-family:monospace;"></p>
        <div id="live-screen-box" style="flex:1;background:#000;border:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden;border-radius:8px;">
          <!-- Cursor -->
          <div id="live-cursor" style="position:absolute;width:12px;height:12px;background:red;border-radius:50%;transform:translate(-50%,-50%);transition:top 0.1s,left 0.1s;pointer-events:none;z-index:10;box-shadow:0 0 10px red;"></div>
        </div>
        <div id="live-clicks-log" style="height:100px;background:rgba(255,255,255,0.05);margin-top:1rem;border-radius:8px;padding:0.5rem;overflow-y:auto;font-family:monospace;font-size:0.8rem;"></div>
      </div>
    </div>

    <!-- Logs -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--accent);">Sistem Logları <span id="log-count"></span></h2>
        <div style="display:flex;gap:0.5rem;">
          <select id="log-filter" style="width:auto;margin-bottom:0;font-size:0.85rem;" onchange="renderLogs()">
            <option value="">Tümü</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
          </select>
        </div>
      </div>
      <div id="log-output" style="max-height:500px;overflow-y:auto;font-family:monospace;font-size:0.8rem;"></div>
    </div>

    <script>
      let rawLogs = ${JSON.stringify(safeLogs.slice().reverse())};
      let liveUsers = [];
      let watchingUserId = null;

      // ── LOG RENDERER ──
      function renderLogs() {
        const filter = document.getElementById('log-filter').value;
        const list   = filter ? rawLogs.filter(l => l.type === filter) : rawLogs;
        const colors = { ERROR:'#f87171', WARN:'#fbbf24', INFO:'#60a5fa', admin:'#a78bfa' };

        document.getElementById('log-count').innerText = \`(\${list.length})\`;
        document.getElementById('log-output').innerHTML = list.length
          ? list.map(l => {
              const time    = (l.timestamp || '').split('T')[1] || l.timestamp || '';
              const timeStr = time.split('.')[0] || time;
              const col     = colors[l.type] || '#a0a0c0';
              return \`<div style="border-bottom:1px solid rgba(255,255,255,0.07);padding:0.5rem 0;">
                <span style="color:#555;">[&thinsp;\${timeStr}&thinsp;]</span>
                <span style="color:\${col};font-weight:\${l.type==='ERROR'?'bold':'normal'};">&nbsp;\${l.type || '?'}</span>:
                <span>&nbsp;\${l.msg || ''}</span>
                \${l.details ? \`<div style="color:#888;margin-left:2rem;margin-top:0.2rem;">\${l.details}</div>\` : ''}
              </div>\`;
            }).join('')
          : '<div style="color:var(--muted);padding:1rem;text-align:center;">Log bulunamadı.</div>';
      }

      // ── LIVE USERS RENDERER ──
      function renderLiveUsers() {
        const container = document.getElementById('live-users-output');
        if (liveUsers.length === 0) {
          container.innerHTML = '<div style="color:var(--muted);">Şu an aktif kullanıcı yok.</div>';
        } else {
          container.innerHTML = liveUsers.map(u => \`
            <div class="card" style="padding:1rem;display:flex;align-items:center;gap:1rem;cursor:pointer;border:1px solid \${watchingUserId === u.userId ? 'var(--success)' : 'rgba(255,255,255,0.1)'}" onclick="openLiveModal('\${u.userId}')">
              <img src="\${u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width:40px;height:40px;border-radius:50%;">
              <div>
                <div style="font-weight:bold;">\${u.username}</div>
                <div style="font-size:0.8rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">\${u.url}</div>
              </div>
            </div>
          \`).join('');
        }

        // Update active modal if watching
        if (watchingUserId) {
          const user = liveUsers.find(u => u.userId === watchingUserId);
          if (user) {
            document.getElementById('live-modal-title').innerText = "Canlı İzleme: " + user.username;
            document.getElementById('live-modal-url').innerText = "Aktif Sayfa: " + user.url + " (" + user.w + "x" + user.h + ")";
            
            const box = document.getElementById('live-screen-box');
            const cursor = document.getElementById('live-cursor');
            
            // Calculate scale
            const scaleX = box.clientWidth / user.w;
            const scaleY = box.clientHeight / user.h;
            
            cursor.style.left = (user.x * scaleX) + 'px';
            cursor.style.top = (user.y * scaleY) + 'px';

            const clicksLog = document.getElementById('live-clicks-log');
            clicksLog.innerHTML = (user.clicks || []).map(c => 
              \`<div>[\${new Date(c.t).toLocaleTimeString()}] Tıkladı: X=\${c.x}, Y=\${c.y}</div>\`
            ).reverse().join('');
          }
        }
      }

      window.openLiveModal = function(userId) {
        watchingUserId = userId;
        document.getElementById('live-modal').style.display = 'block';
        renderLiveUsers();
      }
      
      window.closeLiveModal = function() {
        watchingUserId = null;
        document.getElementById('live-modal').style.display = 'none';
        renderLiveUsers();
      }

      // ── AUTO POLLING ──
      async function fetchData() {
        try {
          const res = await fetch('/api/activity/users');
          const data = await res.json();
          if (data && data.success) {
            liveUsers = data.users || [];
          } else {
            liveUsers = [];
          }
        } catch (e) {
          liveUsers = [];
        }
        renderLiveUsers();
        
        try {
          const res = await fetch('/api/logs');
          const data = await res.json();
          if (data && data.success) {
            rawLogs = data.logs.reverse();
            renderLogs();
          }
        } catch (e) {}
      }

      setInterval(fetchData, 2000);
      fetchData().then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const watchId = urlParams.get('watch');
        if (watchId) {
          window.openLiveModal(watchId);
        }
      });
      renderLogs();
    </script>
  `;
  return _layout('Debug', user, content);
}


// ─────────────────────────────────────────────
// PROFILE PAGE  (guns.lol style)
// ─────────────────────────────────────────────
function renderProfilePage(user, profileUser, isOwn = false, robloxGroups = []) {
  // profileUser = profilini gösterdiğimiz kişi, user = oturum sahibi
  if (!profileUser) profileUser = user;
  const accent = _esc(profileUser.profileColor || '#7c6af7');
  const bannerBg = profileUser.discordBanner
    ? `url(${_esc(profileUser.discordBanner)}) center/cover no-repeat`
    : `linear-gradient(135deg,${accent}cc 0%,#0d0d1a 100%)`;
  const avatarSrc = _esc(profileUser.discordAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png');

  // Roblox group styles and prefix configurations
  const GROUP_STYLES = {
    BEM: { color: '#4ade80', bg: 'rgba(74,222,128,.12)', border: 'rgba(74,222,128,.3)' },
    TMT: { color: '#f87171', bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.3)' },
    TTC: { color: '#60a5fa', bg: 'rgba(96,165,250,.12)', border: 'rgba(96,165,250,.3)' },
    EKO: { color: '#fbbf24', bg: 'rgba(251,191,36,.12)', border: 'rgba(251,191,36,.3)' },
    CTE: { color: '#a78bfa', bg: 'rgba(167,139,250,.12)', border: 'rgba(167,139,250,.3)' },
    TFD: { color: '#22d3ee', bg: 'rgba(34,211,238,.12)', border: 'rgba(34,211,238,.3)' },
    TMA: { color: '#f472b6', bg: 'rgba(244,114,182,.12)', border: 'rgba(244,114,182,.3)' },
  };

  const GROUP_PREFIXES = {
    "35898429": "TTC",
    "35431216": "EKO",
    "35757415": "CTE",
    "17241052": "TFD",
    "11517908": "TMT",
    "33499704": "TMA",
    "8505535": "BEM"
  };

  const badgesList = [];

  if (Array.isArray(robloxGroups)) {
    for (const g of robloxGroups) {
      const groupIdStr = String(g.group?.id || '');
      const prefix = GROUP_PREFIXES[groupIdStr];
      if (prefix && g.role?.rank > 0 && g.role?.name && g.role.name.toLowerCase() !== 'guest') {
        const style = GROUP_STYLES[prefix] || { color: '#a78bfa', bg: 'rgba(167,139,250,.12)', border: 'rgba(167,139,250,.3)' };
        badgesList.push({
          name: `${prefix} - ${g.role.name}`,
          color: style.color,
          bg: style.bg,
          border: style.border
        });
      }
    }
  }

  const roleBadgesHtml = badgesList.map(r =>
    `<span class="p-badge" style="background:${r.bg};color:${r.color};border-color:${r.border};">${_esc(r.name)}</span>`
  ).join('');

  const groupRoleHtml = '';

  const css = `<style>
    main{max-width:100%!important;padding:0!important}
    ${profileUser.profileBgUrl ? `
      body {
        background: url('${_esc(profileUser.profileBgUrl)}') center/cover no-repeat fixed !important;
      }
    ` : ''}
    @keyframes aurora{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    @keyframes fireAni{0%,100%{filter:hue-rotate(0deg) brightness(1)}50%{filter:hue-rotate(25deg) brightness(1.25)}}
    @keyframes galaxy{0%{background-position:0% 0%}100%{background-position:200% 200%}}
    @keyframes neonPulse{0%,100%{box-shadow:0 0 12px ${accent},0 0 24px ${accent}44}50%{box-shadow:0 0 24px #f953c6,0 0 48px #f953c644}}
    @keyframes ocean{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    .eff-aurora .p-banner{background:linear-gradient(270deg,#00c6ff,#0072ff,#7c6af7,#ff6bf7,#00c6ff)!important;background-size:400% 400%!important;animation:aurora 6s ease infinite}
    .eff-fire .p-banner{animation:fireAni 2s ease infinite}
    .eff-galaxy .p-banner{background:linear-gradient(135deg,#0f0c29,#302b63,#24243e,#7c6af7,#0f0c29)!important;background-size:400% 400%!important;animation:galaxy 10s linear infinite}
    .eff-neon .p-card{animation:neonPulse 2.5s ease-in-out infinite}
    .eff-ocean .p-banner{background:linear-gradient(270deg,#1a6b8a,#00b4d8,#90e0ef,#1a6b8a)!important;background-size:400% 400%!important;animation:ocean 5s ease infinite}
    .frm-gold .p-avatar{border-color:#fbbf24!important;box-shadow:0 0 0 4px #fbbf2466,0 0 24px #fbbf2488!important}
    .frm-diamond .p-avatar{box-shadow:0 0 0 4px #a8edea66,0 0 24px #a8edea88!important}
    .frm-fire .p-avatar{border-color:#ff4e00!important;box-shadow:0 0 0 4px #ff4e0066,0 0 24px #ff4e0088!important;animation:fireAni 2s ease infinite}
    .p-root{max-width:860px;margin:0 auto;padding:2rem 1rem 4rem;animation:fadeUp .5s ease}
    .p-banner{width:100%;height:280px;border-radius:20px;position:relative;overflow:hidden;background:${bannerBg};box-shadow:0 8px 40px rgba(0,0,0,.6)}
    .p-banner-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(5,5,8,.85) 100%)}
    .p-avatar-wrap{position:absolute;bottom:-52px;left:2.5rem;filter:drop-shadow(0 4px 16px rgba(0,0,0,.7))}
    .p-avatar{width:120px;height:120px;border-radius:50%;border:5px solid #050508;display:block;transition:transform .3s}
    .p-avatar:hover{transform:scale(1.05)}
    .p-body{padding:4.5rem 2.5rem 2rem}
    .p-name-row{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:.75rem}
    .p-name{font-size:2rem;font-weight:800;line-height:1.1}
    .p-sub{color:var(--muted);font-size:.9rem;margin-top:.2rem}
    .p-badges{display:flex;gap:.4rem;flex-wrap:wrap;margin:.75rem 0}
    .p-badge{display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .7rem;border-radius:20px;font-size:.78rem;font-weight:700;border:1px solid;backdrop-filter:blur(4px)}
    .p-bio{font-size:.95rem;line-height:1.75;color:var(--muted);white-space:pre-wrap;word-break:break-word;margin:1rem 0 1.5rem;padding:1rem 1.25rem;background:rgba(255,255,255,.03);border-left:3px solid ${accent};border-radius:0 10px 10px 0}
    .p-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin:1.5rem 0}
    .p-stat{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:1rem;text-align:center;transition:border-color .3s,transform .3s;backdrop-filter:blur(8px)}
    .p-stat:hover{border-color:${accent}44;transform:translateY(-3px)}
    .p-stat-val{font-size:1.5rem;font-weight:800}
    .p-stat-lbl{font-size:.72rem;color:var(--muted);margin-top:.2rem;text-transform:uppercase;letter-spacing:.5px}
    .p-coin-bar{display:flex;align-items:center;gap:.75rem;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.12);border-radius:14px;padding:.9rem 1.25rem;margin-bottom:1.5rem;backdrop-filter:blur(8px)}
    .p-coin-icon{font-size:1.6rem;animation:float 3s ease-in-out infinite}
    .p-coin-val{font-size:1.4rem;font-weight:800}
    .p-coin-lbl{font-size:.75rem;color:var(--muted)}
    .p-inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.75rem}
    .p-inv-item{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:.9rem .5rem;text-align:center;position:relative;transition:border-color .3s,transform .3s;backdrop-filter:blur(8px)}
    .p-inv-item:hover{border-color:${accent}44;transform:translateY(-3px)}
    .p-inv-item.active{border-color:${accent};background:rgba(167,139,250,.06)}
    .p-inv-active-tag{position:absolute;top:5px;right:5px;font-size:.6rem;font-weight:800;text-transform:uppercase;background:${accent};color:#fff;padding:1px 5px;border-radius:8px}
    .p-inv-icon{font-size:1.8rem;margin-bottom:.35rem}
    .p-inv-name{font-size:.72rem;font-weight:700;line-height:1.2}
    .p-section{margin:2rem 0 1rem;display:flex;align-items:center;gap:.5rem}
    .p-section-title{font-size:.8rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
    .p-section-line{flex:1;height:1px;background:var(--border)}
    @media(max-width:600px){.p-banner{height:180px}.p-avatar{width:90px;height:90px}.p-avatar-wrap{bottom:-40px;left:1.25rem}.p-body{padding:3.5rem 1.25rem 1.5rem}.p-name{font-size:1.5rem}}
  </style>`;

  const profileDiscordId = _esc(profileUser.discordId || '');

  const html = `
    <div class="p-root" id="p-root">
      <div class="p-banner" id="p-banner">
        <div class="p-banner-overlay"></div>
        <div class="p-avatar-wrap">
          <img src="${avatarSrc}" class="p-avatar" id="p-avatar" alt="avatar">
        </div>
      </div>
      <div class="card p-card p-body" style="border-radius:0 0 20px 20px;border-top:none;margin-top:0;">
        <div class="p-name-row">
          <div>
            <div class="p-name">${_esc(profileUser.discordUsername)}</div>
            <div class="p-sub">${profileUser.robloxUsername ? `🎮 <span style="color:var(--success);">${_esc(profileUser.robloxUsername)}</span>` : `<span style="color:var(--muted);">Roblox bağlı değil</span>`}</div>
            ${groupRoleHtml}
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
              ${profileUser.gunsLolUrl ? `
                <a href="${_esc(profileUser.gunsLolUrl)}" target="_blank" class="btn btn-sm" style="background:linear-gradient(135deg, #ff007f 0%, #7f00ff 100%);color:#fff;border:none;box-shadow:0 0 15px rgba(255,0,127,0.4);display:inline-flex;align-items:center;gap:0.4rem;margin-top:0.5rem;font-weight:700;padding: 0.35rem 0.75rem; border-radius: 8px;font-size:0.8rem;text-decoration:none;">
                  <span>🔗 guns.lol</span>
                </a>
              ` : ''}
              ${profileUser.profileMusicUrl ? `
                <div style="margin-top: 0.5rem; padding: 0.3rem 0.6rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; display: inline-flex; align-items: center; gap: 0.5rem; backdrop-filter: blur(8px);">
                  <span style="font-size: 0.9rem;">🎵</span>
                  <span style="font-size: 0.75rem; color: var(--muted);" id="music-status">Müzik: Durdu</span>
                  <button onclick="toggleProfileMusic()" id="play-btn" style="background: var(--accent); border: none; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.65rem;">▶</button>
                  <audio id="profile-audio" src="${_esc(profileUser.profileMusicUrl)}" loop></audio>
                </div>
              ` : ''}
            </div>
          </div>
          ${isOwn ? `<a href="/settings" class="btn btn-ghost btn-sm" style="flex-shrink:0;">✏️ Düzenle</a>` : ''}
        </div>
        <div class="p-badges" id="p-badges">
          ${roleBadgesHtml}
        </div>
        <div class="p-bio">${_esc(profileUser.profileBio || 'Henüz bir biyografi eklenmemiş.')}</div>
        <div class="p-coin-bar">
          <div class="p-coin-icon">💰</div>
          <div><div class="p-coin-val" id="p-balance">—</div><div class="p-coin-lbl">Bakiye</div></div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:.85rem;font-weight:700;color:var(--success);" id="p-earned">—</div>
            <div class="p-coin-lbl">Toplam kazanılan</div>
          </div>
          ${isOwn ? `<a href="/shop" class="btn btn-sm" style="margin-left:1rem;flex-shrink:0;">🛒 Mağaza</a>` : ''}
        </div>
        <div class="p-section"><span class="p-section-title">İstatistikler</span><div class="p-section-line"></div></div>
        <div class="p-stats">
          <div class="p-stat"><div class="p-stat-val" id="stat-tickets">—</div><div class="p-stat-lbl">Ticket</div></div>
          <div class="p-stat"><div class="p-stat-val" id="stat-closed">—</div><div class="p-stat-lbl">Çözülen</div></div>
          <div class="p-stat"><div class="p-stat-val" id="stat-items">—</div><div class="p-stat-lbl">Ürün</div></div>
          <div class="p-stat"><div class="p-stat-val" id="stat-spent">—</div><div class="p-stat-lbl">Harcanan</div></div>
        </div>
        <div class="p-section"><span class="p-section-title">Envanter</span><div class="p-section-line"></div></div>
        <div class="p-inv-grid" id="p-inv"><div style="grid-column:1/-1;color:var(--muted);font-size:.85rem;">Yükleniyor...</div></div>
      </div>
    </div>`;

  const script = `<script>
    const TARGET_ID = ${JSON.stringify(profileUser.discordId || '')};
    const IS_OWN = ${isOwn ? 'true' : 'false'};
    const BADGE_MAP={badge_supporter:{emoji:'💜',label:'Destekçi',color:'rgba(168,85,247,.15)',border:'rgba(168,85,247,.4)',text:'#c084fc'},badge_veteran:{emoji:'⚔️',label:'Veteran',color:'rgba(251,191,36,.1)',border:'rgba(251,191,36,.4)',text:'#fbbf24'},badge_star:{emoji:'⭐',label:'Yıldız',color:'rgba(251,191,36,.1)',border:'rgba(251,191,36,.3)',text:'#fde68a'},badge_crown:{emoji:'👑',label:'Kral',color:'rgba(255,107,247,.1)',border:'rgba(255,107,247,.4)',text:'var(--accent2)'}};

    async function loadProfile(){
      try{
        // Ekonomi verisi — herkese açık endpoint (targetId ile)
        const eRes = await fetch('/api/economy/public/' + TARGET_ID);
        const ed = await eRes.json().catch(()=>({}));

        // Ticket istatistikleri — sadece kendi profilinde
        if(IS_OWN){
          const tRes = await fetch('/api/tickets');
          const td = await tRes.json().catch(()=>({}));
          const tickets=td.tickets||[];
          document.getElementById('stat-tickets').textContent=tickets.length;
          document.getElementById('stat-closed').textContent=tickets.filter(t=>t.status==='closed').length;
        } else {
          document.getElementById('stat-tickets').textContent='—';
          document.getElementById('stat-closed').textContent='—';
        }

        if(ed.success){
          document.getElementById('p-balance').textContent=(ed.balance||0).toLocaleString('tr-TR')+' coin';
          document.getElementById('p-earned').textContent='+'+(ed.totalEarned||0).toLocaleString('tr-TR')+' coin';
          document.getElementById('stat-items').textContent=(ed.inventory||[]).length;
          document.getElementById('stat-spent').textContent=(ed.totalSpent||0).toLocaleString('tr-TR');

          // Rozet ekle
          const br=document.getElementById('p-badges');
          (ed.profileBadges||[]).forEach(bid=>{const b=BADGE_MAP[bid];if(!b)return;const s=document.createElement('span');s.className='p-badge';s.style.cssText='background:'+b.color+';color:'+b.text+';border-color:'+b.border+';';s.textContent=b.emoji+' '+b.label;br.appendChild(s);});

          // Efekt/frame uygula
          const root=document.getElementById('p-root');
          if(ed.profileEffect)root.classList.add('eff-'+ed.profileEffect.replace('effect_',''));
          if(ed.profileFrame)root.classList.add('frm-'+ed.profileFrame.replace('frame_',''));

          // Envanter
          const inv=ed.inventory||[];
          const grid=document.getElementById('p-inv');
          if(!inv.length){
            grid.innerHTML=IS_OWN
              ? '<div style="grid-column:1/-1;color:var(--muted);font-size:.85rem;">Henüz hiçbir şey satın almadınız. <a href=\\"/shop\\" style=\\"color:var(--accent)\\">Mağazaya git →</a></div>'
              : '<div style="grid-column:1/-1;color:var(--muted);font-size:.85rem;">Envanter boş.</div>';
          } else {
            grid.innerHTML=inv.map(item=>{
              const isActive=ed.profileEffect===item.itemId||ed.profileFrame===item.itemId;
              const canEquip=IS_OWN&&(item.type==='effect'||item.type==='frame');
              return '<div class="p-inv-item'+(isActive?' active':'')+'">'+
                (isActive?'<div class="p-inv-active-tag">Aktif</div>':'')+
                '<div class="p-inv-icon">'+item.icon+'</div>'+
                '<div class="p-inv-name">'+item.name+'</div>'+
                (canEquip&&!isActive?'<button onclick="equipItem(\''+item.itemId+'\')" style="margin-top:.4rem;background:rgba(124,106,247,.2);border:1px solid rgba(124,106,247,.4);color:var(--accent);border-radius:8px;padding:2px 10px;font-size:.7rem;cursor:pointer;font-family:inherit;font-weight:700;">Tak</button>':'')+
                '</div>';
            }).join('');
          }
        }
      }catch(err){console.warn('Profil yüklenemedi:',err.message);}
    }

    async function equipItem(itemId){
      const res=await fetch('/api/profile/equip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemId})});
      const d=await res.json().catch(()=>({}));
      if(res.ok){showToast(d.message||'Aktif edildi!','success');setTimeout(()=>location.reload(),700);}
      else showToast(d.error||'Hata','error');
    }
    function toggleProfileMusic() {
      const audio = document.getElementById('profile-audio');
      const btn = document.getElementById('play-btn');
      const status = document.getElementById('music-status');
      if (!audio) return;
      if (audio.paused) {
        audio.play().then(() => {
          btn.textContent = '⏸';
          status.textContent = 'Müzik: Çalıyor';
          btn.style.background = 'var(--danger)';
        }).catch(err => {
          console.warn("Müzik çalınamadı:", err);
          showToast("Tarayıcı engeli: Sayfada herhangi bir yere tıkladıktan sonra çal tuşuna tekrar basın.", "warning");
        });
      } else {
        audio.pause();
        btn.textContent = '▶';
        status.textContent = 'Müzik: Durdu';
        btn.style.background = 'var(--accent)';
      }
    }
    loadProfile();
  <\/script>`;

  const pageTitle = isOwn ? 'Profil' : _esc(profileUser.discordUsername) + ' — Profil';
  const content = css + html + script;
  return _layout(pageTitle, user, content);
}


// ─────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────
function renderSettingsPage(user) {
  const content = `
    <div class="card">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:2rem;">⚙️ Ayarlar</h1>

      <div id="settings-form">
        <label>Profil Rengi (Hex)</label>
        <input type="color" id="color" value="${_esc(user.profileColor || '#7c6af7')}"
               style="width:60px;height:44px;padding:4px;cursor:pointer;margin-bottom:1.2rem;">
        <input type="text"  id="colorText" value="${_esc(user.profileColor || '#7c6af7')}"
               placeholder="#7c6af7" style="margin-top:-0.5rem;">

        <label>Biyografi</label>
        <textarea id="bio" rows="5" placeholder="Kendinden bahset..." maxlength="500">${_esc(user.profileBio || '')}</textarea>
        <div style="text-align:right;color:var(--muted);font-size:0.8rem;margin-top:-1rem;margin-bottom:1rem;">
          <span id="bio-count">${(user.profileBio || '').length}</span>/500
        </div>

        <label>Site Giriş Şifresi</label>
        <input type="password" id="sitePassword" placeholder="Yeni site şifresi girin (Değiştirmek istemiyorsanız boş bırakın)">

        <hr class="divider">
        <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:1rem;">🎨 Guns.lol Tarzı Profil Özelleştirme</h2>
        
        <label>Guns.lol Bağlantı Linki</label>
        <input type="text" id="gunsLolUrl" value="${_esc(user.gunsLolUrl || '')}" placeholder="https://guns.lol/kullaniciadi">

        <label>Profil Özel Arkaplan Resim/GIF URL</label>
        <input type="text" id="profileBgUrl" value="${_esc(user.profileBgUrl || '')}" placeholder="https://ornek.com/resim.gif">

        <label>Profil Özel Arkaplan Müzik (.mp3) URL</label>
        <input type="text" id="profileMusicUrl" value="${_esc(user.profileMusicUrl || '')}" placeholder="https://ornek.com/muzik.mp3">

        <hr class="divider">

        <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:1rem;">🔗 Bağlı Hesaplar</h2>
        <div style="background:rgba(255,255,255,0.025);padding:1rem 1.25rem;border-radius:12px;border:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;backdrop-filter:blur(8px);">
          <div>
            <div style="font-weight:700;margin-bottom:0.2rem;">Discord</div>
            <div style="color:var(--success);font-size:0.85rem;">✅ ${_esc(user.discordUsername)}</div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.025);padding:1rem 1.25rem;border-radius:12px;border:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;backdrop-filter:blur(8px);">
          <div>
            <div style="font-weight:700;margin-bottom:0.2rem;">Roblox</div>
            <div style="color:${user.robloxUsername ? 'var(--success)' : 'var(--warning)'};font-size:0.85rem;">
              ${user.robloxUsername ? '✅ ' + _esc(user.robloxUsername) : '⚠️ Bağlı değil'}
            </div>
          </div>
          ${!user.robloxUsername ? `<a href="/auth/roblox" class="btn btn-sm">Bağla</a>` : `<a href="/auth/roblox/unlink" class="btn btn-sm btn-danger">Bağlantıyı Kes</a>`}
        </div>

        <button class="btn w-full" id="save-btn" onclick="saveSettings()">💾 Kaydet</button>
      </div>
    </div>

    <script>
      const bioEl   = document.getElementById('bio');
      const countEl = document.getElementById('bio-count');
      const colorEl = document.getElementById('color');
      const colorTx = document.getElementById('colorText');

      bioEl.addEventListener('input', () => { countEl.textContent = bioEl.value.length; });
      colorEl.addEventListener('input', () => { colorTx.value = colorEl.value; });
      colorTx.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(colorTx.value)) colorEl.value = colorTx.value;
      });

      async function saveSettings() {
        const btn = document.getElementById('save-btn');
        btn.textContent = 'Kaydediliyor...';
        btn.disabled = true;
        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileColor: colorEl.value,
              profileBio: bioEl.value,
              sitePassword: document.getElementById('sitePassword').value,
              gunsLolUrl: document.getElementById('gunsLolUrl').value,
              profileBgUrl: document.getElementById('profileBgUrl').value,
              profileMusicUrl: document.getElementById('profileMusicUrl').value
            })
          });
          if (res.ok) {
            showToast('Ayarlar başarıyla kaydedildi!', 'success');
            document.getElementById('sitePassword').value = ''; // clear password input after success
          } else {
            const d = await res.json().catch(() => ({}));
            showToast(d.error || 'Bir hata oluştu.', 'error');
          }
        } catch {
          showToast('Bağlantı hatası.', 'error');
        } finally {
          btn.textContent = '💾 Kaydet';
          btn.disabled = false;
        }
      }
    </script>
  `;
  return _layout('Ayarlar', user, content);
}


// ─────────────────────────────────────────────
// LEGAL PAGE
// ─────────────────────────────────────────────
function renderLegalPage(title, text, lang = 'tr') {
  const content = `
    <div class="card" style="max-width:860px;margin:0 auto;">
      <!-- Dil seçici -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;">
        <h1 style="font-size:2rem;font-weight:800;color:var(--accent);">${_esc(title)}</h1>
        <div style="display:flex;gap:.5rem;">
          <a href="?lang=tr" style="padding:.4rem .9rem;border-radius:8px;font-size:.85rem;font-weight:700;text-decoration:none;background:${lang === 'tr' ? 'var(--accent)' : 'rgba(255,255,255,.07)'};color:${lang === 'tr' ? '#fff' : 'var(--muted)'};border:1px solid ${lang === 'tr' ? 'transparent' : 'var(--border)'};">🇹🇷 TR</a>
          <a href="?lang=en" style="padding:.4rem .9rem;border-radius:8px;font-size:.85rem;font-weight:700;text-decoration:none;background:${lang === 'en' ? 'var(--accent)' : 'rgba(255,255,255,.07)'};color:${lang === 'en' ? '#fff' : 'var(--muted)'};border:1px solid ${lang === 'en' ? 'transparent' : 'var(--border)'};">🇬🇧 EN</a>
        </div>
      </div>
      <div style="line-height:2;color:var(--muted);font-size:.97rem;">${text}</div>
      <hr class="divider">
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
        <a href="/legal/tos"     style="color:var(--accent);text-decoration:none;font-weight:600;">📄 Terms of Service / Hizmet Koşulları</a>
        <a href="/legal/privacy" style="color:var(--accent);text-decoration:none;font-weight:600;">🔒 Privacy Policy / Gizlilik Politikası</a>
        <a href="/"              style="color:var(--muted);text-decoration:none;">← Ana Sayfa</a>
      </div>
    </div>
  `;
  return _layout(title, null, content);
}


// ─────────────────────────────────────────────
// WIKI PAGE
// ─────────────────────────────────────────────
function renderWikiListPage(user, articles = [], canManage = false) {
  const adminForm = canManage ? `
    <div id="wa-form" style="display:none;background:rgba(124,106,247,0.06);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-bottom:2rem;">
      <h3 style="margin-bottom:1rem;color:var(--accent);">➕ Yeni Makale</h3>
      <label>Başlık <span style="color:var(--danger);">*</span></label>
      <input type="text" id="wa-title" maxlength="120" placeholder="Makale başlığı">
      <label>Kapak Resmi URL</label>
      <input type="url" id="wa-image" placeholder="https://...">
      <label>İçerik <span style="color:var(--danger);">*</span></label>
      <textarea id="wa-body" rows="10" maxlength="20000" placeholder="Makale içeriğini buraya yazın..."></textarea>
      <div style="text-align:right;color:var(--muted);font-size:0.8rem;margin-top:-1rem;margin-bottom:1rem;"><span id="wa-count">0</span>/20000</div>
      <div style="display:flex;gap:0.75rem;">
        <button class="btn" id="wa-create-btn" onclick="createWikiArticle()" style="flex:1;">📖 Yayınla</button>
        <button class="btn btn-ghost" onclick="document.getElementById('wa-form').style.display='none'" style="flex:1;">İptal</button>
      </div>
    </div>` : '';

  const listHtml = articles.length ? articles.map(a => {
    const preview = (a.body || '').replace(/\n/g, ' ').slice(0, 160);
    const img = a.imageUrl
      ? `<div style="width:100%;height:160px;background:url('${_esc(a.imageUrl)}') center/cover;border-radius:12px 12px 0 0;flex-shrink:0;"></div>`
      : `<div style="width:100%;height:80px;background:linear-gradient(135deg,rgba(124,106,247,0.15),rgba(255,107,247,0.1));border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;font-size:2rem;">📖</div>`;
    const authorAvatar = a.authorAvatar
      ? `<img src="${_esc(a.authorAvatar)}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:4px;">`
      : '';
    const ts = a.createdAt ? `<t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:d>` : '';
    return `
      <a href="/wiki/${_esc(a._id)}" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;
              background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;
              transition:transform 0.3s,border-color 0.3s,box-shadow 0.3s;backdrop-filter:blur(8px);"
         onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(167,139,250,0.2)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.3)'"
         onmouseout="this.style.transform='none';this.style.borderColor='rgba(255,255,255,0.06)';this.style.boxShadow='none'">
        ${img}
        <div style="padding:1.25rem;flex:1;display:flex;flex-direction:column;gap:0.5rem;">
          <h3 style="font-weight:800;font-size:1.1rem;line-height:1.3;">${_esc(a.title)}</h3>
          <p style="color:var(--muted);font-size:0.88rem;line-height:1.5;flex:1;">${_esc(preview)}${preview.length >= 160 ? '…' : ''}</p>
          <div style="display:flex;gap:1rem;font-size:0.78rem;color:var(--muted);margin-top:0.5rem;flex-wrap:wrap;">
            <span>${authorAvatar}${_esc(a.authorName || '—')}</span>
            <span>👁 ${(a.views || 0).toLocaleString('tr-TR')}</span>
            <span>💬 ${(a.commentCount || 0)}</span>
          </div>
        </div>
      </a>`;
  }).join('') : '<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--muted);"><div style="font-size:3rem;margin-bottom:1rem;">📭</div><div>Henüz makale yok.</div></div>';

  const content = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 style="font-size:2.2rem;font-weight:800;">📖 Wiki</h1>
          <p style="color:var(--muted);margin-top:0.25rem;">${articles.length} makale</p>
        </div>
        ${canManage ? `<button class="btn" onclick="document.getElementById('wa-form').style.display=document.getElementById('wa-form').style.display==='none'?'block':'none'">➕ Yeni Makale</button>` : ''}
      </div>
      <hr class="divider">
      ${adminForm}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem;">
        ${listHtml}
      </div>
    </div>

    <script>
      const waBody = document.getElementById('wa-body');
      const waCount = document.getElementById('wa-count');
      if (waBody) waBody.addEventListener('input', () => { waCount.textContent = waBody.value.length; });

      async function createWikiArticle() {
        const btn = document.getElementById('wa-create-btn');
        btn.disabled = true; btn.textContent = 'Yayınlanıyor...';
        const res = await fetch('/api/wiki/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: document.getElementById('wa-title').value.trim(),
            body: waBody.value.trim(),
            imageUrl: document.getElementById('wa-image').value.trim() || null
          })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) { location.href = '/wiki/' + d.article._id; }
        else { showToast(d.error || 'Hata', 'error'); btn.disabled = false; btn.textContent = '📖 Yayınla'; }
      }
    </script>
  `;
  return _layout('Wiki', user, content, '', '/wiki');
}

function renderWikiArticlePage(user, article, canManage = false) {
  const comments = (article.comments || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const reactions = article.reactions || {};
  const EMOJIS = ["👍", "❤️", "🔥", "😂", "😮", "👏"];
  const currentUserId = user ? _esc(user.discordId || '') : '';

  // ── Kapak resmi ──
  const coverImg = article.imageUrl
    ? `<div style="width:100%;max-height:380px;overflow:hidden;border-radius:16px;margin-bottom:2rem;">
         <img src="${_esc(article.imageUrl)}" alt="" style="width:100%;object-fit:cover;display:block;">
       </div>`
    : '';

  // ── Yazar satırı ──
  const authorAvatar = article.authorAvatar
    ? `<img src="${_esc(article.authorAvatar)}" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;">`
    : `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;">
         ${_esc((article.authorName || '?')[0].toUpperCase())}
       </div>`;
  const authorLink = article.authorId
    ? `/profile/${_esc(article.authorId)}`
    : null;
  const authorNameHtml = authorLink
    ? `<a href="${authorLink}" style="color:var(--text);font-weight:600;text-decoration:none;transition:color .2s;"
          onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text)'">${_esc(article.authorName || '—')}</a>`
    : `<span style="color:var(--text);font-weight:600;">${_esc(article.authorName || '—')}</span>`;
  const createdTs = article.createdAt
    ? `<time title="${new Date(article.createdAt).toLocaleString('tr-TR')}">${new Date(article.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</time>`
    : '';
  const editedLine = article.editedByName && article.editedAt
    ? `<span style="color:var(--muted);font-size:0.8rem;margin-left:0.75rem;">
         • Düzenleyen: <a href="/profile/${_esc(article.editedById || '')}" style="color:var(--muted);font-weight:700;text-decoration:none;"
             onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--muted)'">${_esc(article.editedByName)}</a>
         <time title="${new Date(article.editedAt).toLocaleString('tr-TR')}">${new Date(article.editedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
       </span>`
    : '';

  // ── Tepkiler ──
  const reactionHtml = EMOJIS.map(e => {
    const r = reactions[e];
    const count = r ? r.count : 0;
    const reacted = r && user && (r.users || []).includes(user.discordId || '');
    return `<button onclick="reactTo('${e}')" data-emoji="${e}"
      style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;
             border-radius:20px;border:1px solid ${reacted ? 'var(--accent)' : 'var(--border)'};
             background:${reacted ? 'rgba(124,106,247,0.15)' : 'rgba(0,0,0,0.25)'};
             color:${reacted ? 'var(--accent)' : 'var(--text)'};
             font-family:inherit;font-size:0.9rem;cursor:pointer;transition:all 0.2s;"
      onmouseover="this.style.borderColor='var(--accent)'"
      onmouseout="this.style.borderColor='${reacted ? 'var(--accent)' : 'var(--border)'}'">
      ${e} ${count > 0 ? `<span style="font-size:0.8rem;font-weight:700;">${count}</span>` : ''}
    </button>`;
  }).join('');

  // ── Yorumlar ──
  const commentsHtml = comments.map(c => {
    const isOwner = user && (user.discordId === c.userId || canManage);
    const delBtn = isOwner
      ? `<button onclick="deleteComment('${_esc(c._id)}')"
           style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem;padding:0.2rem 0.5rem;border-radius:6px;transition:color 0.2s;"
           onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--muted)'">🗑</button>`
      : '';
    const cAvatar = c.avatar
      ? `<img src="${_esc(c.avatar)}" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;">${_esc((c.username || '?')[0].toUpperCase())}</div>`;
    const cTime = c.createdAt
      ? `<span style="font-size:0.75rem;color:var(--muted);">${new Date(c.createdAt).toLocaleString('tr-TR')}</span>`
      : '';
    return `
      <div id="comment-${_esc(c._id)}" style="display:flex;gap:0.75rem;padding:1rem;background:rgba(0,0,0,0.25);border-radius:14px;border:1px solid var(--border);">
        ${cAvatar}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;flex-wrap:wrap;">
            <a href="/profile/${_esc(c.userId || '')}" style="font-weight:700;color:var(--accent);text-decoration:none;"
               onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">${_esc(c.username || '—')}</a>
            ${cTime}
            ${delBtn}
          </div>
          <div style="white-space:pre-wrap;line-height:1.6;word-break:break-word;">${_esc(c.content)}</div>
        </div>
      </div>`;
  }).join('');

  const commentForm = user
    ? `<div style="margin-top:1.5rem;">
         <textarea id="comment-body" rows="3" placeholder="Yorumunuzu yazın..." maxlength="2000"
           style="resize:vertical;" oninput="document.getElementById('c-count').textContent=this.value.length"></textarea>
         <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;">
           <span style="font-size:0.8rem;color:var(--muted);"><span id="c-count">0</span>/2000</span>
           <button class="btn btn-sm" onclick="postComment()">💬 Yorum Yap</button>
         </div>
       </div>`
    : `<div style="text-align:center;padding:1.5rem;color:var(--muted);">
         Yorum yapmak için <a href="/login" style="color:var(--accent);">giriş yapın</a>.
       </div>`;

  // ── Admin düzenleme formu ──
  const editForm = canManage ? `
    <div id="edit-form" style="display:none;background:rgba(124,106,247,0.06);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-top:1.5rem;">
      <h3 style="margin-bottom:1rem;color:var(--accent);">✏️ Makaleyi Düzenle</h3>
      <label>Başlık</label>
      <input type="text" id="edit-title" value="${_esc(article.title)}" maxlength="120">
      <label>Kapak Resmi URL</label>
      <input type="url" id="edit-image" value="${_esc(article.imageUrl || '')}" placeholder="https://...">
      <label>İçerik</label>
      <textarea id="edit-body" rows="12" maxlength="20000">${_esc(article.body || '')}</textarea>
      <div style="display:flex;gap:0.75rem;margin-top:0.5rem;">
        <button class="btn" onclick="saveEdit()" style="flex:1;">💾 Kaydet</button>
        <button class="btn btn-ghost" onclick="document.getElementById('edit-form').style.display='none'" style="flex:1;">İptal</button>
      </div>
    </div>` : '';

  const aid = JSON.stringify(article._id);

  const content = `
    <div style="max-width:780px;margin:0 auto;">

      <!-- Geri butonu -->
      <a href="/wiki" style="display:inline-flex;align-items:center;gap:0.4rem;color:var(--muted);text-decoration:none;font-size:0.9rem;margin-bottom:1.5rem;transition:color 0.2s;"
         onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">
        ← Wiki'ye Dön
      </a>

      <div class="card">
        <!-- Kapak -->
        ${coverImg}

        <!-- Başlık + meta -->
        <div style="margin-bottom:1.5rem;">
          <h1 style="font-size:2rem;font-weight:800;line-height:1.2;margin-bottom:1rem;">${_esc(article.title)}</h1>
          <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;font-size:0.88rem;color:var(--muted);">
            ${authorAvatar}
            ${authorNameHtml}
            <span>—</span>
            ${createdTs}
            ${editedLine}
            <span style="margin-left:auto;display:flex;gap:1rem;">
              <span>👁 ${(article.views || 0).toLocaleString('tr-TR')} görüntülenme</span>
              <span>💬 ${comments.length} yorum</span>
            </span>
          </div>
        </div>

        <hr class="divider">

        <!-- İçerik -->
        <div style="line-height:1.85;font-size:1rem;white-space:pre-wrap;word-break:break-word;margin-bottom:2rem;">${_esc(article.body || '')}</div>

        <!-- Tepkiler -->
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.5rem;">
          ${reactionHtml}
        </div>

        <!-- Admin butonları -->
        ${canManage ? `
        <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap;">
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('edit-form').style.display=document.getElementById('edit-form').style.display==='none'?'block':'none'">✏️ Düzenle</button>
          <button class="btn btn-sm btn-danger" onclick="deleteArticle()">🗑 Sil</button>
        </div>
        ${editForm}` : ''}

        <hr class="divider">

        <!-- Yorumlar -->
        <div>
          <h2 style="font-size:1.3rem;font-weight:800;margin-bottom:1.25rem;">💬 Yorumlar <span style="color:var(--muted);font-size:0.9rem;font-weight:400;">(${comments.length})</span></h2>
          <div id="comments-list" style="display:flex;flex-direction:column;gap:0.75rem;">
            ${commentsHtml || `<div style="text-align:center;padding:2rem;color:var(--muted);">Henüz yorum yok. İlk yorumu sen yap!</div>`}
          </div>
          ${commentForm}
        </div>
      </div>
    </div>

    <script>
      const articleId = ${aid};

      // ── Tepki ──
      async function reactTo(emoji) {
        ${user ? `
        const res = await fetch('/api/wiki/articles/' + articleId + '/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji })
        });
        if (res.ok) location.reload();
        else { const d = await res.json().catch(()=>({})); showToast(d.error || 'Hata', 'error'); }
        ` : `showToast('Tepki eklemek için giriş yapın.', 'warning');`}
      }

      // ── Yorum gönder ──
      async function postComment() {
        const body = document.getElementById('comment-body');
        const text = body.value.trim();
        if (!text) return;
        const btn = body.nextElementSibling.querySelector('button');
        btn.disabled = true; btn.textContent = 'Gönderiliyor...';
        const res = await fetch('/api/wiki/articles/' + articleId + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text })
        });
        if (res.ok) location.reload();
        else {
          const d = await res.json().catch(() => ({}));
          showToast(d.error || 'Hata', 'error');
          btn.disabled = false; btn.textContent = '💬 Yorum Yap';
        }
      }

      // ── Yorum sil ──
      async function deleteComment(commentId) {
        if (!confirm('Bu yorumu silmek istediğine emin misin?')) return;
        const res = await fetch('/api/wiki/articles/' + articleId + '/comments/' + commentId, { method: 'DELETE' });
        if (res.ok) {
          const el = document.getElementById('comment-' + commentId);
          if (el) el.remove();
          showToast('Yorum silindi.', 'success');
        } else {
          const d = await res.json().catch(() => ({}));
          showToast(d.error || 'Silinemedi.', 'error');
        }
      }

      // ── Makale sil ──
      async function deleteArticle() {
        if (!confirm('Bu makaleyi kalıcı olarak silmek istediğine emin misin?')) return;
        const res = await fetch('/api/wiki/articles/' + articleId, { method: 'DELETE' });
        if (res.ok) location.href = '/wiki';
        else showToast('Silinemedi.', 'error');
      }

      // ── Makale düzenle ──
      async function saveEdit() {
        const res = await fetch('/api/wiki/articles/' + articleId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: document.getElementById('edit-title').value.trim(),
            body: document.getElementById('edit-body').value.trim(),
            imageUrl: document.getElementById('edit-image').value.trim() || null
          })
        });
        if (res.ok) { showToast('Kaydedildi!', 'success'); setTimeout(() => location.reload(), 600); }
        else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Hata', 'error'); }
      }
    </script>
  `;
  return _layout(article.title, user, content, '', '/wiki');
}

function renderAdminPage(user) {
  const content = `
    <!-- Sekme başlıkları -->
    <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border);flex-wrap:wrap;">
      <button class="adm-tab adm-tab-active" onclick="admTab('stats',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid var(--accent);color:var(--text);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        📊 İstatistikler
      </button>
      <button class="adm-tab" onclick="admTab('users',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        👥 Kullanıcılar
      </button>

      <button class="adm-tab" onclick="admTab('coins',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        💰 Para Ver
      </button>
      <button class="adm-tab" onclick="admTab('bans',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        🚫 Banlar
      </button>
      <button class="adm-tab" onclick="admTab('forms',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        📋 Panel Formları
      </button>
      <button class="adm-tab" onclick="admTab('automation',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        🤖 Otomasyon
      </button>
    </div>

    <!-- İstatistikler -->
    <div id="adm-stats" class="card">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">📊 İstatistikler</h1>
      <p class="text-muted mb-3">Sunucu ve kullanıcı aktiflik istatistikleri.</p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="card" style="background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); padding: 1.5rem;">
          <div style="font-size: 2rem; font-weight: 800; color: var(--success); margin-bottom: 10px;" id="stat-active">0</div>
          <div style="color: var(--muted); font-size: 0.9rem;">🟢 Aktif Kullanıcılar (24s)</div>
        </div>
        <div class="card" style="background: rgba(251, 113, 133, 0.1); border: 1px solid rgba(251, 113, 133, 0.3); padding: 1.5rem;">
          <div style="font-size: 2rem; font-weight: 800; color: var(--danger); margin-bottom: 10px;" id="stat-inactive">0</div>
          <div style="color: var(--muted); font-size: 0.9rem;">🔴 İnaktif Kullanıcılar (24s+)</div>
        </div>
        <div class="card" style="background: rgba(167, 139, 250, 0.1); border: 1px solid rgba(167, 139, 250, 0.3); padding: 1.5rem;">
          <div style="font-size: 2rem; font-weight: 800; color: var(--accent); margin-bottom: 10px;" id="stat-rules">0</div>
          <div style="color: var(--muted); font-size: 0.9rem;">📋 Kurallar Kabul</div>
        </div>
        <div class="card" style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); padding: 1.5rem;">
          <div style="font-size: 2rem; font-weight: 800; color: var(--warning); margin-bottom: 10px;" id="stat-activities">0</div>
          <div style="color: var(--muted); font-size: 0.9rem;">📊 Toplam Aktiviteler</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px;">
          <h3 style="margin-bottom: 15px; color: var(--success); font-size: 1.1rem; font-weight: 700;">🟢 Aktif Kullanıcılar (Son 24s)</h3>
          <div id="active-list" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px;">
          <h3 style="margin-bottom: 15px; color: var(--danger); font-size: 1.1rem; font-weight: 700;">🔴 İnaktif Kullanıcılar</h3>
          <div id="inactive-list" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
      </div>
    </div>

    <!-- Kullanıcı yönetimi -->
    <div id="adm-users" class="card" style="display:none;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">⚙️ Admin Paneli</h1>
      <p class="text-muted mb-3">Kullanıcı yetkileri ve ban yönetimi.</p>
      <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;">
        <input type="text" id="admin-search" placeholder="Discord adı veya ID" style="flex:1;" onkeydown="if(event.key==='Enter') adminSearchUsers()">
        <button type="button" class="btn" onclick="adminSearchUsers()">Ara</button>
      </div>
      <div id="admin-results"></div>
      <hr class="divider" style="margin-top:2rem;">
      <a href="/debug" style="color:var(--accent);">🔍 Debug sayfası</a>
    </div>



    <!-- Coin yönetimi -->
    <div id="adm-coins" class="card" style="display:none;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:.5rem;">💰 Coin Yönetimi</h1>
      <p class="text-muted mb-3">Kullanıcılara coin verin. Maksimum tek seferde 1.000.000 coin.</p>

      <div style="background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.12);border-radius:16px;padding:1.5rem;margin-bottom:2rem;backdrop-filter:blur(8px);">
        <h3 style="font-size:1rem;font-weight:800;color:#fbbf24;margin-bottom:1rem;">➕ Kullanıcıya Coin Ver</h3>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem;">
          <input type="text" id="coin-id" placeholder="Discord ID veya kullanıcı adı" style="flex:1;min-width:200px;margin-bottom:0;">
          <input type="number" id="coin-amount" placeholder="Miktar" min="1" max="1000000" style="width:160px;margin-bottom:0;">
        </div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;">
          <input type="text" id="coin-reason" placeholder="Sebep (isteğe bağlı)" style="flex:1;min-width:200px;margin-bottom:0;">
          <button class="btn" onclick="giveCoins()">💸 Ver</button>
        </div>
        <div id="coin-result" style="margin-top:1rem;"></div>
      </div>

      <!-- Hızlı miktarlar -->
      <div style="margin-bottom:1.5rem;">
        <div style="font-size:.85rem;color:var(--muted);font-weight:700;margin-bottom:.5rem;">Hızlı Miktarlar:</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${[100, 500, 1000, 5000, 10000, 50000].map(n =>
    `<button class="btn btn-ghost btn-sm" onclick="document.getElementById('coin-amount').value=${n}">${n.toLocaleString('tr-TR')} 🪙</button>`
  ).join('')}
        </div>
      </div>
    </div>

    <!-- Ban yönetimi -->
    <div id="adm-bans" class="card" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 style="font-size:2rem;font-weight:800;">🚫 Ban Yönetimi</h1>
          <p class="text-muted" style="margin-top:.25rem;">Kullanıcıları site ve/veya Discord'dan yasaklayın.</p>
        </div>
        <button class="btn btn-sm" onclick="loadBans()">🔄 Yenile</button>
      </div>

      <!-- Yeni ban formu -->
      <div style="background:rgba(251,113,133,.04);border:1px solid rgba(251,113,133,.12);border-radius:16px;padding:1.5rem;margin-bottom:2rem;backdrop-filter:blur(8px);">
        <h3 style="font-size:1rem;font-weight:800;color:var(--danger);margin-bottom:1rem;">➕ Kullanıcı Yasakla</h3>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem;">
          <input type="text" id="ban-id" placeholder="Discord ID veya kullanıcı adı" style="flex:1;min-width:200px;margin-bottom:0;">
          <input type="text" id="ban-reason" placeholder="Sebep (isteğe bağlı)" style="flex:2;min-width:200px;margin-bottom:0;">
        </div>
        <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;color:var(--text);font-size:.9rem;">
            <input type="checkbox" id="ban-discord" checked style="width:auto;margin:0;"> Discord'dan da yasakla
          </label>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;color:var(--text);font-size:.9rem;">
            <input type="checkbox" id="ban-site" checked style="width:auto;margin:0;"> Siteden yasakla
          </label>
        </div>
        <button class="btn btn-danger" onclick="banUser()">🚫 Yasakla</button>
      </div>

      <!-- Aktif banlar listesi -->
      <h3 style="font-size:1rem;font-weight:800;margin-bottom:1rem;">📋 Aktif Banlar</h3>
      <div id="ban-list"><div style="color:var(--muted);text-align:center;padding:2rem;">Yükleniyor...</div></div>
    </div>

    <!-- Otomasyon / Alımlar -->
    <div id="adm-automation" class="card" style="display:none;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">🤖 Otomasyon & Alımlar</h1>
      <p class="text-muted mb-3">Sınavlı (AI) veya sınavsız olarak avukat alımı gerçekleştirin.</p>

      <div style="background:rgba(124,106,247,0.04);border:1px solid rgba(124,106,247,0.12);border-radius:16px;padding:1.5rem;margin-bottom:2rem;backdrop-filter:blur(8px);">
        <h3 style="font-size:1.1rem;font-weight:800;color:var(--accent);margin-bottom:1rem;">⚖️ Avukat Alım Sistemi</h3>
        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:0.5rem;font-weight:700;">Discord Kullanıcı ID'si</label>
          <input type="text" id="avukat-discord-id" placeholder="Örn: 1444656401216442497" style="width:100%;margin-bottom:0;">
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <button class="btn" style="background:var(--accent);color:#fff;" onclick="startAvukatAI()">🧠 AI AVUKAT ALIMI BAŞLAT</button>
          <button class="btn btn-ghost" style="border-color:#2ecc71;color:#2ecc71;" onclick="startAvukatDirect()">⚖️ SINAVSIZ ALIM (Rol Ver)</button>
        </div>
        <div id="avukat-result" style="margin-top:1.5rem;font-weight:700;display:none;padding:1rem;border-radius:8px;"></div>
      </div>
    </div>

    <!-- Panel Formları -->
    <div id="adm-forms" class="card" style="display:none;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">📋 Panel Formları</h1>
      <p class="text-muted mb-3">Discord yetkili panelinde yer alan formları doğrudan web üzerinden doldurup gönderin.</p>
      
      <!-- Form seçme butonları -->
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid var(--border);">
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('leave', this)" style="border-color:#f1c40f;color:#f1c40f;">🏖️ İzin Formu</button>
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('suggestion', this)" style="border-color:#2ecc71;color:#2ecc71;">💡 Tavsiye Formu</button>
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('resign', this)" style="border-color:#e74c3c;color:#e74c3c;">🚪 İstifa Formu</button>
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('modaction', this)" style="border-color:#9b59b6;color:#9b59b6;">⚖️ Mod İşlem Formu</button>
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('ban_report', this)" style="border-color:#e74c3c;color:#e74c3c;">🔨 Ban Raporu</button>
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('mute_report', this)" style="border-color:#f39c12;color:#f39c12;">🔇 Mute Raporu</button>
        <button class="btn btn-ghost btn-sm" onclick="showSubForm('mod_complain', this)" style="border-color:#d946ef;color:#d946ef;">⚠️ Mod Şikayeti</button>
      </div>

      <!-- Form alanları (Dinamik) -->
      <div id="form-container" style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:16px;padding:1.5rem;display:none;">
        <h3 id="form-title" style="font-size:1.2rem;font-weight:800;margin-bottom:1.5rem;"></h3>
        
        <div id="form-fields"></div>
        
        <div style="display:flex;justify-content:flex-end;margin-top:1.5rem;">
          <button type="button" class="btn" id="form-submit-btn" onclick="submitAdminForm()">Gönder</button>
        </div>
      </div>
    </div>

    <script>
      // ── Sekme geçişi ──────────────────────────────────────────────────────
      function admTab(name, btn) {
        document.getElementById('adm-stats').style.display  = name === 'stats'  ? '' : 'none';
        document.getElementById('adm-users').style.display  = name === 'users'  ? '' : 'none';
        document.getElementById('adm-coins').style.display  = name === 'coins'  ? '' : 'none';
        document.getElementById('adm-bans').style.display   = name === 'bans'   ? '' : 'none';
        document.getElementById('adm-forms').style.display  = name === 'forms'  ? '' : 'none';
        document.getElementById('adm-automation').style.display = name === 'automation' ? '' : 'none';
        document.querySelectorAll('.adm-tab').forEach(t => {
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'var(--muted)';
        });
        btn.style.borderBottomColor = 'var(--accent)';
        btn.style.color = 'var(--text)';
        if (name === 'bans') loadBans();
        if (name === 'stats') loadStats();
      }

      async function startAvukatAI() {
        const discordId = document.getElementById('avukat-discord-id').value.trim();
        const resDiv = document.getElementById('avukat-result');
        if (!discordId) {
          alert('Lütfen geçerli bir Discord ID girin.');
          return;
        }
        resDiv.style.display = 'block';
        resDiv.style.background = 'rgba(255,255,255,0.05)';
        resDiv.style.color = 'var(--text)';
        resDiv.innerText = '⏳ AI Mülakatı başlatılıyor...';

        try {
          const res = await fetch('/api/avukat/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
          });
          const data = await res.json();
          if (data.success) {
            resDiv.style.background = 'rgba(46,204,113,0.1)';
            resDiv.style.color = '#2ecc71';
            resDiv.innerText = '✅ Başarılı: ' + data.message;
          } else {
            resDiv.style.background = 'rgba(231,76,60,0.1)';
            resDiv.style.color = '#e74c3c';
            resDiv.innerText = '❌ Hata: ' + (data.error || 'Bilinmeyen hata');
          }
        } catch (err) {
          resDiv.style.background = 'rgba(231,76,60,0.1)';
          resDiv.style.color = '#e74c3c';
          resDiv.innerText = '❌ İstek hatası: ' + err.message;
        }
      }

      async function startAvukatDirect() {
        const discordId = document.getElementById('avukat-discord-id').value.trim();
        const resDiv = document.getElementById('avukat-result');
        if (!discordId) {
          alert('Lütfen geçerli bir Discord ID girin.');
          return;
        }
        resDiv.style.display = 'block';
        resDiv.style.background = 'rgba(255,255,255,0.05)';
        resDiv.style.color = 'var(--text)';
        resDiv.innerText = '⏳ Avukat rolü tanımlanıyor...';

        try {
          const res = await fetch('/api/avukat/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
          });
          const data = await res.json();
          if (data.success) {
            resDiv.style.background = 'rgba(46,204,113,0.1)';
            resDiv.style.color = '#2ecc71';
            resDiv.innerText = '✅ Başarılı: ' + data.message;
          } else {
            resDiv.style.background = 'rgba(231,76,60,0.1)';
            resDiv.style.color = '#e74c3c';
            resDiv.innerText = '❌ Hata: ' + (data.error || 'Bilinmeyen hata');
          }
        } catch (err) {
          resDiv.style.background = 'rgba(231,76,60,0.1)';
          resDiv.style.color = '#e74c3c';
          resDiv.innerText = '❌ İstek hatası: ' + err.message;
        }
      }

      // ── Panel Formları Mantığı ───────────────────────────────────────────
      let currentFormType = '';
      
      const formDefinitions = {
        leave: {
          title: "🏖️ İzin Talebi Formu",
          fields: [
            { id: "leave_reason", apiKey: "reason", label: "İzin Sebebi", type: "textarea", placeholder: "İzin alma sebebinizi detaylıca açıklayın...", required: true },
            { id: "leave_duration", apiKey: "duration", label: "Kaç Gün İzin", type: "number", placeholder: "Örn: 5", required: true }
          ],
          submitText: "🏖️ Talebi Gönder (AI Değerlendirir)"
        },
        suggestion: {
          title: "💡 Tavsiye & Öneri Formu",
          fields: [
            { id: "suggestion_text", apiKey: "suggestion", label: "Öneriniz", type: "textarea", placeholder: "Sunucu veya ekip için önerinizi yazın...", required: true }
          ],
          submitText: "💡 Öneriyi İlet"
        },
        resign: {
          title: "🚪 İstifa Bildirim Formu",
          fields: [
            { id: "resign_reason", apiKey: "reason", label: "İstifa Sebebi", type: "textarea", placeholder: "Ayrılma gerekçenizi yazın...", required: true },
            { id: "resign_confirm", apiKey: "confirm", label: "Onaylıyorum (Devam etmek için 'Evet' yazın)", type: "text", placeholder: "Evet", required: true }
          ],
          submitText: "🚪 İstifayı Bildir"
        },
        modaction: {
          title: "⚖️ Moderatör İşlem Rapor Formu",
          fields: [
            { id: "mod_user", apiKey: "user", label: "İşlem Yapılan Kullanıcı (Kullanıcı Adı veya ID)", type: "text", placeholder: "Örn: Ahmet / 123456789...", required: true },
            { id: "mod_action", apiKey: "action", label: "Cezai İşlem Tipi (Ban, Mute, Kick vb.)", type: "text", placeholder: "Örn: Ban", required: true },
            { id: "mod_reason", apiKey: "reason", label: "Sebep ve Kanıt Linki", type: "textarea", placeholder: "Açıklama ve kanıt ekran görüntüsü linkleri...", required: true }
          ],
          submitText: "⚖️ İşlemi Raporla"
        },
        ban_report: {
          title: "🔨 Ban Rapor Formu",
          fields: [
            { id: "ban_isim", apiKey: "isim", label: "İsminiz (Kendi Adınız)", type: "text", placeholder: "Adınız", required: true },
            { id: "ban_kisi", apiKey: "kisi", label: "Banlanan/Banlanacak Kullanıcı", type: "text", placeholder: "Kullanıcı adı", required: true },
            { id: "ban_id", apiKey: "kisiId", label: "Banlanacak Kişinin ID'si", type: "text", placeholder: "18 haneli Discord ID'si", required: true },
            { id: "ban_sebep", apiKey: "sebep", label: "Sebep", type: "textarea", placeholder: "Yasaklanma nedeni...", required: true },
            { id: "ban_kanit", apiKey: "kanit", label: "Kanıt (Görsel/Video Linki)", type: "text", placeholder: "https://...", required: true }
          ],
          submitText: "🔨 Banı Rapor Et"
        },
        mute_report: {
          title: "🔇 Mute Rapor Formu",
          fields: [
            { id: "mute_isim", apiKey: "isim", label: "İsminiz (Kendi Adınız)", type: "text", placeholder: "Adınız", required: true },
            { id: "mute_rutbe", apiKey: "rutbe", label: "Rütbeniz", type: "text", placeholder: "Örn: Kıdemli Moderatör", required: true },
            { id: "mute_kisi", apiKey: "kisi", label: "Mute Atılan Kişi", type: "text", placeholder: "Kullanıcı adı", required: true },
            { id: "mute_ihlal", apiKey: "ihlal", label: "Kaçıncı İhlali?", type: "text", placeholder: "Örn: 2. ihlali", required: true }
          ],
          submitText: "🔇 Susturmayı Rapor Et"
        },
        mod_complain: {
          title: "⚠️ Mod Şikayet Formu",
          fields: [
            { id: "comp_mod", apiKey: "mod", label: "Şikayet Edilen Yetkili (Ad veya ID)", type: "text", placeholder: "Yetkili ismi veya ID'si", required: true },
            { id: "comp_sebep", apiKey: "sebep", label: "Şikayet Nedeni", type: "textarea", placeholder: "Durumu açıklayın...", required: true },
            { id: "comp_kanit", apiKey: "kanit", label: "Kanıt (Görsel veya Açıklama)", type: "textarea", placeholder: "Ekran görüntüsü linkleri, mesaj içerikleri vb...", required: true }
          ],
          submitText: "⚠️ Şikayeti Gizlice Gönder"
        }
      };

      function showSubForm(type, btn) {
        currentFormType = type;
        const form = formDefinitions[type];
        if (!form) return;

        // Butonların aktiflik durumunu sıfırla
        const buttons = btn.parentElement.querySelectorAll('button');
        buttons.forEach(b => {
          b.classList.add('btn-ghost');
          b.style.background = 'transparent';
          b.style.color = b.style.borderColor;
        });
        
        // Aktif buton stilini ver
        btn.classList.remove('btn-ghost');
        btn.style.background = btn.style.borderColor;
        btn.style.color = '#06060e';

        document.getElementById('form-container').style.display = 'block';
        document.getElementById('form-title').innerText = form.title;
        document.getElementById('form-submit-btn').innerText = form.submitText;
        
        // Dinamik alanları çiz
        const fieldsHtml = form.fields.map(f => {
          if (f.type === 'textarea') {
            return '<div style="margin-bottom: 1.2rem;">' +
                      '<label for="' + f.id + '" style="margin-bottom:0.4rem;display:block;color:var(--muted);">' + f.label + ':</label>' +
                      '<textarea id="' + f.id + '" placeholder="' + f.placeholder + '" rows="4" style="width:100%;margin-bottom:0;"></textarea>' +
                    '</div>';
          } else {
            return '<div style="margin-bottom: 1.2rem;">' +
                      '<label for="' + f.id + '" style="margin-bottom:0.4rem;display:block;color:var(--muted);">' + f.label + ':</label>' +
                      '<input type="' + f.type + '" id="' + f.id + '" placeholder="' + f.placeholder + '" style="width:100%;margin-bottom:0;">' +
                    '</div>';
          }
        }).join('');

        document.getElementById('form-fields').innerHTML = fieldsHtml;
      }

      async function submitAdminForm() {
        if (!currentFormType) return;
        const form = formDefinitions[currentFormType];
        const data = {};
        
        for (const f of form.fields) {
          const inputEl = document.getElementById(f.id);
          const val = inputEl ? inputEl.value.trim() : '';
          if (f.required && !val) {
            showToast(\`\${f.label} alanı doldurulmalıdır!\`, 'warning');
            return;
          }
          data[f.apiKey] = val;
        }

        if (currentFormType === 'resign') {
          if (data.confirm.toLowerCase() !== 'evet') {
            showToast("İşlemi onaylamak için kutuya tam olarak 'Evet' yazmalısınız.", 'warning');
            return;
          }
          const check = await confirmAction("İstifa etmek istediğinize emin misiniz? Bu işlem geri alınamaz ve sunucu rolleriniz temizlenecektir!");
          if (!check) return;
        }

        const submitBtn = document.getElementById('form-submit-btn');
        const oldText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Gönderiliyor...';

        try {
          const res = await fetch('/api/admin/submit-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formType: currentFormType, formData: data })
          });

          const d = await res.json().catch(() => ({}));
          
          if (res.ok) {
            showToast(d.message || 'Form başarıyla gönderildi.', 'success');
            
            // Eğer izin formuysa ve AI kararı varsa alert ile göster
            if (currentFormType === 'leave' && d.aiResponse) {
              const approvedText = d.approved ? '✅ ONAYLANDI' : '❌ REDDEDİLDİ';
              setTimeout(() => {
                alert(\`[Yapay Zeka IK Kararı] \${approvedText}\\n\\n\${d.aiResponse}\`);
              }, 400);
            }
            
            // Alanları temizle
            form.fields.forEach(f => {
              const inputEl = document.getElementById(f.id);
              if (inputEl) inputEl.value = '';
            });
          } else {
            showToast(d.error || 'Gönderim başarısız oldu.', 'error');
          }
        } catch (err) {
          showToast('Bağlantı hatası oluştu.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = oldText;
        }
      }

      // ── Kullanıcı arama ───────────────────────────────────────────────────
      function adminEsc(s) {
        const el = document.createElement('div');
        el.textContent = s == null ? '' : String(s);
        return el.innerHTML;
      }

      async function adminSearchUsers() {
        const q = document.getElementById('admin-search').value.trim();
        const box = document.getElementById('admin-results');
        box.innerHTML = '<p style="color:var(--muted);">Aranıyor...</p>';
        try {
          const res = await fetch('/api/admin/users?q=' + encodeURIComponent(q));
          const d = await res.json();
          if (!res.ok) { box.innerHTML = '<p style="color:var(--danger);">' + adminEsc(d.error || 'Hata') + '</p>'; return; }
          if (!d.users || !d.users.length) { box.innerHTML = '<p style="color:var(--muted);">Kullanıcı bulunamadı.</p>'; return; }
          box.innerHTML = d.users.map(function(u) {
            const banBtn = u.isBanned
              ? '<button type="button" class="btn btn-sm btn-success" onclick="quickUnban(\\\''+adminEsc(u.discordId)+'\\\')">✅ Banı Kaldır</button>'
              : '<button type="button" class="btn btn-sm btn-danger" onclick="quickBan(\\\''+adminEsc(u.discordId)+'\\\',\\\''+adminEsc(u.discordUsername)+'\\\')">🚫 Yasakla</button>';
            return '<div class="admin-user-row" data-discord-id="' + adminEsc(u.discordId) + '" style="background:rgba(0,0,0,0.3);border:1px solid '+(u.isBanned?'rgba(248,113,113,.4)':'var(--border)')+';border-radius:14px;padding:1.25rem;margin-bottom:1rem;">' +
              '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;flex-wrap:wrap;">' +
              (u.discordAvatar ? '<img src="'+adminEsc(u.discordAvatar)+'" style="width:36px;height:36px;border-radius:50%;">' : '') +
              '<div><div style="font-weight:800;">' + adminEsc(u.discordUsername) + (u.isBanned ? ' <span style="color:var(--danger);font-size:.75rem;">🚫 BANLANDI</span>' : '') + '</div>' +
              '<div style="font-size:0.8rem;color:var(--muted);">ID: ' + adminEsc(u.discordId) + '</div></div></div>' +
              '<div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;">' +
              '<label style="cursor:pointer;"><input type="checkbox" class="admin-cb-admin" ' + (u.isAdmin ? 'checked' : '') + '> Admin</label>' +
              '<label style="cursor:pointer;"><input type="checkbox" class="admin-cb-staff" ' + (u.isStaff ? 'checked' : '') + '> Staff</label>' +
              '<button type="button" class="btn btn-sm" onclick="adminSaveRoles(this)">💾 Kaydet</button>' +
              banBtn + '</div></div>';
          }).join('');
        } catch (err) {
          box.innerHTML = '<p style="color:var(--danger);">Bağlantı hatası.</p>';
        }
      }

      async function adminSaveRoles(btn) {
        const row = btn.closest('.admin-user-row');
        const id = row.getAttribute('data-discord-id');
        const isAdmin = row.querySelector('.admin-cb-admin').checked;
        const isStaff = row.querySelector('.admin-cb-staff').checked;
        const res = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/roles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isAdmin, isStaff })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) showToast('Kaydedildi: ' + (d.user?.discordUsername || id), 'success');
        else showToast(d.error || 'Kaydedilemedi', 'error');
      }

      function quickBan(id, name) {
        document.getElementById('ban-id').value = id;
        admTab('bans', document.querySelectorAll('.adm-tab')[2]);
      }

      async function quickUnban(id) {
        if (!confirm('Bu kullanıcının banını kaldırmak istiyor musun?')) return;
        const res = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/unban', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordUnban: false })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) { showToast(d.message || 'Ban kaldırıldı.', 'success'); adminSearchUsers(); }
        else showToast(d.error || 'Hata', 'error');
      }

      adminSearchUsers();

      // ── Ban işlemleri ─────────────────────────────────────────────────────
      async function banUser() {
        const idOrName = document.getElementById('ban-id').value.trim();
        const reason   = document.getElementById('ban-reason').value.trim();
        const discordBan = document.getElementById('ban-discord').checked;
        const siteBan = document.getElementById('ban-site').checked;

        if (!idOrName) { showToast('Discord ID veya kullanıcı adı girin.', 'warning'); return; }

        try {
          const sr = await fetch('/api/admin/users?q=' + encodeURIComponent(idOrName));
          const sd = await sr.json().catch(() => ({}));
          const found = (sd.users || []).find(u =>
            u.discordId === idOrName ||
            (u.discordUsername || '').toLowerCase() === idOrName.toLowerCase()
          );

          if (!found) {
            showToast('Kullanıcı bulunamadı.', 'error');
            return;
          }

          const res = await fetch('/api/admin/users/' + encodeURIComponent(found.discordId) + '/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, discordBan, siteBan })
          });
          const d = await res.json().catch(() => ({}));

          if (res.ok) {
            showToast(d.message || 'Kullanıcı yasaklandı.', 'success');
            document.getElementById('ban-id').value = '';
            document.getElementById('ban-reason').value = '';
            loadBans();
          } else {
            showToast(d.error || 'Yasaklanamadı', 'error');
          }
        } catch (err) {
          showToast('Bağlantı hatası.', 'error');
        }
      }

      async function loadBans() {
        const box = document.getElementById('ban-list');
        if (!box) return;
        box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:2rem;">Yükleniyor...</div>';
        try {
          const res = await fetch('/api/admin/bans');
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { box.innerHTML = '<div style="color:var(--danger);padding:1rem;">Hata: ' + adminEsc(d.error || 'Bilinmeyen hata') + '</div>'; return; }
          const bans = d.bans || [];
          if (!bans.length) { box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:2rem;">Aktif yasaklama bulunmuyor.</div>'; return; }
          box.innerHTML = bans.map(function(b) {
            return '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:1rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">' +
              '<div>' +
              '<div style="font-weight:700;">' + adminEsc(b.discordUsername) + ' <small style="color:var(--muted);font-weight:normal;">(ID: ' + adminEsc(b.discordId) + ')</small></div>' +
              '<div style="font-size:0.85rem;color:var(--muted);margin-top:0.25rem;">Sebep: ' + adminEsc(b.banReason || 'Belirtilmedi') + '</div>' +
              '</div>' +
              '<button class="btn btn-sm btn-success" onclick="quickUnban(\\\'' + adminEsc(b.discordId) + '\\\')">Banı Kaldır</button>' +
              '</div>';
          }).join('');
        } catch (err) {
          box.innerHTML = '<div style="color:var(--danger);padding:1rem;">Bağlantı hatası.</div>';
        }
      }

      // ── Coin verme ────────────────────────────────────────────────────────
      async function giveCoins() {
        const idOrName = document.getElementById('coin-id').value.trim();
        const amount   = parseInt(document.getElementById('coin-amount').value, 10);
        const reason   = document.getElementById('coin-reason').value.trim();
        const resultBox = document.getElementById('coin-result');

        if (!idOrName) { showToast('Discord ID veya kullanıcı adı girin.', 'warning'); return; }
        if (isNaN(amount) || amount <= 0) { showToast('Geçerli bir miktar girin.', 'warning'); return; }
        if (amount > 1000000) { showToast('Maksimum 1.000.000 coin verebilirsiniz.', 'warning'); return; }

        resultBox.innerHTML = '<span style="color:var(--muted);">Kullanıcı aranıyor...</span>';

        // Kullanıcıyı ara
        const sr = await fetch('/api/admin/users?q=' + encodeURIComponent(idOrName));
        const sd = await sr.json().catch(() => ({}));
        const found = (sd.users || []).find(u =>
          u.discordId === idOrName ||
          (u.discordUsername || '').toLowerCase() === idOrName.toLowerCase()
        );

        if (!found) {
          resultBox.innerHTML = '<span style="color:var(--danger);">❌ Kullanıcı bulunamadı.</span>';
          return;
        }

        resultBox.innerHTML = \`<span style="color:var(--muted);">\${adminEsc(found.discordUsername)} kullanıcısına \${amount.toLocaleString('tr-TR')} coin veriliyor...</span>\`;

        const res = await fetch('/api/admin/users/' + encodeURIComponent(found.discordId) + '/give-coins', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, reason })
        });
        const d = await res.json().catch(() => ({}));

        if (res.ok) {
          showToast(d.message || 'Coin verildi.', 'success');
          resultBox.innerHTML = \`<span style="color:var(--success);">✅ \${adminEsc(d.message)} • Yeni bakiye: \${(d.newBalance || 0).toLocaleString('tr-TR')} 🪙</span>\`;
          document.getElementById('coin-id').value = '';
          document.getElementById('coin-amount').value = '';
          document.getElementById('coin-reason').value = '';
        } else {
          resultBox.innerHTML = \`<span style="color:var(--danger);">❌ \${adminEsc(d.error || 'Hata')}</span>\`;
          showToast(d.error || 'Hata', 'error');
        }
      }

      async function loadStats() {
        try {
          const statsRes = await fetch('/api/admin/istatistikler');
          const statsData = await statsRes.json().catch(() => ({}));
          if (statsRes.ok && statsData.success) {
            document.getElementById('stat-active').textContent = statsData.stats.aktifKullanicilar || 0;
            document.getElementById('stat-inactive').textContent = statsData.stats.inaktifKullanicilar || 0;
            document.getElementById('stat-rules').textContent = statsData.stats.kurallarKabul || 0;
            document.getElementById('stat-activities').textContent = statsData.stats.toplamAktivite || 0;
          }

          const activeRes = await fetch('/api/admin/aktif-kullanicilar');
          const activeData = await activeRes.json().catch(() => ({}));
          if (activeRes.ok && activeData.success) {
            const html = activeData.users.slice(0, 50).map(id => 
              '<div style="padding:10px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><span>👤 ' + adminEsc(id) + '</span></div>'
            ).join('');
            document.getElementById('active-list').innerHTML = html || '<p style="color:var(--muted); text-align:center; padding:1rem;">Aktif kullanıcı yok</p>';
          }

          const inactiveRes = await fetch('/api/admin/inaktif-kullanicilar');
          const inactiveData = await inactiveRes.json().catch(() => ({}));
          if (inactiveRes.ok && inactiveData.success) {
            const html = inactiveData.users.slice(0, 50).map(id => 
              '<div style="padding:10px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><span>👤 ' + adminEsc(id) + '</span></div>'
            ).join('');
            document.getElementById('inactive-list').innerHTML = html || '<p style="color:var(--muted); text-align:center; padding:1rem;">İnaktif kullanıcı yok</p>';
          }

          const rulesRes = await fetch('/api/admin/kurallar-kabul');
          const rulesData = await rulesRes.json().catch(() => ({}));
          if (rulesRes.ok && rulesData.success) {
            document.getElementById('stat-rules').textContent = rulesData.count || 0;
          }
        } catch (error) {
          console.error('Admin istatistik veri yükleme hatası:', error);
        }
      }

      // İlk yükleme
      document.addEventListener('DOMContentLoaded', loadStats);
      // Her 30 saniyede bir otomatik yenile
      setInterval(() => {
        if (document.getElementById('adm-stats').style.display !== 'none') {
          loadStats();
        }
      }, 30000);

    <\/script>
  `;
  return _layout('Admin', user, content, '', '/admin');
}

function renderGroupAdminPage(user, isOwner = false) {
  const tmtGroups = {
    "35212138": "TMT Akademi",
    "33709461": "TMT Askeri İnzibat",
    "35430592": "TMT Birimler Bölükler",
    "5415548": "TMT Deniz Kuvvetleri Komutanlığı",
    "35212127": "TMT Genel Branş Komutanlığı",
    "33709391": "TMT Hava Kuvvetleri",
    "35432150": "TMT Hudut Müfettişleri",
    "12008462": "TMT Jandarma Genel Komutanlığı",
    "33714381": "TMT Kara Kuvvetleri Komutanlığı",
    "35528574": "TMT Ministry of Foreign Affairs",
    "33708598": "TMT Özel Kuvvetler Komutanlığı",
    "11517908": "TMT Turkish Armed Forces",
    "35528598": "TMT RAIDERS",
    "35528556": "TMT Sürücü Okulu"
  };

  const groupListHtml = Object.entries(tmtGroups).map(([id, name]) => {
    return `
      <button class="btn btn-ghost w-full group-select-btn" data-group-id="${id}" onclick="selectGroup('${id}', '${_esc(name)}')" style="justify-content:flex-start;text-align:left;margin-bottom:0.4rem;padding:0.6rem 1rem;">
        🏢 ${_esc(name)}
      </button>
    `;
  }).join('');

  const ownerSection = isOwner ? `
    <div id="owner-panel" style="margin-top:2rem;background:rgba(124,106,247,0.05);border:1px solid rgba(124,106,247,0.12);border-radius:18px;padding:1.5rem;">
      <h3 style="font-size:1.15rem;font-weight:800;color:var(--accent);margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
        👑 Kurucu Özel Alanı (ekonqtx)
      </h3>
      
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:2rem;">
        <!-- Yetkili Ekle -->
        <div style="flex:1;min-width:240px;">
          <label style="font-weight:700;">Grup Yetkilisi Ekle</label>
          <div style="display:flex;gap:0.5rem;">
            <input type="text" id="new-admin-username" placeholder="Discord kullanıcı adı" style="margin-bottom:0;">
            <button class="btn btn-success" onclick="addGroupAdmin()">Ekle</button>
          </div>
        </div>

        <!-- Tüm Grupları Düzenleme -->
        <div style="flex:1;min-width:240px;display:flex;flex-direction:column;justify-content:flex-end;">
          <label style="font-weight:700;">Toplu İşlemler</label>
          <button class="btn btn-danger w-full" onclick="reorderAllGroups5by5()">
            🔄 Tüm Grupları 5'erli Sırala (Teker Teker)
          </button>
        </div>
      </div>

      <!-- Yetkililer Listesi -->
      <h4 style="font-size:0.95rem;font-weight:800;margin-bottom:0.75rem;">📋 Yetkili Discord Kullanıcıları</h4>
      <div id="admins-list" style="display:flex;flex-direction:column;gap:0.5rem;">
        <p style="color:var(--muted);font-size:0.9rem;">Yükleniyor...</p>
      </div>

      <!-- Bulk Sıralama Log Paneli -->
      <div id="bulk-log-container" style="display:none;margin-top:1.5rem;">
        <h4 style="font-size:0.95rem;font-weight:800;margin-bottom:0.5rem;color:var(--danger);">🤖 İşlem Konsolu</h4>
        <div id="bulk-log" style="background:#000;font-family:monospace;font-size:0.8rem;color:#39ff14;padding:1rem;border-radius:12px;max-height:200px;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);line-height:1.4;">
        </div>
      </div>
    </div>
  ` : '';

  const content = `
    <div style="display:flex;gap:2rem;align-items:flex-start;flex-wrap:wrap;position:relative;">
      <!-- Sol Panel: Gruplar -->
      <div class="card" style="flex:1;min-width:280px;max-width:320px;padding:1.5rem;position:sticky;top:6rem;">
        <h3 style="font-size:1.15rem;font-weight:800;margin-bottom:1rem;color:var(--accent);">🏢 TMT Roblox Grupları</h3>
        <div style="max-height:60vh;overflow-y:auto;padding-right:0.25rem;">
          ${groupListHtml}
        </div>
      </div>

      <!-- Sağ Panel: Editör / Global Görünüm -->
      <div style="flex:3;min-width:320px;display:flex;flex-direction:column;gap:1.5rem;">
        <!-- Global Bilgi / Başlangıç Paneli -->
        <div id="global-panel" class="card">
          <h1 style="font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem;">
            ⚙️ Grup ve Rütbe Yönetimi
          </h1>
          <p class="text-muted" style="line-height:1.5;margin-bottom:1rem;">
            Sol taraftaki listeden işlem yapmak istediğiniz grubu seçin. Yetkili olduğunuz grupların rütbe isimlerini, renklerini değiştirebilir, sıralarını sürükleyip bırakarak düzenleyebilir ve grup açıklamasını güncelleyebilirsiniz.
          </p>
          <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:1rem;font-size:0.88rem;color:var(--muted);line-height:1.5;">
            <p><strong>💡 Bilgilendirme:</strong> Rütbe sıralamasını (Rank numaraları) değiştirmek için rütbe satırlarının başındaki sürükleme simgesinden tutup aşağı/yukarı taşıyabilirsiniz. Kaydet butonuna basılana kadar Roblox üzerinde rütbeler güncellenmez.</p>
          </div>
          ${ownerSection}
        </div>

        <!-- Grup Rütbe Editörü -->
        <div id="editor-panel" class="card" style="display:none;">
          <!-- Grup Detayları Başlığı -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
            <div>
              <h2 id="active-group-title" style="font-size:1.6rem;font-weight:800;color:#fff;"></h2>
              <p id="active-group-id" class="text-muted" style="font-size:0.85rem;margin-top:0.2rem;font-family:monospace;"></p>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <button class="btn btn-success" onclick="addNewRoleRow()">
                ➕ Yeni Rol Ekle
              </button>
              <button class="btn btn-ghost" onclick="reorderCurrentGroup5by5()">
                ⚡ 5'erli Sırala
              </button>
              <button class="btn" style="background:var(--accent);color:#fff;" onclick="saveGroupRoles()">
                💾 Değişiklikleri Kaydet
              </button>
            </div>
          </div>

          <!-- Grup Açıklaması -->
          <div style="margin-bottom:1.5rem;background:rgba(255,255,255,0.015);border:1px solid var(--border);border-radius:14px;padding:1.25rem;">
            <h3 style="font-size:1rem;font-weight:800;margin-bottom:0.75rem;color:var(--accent2);">✍️ Grup Açıklaması</h3>
            <textarea id="group-description" rows="3" placeholder="Grup açıklaması..." style="margin-bottom:0.75rem;resize:vertical;"></textarea>
            <div style="display:flex;justify-content:flex-end;">
              <button id="btn-save-desc" class="btn btn-sm btn-ghost" onclick="saveGroupDescription()">Açıklamayı Güncelle</button>
            </div>
          </div>

          <!-- Rütbeler Listesi -->
          <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:1rem;color:var(--accent2);">🛡️ Rütbe Yapılandırması</h3>
          <div id="roles-headers" style="display:grid;grid-template-columns:50px 80px 1fr 80px auto;gap:1rem;padding:0.5rem 1rem;font-size:0.8rem;color:var(--muted);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border);margin-bottom:0.5rem;">
            <div>Sıra</div>
            <div>Rank</div>
            <div>Rütbe Adı</div>
            <div style="text-align:center;">Renk</div>
            <div style="text-align:center;">İzinler</div>
          </div>
          <div id="roles-list" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- Rütbe Satırları -->
          </div>
        </div>
      </div>
    </div>

    <!-- Sürükle Bırak CSS Stilleri -->
    <style>
      .role-row {
        display: grid;
        grid-template-columns: 50px 80px 1fr 80px auto;
        gap: 1rem;
        align-items: center;
        background: rgba(255,255,255,0.02);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        transition: transform 0.2s, background-color 0.2s, border-color 0.2s;
      }
      .role-row.draggable {
        cursor: grab;
      }
      .role-row.draggable:active {
        cursor: grabbing;
      }
      .role-row.over {
        border-color: var(--accent);
        background: rgba(167, 139, 250, 0.08);
      }
      .drag-handle {
        color: var(--muted);
        font-size: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
      }
      .role-rank-badge {
        font-family: monospace;
        font-weight: 700;
        color: var(--accent2);
        background: rgba(129, 140, 248, 0.08);
        border: 1px solid rgba(129, 140, 248, 0.2);
        border-radius: 6px;
        padding: 0.25rem 0.5rem;
        text-align: center;
      }
      .color-picker-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .color-picker-wrapper input[type="color"] {
        border: 1px solid var(--border);
        border-radius: 6px;
        width: 38px;
        height: 38px;
        padding: 0.15rem;
        background: transparent;
        cursor: pointer;
        margin-bottom: 0;
      }
      .system-role {
        opacity: 0.65;
        background: rgba(255,255,255,0.01);
      }
    </style>

    <script>
      let currentGroupId = '';
      let rolesData = [];
      let dragSrcEl = null;

      function cleanQuote(s) {
        return (s == null ? "" : String(s)).replace(/"/g, '&quot;');
      }

      // ── Yetkilileri Yükle (Owner-only) ──
      const isOwner = ${isOwner};
      async function loadAdmins() {
        if (!isOwner) return;
        try {
          const res = await fetch('/api/group-admin/config');
          const d = await res.json();
          if (res.ok && d.admins) {
            const list = document.getElementById('admins-list');
            if (d.admins.length === 0) {
              list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">Kayıtlı grup yetkilisi bulunmuyor.</p>';
              return;
            }
            list.innerHTML = d.admins.map(a => {
              return \`
                <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);padding:0.75rem 1rem;border-radius:12px;border:1px solid var(--border);">
                  <div style="font-weight:600;color:var(--text);">\${a.username}</div>
                  <button class="btn btn-sm btn-danger" onclick="removeGroupAdmin('\${a.username}')">Kaldır</button>
                </div>
              \`;
            }).join('');
          }
        } catch (err) {
          console.error("Yetkililer yüklenemedi:", err);
        }
      }

      async function addGroupAdmin() {
        const usernameEl = document.getElementById('new-admin-username');
        const username = usernameEl.value.trim();
        if (!username) { showToast('Bir kullanıcı adı girin.', 'warning'); return; }
        
        try {
          const res = await fetch('/api/group-admin/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });
          const d = await res.json();
          if (res.ok) {
            showToast('Yetkili başarıyla eklendi.', 'success');
            usernameEl.value = '';
            loadAdmins();
          } else {
            showToast(d.error || 'Hata oluştu.', 'error');
          }
        } catch {
          showToast('Bağlantı hatası.', 'error');
        }
      }

      async function removeGroupAdmin(username) {
        if (!confirm(username + ' yetkisini kaldırmak istediğinize emin misiniz?')) return;
        try {
          const res = await fetch('/api/group-admin/admins/' + encodeURIComponent(username), {
            method: 'DELETE'
          });
          const d = await res.json();
          if (res.ok) {
            showToast('Yetkili kaldırıldı.', 'success');
            loadAdmins();
          } else {
            showToast(d.error || 'Hata oluştu.', 'error');
          }
        } catch {
          showToast('Bağlantı hatası.', 'error');
        }
      }

      if (isOwner) {
        loadAdmins();
      }
    </script>

    <!-- İzinler Modalı -->
    <div id="permissions-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;align-items:center;justify-content:center;padding:1rem;">
      <div class="card" style="width:100%;max-width:500px;max-height:90vh;overflow-y:auto;">
        <h2 style="font-size:1.4rem;font-weight:800;margin-bottom:0.5rem;color:var(--accent);">⚙️ Rol İzinleri</h2>
        <p id="perm-role-name" style="color:var(--muted);margin-bottom:1.5rem;"></p>
        
        <div id="perm-loading" style="display:none;text-align:center;padding:2rem;">
          <p style="color:var(--muted);">İzinler yükleniyor...</p>
        </div>
        
        <div id="perm-content" style="display:flex;flex-direction:column;gap:1rem;">
          <!-- İzinler buraya JS ile yüklenecek -->
        </div>

        <div style="display:flex;justify-content:flex-end;gap:1rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);">
          <button class="btn btn-ghost" onclick="closePermissionsModal()">İptal</button>
          <button class="btn btn-success" id="btn-save-perms" onclick="savePermissions()">💾 Kaydet</button>
        </div>
      </div>
    </div>

    <script>
      // ── Grup Seçimi ve Veri Çekme ──
      async function selectGroup(groupId, groupName) {
        currentGroupId = groupId;
        
        // Aktif buton rengi
        document.querySelectorAll('.group-select-btn').forEach(btn => {
          btn.classList.add('btn-ghost');
          btn.style.background = 'transparent';
          btn.style.borderColor = 'rgba(255,255,255,0.08)';
        });
        const activeBtn = document.querySelector(\`[data-group-id="\${groupId}"]\`);
        if (activeBtn) {
          activeBtn.classList.remove('btn-ghost');
          activeBtn.style.background = 'rgba(167,139,250,0.15)';
          activeBtn.style.borderColor = 'var(--accent)';
        }

        // Arayüz geçişi
        document.getElementById('global-panel').style.display = 'none';
        const editor = document.getElementById('editor-panel');
        editor.style.display = 'block';
        
        document.getElementById('active-group-title').innerText = groupName;
        document.getElementById('active-group-id').innerText = 'ID: ' + groupId;

        const rolesList = document.getElementById('roles-list');
        rolesList.innerHTML = '<div style="color:var(--muted);text-align:center;padding:3rem;">Rütbeler yükleniyor...</div>';
        document.getElementById('group-description').value = '';

        try {
          const res = await fetch(\`/api/group-admin/groups/\${groupId}/roles\`);
          const d = await res.json();
          if (res.ok && d.roles) {
            rolesData = d.roles;
            document.getElementById('group-description').value = d.description || '';
            renderRolesList();
          } else {
            rolesList.innerHTML = \`<div style="color:var(--danger);text-align:center;padding:3rem;">❌ Hata: \${d.error || 'Rütbeler yüklenemedi.'}</div>\`;
          }
        } catch (err) {
          rolesList.innerHTML = '<div style="color:var(--danger);text-align:center;padding:3rem;">❌ Bağlantı hatası.</div>';
        }
      }

      // Rütbeleri Arayüze Çiz
      function renderRolesList() {
        const list = document.getElementById('roles-list');
        if (rolesData.length === 0) {
          list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:2rem;">Grupta rütbe bulunamadı.</div>';
          return;
        }

        rolesData = [...rolesData].sort((a, b) => b.rank - a.rank);
        const sortedRoles = rolesData;

        list.innerHTML = sortedRoles.map((role, index) => {
          const isSystem = role.rank === 0 || role.rank === 255;
          const dragAttr = isSystem ? '' : 'draggable="true"';
          const dragClass = isSystem ? 'system-role' : 'draggable';
          const handle = isSystem ? '🔒' : '☰';

          return \`
            <div class="role-row \${dragClass}" data-role-id="\${role.id}" \${dragAttr}>
              <div class="drag-handle">\${handle}</div>
              <div class="role-rank-badge">\${role.rank}</div>
              <div>
                <input type="text" id="name-\${role.id}" class="role-name-input" value="\${cleanQuote(role.name)}" \${isSystem ? 'disabled style="background:transparent;border:none;margin-bottom:0;"' : 'style="margin-bottom:0;padding:0.5rem 0.75rem;"'} onchange="updateRoleName('\${role.id}', this.value)">
              </div>
              <div class="color-picker-wrapper">
                <input type="color" value="\${role.color || '#7c6af7'}" onchange="updateRoleColor('\${role.id}', this.value)">
              </div>
              <div style="display:flex;align-items:center;justify-content:center;">
                \${String(currentGroupId) !== "11517908" ? \`<button class="btn btn-sm btn-ghost" style="padding:0.35rem 0.6rem;font-size:0.8rem;" onclick="openPermissionsModal('\${role.id}', '\${cleanQuote(role.name)}')">İzinler</button>\` : \`<span style="color:var(--muted);font-size:0.75rem;">Kapalı</span>\`}
              </div>
            </div>
          \`;
        }).join('');

        addDragAndDropEvents();
      }

      function updateRoleName(id, val) {
        const role = rolesData.find(r => r.id === id);
        if (role) {
          role.name = val.trim();
        }
      }

      function updateRoleColor(id, val) {
        const role = rolesData.find(r => r.id === id);
        if (role) {
          role.color = val;
        }
      }

      function addNewRoleRow() {
        if (!currentGroupId) return;
        const newId = 'new_' + Date.now();
        rolesData.push({
          id: newId,
          name: 'Yeni Rütbe',
          rank: 1,
          color: '#ffffff'
        });
        recalculateRankNumbers();
        renderRolesList();
        showToast('Yeni rol eklendi. Sırasını sürükleyerek ayarlayın ve kaydedin.', 'info');
      }

      function addDragAndDropEvents() {
        const rows = document.querySelectorAll('.role-row.draggable');
        rows.forEach(row => {
          row.addEventListener('dragstart', handleDragStart, false);
          row.addEventListener('dragenter', handleDragEnter, false);
          row.addEventListener('dragover', handleDragOver, false);
          row.addEventListener('dragleave', handleDragLeave, false);
          row.addEventListener('drop', handleDrop, false);
          row.addEventListener('dragend', handleDragEnd, false);
        });
      }

      function handleDragStart(e) {
        this.style.opacity = '0.4';
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.getAttribute('data-role-id'));
      }

      function handleDragOver(e) {
        if (e.preventDefault) {
          e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
      }

      function handleDragEnter() {
        this.classList.add('over');
      }

      function handleDragLeave() {
        this.classList.remove('over');
      }

      function handleDrop(e) {
        if (e.stopPropagation) {
          e.stopPropagation();
        }
        
        const srcId = e.dataTransfer.getData('text/plain');
        const destId = this.getAttribute('data-role-id');
        
        if (srcId !== destId) {
          const srcIndex = rolesData.findIndex(r => r.id === srcId);
          const destIndex = rolesData.findIndex(r => r.id === destId);
          
          if (srcIndex > -1 && destIndex > -1) {
            // Sadece taşınabilir rütbeleri değiştir
            const srcRole = rolesData[srcIndex];
            const destRole = rolesData[destIndex];
            
            if (srcRole.rank !== 0 && srcRole.rank !== 255 && destRole.rank !== 0 && destRole.rank !== 255) {
              const [removed] = rolesData.splice(srcIndex, 1);
              rolesData.splice(destIndex, 0, removed);
              
              // Sürükle bırak bittikten sonra rankleri 5'erli sıralayalım (veya koruyup güncelleyelim)
              // Rütbeleri rank sırasına göre (büyükten küçüğe) tutup aradakileri 5erli sıralayabiliriz:
              recalculateRankNumbers();
              renderRolesList();
            }
          }
        }
        return false;
      }

      function handleDragEnd() {
        this.style.opacity = '1';
        document.querySelectorAll('.role-row').forEach(row => {
          row.classList.remove('over');
        });
      }

      // Drag and drop sonrasında rank numaralarını bozmadan 5erli aralıklara oturtalım
      function recalculateRankNumbers() {
        // rolesData şu an yeni sıralamasıyla (büyükten küçüğe) duruyor.
        // En sondaki Owner veya Guest olabilir.
        // Biz sadece rank > 0 && rank < 255 olanları sıralayacağız.
        // Aşağıdan yukarıya (küçük rankten büyüğe) 5, 10, 15 şeklinde vermeliyiz.
        // Bunun için diziyi ters çevirip işleyebiliriz.
        let currentRank = 5;
        // rolesData büyükten küçüğe sıralı. Sondan başa doğru gidersek küçükten büyüğe gitmiş oluruz.
        for (let i = rolesData.length - 1; i >= 0; i--) {
          const r = rolesData[i];
          if (r.rank > 0 && r.rank < 255) {
            r.rank = currentRank;
            currentRank += 5;
          }
        }
      }

      // ── API İşlemleri (Description, Save Roles, Reorder 5) ──

      async function saveGroupDescription() {
        if (!currentGroupId) return;
        const description = document.getElementById('group-description').value;
        const btn = document.getElementById('btn-save-desc');
        
        btn.disabled = true;
        btn.innerText = 'Güncelleniyor...';

        try {
          const res = await fetch(\`/api/group-admin/groups/\${currentGroupId}/description\`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
          });
          const d = await res.json();
          if (res.ok) {
            showToast('Grup açıklaması başarıyla güncellendi.', 'success');
          } else {
            showToast(d.error || 'Açıklama güncellenemedi.', 'error');
          }
        } catch {
          showToast('Bağlantı hatası.', 'error');
        } finally {
          btn.disabled = false;
          btn.innerText = 'Açıklamayı Güncelle';
        }
      }

      async function saveGroupRoles() {
        if (!currentGroupId) return;
        if (!confirm('Rütbe düzenlemelerini kaydetmek istediğinize emin misiniz? Bu işlem Roblox API üzerinden rütbeleri güncelleyecektir.')) return;

        // Buton kilitle
        const btns = document.querySelectorAll('.btn');
        btns.forEach(b => b.disabled = true);

        showToast('Değişiklikler kaydediliyor, lütfen bekleyin...', 'info');

        try {
          const res = await fetch(\`/api/group-admin/groups/\${currentGroupId}/roles\`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles: rolesData })
          });
          const d = await res.json();
          if (res.ok) {
            showToast('Rütbeler başarıyla kaydedildi! Roblox sunucularına yansıması 1-2 dakika sürebilir.', 'success');
            // Cache sorununu önlemek için hemen tekrar fetch atmıyoruz, mevcut görünüme dokunmuyoruz.
          } else {
            showToast(d.error || 'Kaydetme hatası.', 'error');
          }
        } catch (err) {
          showToast('Bağlantı hatası oluştu.', 'error');
        } finally {
          btns.forEach(b => b.disabled = false);
        }
      }

      async function reorderCurrentGroup5by5() {
        if (!currentGroupId) return;
        if (!confirm('Grubun sıralarını bozmadan en aşağıdan başlayarak 5, 10, 15... şeklinde yeniden sıralamak istediğinize emin misiniz?')) return;

        showToast('Sıralama işlemi başlatıldı...', 'info');

        try {
          const res = await fetch(\`/api/group-admin/groups/\${currentGroupId}/reorder-5\`, { method: 'POST' });
          const d = await res.json();
          if (res.ok) {
            showToast("Grup rütbeleri başarıyla 5erli sıralandı. Roblox'un yansıtması 1-2 dakika sürebilir, ardından sayfayı yenileyebilirsiniz.", 'success');
          } else {
            showToast(d.error || 'Sıralama hatası.', 'error');
          }
        } catch {
          showToast('Bağlantı hatası.', 'error');
        }
      }

      // --- PERMISSIONS MANAGEMENT ---
      let currentEditingRoleId = null;
      let currentPermissionsData = null;

      function closePermissionsModal() {
        document.getElementById('permissions-modal').style.display = 'none';
        currentEditingRoleId = null;
        currentPermissionsData = null;
      }

      async function openPermissionsModal(roleId, roleName) {
        if (String(currentGroupId) === "11517908") {
          showToast("Bu grupta izin yönetimi devre dışıdır.", "warning");
          return;
        }

        currentEditingRoleId = roleId;
        document.getElementById('perm-role-name').innerText = roleName + " (ID: " + roleId + ")";
        document.getElementById('permissions-modal').style.display = 'flex';
        document.getElementById('perm-loading').style.display = 'block';
        document.getElementById('perm-content').innerHTML = '';
        document.getElementById('btn-save-perms').disabled = true;

        try {
          const res = await fetch(\`/api/group-admin/groups/\${currentGroupId}/roles/\${roleId}/permissions\`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'İzinler alınamadı');

          currentPermissionsData = data;
          renderPermissionsForm(data.permissions);
        } catch (err) {
          document.getElementById('perm-content').innerHTML = \`<p style="color:var(--danger);">❌ \${err.message}</p>\`;
        } finally {
          document.getElementById('perm-loading').style.display = 'none';
          if (currentPermissionsData) document.getElementById('btn-save-perms').disabled = false;
        }
      }

      function renderPermissionsForm(perms) {
        if (!perms) {
          document.getElementById('perm-content').innerHTML = '<p>İzin bilgisi bulunamadı.</p>';
          return;
        }

        let html = '';
        for (const [categoryName, categoryObj] of Object.entries(perms)) {
          // Format category name: groupPostsPermissions -> Group Posts Permissions
          const formattedTitle = categoryName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          html += \`
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:1rem;">
              <h4 style="font-weight:700;margin-bottom:0.5rem;color:var(--accent2);font-size:0.9rem;">\${formattedTitle}</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          \`;

          for (const [permName, permValue] of Object.entries(categoryObj)) {
            const labelName = permName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            html += \`
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer;">
                <input type="checkbox" id="perm_\${categoryName}_\${permName}" \${permValue ? 'checked' : ''}>
                <span>\${labelName}</span>
              </label>
            \`;
          }
          html += \`</div></div>\`;
        }

        document.getElementById('perm-content').innerHTML = html;
      }

      async function savePermissions() {
        if (!currentEditingRoleId || !currentPermissionsData || String(currentGroupId) === "11517908") return;

        const btn = document.getElementById('btn-save-perms');
        btn.disabled = true;
        btn.textContent = '⏳ Kaydediliyor...';

        // Gather checkbox values and update currentPermissionsData
        for (const [categoryName, categoryObj] of Object.entries(currentPermissionsData.permissions)) {
          for (const permName of Object.keys(categoryObj)) {
            const cb = document.getElementById(\`perm_\${categoryName}_\${permName}\`);
            if (cb) {
              currentPermissionsData.permissions[categoryName][permName] = cb.checked;
            }
          }
        }

        try {
          const res = await fetch(\`/api/group-admin/groups/\${currentGroupId}/roles/\${currentEditingRoleId}/permissions\`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentPermissionsData)
          });
          const data = await res.json();

          if (res.ok) {
            showToast('İzinler başarıyla güncellendi.', 'success');
            closePermissionsModal();
          } else {
            showToast(data.error || 'İzinler güncellenemedi.', 'error');
          }
        } catch (err) {
          showToast('Bağlantı hatası.', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '💾 Kaydet';
        }
      }

      // ── Kurucu Toplu Sıralama Fonksiyonu (Owner-only) ──
      async function reorderAllGroups5by5() {
        if (!isOwner) return;
        if (!confirm('TMT grubunun sahip olduğu tüm grupları sıralarını bozmadan 5erli olarak sıralamak istiyor musunuz? Bu işlem her grup için sırayla çalışacaktır ve bir miktar zaman alacaktır.')) return;

        const logContainer = document.getElementById('bulk-log-container');
        const logBox = document.getElementById('bulk-log');
        logContainer.style.display = 'block';
        logBox.innerHTML = '🤖 Toplu 5erli sıralama başlatıldı...\\n';
        
        // Butonları kilitle
        const btns = document.querySelectorAll('.btn');
        btns.forEach(b => b.disabled = true);

        try {
          // 1. Grupları listele
          logBox.innerHTML += '👉 Gruplar listeleniyor...\\n';
          const groupsRes = await fetch('/api/group-admin/groups');
          const groupsData = await groupsRes.json();
          
          if (!groupsRes.ok || !groupsData.groups) {
            logBox.innerHTML += '❌ Gruplar listelenemedi: ' + (groupsData.error || 'Bilinmeyen hata') + '\\n';
            return;
          }

          const groups = groupsData.groups;
          logBox.innerHTML += \`✅ Toplam \${groups.length} grup bulundu.\\n\\n\`;

          // 2. Sırayla her grup için API'yi tetikle
          for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            logBox.innerHTML += \`⏳ [\${i+1}/\${groups.length}] \${g.name} sıralanıyor...\\n\`;
            logBox.scrollTop = logBox.scrollHeight;

            try {
              const res = await fetch(\`/api/group-admin/groups/\${g.id}/reorder-5\`, { method: 'POST' });
              const d = await res.json();
              if (res.ok) {
                logBox.innerHTML += \`✅ \${g.name} başarıyla sıralandı!\\n\`;
              } else {
                logBox.innerHTML += \`⚠️ \${g.name} hata aldı: \${d.error || 'Bilinmeyen hata'}\\n\`;
              }
            } catch (err) {
              logBox.innerHTML += \`❌ \${g.name} bağlantı hatası: \${err.message}\\n\`;
            }
            logBox.scrollTop = logBox.scrollHeight;
            
            // Gruplar arası 1 saniye bekleme
            if (i < groups.length - 1) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }

          logBox.innerHTML += '\\n🏁 Tüm grupların sıralama işlemi tamamlandı!';
          logBox.scrollTop = logBox.scrollHeight;
          showToast('Toplu sıralama tamamlandı.', 'success');
        } catch (err) {
          logBox.innerHTML += '\\n❌ Toplu işlem başarısız oldu: ' + err.message;
          logBox.scrollTop = logBox.scrollHeight;
        } finally {
          btns.forEach(b => b.disabled = false);
        }
      }
    </script>
  `;

  return _layout('Grup Yönetimi', user, content, '', '/group-admin');
}

function renderLeaderboardPage(user, topUsers = []) {
  const medals = ['🥇', '🥈', '🥉'];
  const rankColors = ['#fbbf24', '#9ca3af', '#b45309'];

  const content = `
    <div class="card">
      <h1 style="font-size:2.2rem;font-weight:800;text-align:center;margin-bottom:0.5rem;
                 background:linear-gradient(135deg,#f59e0b,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
        🏆 Liderlik Tablosu
      </h1>
      <p style="text-align:center;color:var(--muted);margin-bottom:2.5rem;">Sunucunun en zengin kullanıcıları</p>

      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        ${topUsers.map((u, i) => {
    const borderColor = rankColors[i] || 'var(--border)';
    return `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      background:rgba(255,255,255,0.025);padding:1rem 1.5rem;border-radius:16px;
                      border:1px solid ${borderColor};transition:transform 0.3s,background 0.3s;backdrop-filter:blur(8px);"
               onmouseover="this.style.transform='translateX(4px)';this.style.background='rgba(255,255,255,0.04)'"
               onmouseout="this.style.transform='none';this.style.background='rgba(255,255,255,0.025)'">
            <div style="display:flex;align-items:center;gap:1.25rem;">
              <div style="font-size:1.5rem;width:32px;text-align:center;font-weight:800;color:${borderColor};">
                ${medals[i] || (i + 1)}
              </div>
              <img src="${_esc(u.avatar)}" alt="" style="width:46px;height:46px;border-radius:50%;border:2px solid ${borderColor};">
              <span style="font-weight:700;font-size:1.1rem;">${_esc(u.username)}</span>
            </div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--success);">
              💵 ${Number(u.balance).toLocaleString('tr-TR')}
            </div>
          </div>`;
  }).join('') || '<div style="text-align:center;padding:3rem;color:var(--muted);">Henüz veri yok.</div>'}
      </div>
    </div>
  `;
  return _layout('Liderlik Tablosu', user, content);
}


// ─────────────────────────────────────────────
// SHOP PAGE
// ─────────────────────────────────────────────
function renderShopPage(user, items = []) {
  const content = `
    <div class="card">
      <h1 style="font-size:2.2rem;font-weight:800;text-align:center;margin-bottom:0.5rem;color:var(--accent);">🛒 Mağaza</h1>
      <p style="text-align:center;color:var(--muted);margin-bottom:3rem;">Ekonomi bakiyenizle satın alabileceğiniz özellikler</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;">
        ${items.map(item => `
          <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:20px;
                      padding:2rem;text-align:center;transition:transform 0.3s,border-color 0.3s,box-shadow 0.3s;cursor:pointer;display:flex;flex-direction:column;align-items:center;backdrop-filter:blur(12px);"
               onmouseover="this.style.transform='translateY(-6px)';this.style.borderColor='rgba(167,139,250,0.2)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.3)'"
               onmouseout="this.style.transform='none';this.style.borderColor='rgba(255,255,255,0.06)';this.style.boxShadow='none'">
            <div style="font-size:3.5rem;margin-bottom:1rem;">${_esc(item.icon || '📦')}</div>
            <h3 style="font-size:1.3rem;margin-bottom:0.5rem;">${_esc(item.name)}</h3>
            <p style="color:var(--muted);margin-bottom:1.5rem;font-size:0.9rem;line-height:1.5;flex:1;">${_esc(item.desc || '')}</p>
            <div style="font-size:1.5rem;font-weight:800;color:var(--success);margin-bottom:1.5rem;">
              💵 ${Number(item.price).toLocaleString('tr-TR')}
            </div>
            <button class="btn w-full" onclick="buyItem('${_esc(item.id || item.name)}','${_esc(item.name)}')">Satın Al</button>
          </div>
        `).join('') || '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">Mağazada henüz ürün yok.</div>'}
      </div>
    </div>

    <script>
      async function buyItem(id, name) {
        if (!confirm(name + ' satın almak istiyor musun?')) return;
        try {
          const res = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: id })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok) showToast(d.message || 'Satın alındı!', 'success');
          else showToast(d.error || 'İşlem başarısız.', 'error');
        } catch {
          showToast('Bağlantı hatası.', 'error');
        }
      }
    </script>
  `;
  return _layout('Mağaza', user, content);
}


// ─────────────────────────────────────────────
// 404 / ERROR PAGE
// ─────────────────────────────────────────────
function renderErrorPage(code = 404, message = 'Sayfa bulunamadı.') {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${code} — Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root { --accent:#a78bfa; --accent2:#818cf8; --bg:#06060e; --muted:#7c7c9a; }
    body {
      background:var(--bg);
      background-image:radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99,102,241,0.06) 0%, transparent 60%);
      color:#f0f0f8; font-family:'Outfit',sans-serif;
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      text-align:center; padding:2rem;
    }
    .code {
      font-size:7rem; font-weight:800; line-height:1;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      margin-bottom:1rem;
    }
    h1 { font-size:1.4rem; margin-bottom:1rem; font-weight:600; }
    p  { color:var(--muted); margin-bottom:2rem; font-weight:300; }
    a  {
      display:inline-block; padding:0.8rem 2rem;
      background:rgba(167,139,250,0.18);
      border:1px solid rgba(167,139,250,0.25);
      color:var(--accent); border-radius:30px; text-decoration:none; font-weight:600;
      transition:all 0.3s ease;
      box-shadow:0 2px 16px rgba(167,139,250,0.1);
      backdrop-filter:blur(8px);
    }
    a:hover {
      transform:translateY(-2px);
      background:rgba(167,139,250,0.28);
      border-color:rgba(167,139,250,0.4);
      color:#fff;
      box-shadow:0 8px 28px rgba(167,139,250,0.2);
    }
    ::selection { background:rgba(167,139,250,0.3); color:#fff; }
  </style>
</head>
<body>
  <div>
    <div class="code">${code}</div>
    <h1>Bir şeyler ters gitti.</h1>
    <p>${_esc(message)}</p>
    <a href="/">Ana Sayfaya Dön</a>
  </div>
</body>
</html>`;
}


// ─────────────────────────────────────────────
// CREATE TICKET PAGE  (yeni)
// ─────────────────────────────────────────────
function renderCreateTicketPage(user, categories = []) {
  const defaultCats = ['Genel Destek', 'Teknik Sorun', 'Hesap', 'Ödeme', 'Diğer'];
  const cats = categories.length ? categories : defaultCats;

  const content = `
    <div class="card" style="max-width:640px;margin:0 auto;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">➕ Yeni Ticket Oluştur</h1>
      <p class="text-muted mb-3">Ekibimiz en kısa sürede sana dönecek.</p>
      <hr class="divider">

      <div id="ticket-form">
        <label>Kategori <span style="color:var(--danger);">*</span></label>
        <select id="tc-category">
          <option value="">— Seçiniz —</option>
          <option value="ban">🔨 Ban / Şikayet Talebi</option>
          <option value="reklam">📢 Reklam Satın Al</option>
          <option value="report">🚨 Kullanıcı Şikayet</option>
          <option value="billing">💳 Ödeme Sorunu</option>
          <option value="technical">🔧 Teknik Sorun</option>
          <option value="account">👤 Hesap Sorunu</option>
          <option value="genel">💬 Genel Destek</option>
          <option value="other">📝 Diğer</option>
        </select>

        <label>Konu <span style="color:var(--danger);">*</span></label>
        <input type="text" id="tc-subject" placeholder="Kısa bir konu başlığı girin" maxlength="100">

        <label>Açıklama <span style="color:var(--danger);">*</span></label>
        <textarea id="tc-desc" rows="6" placeholder="Sorununuzu veya talebinizi ayrıntılı olarak anlatın..." maxlength="2000"></textarea>
        <div style="text-align:right;color:var(--muted);font-size:0.8rem;margin-top:-1rem;margin-bottom:1rem;">
          <span id="tc-count">0</span>/2000
        </div>

        <div id="tc-error" style="display:none;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--danger);padding:0.8rem 1rem;border-radius:10px;margin-bottom:1rem;"></div>

        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
          <button class="btn" id="tc-submit" onclick="submitTicket()" style="flex:1;">📨 Gönder</button>
          <a href="/tickets" class="btn btn-ghost" style="flex:1;text-align:center;">İptal</a>
        </div>
      </div>
    </div>

    <script>
      const descEl  = document.getElementById('tc-desc');
      const cntEl   = document.getElementById('tc-count');
      descEl.addEventListener('input', () => { cntEl.textContent = descEl.value.length; });

      // Auto-select category from URL query parameters if present
      const urlParams = new URLSearchParams(window.location.search);
      const catParam = urlParams.get('category');
      if (catParam) {
        const selectEl = document.getElementById('tc-category');
        if (selectEl) {
          selectEl.value = catParam;
        }
      }

      async function submitTicket() {
        const cat      = document.getElementById('tc-category').value;
        const subject  = document.getElementById('tc-subject').value.trim();
        const desc     = descEl.value.trim();
        const errEl    = document.getElementById('tc-error');
        const btn      = document.getElementById('tc-submit');

        // Kategori bazlı otomatik öncelik
        const autoPriority = { ban: 'high', report: 'high', billing: 'high', reklam: 'medium', technical: 'medium', account: 'medium', genel: 'low', other: 'low' };
        const priority = autoPriority[cat] || 'medium';

        errEl.style.display = 'none';
        if (!cat)     { errEl.textContent = 'Lütfen bir kategori seçin.';        errEl.style.display='block'; return; }
        if (!subject) { errEl.textContent = 'Lütfen bir konu başlığı girin.';    errEl.style.display='block'; return; }
        if (!desc)    { errEl.textContent = 'Lütfen açıklama kısmını doldurun.'; errEl.style.display='block'; return; }

        btn.textContent = 'Gönderiliyor...';
        btn.disabled = true;

        try {
          const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: cat, subject, description: desc, priority })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok) {
            const msg = d.discordChannel
              ? \`Ticket oluşturuldu! 🎉 \${d.discordChannel}\`
              : 'Ticket oluşturuldu! 🎉';
            showToast(msg, 'success');
            setTimeout(() => window.location.href = '/tickets', 1500);
          } else {
            errEl.textContent = d.error || 'Bir hata oluştu.';
            errEl.style.display = 'block';
            btn.textContent = '📨 Gönder';
            btn.disabled = false;
          }
        } catch {
          errEl.textContent = 'Bağlantı hatası. Lütfen tekrar deneyin.';
          errEl.style.display = 'block';
          btn.textContent = '📨 Gönder';
          btn.disabled = false;
        }
      }
    </script>
  `;
  return _layout('Yeni Ticket', user, content, '', '/tickets');
}


// ─────────────────────────────────────────────
// NOTIFICATIONS PAGE  (yeni)
// ─────────────────────────────────────────────
function renderNotificationsPage(user, notifications = []) {
  const notifHtml = notifications.map(n => {
    const icons = { ticket: '🎫', system: '⚙️', staff: '👨‍💼', mention: '💬', warning: '⚠️' };
    const icon = n.icon || icons[n.type] || '🔔';
    const isRead = n.read;
    return `
      <div style="display:flex;gap:1rem;align-items:flex-start;padding:1.25rem;
                  border-radius:14px;border:1px solid ${isRead ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.2)'};
                  background:${isRead ? 'rgba(255,255,255,0.02)' : 'rgba(167,139,250,0.04)'};
                  margin-bottom:0.75rem;transition:border-color 0.3s;backdrop-filter:blur(8px);"
           onmouseover="this.style.borderColor='rgba(167,139,250,0.2)'" onmouseout="this.style.borderColor='${isRead ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.2)'}'">
        <div style="font-size:1.5rem;flex-shrink:0;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:${isRead ? '600' : '800'};margin-bottom:0.25rem;">${_esc(n.title || '')}</div>
          <div style="color:var(--muted);font-size:0.9rem;line-height:1.5;">${_esc(n.message || '')}</div>
          ${n.createdAt ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:0.4rem;">${new Date(n.createdAt).toLocaleString('tr-TR')}</div>` : ''}
        </div>
        ${!isRead ? `<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:0.4rem;box-shadow:0 0 6px var(--accent);"></div>` : ''}
      </div>
    `;
  }).join('');

  const unreadCount = notifications.filter(n => !n.read).length;

  const content = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 style="font-size:2rem;font-weight:800;">🔔 Bildirimler</h1>
          ${unreadCount > 0 ? `<div style="color:var(--accent);font-size:0.85rem;margin-top:0.25rem;">${unreadCount} okunmamış bildirim</div>` : ''}
        </div>
        ${unreadCount > 0 ? `<button class="btn btn-ghost btn-sm" onclick="markAllRead()">✅ Tümünü Okundu İşaretle</button>` : ''}
      </div>

      ${notifications.length > 0 ? notifHtml
      : `<div style="text-align:center;padding:4rem;color:var(--muted);">
             <div style="font-size:3rem;margin-bottom:1rem;">🔕</div>
             <div>Henüz bildiriminiz yok.</div>
           </div>`}
    </div>

    <script>
      async function markAllRead() {
        try {
          const res = await fetch('/api/notifications/read-all', { method: 'POST' });
          if (res.ok) { showToast('Tüm bildirimler okundu işaretlendi.', 'success'); setTimeout(() => location.reload(), 600); }
          else showToast('Bir hata oluştu.', 'error');
        } catch { showToast('Bağlantı hatası.', 'error'); }
      }
    </script>
  `;
  return _layout('Bildirimler', user, content, '', '/notifications');
}


// ─────────────────────────────────────────────
// WEBHOOK PROXY PAGE
// ─────────────────────────────────────────────
function renderWebhookPage(user) {
  const { BASE_URL } = require('../config');
  const proxyUrl = `${BASE_URL}/api/webhook/proxy`;

  const content = `
    <div class="card" style="max-width:800px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:2rem;">
        <div style="font-size:3rem;margin-bottom:.75rem;">🔗</div>
        <h1 style="font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          Webhook Proxy
        </h1>
        <p class="text-muted" style="margin-top:.5rem;">Roblox'tan Discord webhook'larına mesaj gönderin</p>
      </div>

      <!-- Proxy URL -->
      <div style="background:rgba(167,139,250,.05);border:1px solid rgba(167,139,250,.12);border-radius:16px;padding:1.5rem;margin-bottom:2rem;backdrop-filter:blur(8px);">
        <div style="font-size:.8rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:.75rem;">📡 Proxy Endpoint URL</div>
        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
          <code id="proxy-url" style="flex:1;background:rgba(0,0,0,.4);padding:.75rem 1rem;border-radius:10px;font-size:.9rem;color:var(--accent);word-break:break-all;border:1px solid var(--border);">${_esc(proxyUrl)}</code>
          <button class="btn btn-sm" onclick="copyProxyUrl()">📋 Kopyala</button>
        </div>
        <p style="font-size:.8rem;color:var(--muted);margin-top:.75rem;">Bu URL'yi Roblox scriptinizde kullanın. <code style="color:var(--accent);">POST</code> isteği atın.</p>
      </div>

      <!-- Test aracı -->
      <div style="margin-bottom:2rem;">
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:1rem;">🧪 Webhook Test Et</h2>

        <label>Discord Webhook URL</label>
        <input type="text" id="wh-url" placeholder="https://discord.com/api/webhooks/..." style="font-family:monospace;font-size:.85rem;">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
          <div>
            <label>Bot Adı (isteğe bağlı)</label>
            <input type="text" id="wh-username" placeholder="Sentara Bot" style="margin-bottom:0;">
          </div>
          <div>
            <label>Bot Avatar URL (isteğe bağlı)</label>
            <input type="text" id="wh-avatar" placeholder="https://..." style="margin-bottom:0;">
          </div>
        </div>

        <label style="margin-top:1rem;">Mesaj İçeriği</label>
        <textarea id="wh-content" rows="3" placeholder="Merhaba Discord! Bu Roblox'tan gelen bir test mesajıdır." style="resize:vertical;"></textarea>

        <!-- Embed -->
        <details style="margin-bottom:1rem;">
          <summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:.9rem;padding:.5rem 0;">➕ Embed Ekle (isteğe bağlı)</summary>
          <div style="margin-top:1rem;background:rgba(0,0,0,.2);border-radius:12px;padding:1rem;border:1px solid var(--border);">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
              <div>
                <label>Embed Başlık</label>
                <input type="text" id="emb-title" placeholder="Başlık" style="margin-bottom:0;">
              </div>
              <div>
                <label>Embed Renk (hex)</label>
                <input type="color" id="emb-color" value="#7c6af7" style="height:46px;padding:.25rem;margin-bottom:0;">
              </div>
            </div>
            <label style="margin-top:.75rem;">Embed Açıklama</label>
            <textarea id="emb-desc" rows="2" placeholder="Embed açıklaması..." style="resize:vertical;margin-bottom:.5rem;"></textarea>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
              <div>
                <label>Footer</label>
                <input type="text" id="emb-footer" placeholder="Footer metni" style="margin-bottom:0;">
              </div>
              <div>
                <label>Thumbnail URL</label>
                <input type="text" id="emb-thumb" placeholder="https://..." style="margin-bottom:0;">
              </div>
            </div>
          </div>
        </details>

        <button class="btn" onclick="testWebhook()" id="test-btn">🚀 Gönder</button>
        <div id="wh-result" style="margin-top:1rem;"></div>
      </div>

      <!-- Roblox kod örneği -->
      <div>
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:1rem;">📜 Roblox Lua Kod Örneği</h2>
        <div style="position:relative;">
          <pre id="lua-code" style="background:rgba(0,0,0,.5);border:1px solid var(--border);border-radius:12px;padding:1.5rem;overflow-x:auto;font-size:.82rem;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;word-break:break-all;"></pre>
          <button class="btn btn-sm btn-ghost" onclick="copyLua()" style="position:absolute;top:.75rem;right:.75rem;">📋 Kopyala</button>
        </div>
      </div>
    </div>

    <script>
      const PROXY_URL = ${JSON.stringify(proxyUrl)};

      // Lua kod örneğini doldur
      function updateLuaCode() {
        const webhookUrl = document.getElementById('wh-url').value || 'WEBHOOK_URL_BURAYA';
        const code = \`local HttpService = game:GetService("HttpService")

-- Proxy URL (Discord webhook'larına Roblox'tan istek atmak için)
local PROXY_URL = "\${PROXY_URL}"

-- Webhook URL'nizi buraya yapıştırın
local WEBHOOK_URL = "\${webhookUrl}"

local function sendWebhook(message, embedTitle, embedDesc, embedColor)
    local payload = {
        webhookUrl = WEBHOOK_URL,
        username = "Roblox Bot",
        content = message,
    }
    
    -- Embed eklemek istersen
    if embedTitle or embedDesc then
        payload.embeds = {
            {
                title = embedTitle or "",
                description = embedDesc or "",
                color = embedColor or 8077559, -- #7b6af7
                timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
                footer = { text = "Sentara Webhook Proxy" }
            }
        }
    end
    
    local success, err = pcall(function()
        HttpService:PostAsync(
            PROXY_URL,
            HttpService:JSONEncode(payload),
            Enum.HttpContentType.ApplicationJson,
            false
        )
    end)
    
    if not success then
        warn("Webhook gönderilemedi: " .. tostring(err))
    end
end

-- Kullanım örneği:
sendWebhook("Merhaba Discord! 👋", "Oyun Bildirimi", "Bir oyuncu sunucuya katıldı.", 5763719)\`;
        document.getElementById('lua-code').textContent = code;
      }

      document.getElementById('wh-url').addEventListener('input', updateLuaCode);
      updateLuaCode();

      function copyProxyUrl() {
        navigator.clipboard.writeText(PROXY_URL).then(() => showToast('URL kopyalandı!', 'success'));
      }

      function copyLua() {
        const code = document.getElementById('lua-code').textContent;
        navigator.clipboard.writeText(code).then(() => showToast('Lua kodu kopyalandı!', 'success'));
      }

      async function testWebhook() {
        const webhookUrl = document.getElementById('wh-url').value.trim();
        const content    = document.getElementById('wh-content').value.trim();
        const username   = document.getElementById('wh-username').value.trim();
        const avatarUrl  = document.getElementById('wh-avatar').value.trim();
        const embTitle   = document.getElementById('emb-title').value.trim();
        const embDesc    = document.getElementById('emb-desc').value.trim();
        const embColor   = document.getElementById('emb-color').value;
        const embFooter  = document.getElementById('emb-footer').value.trim();
        const embThumb   = document.getElementById('emb-thumb').value.trim();
        const resultBox  = document.getElementById('wh-result');
        const btn        = document.getElementById('test-btn');

        if (!webhookUrl) { showToast('Discord Webhook URL girin.', 'warning'); return; }
        if (!content && !embTitle && !embDesc) { showToast('Mesaj içeriği veya embed girin.', 'warning'); return; }

        btn.disabled = true;
        btn.textContent = '⏳ Gönderiliyor...';
        resultBox.innerHTML = '';

        const payload = { webhookUrl };
        if (content)   payload.content    = content;
        if (username)  payload.username   = username;
        if (avatarUrl) payload.avatar_url = avatarUrl;

        if (embTitle || embDesc) {
          // hex rengi integer'a çevir
          const colorInt = parseInt(embColor.replace('#', ''), 16);
          const embed = { color: colorInt };
          if (embTitle)  embed.title       = embTitle;
          if (embDesc)   embed.description = embDesc;
          if (embFooter) embed.footer      = { text: embFooter };
          if (embThumb)  embed.thumbnail   = { url: embThumb };
          embed.timestamp = new Date().toISOString();
          payload.embeds = [embed];
        }

        try {
          const res = await fetch('/api/webhook/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const d = await res.json().catch(() => ({}));

          if (res.ok && d.success) {
            resultBox.innerHTML = '<div style="color:var(--success);background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:10px;padding:.75rem 1rem;">✅ Webhook başarıyla gönderildi!</div>';
            showToast('Webhook gönderildi!', 'success');
          } else {
            resultBox.innerHTML = \`<div style="color:var(--danger);background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:10px;padding:.75rem 1rem;">❌ Hata: \${d.error || 'Bilinmeyen hata'}\${d.discord_response ? '<br><small style=\\"opacity:.7\\">' + d.discord_response + '</small>' : ''}</div>\`;
            showToast(d.error || 'Hata', 'error');
          }
        } catch (err) {
          resultBox.innerHTML = \`<div style="color:var(--danger);">❌ Bağlantı hatası: \${err.message}</div>\`;
        }

        btn.disabled = false;
        btn.textContent = '🚀 Gönder';
      }
    <\/script>
  `;
  return _layout('Webhook Proxy', user, content, '', '/webhook');
}


// ─────────────────────────────────────────────
// BRIEFING ONBOARDING MODAL
// ─────────────────────────────────────────────
function renderBriefingOnboardingModal(user = null) {
  const content = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="card" style="max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; animation: slideIn 0.3s ease;">
        <h2 style="margin: 0 0 10px 0; color: var(--accent); font-size: 1.5rem;">🎯 Kişisel Tanışma Formu</h2>
        <p style="color: var(--muted); margin: 0 0 30px 0; font-size: 0.95rem;">
          Briefing'e erişmeden önce, seni biraz daha tanımak istiyoruz. 
          Lütfen aşağıdaki soruları cevapla.
        </p>

        <div id="questions-container">
          <!-- Sorular buraya yüklenecek -->
        </div>

        <div id="form-container" style="display: none; margin-top: 20px;">
          <textarea id="answers-textarea" placeholder="Cevaplarını buraya yazabilirsin..." 
            style="width: 100%; height: 150px; padding: 12px; background: rgba(255,255,255,0.05); 
            border: 1px solid var(--border); border-radius: 8px; color: var(--text); 
            font-family: 'Outfit', sans-serif; resize: none;"></textarea>
          
          <button onclick="submitBriefingForm()" 
            style="margin-top: 15px; padding: 12px 30px; background: var(--accent); 
            color: #000; border: none; border-radius: 8px; font-weight: 600; 
            cursor: pointer; width: 100%; transition: all 0.3s;">
            ✅ Gönder
          </button>
        </div>
      </div>
    </div>

    <style>
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .question-item {
        background: rgba(255,255,255,0.02);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .question-item:hover {
        background: rgba(255,255,255,0.05);
        border-color: var(--accent);
      }

      .question-item.selected {
        background: rgba(167,139,250,0.15);
        border-color: var(--accent);
      }

      .question-text {
        font-weight: 600;
        color: var(--text);
        margin-bottom: 8px;
      }

      .question-num {
        font-size: 0.85rem;
        color: var(--muted);
      }
    </style>

    <script>
      const questions = [
        {
          id: "hobbies",
          text: "🎮 Hobilerin neler? (Müzik, oyun, spor, vs.)",
          type: "text"
        },
        {
          id: "nocreen",
          text: "📵 Telefonuna/Bilgisayarına bakmadığında ne yapıyorsun?",
          type: "text"
        },
        {
          id: "personality",
          text: "😊 Kendini 3 kelimeyle tanımlayabilir misin?",
          type: "text"
        },
        {
          id: "goals",
          text: "🎯 Sentara'da ne yapmak istiyorsun? (Kariyer, eğlence, vs.)",
          type: "text"
        },
        {
          id: "music",
          text: "🎵 Sevdiğin müzik türü nedir?",
          type: "text"
        }
      ];

      let currentQuestion = 0;
      let answers = {};

      function loadQuestion() {
        const container = document.getElementById('questions-container');
        const q = questions[currentQuestion];
        
        if (currentQuestion < questions.length) {
          container.innerHTML = \`
            <div class="question-item">
              <div class="question-num">Soru \${currentQuestion + 1}/\${questions.length}</div>
              <div class="question-text">\${q.text}</div>
              <input type="text" id="answer-input" placeholder="Cevabını yaz..." 
                value="\${answers[q.id] || ''}"
                style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); 
                border: 1px solid var(--border); border-radius: 6px; color: var(--text); 
                font-family: 'Outfit', sans-serif; margin-top: 10px;" 
                onkeypress="if(event.key==='Enter') nextQuestion()">
              <button onclick="nextQuestion()" 
                style="margin-top: 12px; padding: 10px 20px; background: var(--accent); 
                color: #000; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                \${currentQuestion === questions.length - 1 ? '✅ Bitir' : '➡️ Devam Et'}
              </button>
            </div>
          \`;
          document.getElementById('answer-input').focus();
        }
      }

      function nextQuestion() {
        const q = questions[currentQuestion];
        const input = document.getElementById('answer-input');
        const answer = input.value.trim();
        
        if (!answer) {
          alert('Lütfen soruyu cevapla!');
          return;
        }

        answers[q.id] = answer;

        if (currentQuestion < questions.length - 1) {
          currentQuestion++;
          loadQuestion();
        } else {
          showForm();
        }
      }

      function showForm() {
        document.getElementById('questions-container').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';
        
        const summary = questions.map((q, i) => 
          \`Q\${i+1}: \${q.text}\\nA: \${answers[q.id] || 'Boş'}\`
        ).join('\\n\\n');
        
        document.getElementById('answers-textarea').value = summary;
      }

      async function submitBriefingForm() {
        try {
          const response = await fetch('/api/briefing/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
          });

          const data = await response.json();
          
          if (data.success) {
            alert('✅ Formu gönderdin! Briefing sayfasına yönlendiriliyorsun...');
            window.location.href = '/briefing';
          } else {
            alert('❌ Hata: ' + (data.error || 'Bilinmeyen hata'));
          }
        } catch (error) {
          alert('❌ Sunucu hatası: ' + error.message);
        }
      }

      // İlk soruyu yükle
      loadQuestion();
    </script>
  `;

  return content;
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────
module.exports = {
  renderMainPage,
  renderLoginPage,
  renderAuthorizePage,
  renderDashboard,
  renderTicketsPage,
  renderCreateTicketPage,
  renderNotificationsPage,
  renderStaffPanel,
  renderDebugPage,
  renderProfilePage,
  renderSettingsPage,
  renderLegalPage,
  renderWikiListPage,
  renderWikiArticlePage,
  renderAdminPage,
  renderBriefingOnboardingModal,
  renderGroupAdminPage,
  renderLeaderboardPage,
  renderShopPage,
  renderWebhookPage,
  renderErrorPage,
  // Internal helpers (exported for testing)
  _esc,
  _layout,
};