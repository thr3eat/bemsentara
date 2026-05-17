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
      --bg:       #050508;
      --surface:  rgba(20,20,30,0.65);
      --border:   rgba(124,106,247,0.2);
      --accent:   #7c6af7;
      --accent2:  #ff6bf7;
      --text:     #ffffff;
      --muted:    #a0a0c0;
      --success:  #4ade80;
      --warning:  #fbbf24;
      --danger:   #f87171;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      background: radial-gradient(circle at top left, #1a1a2e 0%, var(--bg) 100%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* ── Header ── */
    header {
      background: rgba(10,10,15,0.55);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 0.9rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 200;
      box-shadow: 0 4px 30px rgba(0,0,0,0.4);
    }
    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -1px;
      text-decoration: none;
      flex-shrink: 0;
    }
    .nav-links {
      display: flex;
      gap: 1.4rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .nav-link {
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
      transition: color 0.25s;
      padding: 0.2rem 0;
      position: relative;
    }
    .nav-link::after {
      content:'';
      position: absolute;
      bottom: -2px; left: 0;
      width: 0; height: 2px;
      background: var(--accent);
      transition: width 0.3s ease;
    }
    .nav-link:hover { color: var(--text); }
    .nav-link:hover::after { width:100%; }
    .nav-link.staff-link { color: var(--accent); }
    .nav-link.debug-link  { color: var(--danger); }
    .nav-link.logout-link { color: var(--danger); }
    .nav-link.logout-link::after { background: var(--danger); }
    .nav-link.nav-active { color: var(--text); }
    .nav-link.nav-active::after { width: 100%; }

    /* ── Hamburger ── */
    .hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      cursor: pointer;
      padding: 0.4rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
    }
    .hamburger span {
      display: block;
      width: 22px; height: 2px;
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
        background: rgba(10,10,15,0.97);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--border);
        padding: 1rem 2rem;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 199;
      }
      .nav-links.open { display: flex; }
      .nav-link { padding: 0.6rem 0; font-size: 1rem; }
    }

    /* ── Main & Card ── */
    main { max-width: 1000px; margin: 0 auto; padding: 3rem 2rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2rem;
      backdrop-filter: blur(10px);
    }
    .card + .card { margin-top: 2rem; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.8rem 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      transition: transform 0.25s, box-shadow 0.25s, opacity 0.25s;
      box-shadow: 0 4px 15px rgba(124,106,247,0.3);
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(124,106,247,0.5); }
    .btn:active { transform: translateY(0); }
    .btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
    .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 4px 15px rgba(239,68,68,0.3); }
    .btn-danger:hover { box-shadow: 0 8px 25px rgba(239,68,68,0.5); }
    .btn-success { background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 4px 15px rgba(34,197,94,0.3); }
    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      box-shadow: none;
    }
    .btn-ghost:hover { border-color: var(--accent); color: var(--text); box-shadow: none; }

    /* ── Form elements ── */
    label { display: block; margin-bottom: 0.4rem; color: var(--muted); font-size: 0.9rem; font-weight: 600; }
    input, textarea, select {
      width: 100%;
      padding: 0.9rem 1rem;
      background: rgba(0,0,0,0.35);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: white;
      font-family: inherit;
      font-size: 0.95rem;
      margin-bottom: 1.2rem;
      outline: none;
      transition: border-color 0.25s, box-shadow 0.25s;
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(124,106,247,0.15);
    }
    select option { background: #1a1a2e; }

    /* ── Badges ── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.3rem 0.75rem;
      border-radius: 30px;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-open    { background: rgba(74,222,128,0.12); color: var(--success); border: 1px solid rgba(74,222,128,0.3); }
    .badge-closed  { background: rgba(248,113,113,0.12); color: var(--danger);  border: 1px solid rgba(248,113,113,0.3); }
    .badge-pending { background: rgba(251,191,36,0.12);  color: var(--warning); border: 1px solid rgba(251,191,36,0.3); }
    .badge-admin   { background: rgba(255,107,247,0.12); color: var(--accent2); border: 1px solid rgba(255,107,247,0.3); }

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
      padding: 1rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      backdrop-filter: blur(10px);
      border: 1px solid;
      animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
      pointer-events: auto;
      max-width: 320px;
    }
    .toast-success { background: rgba(34,197,94,0.15);  color: var(--success); border-color: rgba(34,197,94,0.3); }
    .toast-error   { background: rgba(239,68,68,0.15);  color: var(--danger);  border-color: rgba(239,68,68,0.3); }
    .toast-info    { background: rgba(124,106,247,0.15); color: var(--accent);  border-color: rgba(124,106,247,0.3); }
    .toast-warning { background: rgba(251,191,36,0.15);  color: var(--warning); border-color: rgba(251,191,36,0.3); }
    .toast-inner   { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; }
    .toast-close   { cursor:pointer; opacity:0.6; flex-shrink:0; font-size:1rem; background:none; border:none; color:inherit; padding:0; line-height:1; }
    .toast-close:hover { opacity:1; }
    @keyframes toastIn  { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
    @keyframes toastOut { from { opacity:1; } to { opacity:0; transform:translateX(30px); } }

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
    hr.divider { border:none; border-top:1px solid var(--border); margin:2rem 0; }

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
    <a href="/dashboard" class="logo">sentara</a>
    <button class="hamburger" id="hamburger" aria-label="Menü" onclick="this.classList.toggle('open');document.getElementById('nav-links').classList.toggle('open')">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav-links" id="nav-links">
      ${navLink('/dashboard', 'Dashboard')}
      ${navLink('/profile',   'Profil')}
      ${navLink('/tickets',   "Ticket'lar")}
      ${navLink('/notifications', '🔔 Bildirimler')}
      ${navLink('/leaderboard', 'Sıralama')}
      ${navLink('/shop',      'Mağaza')}
      ${navLink('/wiki',      'Wiki')}
      ${navLink('/settings',  'Ayarlar')}
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
      --bg:      #050508;
      --surface: rgba(20,20,30,0.6);
      --border:  rgba(124,106,247,0.2);
      --accent:  #7c6af7;
      --accent2: #ff6bf7;
      --text:    #ffffff;
      --muted:   #a0a0c0;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      background: radial-gradient(circle at top right, #1a1a2e 0%, var(--bg) 60%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .glow {
      position:fixed; width:500px; height:500px;
      border-radius:50%; opacity:0.12; z-index:0;
      filter:blur(160px); pointer-events:none;
      animation: floatGlow 12s infinite ease-in-out alternate;
    }
    .glow-1 { background:var(--accent2); top:-150px; right:-150px; }
    .glow-2 { background:var(--accent);  bottom:-150px; left:-150px; animation-delay:-6s; }
    @keyframes floatGlow {
      0%   { transform: scale(1) translate(0,0); }
      100% { transform: scale(1.15) translate(20px,30px); }
    }

    header {
      padding: 1.2rem 4rem;
      display:flex; justify-content:space-between; align-items:center;
      background: rgba(10,10,15,0.45);
      backdrop-filter:blur(20px);
      border-bottom:1px solid var(--border);
      position:sticky; top:0; z-index:100;
    }
    .logo {
      font-size:2rem; font-weight:800; letter-spacing:-1px;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      text-decoration:none;
    }
    nav { display:flex; gap:2rem; align-items:center; }
    nav a {
      color:var(--text); text-decoration:none; font-weight:600;
      transition:opacity 0.2s; position:relative;
    }
    nav a::after {
      content:''; position:absolute; bottom:-4px; left:0;
      width:0; height:2px; background:var(--accent);
      transition:width 0.3s ease;
    }
    nav a:hover::after { width:100%; }

    .btn {
      padding:0.8rem 2rem;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      color:white; border:none; border-radius:30px;
      font-family:'Outfit',sans-serif; font-weight:800; font-size:1rem;
      cursor:pointer; text-decoration:none;
      transition:transform 0.3s, box-shadow 0.3s;
      box-shadow:0 4px 15px rgba(124,106,247,0.35);
      display:inline-flex; align-items:center; gap:0.5rem;
      position:relative; overflow:hidden;
    }
    .btn::after {
      content:''; position:absolute; top:0; left:-100%;
      width:100%; height:100%;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);
      transition:left 0.5s;
    }
    .btn:hover::after { left:100%; }
    .btn:hover { transform:translateY(-3px) scale(1.04); box-shadow:0 10px 28px rgba(124,106,247,0.55); }

    /* ── Hero ── */
    .hero {
      position:relative; z-index:1;
      max-width:1100px; margin:0 auto;
      padding:8rem 2rem 5rem;
      text-align:center;
    }
    .hero-badge {
      display:inline-flex; align-items:center; gap:0.5rem;
      background:rgba(124,106,247,0.12);
      border:1px solid rgba(124,106,247,0.3);
      padding:0.4rem 1rem; border-radius:30px;
      font-size:0.85rem; font-weight:600; color:var(--accent);
      margin-bottom:2rem;
      animation:fadeUp 0.8s ease forwards; opacity:0;
    }
    h1 {
      font-size:5rem; line-height:1.05; font-weight:800;
      margin-bottom:1.5rem;
      animation:fadeUp 0.9s ease 0.1s forwards; opacity:0;
    }
    .grad {
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }
    .subtitle {
      color:var(--muted); font-size:1.25rem; max-width:680px;
      margin:0 auto 3rem;
      animation:fadeUp 0.9s ease 0.2s forwards; opacity:0;
      line-height:1.7;
    }
    .hero-cta {
      display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;
      animation:fadeUp 0.9s ease 0.3s forwards; opacity:0;
    }
    .btn-outline {
      padding:0.8rem 2rem; background:transparent;
      border:1px solid var(--border); color:var(--text);
      border-radius:30px; font-family:'Outfit',sans-serif;
      font-weight:700; cursor:pointer; text-decoration:none;
      transition:border-color 0.3s, color 0.3s;
    }
    .btn-outline:hover { border-color:var(--accent); color:var(--accent); }

    @keyframes fadeUp {
      to { opacity:1; transform:translateY(0); }
      from { opacity:0; transform:translateY(24px); }
    }

    /* ── Stats strip ── */
    .stats {
      display:flex; justify-content:center; gap:3rem; flex-wrap:wrap;
      padding:2.5rem; background:var(--surface);
      border:1px solid var(--border); border-radius:20px;
      max-width:900px; margin:3rem auto 0;
      animation:fadeUp 1s ease 0.4s forwards; opacity:0;
    }
    .stat-item { text-align:center; }
    .stat-value { font-size:2.5rem; font-weight:800; }
    .stat-label { color:var(--muted); font-size:0.9rem; }

    /* ── Features ── */
    #features {
      max-width:1100px; margin:6rem auto; padding:0 2rem;
    }
    .section-label {
      text-align:center; color:var(--accent); font-weight:700;
      font-size:0.85rem; letter-spacing:2px; text-transform:uppercase;
      margin-bottom:1rem;
    }
    .section-title { text-align:center; font-size:2.8rem; font-weight:800; margin-bottom:4rem; }
    .features-grid {
      display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.5rem;
    }
    .feature {
      background:var(--surface); border:1px solid var(--border);
      border-radius:20px; padding:2rem;
      backdrop-filter:blur(10px);
      transition:transform 0.35s, border-color 0.35s, box-shadow 0.35s;
      position:relative; overflow:hidden;
    }
    .feature::before {
      content:''; position:absolute;
      inset:0; border-radius:20px;
      background:linear-gradient(135deg,rgba(124,106,247,0.06),transparent);
      opacity:0; transition:opacity 0.35s;
    }
    .feature:hover { transform:translateY(-8px); border-color:rgba(124,106,247,0.5); box-shadow:0 20px 40px rgba(0,0,0,0.5); }
    .feature:hover::before { opacity:1; }
    .feature-icon {
      font-size:2.5rem; display:inline-flex;
      align-items:center; justify-content:center;
      width:64px; height:64px;
      background:rgba(124,106,247,0.1); border-radius:16px;
      margin-bottom:1.5rem;
    }
    .feature h3 { font-size:1.3rem; font-weight:800; margin-bottom:0.75rem; }
    .feature p  { color:var(--muted); line-height:1.7; font-size:0.95rem; }

    /* ── Footer ── */
    footer {
      text-align:center; padding:3rem 2rem;
      border-top:1px solid var(--border);
      color:var(--muted); background:rgba(5,5,8,0.9);
      position:relative; z-index:1;
    }
    footer .logo { font-size:1.5rem; display:block; margin-bottom:0.75rem; }
    .footer-links { display:flex; justify-content:center; gap:1.5rem; margin:1rem 0; flex-wrap:wrap; }
    .footer-links a { color:var(--muted); text-decoration:none; font-size:0.9rem; transition:color 0.2s; }
    .footer-links a:hover { color:var(--text); }

    @media(max-width:768px) {
      header { padding:1rem; flex-direction:column; gap:1rem; }
      h1 { font-size:2.8rem; }
      .stats { gap:1.5rem; }
    }
  </style>
