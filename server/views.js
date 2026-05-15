'use strict';

// ─────────────────────────────────────────────
// SHARED LAYOUT HELPER  (declared ONCE at top)
// ─────────────────────────────────────────────
function _layout(title, user, content, extraHead = '', activePath = '') {
  const staffLinks = user && (user.isStaff || user.isAdmin)
    ? `<a href="/staff" class="nav-link staff-link${activePath === '/staff' ? ' nav-active' : ''}">👨‍💼 Staff</a>`
    : '';
  const adminLink = user && user.isAdmin
    ? `<a href="/debug" class="nav-link debug-link${activePath === '/debug' ? ' nav-active' : ''}">🔍 Debug</a>`
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
  const isRobloxLinked = user.robloxUsername &&
    !['Yetkilendirmedi', 'RobloxUser', ''].includes(user.robloxUsername);

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
      ${!isRobloxLinked ? `<a href="/auth/roblox" class="btn btn-sm">Roblox'u Bağla</a>` : ''}
    </div>

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

    <style>
      .ticket-item {
        background:rgba(0,0,0,0.3); border:1px solid var(--border);
        border-radius:14px; padding:1.25rem 1.5rem;
        display:flex; justify-content:space-between; align-items:center;
        transition:border-color 0.25s, transform 0.25s;
        margin-bottom:0.75rem; flex-wrap:wrap; gap:1rem;
        cursor:default;
      }
      .ticket-item:hover { border-color:var(--accent); transform:translateX(4px); }
      .ticket-item:last-child { margin-bottom:0; }
    </style>

    <script>
      let allTickets = [];

      async function loadTickets() {
        try {
          const res  = await fetch('/api/tickets');
          const data = await res.json();
          if (!data.success) throw new Error(data.error);
          allTickets = data.tickets || [];

          // Populate category filter
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
        return Math.floor(h / 24) + 'g önce';
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
          return \`<div class="ticket-item">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;flex-wrap:wrap;">
                <span style="font-weight:700;color:var(--accent);">\${t.ticketId}</span>
                \${t.category ? \`<span style="font-size:0.75rem;background:rgba(124,106,247,0.1);border:1px solid rgba(124,106,247,0.2);padding:0.1rem 0.5rem;border-radius:20px;color:var(--muted);">\${t.category}</span>\` : ''}
              </div>
              <div style="margin-bottom:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${t.subject || 'Konu belirtilmedi'}</div>
              \${ago ? \`<div style="color:var(--muted);font-size:0.78rem;">🕐 \${ago}</div>\` : ''}
            </div>
            <span class="badge badge-\${isOpen ? 'open' : 'closed'}">\${isOpen ? 'AÇIK' : 'KAPALI'}</span>
          </div>\`;
        }).join('');
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
    <div class="card">
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

    <script>
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
// PROFILE PAGE
// ─────────────────────────────────────────────
function renderProfilePage(user) {
  const banner = user.discordBanner
    ? `url(${_esc(user.discordBanner)})`
    : `linear-gradient(135deg, ${_esc(user.profileColor || '#7c6af7')}, #1a1a2e)`;

  const content = `
    <!-- Banner -->
    <div style="background:${banner};background-size:cover;background-position:center;
                height:220px;border-radius:20px 20px 0 0;position:relative;
                border:1px solid var(--border);border-bottom:none;">
      <img src="${_esc(user.discordAvatar)}" alt="Avatar"
           style="width:110px;height:110px;border-radius:50%;border:4px solid var(--bg);
                  position:absolute;bottom:-55px;left:2rem;
                  box-shadow:0 4px 20px rgba(0,0,0,0.6);">
    </div>

    <!-- Info Card -->
    <div class="card" style="border-radius:0 0 20px 20px;padding-top:4rem;border-top:none;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">
        <div>
          <h1 style="font-size:2.2rem;font-weight:800;margin-bottom:0.3rem;">${_esc(user.discordUsername)}</h1>
          <div style="color:var(--muted);font-size:0.9rem;">
            Roblox: <span style="color:${user.robloxUsername ? 'var(--success)' : 'var(--muted)'};">${_esc(user.robloxUsername || 'Bağlı değil')}</span>
          </div>
          <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${user.isAdmin ? '<span class="badge badge-admin">👑 Admin</span>' : ''}
            ${user.isStaff && !user.isAdmin ? '<span class="badge" style="background:rgba(124,106,247,0.12);color:var(--accent);border:1px solid rgba(124,106,247,0.3);">🛡 Staff</span>' : ''}
          </div>
        </div>
        <a href="/settings" class="btn btn-ghost btn-sm">✏️ Düzenle</a>
      </div>

      <hr class="divider">

      <!-- Bio -->
      <div style="background:rgba(0,0,0,0.3);padding:1.5rem;border-radius:15px;border:1px solid var(--border);">
        <h3 style="margin-bottom:0.75rem;color:var(--accent);font-size:1rem;">📝 Hakkımda</h3>
        <p style="line-height:1.7;white-space:pre-wrap;color:${user.profileBio ? 'var(--text)' : 'var(--muted)'};">
          ${_esc(user.profileBio || 'Henüz bir biyografi eklenmemiş.')}
        </p>
      </div>
    </div>
  `;
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
function renderWikiPage(user, comments = []) {
  const commentsHtml = comments.map(c => `
    <div style="background:rgba(0,0,0,0.3);padding:1.5rem;border-radius:15px;
                border:1px solid var(--border);margin-bottom:1rem;
                display:flex;gap:1rem;align-items:flex-start;">
      <img src="${_esc(c.avatar)}" alt="" style="width:48px;height:48px;border-radius:50%;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:0.3rem;">${_esc(c.username)}</div>
        <div style="line-height:1.6;word-break:break-word;white-space:pre-wrap;">${_esc(c.content)}</div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:0.5rem;">${new Date(c.createdAt).toLocaleString('tr-TR')}</div>
      </div>
    </div>
  `).join('');

  const formHtml = user ? `
    <div id="wiki-form">
      <label>Paylaşımın</label>
      <textarea id="wiki-content" rows="4" placeholder="Wiki'ye katkıda bulun..." maxlength="2000" required></textarea>
      <div style="text-align:right;color:var(--muted);font-size:0.8rem;margin-top:-1rem;margin-bottom:1rem;">
        <span id="wc-count">0</span>/2000
      </div>
      <button class="btn" id="wiki-btn" onclick="postWiki()">📨 Gönder</button>
    </div>
  ` : `<div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);padding:1rem;border-radius:10px;color:var(--danger);">
    Yorum yapmak için <a href="/login" style="color:var(--accent);">giriş yapmalısınız</a>.
  </div>`;

  const script = user ? `
    <script>
      const wcEl  = document.getElementById('wiki-content');
      const cntEl = document.getElementById('wc-count');
      if (wcEl) wcEl.addEventListener('input', () => { cntEl.textContent = wcEl.value.length; });

      async function postWiki() {
        const btn     = document.getElementById('wiki-btn');
        const content = wcEl ? wcEl.value.trim() : '';
        if (!content) { showToast('Boş paylaşım gönderilemez.', 'error'); return; }
        btn.textContent = 'Gönderiliyor...';
        btn.disabled = true;
        try {
          const res = await fetch('/api/wiki', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
          if (res.ok) {
            showToast('Paylaşım gönderildi!', 'success');
            setTimeout(() => window.location.reload(), 800);
          } else {
            const d = await res.json().catch(() => ({}));
            showToast(d.error || 'Bir hata oluştu.', 'error');
            btn.textContent = '📨 Gönder';
            btn.disabled = false;
          }
        } catch {
          showToast('Bağlantı hatası.', 'error');
          btn.textContent = '📨 Gönder';
          btn.disabled = false;
        }
      }
    <\/script>
  ` : '';

  const content = `
    <div class="card">
      <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">📖 Topluluk Wiki</h1>
      <p class="text-muted mb-3">Sentara platformu hakkında topluluk tartışmaları ve rehberler.</p>

      <hr class="divider">
      <h3 style="margin-bottom:1rem;">💬 Bir şeyler paylaş</h3>
      ${formHtml}

      <hr class="divider">
      <h3 style="margin-bottom:1.5rem;">Paylaşımlar (${comments.length})</h3>
      ${comments.length > 0 ? commentsHtml : '<div style="text-align:center;padding:2rem;color:var(--muted);">Henüz paylaşım yok. İlk paylaşan sen ol!</div>'}
    </div>
    ${script}
  `;
  return _layout('Wiki', user, content);
}


// ─────────────────────────────────────────────
// LEADERBOARD PAGE
// ─────────────────────────────────────────────
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
            showToast('Ticket oluşturuldu! 🎉', 'success');
            setTimeout(() => window.location.href = '/tickets', 1000);
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
  renderWikiPage,
  renderLeaderboardPage,
  renderShopPage,
  renderErrorPage,
  // Internal helpers (exported for testing)
  _esc,
  _layout,
};