function renderMainPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentara - Premium Destek Sistemi</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050508;
      --surface: rgba(20, 20, 30, 0.6);
      --border: rgba(124, 106, 247, 0.2);
      --accent: #7c6af7;
      --accent2: #ff6bf7;
      --text: #ffffff;
      --muted: #a0a0c0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      scroll-behavior: smooth;
    }

    body {
      background: radial-gradient(circle at top right, #1a1a2e 0%, var(--bg) 60%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Glow Elements */
    .glow {
      position: absolute;
      width: 400px;
      height: 400px;
      background: var(--accent);
      filter: blur(150px);
      border-radius: 50%;
      opacity: 0.15;
      z-index: -1;
      animation: float 10s infinite ease-in-out alternate;
    }
    .glow.top-right { top: -100px; right: -100px; background: var(--accent2); }
    .glow.bottom-left { bottom: -100px; left: -100px; }

    @keyframes float {
      0% { transform: translateY(0) scale(1); }
      100% { transform: translateY(30px) scale(1.1); }
    }

    header {
      padding: 1.5rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(10, 10, 15, 0.4);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -1px;
    }

    nav {
      display: flex;
      gap: 2rem;
      align-items: center;
    }

    nav a {
      color: var(--text);
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s;
      position: relative;
    }

    nav a::after {
      content: '';
      position: absolute;
      width: 0;
      height: 2px;
      bottom: -4px;
      left: 0;
      background: var(--accent);
      transition: width 0.3s ease;
    }

    nav a:hover::after {
      width: 100%;
    }

    .btn {
      padding: 0.8rem 2rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white;
      border: none;
      border-radius: 30px;
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 4px 15px rgba(124, 106, 247, 0.3);
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: all 0.5s;
    }
    .btn:hover::before { left: 100%; }

    .btn:hover {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 10px 25px rgba(124, 106, 247, 0.5);
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 6rem 2rem;
      text-align: center;
    }

    h1 {
      font-size: 4.5rem;
      line-height: 1.1;
      margin-bottom: 1.5rem;
      font-weight: 800;
      animation: fadeUp 1s ease forwards;
      opacity: 0;
      transform: translateY(20px);
    }

    .grad {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--muted);
      font-size: 1.3rem;
      margin: 0 auto 3.5rem auto;
      max-width: 700px;
      animation: fadeUp 1s ease 0.2s forwards;
      opacity: 0;
      transform: translateY(20px);
    }

    @keyframes fadeUp {
      to { opacity: 1; transform: translateY(0); }
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 2rem;
      margin-top: 5rem;
    }

    .feature {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2.5rem;
      backdrop-filter: blur(10px);
      transition: all 0.4s ease;
      text-align: left;
      opacity: 0;
      transform: translateY(20px);
      animation: fadeUp 1s ease 0.4s forwards;
    }

    .feature:hover {
      border-color: var(--accent2);
      transform: translateY(-10px);
      box-shadow: 0 15px 30px rgba(0,0,0,0.5), 0 0 20px rgba(124, 106, 247, 0.2);
    }

    .feature-icon {
      font-size: 3rem;
      margin-bottom: 1.5rem;
      display: inline-block;
      background: rgba(124, 106, 247, 0.1);
      padding: 1rem;
      border-radius: 15px;
    }

    .feature h3 {
      font-size: 1.4rem;
      margin-bottom: 1rem;
      font-weight: 800;
    }

    .feature p {
      color: var(--muted);
      line-height: 1.7;
    }

    footer {
      padding: 3rem;
      text-align: center;
      color: var(--muted);
      border-top: 1px solid var(--border);
      margin-top: 5rem;
      background: rgba(5,5,8,0.8);
    }

    @media (max-width: 768px) {
      header {
        padding: 1rem;
        flex-direction: column;
        gap: 1rem;
      }
      h1 { font-size: 2.8rem; }
      .feature { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="glow top-right"></div>
  <div class="glow bottom-left"></div>

  <header>
    <div class="logo">sentara</div>
    <nav>
      <a href="#features">Özellikler</a>
      <a href="/login" class="btn">Giriş Yap</a>
    </nav>
  </header>

  <main>
    <h1>Discord'da <br><span class="grad">Yeni Nesil Destek</span></h1>
    <p class="subtitle">Sentara ile sunucunuzdaki destek deneyimini tamamen değiştirin. Roblox entegrasyonu, premium tasarım ve kusursuz hız bir arada.</p>
    
    <a href="/login" class="btn" style="font-size: 1.2rem; padding: 1rem 3rem;">Hemen Başla</a>

    <div id="features" class="features">
      <div class="feature" style="animation-delay: 0.3s">
        <div class="feature-icon">🎮</div>
        <h3>Roblox Entegrasyonu</h3>
        <p>Kullanıcıların Roblox hesaplarını Discord ile eşleştirin. Destek taleplerinde güvenilir kullanıcı doğrulama sağlayın.</p>
      </div>

      <div class="feature" style="animation-delay: 0.4s">
        <div class="feature-icon">⚡</div>
        <h3>Işık Hızında Paneller</h3>
        <p>Premium web paneli sayesinde oyun içi veya Discord içi tüm destek işlemlerinizi saniyeler içinde yönetin.</p>
      </div>

      <div class="feature" style="animation-delay: 0.5s">
        <div class="feature-icon">🎨</div>
        <h3>Cam (Glass) Tasarım</h3>
        <p>Modern, şık ve göz yormayan arayüz tasarımı ile hem takımınız hem de üyeleriniz için harika bir deneyim.</p>
      </div>
    </div>
  </main>

  <footer>
    <div class="logo" style="font-size: 1.5rem; margin-bottom: 1rem;">sentara</div>
    © 2026 Sentara Premium Support. Tüm hakları saklıdır.
  </footer>
</body>
</html>`;
}

function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Giriş Yap - Sentara Premium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050508;
      --surface: rgba(20, 20, 30, 0.6);
      --border: rgba(124, 106, 247, 0.2);
      --accent: #7c6af7;
      --accent2: #ff6bf7;
      --text: #ffffff;
      --muted: #a0a0c0;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: radial-gradient(circle at center, #1a1a2e 0%, var(--bg) 100%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .glow {
      position: absolute;
      width: 500px;
      height: 500px;
      background: var(--accent);
      filter: blur(200px);
      border-radius: 50%;
      opacity: 0.15;
      animation: pulse 8s infinite alternate;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.1; }
      100% { transform: scale(1.2); opacity: 0.25; }
    }

    .container {
      width: 100%;
      max-width: 420px;
      padding: 2rem;
      position: relative;
      z-index: 10;
    }

    .card {
      background: rgba(15, 15, 20, 0.5);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 3rem 2.5rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
      animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.9) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    .logo {
      font-size: 2.5rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -1px;
    }

    h1 {
      font-size: 1.6rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    .subtitle {
      color: var(--muted);
      margin-bottom: 2.5rem;
      font-size: 1rem;
    }

    .btn {
      padding: 1.2rem;
      border: none;
      border-radius: 12px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 1.1rem;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
    }

    .btn-discord {
      background: #5865F2;
      color: white;
      box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
    }

    .btn-discord:hover {
      background: #4752C4;
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(88, 101, 242, 0.5);
    }

    .back {
      display: inline-block;
      margin-top: 2rem;
      color: var(--muted);
      text-decoration: none;
      font-size: 0.95rem;
      transition: color 0.2s;
    }

    .back:hover {
      color: var(--text);
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="container">
    <div class="card">
      <div class="logo">sentara</div>
      <h1>Giriş Yap</h1>
      <p class="subtitle">Platforma erişmek için Discord ile bağlanın</p>

      <div class="auth-buttons">
        <a href="/auth/discord" class="btn btn-discord">
          <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a67.59,67.59,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.33,46,96.22,53,91.08,65.69,84.69,65.69Z"/></svg>
          Discord ile Giriş Yap
        </a>
      </div>

      <a href="/" class="back">← Ana Sayfaya Dön</a>
    </div>
  </div>
</body>
</html>`;
}

function renderDashboard(user) {
  const isRobloxLinked = user.robloxUsername && user.robloxUsername !== 'Yetkilendirmedi' && user.robloxUsername !== 'RobloxUser';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Sentara Premium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050508;
      --surface: rgba(20, 20, 30, 0.6);
      --border: rgba(124, 106, 247, 0.2);
      --accent: #7c6af7;
      --accent2: #ff6bf7;
      --text: #ffffff;
      --muted: #a0a0c0;
      --success: #4ade80;
      --warning: #fbbf24;
      --danger: #f87171;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: radial-gradient(circle at top left, #1a1a2e 0%, var(--bg) 100%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    header {
      background: rgba(10, 10, 15, 0.5);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
    }

    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -1px;
    }

    .header-actions {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }

    .header-link {
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.3s;
    }

    .header-link:hover { color: var(--text); }
    .header-link.staff { color: var(--accent); }
    .header-link.debug { color: var(--danger); }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(255,255,255,0.03);
      padding: 0.5rem 1rem;
      border-radius: 30px;
      border: 1px solid var(--border);
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid var(--accent);
      box-shadow: 0 0 10px rgba(124, 106, 247, 0.4);
    }

    .logout {
      color: var(--danger);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.3s;
    }
    .logout:hover { color: #fca5a5; }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 2rem;
    }

    .welcome-section {
      margin-bottom: 3rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      animation: slideDown 0.5s ease;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .welcome-section h1 {
      font-size: 2.5rem;
      font-weight: 800;
    }

    .roblox-status {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(15,15,20,0.6);
      backdrop-filter: blur(10px);
      padding: 1rem 1.5rem;
      border-radius: 15px;
      border: 1px solid var(--border);
    }

    .btn-roblox {
      padding: 0.8rem 1.5rem;
      background: #000;
      color: white;
      border: 1px solid #333;
      border-radius: 10px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-roblox:hover {
      background: #111;
      border-color: #555;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.5);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      margin-bottom: 4rem;
    }

    .card {
      background: var(--surface);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2rem;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 4px; height: 100%;
      background: var(--accent);
    }

    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 30px rgba(0,0,0,0.4), 0 0 15px rgba(124, 106, 247, 0.2);
      border-color: var(--accent);
    }

    .card h3 {
      font-size: 1rem;
      color: var(--muted);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .card-value {
      font-size: 3.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #fff, var(--muted));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .section {
      background: var(--surface);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2.5rem;
    }

    .section h2 {
      font-size: 1.8rem;
      margin-bottom: 2rem;
      font-weight: 800;
    }

    .ticket-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ticket {
      background: rgba(10,10,15,0.8);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.3s;
    }

    .ticket:hover {
      background: rgba(20,20,30,0.9);
      border-color: var(--accent);
      transform: translateX(5px);
    }

    .ticket-info h4 { margin-bottom: 0.5rem; font-size: 1.2rem; }
    .ticket-meta { color: var(--muted); font-size: 0.95rem; }

    .ticket-badge {
      padding: 0.5rem 1rem;
      border-radius: 30px;
      font-size: 0.85rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .badge-open { background: rgba(74, 222, 128, 0.15); color: var(--success); border: 1px solid rgba(74, 222, 128, 0.3); }
    .badge-closed { background: rgba(248, 113, 113, 0.15); color: var(--danger); border: 1px solid rgba(248, 113, 113, 0.3); }

    @media (max-width: 768px) {
      header { flex-wrap: wrap; gap: 1rem; }
      .header-actions { width: 100%; justify-content: space-between; flex-wrap: wrap; }
      .ticket { flex-direction: column; align-items: flex-start; gap: 1rem; }
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo" style="text-decoration: none;">sentara</a>
    <div class="header-actions">
      <a href="/profile" class="header-link">Profil</a>
      <a href="/wiki" class="header-link">Wiki</a>
      <a href="/settings" class="header-link">Ayarlar</a>
      ${user.isStaff || user.isAdmin ? '<a href="/staff" class="header-link staff">👨‍💼 Staff Panel</a>' : ''}
      ${user.isAdmin ? '<a href="/debug" class="header-link debug">🔍 Debug</a>' : ''}
      <div class="user-info">
        <img src="${user.discordAvatar}" alt="Avatar" class="user-avatar">
        <div>
          <div style="font-weight: 600;">${user.discordUsername}</div>
          <a href="/logout" class="logout" style="font-size: 0.85rem;">Çıkış Yap</a>
        </div>
      </div>
    </div>
  </header>

  <main>
    <div class="welcome-section">
      <div>
        <h1>Hoş Geldin, ${user.discordUsername}! 👋</h1>
        <p style="color: var(--muted); margin-top: 0.5rem;">İşte destek sistemindeki durumun.</p>
      </div>
      <div class="roblox-status">
        ${isRobloxLinked ? 
          \`<div>
            <div style="color: var(--muted); font-size: 0.85rem;">Bağlı Roblox Hesabı</div>
            <div style="font-weight: 700; color: var(--success);">✅ \${user.robloxUsername}</div>
          </div>\` : 
          \`<div>
            <div style="color: var(--warning); font-weight: 600; margin-bottom: 0.3rem;">Roblox Hesabı Bağlı Değil</div>
            <a href="/auth/roblox" class="btn-roblox">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5.5 2h13C20.4 2 22 3.6 22 5.5v13c0 1.9-1.6 3.5-3.5 3.5h-13C3.6 22 2 20.4 2 18.5v-13C2 3.6 3.6 2 5.5 2zM12 5L6 12l6 7 6-7-6-7z"/></svg>
              Roblox'u Bağla
            </a>
          </div>\`
        }
      </div>
    </div>

    <div class="grid">
      <div class="card" style="border-left-color: var(--success);">
        <h3>🟢 Açık Ticket'lar</h3>
        <div class="card-value" id="open-count">0</div>
      </div>

      <div class="card" style="border-left-color: var(--danger);">
        <h3>🔴 Kapalı Ticket'lar</h3>
        <div class="card-value" id="closed-count">0</div>
      </div>

      <div class="card" style="border-left-color: var(--accent);">
        <h3>📊 Toplam Ticket</h3>
        <div class="card-value" id="total-count">0</div>
      </div>
    </div>

    <div class="section">
      <h2>🎫 Ticket Geçmişin</h2>
      <div class="ticket-list" id="tickets">
        <p style="color: var(--muted); animation: pulse 2s infinite;">Yükleniyor...</p>
      </div>
    </div>
  </main>

  <script>
    async function loadTickets() {
      try {
        const res = await fetch('/api/tickets');
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        const tickets = data.tickets;
        const open = tickets.filter(t => t.status === 'open').length;
        const closed = tickets.filter(t => t.status === 'closed').length;

        // Animate numbers
        animateValue("open-count", parseInt(document.getElementById('open-count').innerText) || 0, open, 500);
        animateValue("closed-count", parseInt(document.getElementById('closed-count').innerText) || 0, closed, 500);
        animateValue("total-count", parseInt(document.getElementById('total-count').innerText) || 0, tickets.length, 500);

        let html = '';
        if (tickets.length > 0) {
          tickets.forEach(t => {
            const isOpen = t.status === 'open';
            html += \`
              <div class="ticket">
                <div class="ticket-info">
                  <h4>\${t.ticketId}</h4>
                  <div class="ticket-meta">\${t.subject} • Kategori: \${t.category}</div>
                </div>
                <span class="ticket-badge \${isOpen ? 'badge-open' : 'badge-closed'}">
                  \${isOpen ? 'AÇIK' : 'KAPALI'}
                </span>
              </div>
            \`;
          });
        } else {
          html = '<div style="text-align: center; padding: 3rem; color: var(--muted);">Henüz hiç destek talebi oluşturmamışsın.</div>';
        }

        document.getElementById('tickets').innerHTML = html;
      } catch (err) {
        document.getElementById('tickets').innerHTML = \`<div style="color: var(--danger); padding: 1rem;">❌ \${err.message}</div>\`;
      }
    }

    function animateValue(id, start, end, duration) {
        if (start === end) return;
        let obj = document.getElementById(id);
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    loadTickets();
    setInterval(loadTickets, 10000); // Poll every 10s
  </script>
</body>
</html>`;
}

function renderTicketsPage(user) {
  const content = `
    <div class="card">
      <h1 style="margin-bottom: 2rem;">🎫 Tüm Ticket'lar</h1>
      <div id="tickets" style="display: grid; gap: 1rem;">
        <p style="color: var(--muted);">Yükleniyor...</p>
      </div>
    </div>
    <script>
      async function loadTickets() {
        try {
          const res = await fetch('/api/tickets');
          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          let html = '';
          if (data.tickets.length > 0) {
            data.tickets.forEach(t => {
              const isOpen = t.status === 'open';
              html += `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem; color: var(--accent);">${t.ticketId}</div>
                    <div style="color: var(--muted);">${t.subject} • Kategori: ${t.category}</div>
                  </div>
                  <div style="padding: 0.5rem 1rem; border-radius: 20px; font-weight: 800; font-size: 0.8rem; background: ${isOpen ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}; color: ${isOpen ? 'var(--success)' : '#f87171'}; border: 1px solid ${isOpen ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}">
                    ${isOpen ? 'AÇIK' : 'KAPALI'}
                  </div>
                </div>
              `;
            });
          } else {
            html = '<p style="color: var(--muted);">Henüz ticket\'ınız yok.</p>';
          }
          document.getElementById('tickets').innerHTML = html;
        } catch (err) {
          document.getElementById('tickets').innerHTML = `<p style="color: #f87171;">❌ ${err.message}</p>`;
        }
      }
      loadTickets();
    </script>
  `;
  return _layout("Ticket'lar", user, content);
}

function renderStaffPanel(user) {
  const content = `
    <div class="card">
      <h1 style="margin-bottom: 2rem;">👨‍💼 Staff Panel</h1>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(124, 106, 247, 0.1); border-bottom: 1px solid var(--border);">
              <th style="padding: 1rem; color: var(--accent);">ID</th>
              <th style="padding: 1rem; color: var(--accent);">Kullanıcı</th>
              <th style="padding: 1rem; color: var(--accent);">Konu</th>
              <th style="padding: 1rem; color: var(--accent);">Kategori</th>
              <th style="padding: 1rem; color: var(--accent);">İşlem</th>
            </tr>
          </thead>
          <tbody id="staff-tickets">
            <tr><td colspan="5" style="padding: 1rem; color: var(--muted);">Yükleniyor...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <script>
      async function loadStaffTickets() {
        const res = await fetch('/api/tickets/staff');
        const data = await res.json();
        const html = data.tickets.map(t => `
          <tr style="border-bottom: 1px solid var(--border); transition: 0.3s; background: rgba(0,0,0,0.2);">
            <td style="padding: 1rem; font-weight: 700;">${t.ticketId}</td>
            <td style="padding: 1rem;">${t.userName}</td>
            <td style="padding: 1rem;">${t.subject}</td>
            <td style="padding: 1rem;">${t.category}</td>
            <td style="padding: 1rem;">
              <button class="btn" style="background: #ef4444; padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="closeTicket('${t.ticketId}')">Kapat</button>
            </td>
          </tr>
        `).join('');
        document.getElementById('staff-tickets').innerHTML = html || '<tr><td colspan="5" style="padding: 1rem; color: var(--muted); text-align: center;">Açık ticket yok.</td></tr>';
      }
      async function closeTicket(id) {
        if(!confirm('Kapatmak istediğine emin misin?')) return;
        await fetch('/api/tickets/' + id + '/close', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({reason: 'Staff tarafından kapatıldı'}) });
        loadStaffTickets();
      }
      loadStaffTickets();
    </script>
  `;
  return _layout("Staff Panel", user, content);
}

function renderDebugPage(user, stats, logs) {
  const content = `
    <div class="card" style="background: rgba(0,0,0,0.5); padding: 1.5rem; border-radius: 10px; border: 1px solid rgba(74, 222, 128, 0.3);">
        <h2 style="color: #4ade80; margin-bottom: 1rem;">Recent Logs (${logs.length})</h2>
        <div id="logs" style="max-height: 400px; overflow-y: auto;">
          ${logs.reverse().map(l => `
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0.5rem 0; font-size: 0.8rem;">
              <span style="color: #666;">[${l.timestamp.split('T')[1].split('.')[0]}]</span>
              <span style="color: ${l.type === 'ERROR' ? '#f87171' : '#60a5fa'}; font-weight: ${l.type === 'ERROR' ? 'bold' : 'normal'};">${l.type}</span>: ${l.msg}
              <div style="color: #888; font-size: 0.75rem; margin-left: 1rem;">${l.details || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
  </div>
</body>
</html>`;
}

module.exports = { renderMainPage, renderLoginPage, renderDashboard, renderTicketsPage, renderAuthorizePage, renderStaffPanel, renderDebugPage, renderProfilePage, renderSettingsPage, renderLegalPage, renderWikiPage };

function _layout(title, user, content) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Sentara Premium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050508;
      --surface: rgba(20, 20, 30, 0.6);
      --border: rgba(124, 106, 247, 0.2);
      --accent: #7c6af7;
      --accent2: #ff6bf7;
      --text: #ffffff;
      --muted: #a0a0c0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(circle at top left, #1a1a2e 0%, var(--bg) 100%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }
    header {
      background: rgba(10, 10, 15, 0.5);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-decoration: none;
    }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--muted); text-decoration: none; font-weight: 600; transition: 0.3s; }
    .nav-links a:hover { color: var(--text); }
    main { max-width: 1000px; margin: 0 auto; padding: 3rem 2rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 2rem; backdrop-filter: blur(10px); }
    .btn { padding: 0.8rem 1.5rem; background: var(--accent); color: white; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; font-weight: 700; transition: 0.3s; }
    .btn:hover { background: #6b57f5; transform: translateY(-2px); }
    input, textarea { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 10px; color: white; font-family: inherit; margin-bottom: 1rem; outline: none; }
    input:focus, textarea:focus { border-color: var(--accent); }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">sentara</a>
    <div class="nav-links">
      <a href="/dashboard">Dashboard</a>
      <a href="/profile">Profil</a>
      <a href="/wiki">Wiki</a>
      <a href="/settings">Ayarlar</a>
      ${user ? '<a href="/logout" style="color: #f87171;">Çıkış</a>' : ''}
    </div>
  </header>
  <main>
    ${content}
  </main>
</body>
</html>`;
}

function renderProfilePage(user) {
  const banner = user.discordBanner ? `url(${user.discordBanner})` : `linear-gradient(135deg, ${user.profileColor || 'var(--accent)'}, #1a1a2e)`;
  const content = `
    <div style="background: ${banner}; background-size: cover; background-position: center; height: 200px; border-radius: 20px 20px 0 0; position: relative; border: 1px solid var(--border); border-bottom: none;">
      <img src="${user.discordAvatar}" style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid var(--bg); position: absolute; bottom: -60px; left: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
    </div>
    <div class="card" style="border-radius: 0 0 20px 20px; padding-top: 80px; position: relative;">
      <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${user.discordUsername}</h1>
      <p style="color: var(--muted); margin-bottom: 2rem;">Roblox: ${user.robloxUsername || 'Bağlı değil'}</p>
      
      <div style="background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 15px; border: 1px solid var(--border);">
        <h3 style="margin-bottom: 1rem; color: var(--accent);">Hakkımda</h3>
        <p style="line-height: 1.6; white-space: pre-wrap;">${user.profileBio || 'Henüz bir biyografi eklenmemiş.'}</p>
      </div>
    </div>
  `;
  return _layout("Profil", user, content);
}

function renderSettingsPage(user) {
  const content = `
    <div class="card">
      <h1 style="margin-bottom: 2rem;">Ayarlar</h1>
      <form id="settingsForm">
        <label style="display: block; margin-bottom: 0.5rem; color: var(--muted);">Profil Rengi (Hex)</label>
        <input type="text" id="color" value="${user.profileColor || '#7c6af7'}" placeholder="#7c6af7">
        
        <label style="display: block; margin-bottom: 0.5rem; color: var(--muted);">Biyografi</label>
        <textarea id="bio" rows="5" placeholder="Kendinden bahset...">${user.profileBio || ''}</textarea>
        
        <button type="submit" class="btn">Kaydet</button>
      </form>
    </div>
    <script>
      document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileColor: document.getElementById('color').value,
            profileBio: document.getElementById('bio').value
          })
        });
        if(res.ok) {
          alert('Başarıyla kaydedildi!');
          window.location.reload();
        } else {
          alert('Bir hata oluştu.');
        }
      });
    </script>
  `;
  return _layout("Ayarlar", user, content);
}

function renderLegalPage(title, text) {
  const content = `
    <div class="card">
      <h1 style="margin-bottom: 2rem; color: var(--accent);">${title}</h1>
      <div style="line-height: 1.8; color: var(--muted);">${text}</div>
      <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border); display: flex; gap: 1rem;">
        <a href="/legal/tos" style="color: var(--accent); text-decoration: none;">Hizmet Koşulları</a>
        <a href="/legal/privacy" style="color: var(--accent); text-decoration: none;">Gizlilik Politikası</a>
      </div>
    </div>
  `;
  return _layout(title, null, content);
}

function renderWikiPage(user, comments) {
  const commentsHtml = comments.map(c => `
    <div style="background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 15px; border: 1px solid var(--border); margin-bottom: 1rem; display: flex; gap: 1rem; align-items: flex-start;">
      <img src="${c.avatar}" style="width: 50px; height: 50px; border-radius: 50%;">
      <div>
        <div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--accent);">${c.username}</div>
        <div style="line-height: 1.5; white-space: pre-wrap;">${c.content}</div>
        <div style="font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem;">${new Date(c.createdAt).toLocaleString('tr-TR')}</div>
      </div>
    </div>
  `).join('');

  const content = `
    <div class="card">
      <h1 style="margin-bottom: 1rem;">Topluluk Wiki</h1>
      <p style="color: var(--muted); margin-bottom: 3rem;">Sentara platformu hakkında topluluk tartışmaları, rehberler ve yorumlar.</p>
      
      <div style="margin-bottom: 3rem;">
        <h3 style="margin-bottom: 1rem;">Bir şeyler paylaş...</h3>
        ${user ? `
          <form id="wikiForm">
            <textarea id="wikiContent" rows="4" placeholder="Wiki'ye katkıda bulun..." required></textarea>
            <button type="submit" class="btn">Gönder</button>
          </form>
        ` : '<p style="color: var(--danger);">Yorum yapmak için giriş yapmalısınız.</p>'}
      </div>

      <div>
        <h3 style="margin-bottom: 1.5rem;">Paylaşımlar (${comments.length})</h3>
        ${comments.length > 0 ? commentsHtml : '<p style="color: var(--muted);">Henüz paylaşım yok. İlk paylaşan sen ol!</p>'}
      </div>
    </div>
    
    ${user ? `
    <script>
      document.getElementById('wikiForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await fetch('/api/wiki', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: document.getElementById('wikiContent').value
          })
        });
        if(res.ok) {
          window.location.reload();
        } else {
          const data = await res.json();
          alert(data.error || 'Bir hata oluştu.');
        }
      });
    </script>
    ` : ''}
  `;
  return _layout("Wiki", user, content);
}