</head>
<body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <header>
    <a href="/" class="logo">sentara</a>
    <nav>
      <a href="#features">Özellikler</a>
      <a href="/legal/tos">Koşullar</a>
      <a href="/login" class="btn">Giriş Yap</a>
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
        <p>Ticket metrikleri, personel performansı ve kullanıcı aktivitesi hakkında kapsamlı raporlar.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🤖</div>
        <h3>Otomasyon</h3>
        <p>Otomatik atama, kategorizasyon ve yanıt şablonları ile verimliliği maksimuma taşıyın.</p>
      </div>
    </div>
  </section>

  <footer>
    <a href="/" class="logo">sentara</a>
    <div class="footer-links">
      <a href="/legal/tos">Hizmet Koşulları</a>
      <a href="/legal/privacy">Gizlilik Politikası</a>
      <a href="/wiki">Wiki</a>
    </div>
    <p style="font-size:0.85rem;">&copy; 2026 Sentara Premium Support. Tüm hakları saklıdır.</p>
  </footer>
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
      --bg:      #050508;
      --surface: rgba(20,20,30,0.6);
      --border:  rgba(124,106,247,0.2);
      --accent:  #7c6af7;
      --accent2: #ff6bf7;
      --text:    #ffffff;
      --muted:   #a0a0c0;
      --danger:  #f87171;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: radial-gradient(circle at center, #1a1a2e 0%, var(--bg) 100%);
      color:var(--text); font-family:'Outfit',sans-serif;
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      overflow:hidden;
    }
    .glow {
      position:fixed; width:500px; height:500px; border-radius:50%;
      filter:blur(200px); pointer-events:none; z-index:0;
      animation:pulse 8s infinite alternate;
    }
    .glow-1 { background:var(--accent); top:-200px; left:-200px; opacity:0.12; }
    .glow-2 { background:var(--accent2); bottom:-200px; right:-200px; opacity:0.12; animation-delay:-4s; }
    @keyframes pulse {
      0%   { transform:scale(1); opacity:0.1; }
      100% { transform:scale(1.2); opacity:0.22; }
    }
    .container { position:relative; z-index:10; width:100%; max-width:420px; padding:1.5rem; }
    .card {
      background:rgba(15,15,20,0.55);
      backdrop-filter:blur(24px);
      border:1px solid var(--border);
      border-radius:24px; padding:3rem 2.5rem;
      text-align:center;
      box-shadow:0 30px 60px -12px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.05);
      animation:popIn 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
    }
    @keyframes popIn {
      0%   { opacity:0; transform:scale(0.88) translateY(24px); }
      100% { opacity:1; transform:scale(1) translateY(0); }
    }
    .logo {
      font-size:2.5rem; font-weight:800; letter-spacing:-1px;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      margin-bottom:0.5rem; display:block;
    }
    .card h1 { font-size:1.5rem; font-weight:600; margin-bottom:0.4rem; }
    .card .subtitle { color:var(--muted); margin-bottom:2rem; font-size:0.95rem; }
    .error-box {
      background:rgba(248,113,113,0.1); border:1px solid rgba(248,113,113,0.3);
      color:var(--danger); padding:0.8rem 1rem; border-radius:10px;
      margin-bottom:1.5rem; font-size:0.9rem;
    }
    .btn-discord {
      width:100%; padding:1.1rem; border:none; border-radius:12px;
      font-family:'Outfit',sans-serif; font-weight:700; font-size:1.05rem;
      cursor:pointer; background:#5865F2; color:white;
      display:flex; align-items:center; justify-content:center; gap:10px;
      text-decoration:none;
      transition:background 0.25s, transform 0.25s, box-shadow 0.25s;
      box-shadow:0 4px 15px rgba(88,101,242,0.35);
    }
    .btn-discord:hover { background:#4752C4; transform:translateY(-3px); box-shadow:0 8px 25px rgba(88,101,242,0.55); }
    .divider { color:var(--muted); font-size:0.85rem; margin:1.5rem 0; position:relative; }
    .divider::before, .divider::after {
      content:''; position:absolute; top:50%; width:40%; height:1px; background:var(--border);
    }
    .divider::before { left:0; }
    .divider::after  { right:0; }
    .back { display:inline-block; margin-top:1.5rem; color:var(--muted); text-decoration:none; font-size:0.9rem; transition:color 0.2s; }
    .back:hover { color:var(--text); }
    .terms { margin-top:1.5rem; font-size:0.78rem; color:var(--muted); line-height:1.5; }
    .terms a { color:var(--accent); text-decoration:none; }
    .terms a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="container">
    <div class="card">
      <span class="logo">sentara</span>
      <h1>Hoş Geldiniz</h1>
      <p class="subtitle">Platforma erişmek için Discord hesabınızla devam edin</p>

      ${errorMsg ? `<div class="error-box">⚠️ ${_esc(errorMsg)}</div>` : ''}

      <a href="/auth/discord" class="btn-discord">
        <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="currentColor">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a67.59,67.59,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.33,46,96.22,53,91.08,65.69,84.69,65.69Z"/>
        </svg>
        Discord ile Giriş Yap
      </a>

      <p class="terms">
        Giriş yaparak <a href="/legal/tos">Hizmet Koşullarını</a> ve
        <a href="/legal/privacy">Gizlilik Politikasını</a> kabul etmiş olursunuz.
      </p>
      <a href="/" class="back">← Ana Sayfaya Dön</a>
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
    :root { --bg:#050508; --border:rgba(124,106,247,0.2); --accent:#7c6af7; --accent2:#ff6bf7; --text:#fff; --muted:#a0a0c0; }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    body {
      background:radial-gradient(circle at center, #1a1a2e 0%, var(--bg) 100%);
      color:var(--text); font-family:'Outfit',sans-serif;
      min-height:100vh; display:flex; align-items:center; justify-content:center;
    }
    .card {
      background:rgba(15,15,20,0.55); backdrop-filter:blur(24px);
      border:1px solid var(--border); border-radius:24px; padding:3rem 2.5rem;
      text-align:center; max-width:400px; width:100%; margin:1.5rem;
      box-shadow:0 30px 60px rgba(0,0,0,0.5);
      animation:popIn 0.5s ease forwards;
    }
    @keyframes popIn { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
    .logo { font-size:2rem; font-weight:800; background:linear-gradient(135deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; display:block; margin-bottom:1.5rem; }
    h1 { font-size:1.4rem; margin-bottom:0.5rem; }
    p  { color:var(--muted); margin-bottom:2rem; font-size:0.95rem; line-height:1.6; }
    .scope-list { text-align:left; margin-bottom:2rem; display:flex; flex-direction:column; gap:0.5rem; }
    .scope-item {
      display:flex; align-items:center; gap:0.75rem;
      background:rgba(124,106,247,0.08); border:1px solid rgba(124,106,247,0.2);
      padding:0.6rem 1rem; border-radius:10px; font-size:0.9rem;
    }
    .btn {
      width:100%; padding:1rem; border:none; border-radius:12px;
      font-family:'Outfit',sans-serif; font-weight:700; font-size:1rem;
      cursor:pointer; background:linear-gradient(135deg,var(--accent),var(--accent2));
      color:white; margin-bottom:0.75rem; transition:transform 0.2s, box-shadow 0.2s;
      text-decoration:none; display:block;
    }
    .btn:hover { transform:translateY(-2px); box-shadow:0 8px 25px rgba(124,106,247,0.45); }
    .btn-ghost { background:transparent; border:1px solid var(--border); color:var(--muted); }
    .btn-ghost:hover { border-color:var(--accent); color:var(--text); box-shadow:none; }
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
function renderDashboard(user) {
  // Use isAuthorized flag instead of checking username, since username might be a fallback value
  const isRobloxLinked = user.isAuthorized && user.robloxId;

  const content = `
    <!-- Welcome -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:2.5rem; animation:fadeUp 0.5s ease;">
      <div>
        <div style="color:var(--muted);font-size:0.9rem;margin-bottom:0.3rem;">Hoş Geldin 👋</div>
        <h1 style="font-size:2.4rem;font-weight:800;">${_esc(user.discordUsername)}</h1>
        <p class="text-muted mt-1">İşte destek sistemindeki güncel durumun.</p>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;background:rgba(15,15,20,0.6);padding:1rem 1.5rem;border-radius:16px;border:1px solid var(--border);backdrop-filter:blur(10px);">
        <img src="${_esc(user.discordAvatar)}" alt="Avatar"
             style="width:50px;height:50px;border-radius:50%;border:2px solid var(--accent);box-shadow:0 0 12px rgba(124,106,247,0.4);">
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

    <!-- Roblox Banner -->
    <div style="background:${isRobloxLinked ? 'rgba(74,222,128,0.07)' : 'rgba(251,191,36,0.07)'};
                border:1px solid ${isRobloxLinked ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)'};
                border-radius:16px;padding:1.25rem 1.5rem;
                display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
                margin-bottom:2rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:1.5rem;">${isRobloxLinked ? '✅' : '⚠️'}</span>
        <div>
          <div style="font-weight:700;color:${isRobloxLinked ? 'var(--success)' : 'var(--warning)'};">
            ${isRobloxLinked ? 'Roblox Bağlandı' : 'Roblox Hesabı Bağlı Değil'}
          </div>
          <div style="font-size:0.85rem;color:var(--muted);">
            ${isRobloxLinked ? _esc(user.robloxUsername) : 'Ticket açmak için Roblox bağlantısı gerekebilir.'}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        ${!isRobloxLinked ? `<a href="/auth/roblox" class="btn btn-sm">Roblox'u Bağla</a>` : `<button type="button" id="btn-sync-roles" class="btn btn-sm btn-success">🔄 Rolleri Güncelle</button>`}
      </div>
    </div>

    <div id="role-sync-result" style="display:none;margin-bottom:2rem;"></div>

    <!-- Stats Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin-bottom:2.5rem;">
      <div class="card" style="border-left:4px solid var(--success);text-align:center;padding:1.5rem;">
        <div style="color:var(--muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">🟢 Açık</div>
        <div id="cnt-open"  style="font-size:3rem;font-weight:800;">—</div>
      </div>
      <div class="card" style="border-left:4px solid var(--danger);text-align:center;padding:1.5rem;">
        <div style="color:var(--muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">🔴 Kapalı</div>
        <div id="cnt-closed" style="font-size:3rem;font-weight:800;">—</div>
      </div>
      <div class="card" style="border-left:4px solid var(--accent);text-align:center;padding:1.5rem;">
        <div style="color:var(--muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">📊 Toplam</div>
        <div id="cnt-total" style="font-size:3rem;font-weight:800;">—</div>
      </div>
    </div>

    <!-- Ticket List -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <h2 style="font-size:1.5rem;font-weight:800;">🎫 Ticket Geçmişin</h2>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <a href="/tickets/new" class="btn btn-sm">➕ Yeni Ticket</a>
          <a href="/tickets" class="btn btn-ghost btn-sm">Tümünü Gör</a>
        </div>
      </div>
      <div id="ticket-list">
        <div style="color:var(--muted);text-align:center;padding:2rem;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
          Yükleniyor...
        </div>
      </div>
    </div>

    <!-- Activity Chart -->
    <div class="card" style="margin-top:2rem;">
      <h2 style="font-size:1.3rem;font-weight:800;margin-bottom:1.5rem;">📈 Son 7 Günlük Aktivite</h2>
      <div id="activity-chart" style="display:flex;align-items:flex-end;gap:0.5rem;height:80px;padding:0 0.25rem;">
        <div style="color:var(--muted);font-size:0.85rem;align-self:center;">Yükleniyor...</div>
      </div>
      <div id="activity-labels" style="display:flex;gap:0.5rem;margin-top:0.5rem;padding:0 0.25rem;"></div>
    </div>

    <style>
      .ticket-row {
        background:rgba(10,10,15,0.8); border:1px solid rgba(255,255,255,0.05);
        border-radius:12px; padding:1.25rem 1.5rem;
        display:flex; justify-content:space-between; align-items:center;
        transition:border-color 0.25s, transform 0.25s;
        margin-bottom:0.75rem;
      }
      .ticket-row:hover { border-color:var(--accent); transform:translateX(4px); }
      .ticket-row:last-child { margin-bottom:0; }
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0); }
      }
    </style>

    <script>
      function animateNum(id, end) {
        const el = document.getElementById(id);
        if (!el) return;
        let start = 0, duration = 600;
        const step = (ts) => {
          if (!step.t) step.t = ts;
          const p = Math.min((ts - step.t) / duration, 1);
          el.textContent = Math.floor(p * end);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }

      async function loadDashboard() {
        try {
          const res  = await fetch('/api/tickets');
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'API hatası');

          const tickets = data.tickets || [];
          const open   = tickets.filter(t => t.status === 'open').length;
          const closed = tickets.filter(t => t.status !== 'open').length;

          animateNum('cnt-open',   open);
          animateNum('cnt-closed', closed);
          animateNum('cnt-total',  tickets.length);

          const list = document.getElementById('ticket-list');
          if (!tickets.length) {
            list.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);">Henüz hiç destek talebi oluşturmamışsın.</div>';
            return;
          }

          list.innerHTML = tickets.slice(0, 10).map(t => {
            const isOpen = t.status === 'open';
            const ago = t.createdAt ? timeAgo(t.createdAt) : '';
            return \`<div class="ticket-row">
              <div>
                <div style="font-weight:700;margin-bottom:0.3rem;">\${t.ticketId}</div>
                <div style="color:var(--muted);font-size:0.9rem;">\${t.subject || ''} · \${t.category || ''}</div>
                \${ago ? \`<div style="color:var(--muted);font-size:0.78rem;margin-top:0.2rem;">🕐 \${ago}</div>\` : ''}
              </div>
              <span class="badge badge-\${isOpen ? 'open' : 'closed'}">\${isOpen ? 'AÇIK' : 'KAPALI'}</span>
            </div>\`;
          }).join('');

          // Build activity chart from ticket dates
          renderActivityChart(tickets);
        } catch (err) {
          document.getElementById('ticket-list').innerHTML =
            \`<div style="color:var(--danger);padding:1rem;">❌ \${err.message}</div>\`;
        }
      }

      function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'az önce';
        if (m < 60) return m + ' dakika önce';
        const h = Math.floor(m / 60);
        if (h < 24) return h + ' saat önce';
        return Math.floor(h / 24) + ' gün önce';
      }

      function renderActivityChart(tickets) {
        const days = 7;
        const counts = Array(days).fill(0);
        const labels = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          labels.push(d.toLocaleDateString('tr-TR', { weekday: 'short' }));
          tickets.forEach(t => {
            if (!t.createdAt) return;
            const td = new Date(t.createdAt);
            if (td.toDateString() === d.toDateString()) counts[days - 1 - i]++;
          });
        }
        const max = Math.max(...counts, 1);
        const chart = document.getElementById('activity-chart');
        const labelsEl = document.getElementById('activity-labels');
        if (!chart) return;
        chart.innerHTML = counts.map((c, i) => {
          const h = Math.max(8, Math.round((c / max) * 80));
          const isToday = i === days - 1;
          return \`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:0.7rem;color:var(--muted);">\${c || ''}</div>
            <div style="width:100%;height:\${h}px;background:\${isToday ? 'linear-gradient(to top,var(--accent),var(--accent2))' : 'rgba(124,106,247,0.3)'};
                        border-radius:6px 6px 0 0;transition:height 0.6s ease;cursor:default;"
                 title="\${labels[i]}: \${c} ticket"></div>
          </div>\`;
        }).join('');
        if (labelsEl) labelsEl.innerHTML = labels.map(l =>
          \`<div style="flex:1;text-align:center;font-size:0.72rem;color:var(--muted);">\${l}</div>\`
        ).join('');
      }

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

      loadDashboard();
      setInterval(loadDashboard, 15000);
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
      <div style="background:#1a1a2e;border:1px solid var(--border);border-radius:20px;padding:2rem;max-width:480px;width:90%;">
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
        background:rgba(0,0,0,0.3); border:1px solid var(--border);
        border-radius:14px; padding:1.25rem 1.5rem;
        transition:border-color 0.25s, transform 0.25s;
        margin-bottom:0.75rem;
      }
      .ticket-item:hover { border-color:var(--accent); transform:translateX(4px); }
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
               \${hasChannel ? \`<a href="https://discord.com/channels/\${t.guildId || ''}/ \${t.channelId}" target="_blank" class="btn btn-sm btn-ghost">💬 Kanala Git</a>\` : ''}\`
            : \`<button class="btn btn-sm btn-success" onclick="reopenTicket('\${t.ticketId}')">🔓 Tekrar Aç</button>\`;

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
            <tr style="background:rgba(124,106,247,0.1);border-bottom:1px solid var(--border);">
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
  const safeLogs  = Array.isArray(logs) ? logs : [];

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

    <!-- Logs -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--success);">Loglar (${safeLogs.length})</h2>
        <div style="display:flex;gap:0.5rem;">
          <select id="log-filter" style="width:auto;margin-bottom:0;font-size:0.85rem;">
            <option value="">Tümü</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
          </select>
          <button class="btn btn-sm btn-ghost" onclick="renderLogs()">Filtrele</button>
        </div>
      </div>
      <div id="log-output" style="max-height:500px;overflow-y:auto;font-family:monospace;font-size:0.8rem;"></div>
    </div>

    <script>
      const rawLogs = ${JSON.stringify(safeLogs.slice().reverse())};

      function renderLogs() {
        const filter = document.getElementById('log-filter').value;
        const list   = filter ? rawLogs.filter(l => l.type === filter) : rawLogs;
        const colors = { ERROR:'#f87171', WARN:'#fbbf24', INFO:'#60a5fa' };

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

      renderLogs();
    </script>
  `;
  return _layout('Debug', user, content);
}


// ─────────────────────────────────────────────
// PROFILE PAGE  (guns.lol style)
// ─────────────────────────────────────────────
function renderProfilePage(user) {
  const accent = _esc(user.profileColor || '#7c6af7');
  const bannerBg = user.discordBanner
    ? `url(${_esc(user.discordBanner)}) center/cover no-repeat`
    : `linear-gradient(135deg,${accent}cc 0%,#0d0d1a 100%)`;
  const avatarSrc = _esc(user.discordAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png');
  const PLACEHOLDER = '<!-- PROFILE_CONTENT -->';

  const css = `<style>
    main{max-width:100%!important;padding:0!important}
    @keyframes aurora{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    @keyframes fireAni{0%,100%{filter:hue-rotate(0deg) brightness(1)}50%{filter:hue-rotate(25deg) brightness(1.25)}}
    @keyframes galaxy{0%{background-position:0% 0%}100%{background-position:200% 200%}}
    @keyframes neonPulse{0%,100%{box-shadow:0 0 12px ${accent},0 0 24px ${accent}44}50%{box-shadow:0 0 24px #f953c6,0 0 48px #f953c644}}
    @keyframes ocean{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
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
    .p-stat{background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:14px;padding:1rem;text-align:center;transition:border-color .25s,transform .25s}
    .p-stat:hover{border-color:${accent}88;transform:translateY(-3px)}
    .p-stat-val{font-size:1.5rem;font-weight:800}
    .p-stat-lbl{font-size:.72rem;color:var(--muted);margin-top:.2rem;text-transform:uppercase;letter-spacing:.5px}
    .p-coin-bar{display:flex;align-items:center;gap:.75rem;background:rgba(124,106,247,.08);border:1px solid rgba(124,106,247,.25);border-radius:14px;padding:.9rem 1.25rem;margin-bottom:1.5rem}
    .p-coin-icon{font-size:1.6rem;animation:float 3s ease-in-out infinite}
    .p-coin-val{font-size:1.4rem;font-weight:800}
    .p-coin-lbl{font-size:.75rem;color:var(--muted)}
    .p-inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.75rem}
    .p-inv-item{background:rgba(0,0,0,.35);border:1px solid var(--border);border-radius:14px;padding:.9rem .5rem;text-align:center;position:relative;transition:border-color .25s,transform .25s}
    .p-inv-item:hover{border-color:${accent}88;transform:translateY(-3px)}
    .p-inv-item.active{border-color:${accent};background:rgba(124,106,247,.08)}
    .p-inv-active-tag{position:absolute;top:5px;right:5px;font-size:.6rem;font-weight:800;text-transform:uppercase;background:${accent};color:#fff;padding:1px 5px;border-radius:8px}
    .p-inv-icon{font-size:1.8rem;margin-bottom:.35rem}
    .p-inv-name{font-size:.72rem;font-weight:700;line-height:1.2}
    .p-section{margin:2rem 0 1rem;display:flex;align-items:center;gap:.5rem}
    .p-section-title{font-size:.8rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
    .p-section-line{flex:1;height:1px;background:var(--border)}
    @media(max-width:600px){.p-banner{height:180px}.p-avatar{width:90px;height:90px}.p-avatar-wrap{bottom:-40px;left:1.25rem}.p-body{padding:3.5rem 1.25rem 1.5rem}.p-name{font-size:1.5rem}}
  </style>`;

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
            <div class="p-name">${_esc(user.discordUsername)}</div>
            <div class="p-sub">${user.robloxUsername ? `🎮 <span style="color:var(--success);">${_esc(user.robloxUsername)}</span>` : `<span style="color:var(--muted);">Roblox bağlı değil</span>`}</div>
          </div>
          <a href="/settings" class="btn btn-ghost btn-sm" style="flex-shrink:0;">✏️ Düzenle</a>
        </div>
        <div class="p-badges" id="p-badges">
          ${user.isAdmin ? `<span class="p-badge" style="background:rgba(255,107,247,.1);color:var(--accent2);border-color:rgba(255,107,247,.3);">👑 Admin</span>` : ''}
          ${user.isStaff && !user.isAdmin ? `<span class="p-badge" style="background:rgba(124,106,247,.1);color:var(--accent);border-color:rgba(124,106,247,.3);">🛡 Staff</span>` : ''}
        </div>
        <div class="p-bio">${_esc(user.profileBio || 'Henüz bir biyografi eklenmemiş.')}</div>
        <div class="p-coin-bar">
          <div class="p-coin-icon">💰</div>
          <div><div class="p-coin-val" id="p-balance">—</div><div class="p-coin-lbl">Bakiye</div></div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:.85rem;font-weight:700;color:var(--success);" id="p-earned">—</div>
            <div class="p-coin-lbl">Toplam kazanılan</div>
          </div>
          <a href="/shop" class="btn btn-sm" style="margin-left:1rem;flex-shrink:0;">🛒 Mağaza</a>
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
    const BADGE_MAP={badge_supporter:{emoji:'💜',label:'Destekçi',color:'rgba(168,85,247,.15)',border:'rgba(168,85,247,.4)',text:'#c084fc'},badge_veteran:{emoji:'⚔️',label:'Veteran',color:'rgba(251,191,36,.1)',border:'rgba(251,191,36,.4)',text:'#fbbf24'},badge_star:{emoji:'⭐',label:'Yıldız',color:'rgba(251,191,36,.1)',border:'rgba(251,191,36,.3)',text:'#fde68a'},badge_crown:{emoji:'👑',label:'Kral',color:'rgba(255,107,247,.1)',border:'rgba(255,107,247,.4)',text:'var(--accent2)'}};
    async function loadProfile(){
      try{
        const[tr,er]=await Promise.all([fetch('/api/tickets'),fetch('/api/economy/balance')]);
        const[td,ed]=await Promise.all([tr.json().catch(()=>({})),er.json().catch(()=>({}))]);
        const tickets=td.tickets||[];
        document.getElementById('stat-tickets').textContent=tickets.length;
        document.getElementById('stat-closed').textContent=tickets.filter(t=>t.status==='closed').length;
        if(ed.success){
          document.getElementById('p-balance').textContent=(ed.balance||0).toLocaleString('tr-TR')+' coin';
          document.getElementById('p-earned').textContent='+'+(ed.totalEarned||0).toLocaleString('tr-TR')+' coin';
          document.getElementById('stat-items').textContent=(ed.inventory||[]).length;
          document.getElementById('stat-spent').textContent=(ed.totalSpent||0).toLocaleString('tr-TR');
          const br=document.getElementById('p-badges');
          (ed.profileBadges||[]).forEach(bid=>{const b=BADGE_MAP[bid];if(!b)return;const s=document.createElement('span');s.className='p-badge';s.style.cssText='background:'+b.color+';color:'+b.text+';border-color:'+b.border+';';s.textContent=b.emoji+' '+b.label;br.appendChild(s);});
          const root=document.getElementById('p-root');
          if(ed.profileEffect)root.classList.add('eff-'+ed.profileEffect.replace('effect_',''));
          if(ed.profileFrame)root.classList.add('frm-'+ed.profileFrame.replace('frame_',''));
          const inv=ed.inventory||[];
          const grid=document.getElementById('p-inv');
          if(!inv.length){grid.innerHTML='<div style="grid-column:1/-1;color:var(--muted);font-size:.85rem;">Henüz hiçbir şey satın almadınız. <a href=\\"/shop\\" style=\\"color:var(--accent)\\">Mağazaya git →</a></div>';}
          else{grid.innerHTML=inv.map(item=>{const isActive=ed.profileEffect===item.itemId||ed.profileFrame===item.itemId;const canEquip=item.type==='effect'||item.type==='frame';return '<div class="p-inv-item'+(isActive?' active':'')+'">'+( isActive?'<div class="p-inv-active-tag">Aktif</div>':'')+' <div class="p-inv-icon">'+item.icon+'</div><div class="p-inv-name">'+item.name+'</div>'+(canEquip&&!isActive?'<button onclick="equipItem(\\''+item.itemId+'\\')" style="margin-top:.4rem;background:rgba(124,106,247,.2);border:1px solid rgba(124,106,247,.4);color:var(--accent);border-radius:8px;padding:2px 10px;font-size:.7rem;cursor:pointer;font-family:inherit;font-weight:700;">Tak</button>':'')+'</div>';}).join('');}
        }
      }catch(err){console.warn('Profil yüklenemedi:',err.message);}
    }
    async function equipItem(itemId){const res=await fetch('/api/profile/equip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemId})});const d=await res.json().catch(()=>({}));if(res.ok){showToast(d.message||'Aktif edildi!','success');setTimeout(()=>location.reload(),700);}else showToast(d.error||'Hata','error');}
    loadProfile();
  <\/script>`;

  const content = css + html + script;
  return _layout('Profil', user, content);
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

        <hr class="divider">

        <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:1rem;">🔗 Bağlı Hesaplar</h2>
        <div style="background:rgba(0,0,0,0.3);padding:1rem 1.25rem;border-radius:12px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
          <div>
            <div style="font-weight:700;margin-bottom:0.2rem;">Discord</div>
            <div style="color:var(--success);font-size:0.85rem;">✅ ${_esc(user.discordUsername)}</div>
          </div>
        </div>
        <div style="background:rgba(0,0,0,0.3);padding:1rem 1.25rem;border-radius:12px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;">
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
              profileBio: bioEl.value
            })
          });
          if (res.ok) {
            showToast('Ayarlar başarıyla kaydedildi!', 'success');
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
function renderLegalPage(title, text) {
  const content = `
    <div class="card">
      <h1 style="font-size:2rem;font-weight:800;color:var(--accent);margin-bottom:2rem;">${_esc(title)}</h1>
      <div style="line-height:1.9;color:var(--muted);">${text}</div>
      <hr class="divider">
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
        <a href="/legal/tos"     style="color:var(--accent);text-decoration:none;font-weight:600;">Hizmet Koşulları</a>
        <a href="/legal/privacy" style="color:var(--accent);text-decoration:none;font-weight:600;">Gizlilik Politikası</a>
        <a href="/"              style="color:var(--muted); text-decoration:none;">Ana Sayfa</a>
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
    const ts = a.createdAt ? `<t:${Math.floor(new Date(a.createdAt).getTime()/1000)}:d>` : '';
    return `
      <a href="/wiki/${_esc(a._id)}" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;
              background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:16px;overflow:hidden;
              transition:transform 0.25s,border-color 0.25s,box-shadow 0.25s;"
         onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='var(--accent)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.5)'"
         onmouseout="this.style.transform='none';this.style.borderColor='var(--border)';this.style.boxShadow='none'">
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
  const createdTs = article.createdAt
    ? `<time title="${new Date(article.createdAt).toLocaleString('tr-TR')}">${new Date(article.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' })}</time>`
    : '';
  const editedLine = article.editedByName && article.editedAt
    ? `<span style="color:var(--muted);font-size:0.8rem;margin-left:0.75rem;">
         • Düzenleyen: <b>${_esc(article.editedByName)}</b>
         <time title="${new Date(article.editedAt).toLocaleString('tr-TR')}">${new Date(article.editedAt).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' })}</time>
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
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;">${_esc((c.username||'?')[0].toUpperCase())}</div>`;
    const cTime = c.createdAt
      ? `<span style="font-size:0.75rem;color:var(--muted);">${new Date(c.createdAt).toLocaleString('tr-TR')}</span>`
      : '';
    return `
      <div id="comment-${_esc(c._id)}" style="display:flex;gap:0.75rem;padding:1rem;background:rgba(0,0,0,0.25);border-radius:14px;border:1px solid var(--border);">
        ${cAvatar}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;flex-wrap:wrap;">
            <span style="font-weight:700;color:var(--accent);">${_esc(c.username || '—')}</span>
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
            <span style="color:var(--text);font-weight:600;">${_esc(article.authorName || '—')}</span>
            <span>Geliştirici</span>
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
    <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border);">
      <button class="adm-tab adm-tab-active" onclick="admTab('users',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid var(--accent);color:var(--text);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        👥 Kullanıcılar
      </button>
      <button class="adm-tab" onclick="admTab('roles',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        🎖 Rütbeler
      </button>
      <button class="adm-tab" onclick="admTab('coins',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        💰 Para Ver
      </button>
      <button class="adm-tab" onclick="admTab('bans',this)"
        style="padding:.75rem 1.5rem;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
        🚫 Banlar
      </button>
    </div>

    <!-- Kullanıcı yönetimi -->
    <div id="adm-users" class="card">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">⚙️ Admin Paneli</h1>
      <p class="text-muted mb-3">Kullanıcı yetkileri ve ban yönetimi.</p>
      <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;">
        <input type="text" id="admin-search" placeholder="Discord adı veya ID" style="flex:1;">
        <button type="button" class="btn" onclick="adminSearchUsers()">Ara</button>
      </div>
      <div id="admin-results"></div>
      <hr class="divider" style="margin-top:2rem;">
      <a href="/debug" style="color:var(--accent);">🔍 Debug sayfası</a>
    </div>

    <!-- Rütbe yönetimi -->
    <div id="adm-roles" class="card" style="display:none;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:.5rem;">🎖 Rütbe Yönetimi</h1>
      <p class="text-muted mb-3">Kullanıcılara özel rütbeler atayın. Birden fazla rütbe seçilebilir.</p>
      <div style="display:flex;gap:.75rem;margin-bottom:1.5rem;flex-wrap:wrap;">
        <input type="text" id="role-search" placeholder="Discord adı veya ID ara..." style="flex:1;min-width:200px;margin-bottom:0;">
        <button class="btn" onclick="roleSearchUsers()">🔍 Ara</button>
      </div>

      <!-- Rütbe açıklamaları -->
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem;">
        <div style="font-size:.8rem;color:var(--muted);width:100%;margin-bottom:.25rem;font-weight:700;">Mevcut Rütbeler:</div>
        <span style="background:rgba(124,106,247,.15);color:#7c6af7;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">📝 Wiki Editörü</span>
        <span style="background:rgba(74,222,128,.15);color:#4ade80;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">🛡️ Moderatör</span>
        <span style="background:rgba(251,191,36,.15);color:#fbbf24;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">⭐ Destek Lideri</span>
        <span style="background:rgba(255,107,247,.15);color:#ff6bf7;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">🎬 İçerik Yaratıcısı</span>
        <span style="background:rgba(6,182,212,.15);color:#06b6d4;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">🌐 Çevirmen</span>
        <span style="background:rgba(249,115,22,.15);color:#f97316;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">🎉 Etkinlik Yöneticisi</span>
        <span style="background:rgba(163,230,53,.15);color:#a3e635;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">🤝 Topluluk Yardımcısı</span>
        <span style="background:rgba(232,121,249,.15);color:#e879f9;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">📸 Medya Ekibi</span>
        <span style="background:rgba(56,189,248,.15);color:#38bdf8;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">💻 Geliştirici</span>
        <span style="background:rgba(250,204,21,.15);color:#facc15;padding:.25rem .75rem;border-radius:20px;font-size:.8rem;font-weight:700;">👑 VIP</span>
      </div>

      <div id="role-results"></div>
    </div>

    <!-- Coin yönetimi -->
    <div id="adm-coins" class="card" style="display:none;">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:.5rem;">💰 Coin Yönetimi</h1>
      <p class="text-muted mb-3">Kullanıcılara coin verin. Maksimum tek seferde 1.000.000 coin.</p>

      <div style="background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.2);border-radius:16px;padding:1.5rem;margin-bottom:2rem;">
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
      <div style="background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.2);border-radius:16px;padding:1.5rem;margin-bottom:2rem;">
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

    <script>
      // ── Sekme geçişi ──────────────────────────────────────────────────────
      function admTab(name, btn) {
        document.getElementById('adm-users').style.display  = name === 'users'  ? '' : 'none';
        document.getElementById('adm-roles').style.display  = name === 'roles'  ? '' : 'none';
        document.getElementById('adm-coins').style.display  = name === 'coins'  ? '' : 'none';
        document.getElementById('adm-bans').style.display   = name === 'bans'   ? '' : 'none';
        document.querySelectorAll('.adm-tab').forEach(t => {
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'var(--muted)';
        });
        btn.style.borderBottomColor = 'var(--accent)';
        btn.style.color = 'var(--text)';
        if (name === 'bans') loadBans();
        if (name === 'roles') roleSearchUsers();
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
              ? '<button type="button" class="btn btn-sm btn-success" onclick="quickUnban(\\''+adminEsc(u.discordId)+'\\')">✅ Banı Kaldır</button>'
              : '<button type="button" class="btn btn-sm btn-danger" onclick="quickBan(\\''+adminEsc(u.discordId)+'\\',\\''+adminEsc(u.discordUsername)+'\\')">🚫 Yasakla</button>';
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
        admTab('bans', document.querySelectorAll('.adm-tab')[3]);
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
        const siteBan    = document.getElementById('ban-site').checked;

        if (!idOrName) { showToast('Discord ID veya kullanıcı adı girin.', 'warning'); return; }
        if (!discordBan && !siteBan) { showToast('En az bir ban türü seçin.', 'warning'); return; }

        // Önce kullanıcıyı ara
        const sr = await fetch('/api/admin/users?q=' + encodeURIComponent(idOrName));
        const sd = await sr.json().catch(() => ({}));
        const found = (sd.users || []).find(u => u.discordId === idOrName || u.discordUsername?.toLowerCase() === idOrName.toLowerCase());

        if (!found) { showToast('Kullanıcı bulunamadı. Lütfen Discord ID girin.', 'error'); return; }

        if (!confirm(found.discordUsername + ' kullanıcısını yasaklamak istiyor musun?')) return;

        const res = await fetch('/api/admin/users/' + encodeURIComponent(found.discordId) + '/ban', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, discordBan, siteBan })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(d.message || 'Yasaklandı.', 'success');
          if (d.discordResult) showToast(d.discordResult, 'info');
          document.getElementById('ban-id').value = '';
          document.getElementById('ban-reason').value = '';
          loadBans();
        } else showToast(d.error || 'Hata', 'error');
      }

      async function loadBans() {
        const box = document.getElementById('ban-list');
        box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:2rem;">Yükleniyor...</div>';
        try {
          const res = await fetch('/api/admin/bans');
          const d = await res.json().catch(() => ({}));
          const bans = d.bans || [];
          if (!bans.length) {
            box.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">Aktif ban yok.</div>';
            return;
          }
          box.innerHTML = bans.map(b => {
            const ts = b.bannedAt ? new Date(b.bannedAt).toLocaleString('tr-TR') : '—';
            return \`<div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.2);border-radius:14px;margin-bottom:.75rem;flex-wrap:wrap;">
              \${b.discordAvatar ? \`<img src="\${b.discordAvatar}" style="width:42px;height:42px;border-radius:50%;flex-shrink:0;">\` : ''}
              <div style="flex:1;min-width:0;">
                <div style="font-weight:800;">\${b.discordUsername || '—'}</div>
                <div style="font-size:.78rem;color:var(--muted);">ID: \${b.discordId} • \${ts}</div>
                \${b.banReason ? \`<div style="font-size:.82rem;color:var(--danger);margin-top:.2rem;">Sebep: \${b.banReason}</div>\` : ''}
              </div>
              <div style="display:flex;gap:.5rem;flex-shrink:0;">
                <button class="btn btn-sm btn-success" onclick="unbanUser('\${b.discordId}', true)">✅ Kaldır + Discord</button>
                <button class="btn btn-sm btn-ghost" onclick="unbanUser('\${b.discordId}', false)">🔓 Sadece Site</button>
              </div>
            </div>\`;
          }).join('');
        } catch (err) {
          box.innerHTML = '<div style="color:var(--danger);padding:1rem;">❌ ' + err.message + '</div>';
        }
      }

      async function unbanUser(id, discordUnban) {
        if (!confirm('Bu kullanıcının banını kaldırmak istiyor musun?')) return;
        const res = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/unban', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordUnban })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(d.message || 'Ban kaldırıldı.', 'success');
          if (d.discordResult) showToast(d.discordResult, 'info');
          loadBans();
        } else showToast(d.error || 'Hata', 'error');
      }

      // ── Rütbe yönetimi ────────────────────────────────────────────────────
      const ROLE_DEFS = {
        wiki_editor:      { name: '📝 Wiki Editörü',        color: '#7c6af7' },
        moderator:        { name: '🛡️ Moderatör',            color: '#4ade80' },
        support_lead:     { name: '⭐ Destek Lideri',        color: '#fbbf24' },
        content_creator:  { name: '🎬 İçerik Yaratıcısı',   color: '#ff6bf7' },
        translator:       { name: '🌐 Çevirmen',             color: '#06b6d4' },
        event_manager:    { name: '🎉 Etkinlik Yöneticisi',  color: '#f97316' },
        community_helper: { name: '🤝 Topluluk Yardımcısı', color: '#a3e635' },
        media_team:       { name: '📸 Medya Ekibi',          color: '#e879f9' },
        developer:        { name: '💻 Geliştirici',          color: '#38bdf8' },
        vip:              { name: '👑 VIP',                  color: '#facc15' },
      };

      async function roleSearchUsers() {
        const q = (document.getElementById('role-search')?.value || '').trim();
        const box = document.getElementById('role-results');
        if (!box) return;
        box.innerHTML = '<p style="color:var(--muted);">Aranıyor...</p>';
        try {
          const res = await fetch('/api/admin/users?q=' + encodeURIComponent(q));
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { box.innerHTML = '<p style="color:var(--danger);">' + adminEsc(d.error || 'Hata') + '</p>'; return; }
          if (!d.users || !d.users.length) { box.innerHTML = '<p style="color:var(--muted);">Kullanıcı bulunamadı.</p>'; return; }

          box.innerHTML = d.users.map(function(u) {
            const userRoles = u.roles || [];
            const checkboxes = Object.entries(ROLE_DEFS).map(([rid, rdef]) => {
              const checked = userRoles.includes(rid) ? 'checked' : '';
              return \`<label style="display:inline-flex;align-items:center;gap:.35rem;margin:.25rem .5rem .25rem 0;cursor:pointer;font-size:.85rem;padding:.3rem .6rem;background:rgba(0,0,0,.2);border-radius:8px;border:1px solid var(--border);">
                <input type="checkbox" class="role-cb" data-role="\${rid}" \${checked} style="width:auto;margin:0;">
                <span style="color:\${rdef.color};">\${rdef.name}</span>
              </label>\`;
            }).join('');

            const currentBadges = userRoles.length
              ? userRoles.map(r => ROLE_DEFS[r] ? \`<span style="background:rgba(0,0,0,.3);color:\${ROLE_DEFS[r].color};padding:.2rem .6rem;border-radius:12px;font-size:.75rem;font-weight:700;">\${ROLE_DEFS[r].name}</span>\` : '').join(' ')
              : '<span style="color:var(--muted);font-size:.8rem;">Rütbe yok</span>';

            return \`<div class="role-user-row" data-discord-id="\${adminEsc(u.discordId)}" style="background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1rem;">
              <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;flex-wrap:wrap;">
                \${u.discordAvatar ? \`<img src="\${adminEsc(u.discordAvatar)}" style="width:36px;height:36px;border-radius:50%;">\` : ''}
                <div>
                  <div style="font-weight:800;">\${adminEsc(u.discordUsername)}</div>
                  <div style="font-size:.78rem;color:var(--muted);">ID: \${adminEsc(u.discordId)}</div>
                </div>
                <div style="margin-left:auto;display:flex;gap:.35rem;flex-wrap:wrap;">\${currentBadges}</div>
              </div>
              <div style="margin-bottom:1rem;">\${checkboxes}</div>
              <button class="btn btn-sm" onclick="roleSaveRoles(this)">💾 Rütbeleri Kaydet</button>
            </div>\`;
          }).join('');
        } catch (err) {
          box.innerHTML = '<p style="color:var(--danger);">Bağlantı hatası.</p>';
        }
      }

      async function roleSaveRoles(btn) {
        const row = btn.closest('.role-user-row');
        const id = row.getAttribute('data-discord-id');
        const roles = Array.from(row.querySelectorAll('.role-cb:checked')).map(cb => cb.getAttribute('data-role'));
        btn.disabled = true;
        btn.textContent = 'Kaydediliyor...';
        const res = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/site-roles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles })
        });
        const d = await res.json().catch(() => ({}));
        btn.disabled = false;
        btn.textContent = '💾 Rütbeleri Kaydet';
        if (res.ok) showToast(d.message || 'Rütbeler kaydedildi.', 'success');
        else showToast(d.error || 'Kaydedilemedi', 'error');
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

    <\/script>
  `;
  return _layout('Admin', user, content, '', '/admin');
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
                      background:rgba(0,0,0,0.3);padding:1rem 1.5rem;border-radius:16px;
                      border:1px solid ${borderColor};transition:transform 0.2s;"
               onmouseover="this.style.transform='translateX(4px)'"
               onmouseout="this.style.transform='none'">
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
          <div style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:20px;
                      padding:2rem;text-align:center;transition:transform 0.3s,border-color 0.3s,box-shadow 0.3s;cursor:pointer;display:flex;flex-direction:column;align-items:center;"
               onmouseover="this.style.transform='translateY(-6px)';this.style.borderColor='var(--accent)';this.style.boxShadow='0 15px 30px rgba(0,0,0,0.5)'"
               onmouseout="this.style.transform='none';this.style.borderColor='var(--border)';this.style.boxShadow='none'">
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
    :root { --accent:#7c6af7; --accent2:#ff6bf7; --bg:#050508; --muted:#a0a0c0; }
    body {
      background:radial-gradient(circle at center,#1a1a2e 0%,var(--bg) 100%);
      color:#fff; font-family:'Outfit',sans-serif;
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      text-align:center; padding:2rem;
    }
    .code {
      font-size:8rem; font-weight:800; line-height:1;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      margin-bottom:1rem;
    }
    h1 { font-size:1.5rem; margin-bottom:1rem; }
    p  { color:var(--muted); margin-bottom:2rem; }
    a  {
      display:inline-block; padding:0.8rem 2rem;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
      color:white; border-radius:30px; text-decoration:none; font-weight:700;
      transition:transform 0.2s, box-shadow 0.2s;
      box-shadow:0 4px 15px rgba(124,106,247,0.35);
    }
    a:hover { transform:translateY(-3px); box-shadow:0 8px 25px rgba(124,106,247,0.55); }
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
          ${cats.map(c => `<option value="${_esc(c)}">${_esc(c)}</option>`).join('')}
        </select>

        <label>Konu <span style="color:var(--danger);">*</span></label>
        <input type="text" id="tc-subject" placeholder="Kısa bir konu başlığı girin" maxlength="100">

        <label>Açıklama <span style="color:var(--danger);">*</span></label>
        <textarea id="tc-desc" rows="6" placeholder="Sorununuzu veya talebinizi ayrıntılı olarak anlatın..." maxlength="2000"></textarea>
        <div style="text-align:right;color:var(--muted);font-size:0.8rem;margin-top:-1rem;margin-bottom:1rem;">
          <span id="tc-count">0</span>/2000
        </div>

        <label>Öncelik</label>
        <select id="tc-priority">
          <option value="normal">Normal</option>
          <option value="high">Yüksek</option>
          <option value="low">Düşük</option>
        </select>

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

      async function submitTicket() {
        const cat      = document.getElementById('tc-category').value;
        const subject  = document.getElementById('tc-subject').value.trim();
        const desc     = descEl.value.trim();
        const priority = document.getElementById('tc-priority').value;
        const errEl    = document.getElementById('tc-error');
        const btn      = document.getElementById('tc-submit');

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
    const icons = { ticket:'🎫', system:'⚙️', staff:'👨‍💼', mention:'💬', warning:'⚠️' };
    const icon = icons[n.type] || '🔔';
    const isRead = n.read;
    return `
      <div style="display:flex;gap:1rem;align-items:flex-start;padding:1.25rem;
                  border-radius:14px;border:1px solid ${isRead ? 'var(--border)' : 'rgba(124,106,247,0.35)'};
                  background:${isRead ? 'rgba(0,0,0,0.2)' : 'rgba(124,106,247,0.06)'};
                  margin-bottom:0.75rem;transition:border-color 0.25s;"
           onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='${isRead ? 'var(--border)' : 'rgba(124,106,247,0.35)'}'">
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
  renderLeaderboardPage,
  renderShopPage,
  renderErrorPage,
  // Internal helpers (exported for testing)
  _esc,
  _layout,
};