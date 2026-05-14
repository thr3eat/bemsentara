function renderMainPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentara - Destek Sistemi</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
      --success: #4ade80;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg) 0%, #0f0f1a 100%);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
    }

    header {
      padding: 2rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: rgba(124, 106, 247, 0.05);
      backdrop-filter: blur(10px);
    }

    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
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
      transition: color 0.2s;
    }

    nav a:hover {
      color: var(--accent);
    }

    .btn {
      padding: 0.7rem 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white;
      border: none;
      border-radius: 8px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124, 106, 247, 0.3);
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 4rem 2rem;
    }

    h1 {
      font-size: 3.5rem;
      line-height: 1.1;
      margin-bottom: 1rem;
      font-weight: 800;
    }

    .grad {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--muted);
      font-size: 1.2rem;
      margin-bottom: 3rem;
      max-width: 600px;
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .feature {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      transition: all 0.3s;
    }

    .feature:hover {
      border-color: var(--accent);
      background: rgba(124, 106, 247, 0.05);
      transform: translateY(-4px);
    }

    .feature-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .feature h3 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }

    .feature p {
      color: var(--muted);
      line-height: 1.6;
    }

    footer {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      border-top: 1px solid var(--border);
      margin-top: 4rem;
    }

    @media (max-width: 768px) {
      header {
        padding: 1.5rem;
        flex-direction: column;
        gap: 1rem;
      }

      h1 {
        font-size: 2.2rem;
      }

      main {
        padding: 2rem 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">sentara</div>
    <nav>
      <a href="#features">Özellikler</a>
      <a href="/login" class="btn">Giriş Yap</a>
    </nav>
  </header>

  <main>
    <h1>Discord'da <span class="grad">Destek Sistemi</span></h1>
    <p class="subtitle">Sentara Bot ile profesyonel destek sistemi kurun. Ticket'ları yönetin, durumları izleyin ve kullanıcılarını mutlu tutun.</p>

    <div id="features" class="features">
      <div class="feature">
        <div class="feature-icon">🎫</div>
        <h3>Ticket Sistemi</h3>
        <p>Discord'da butonla destek talebine başlayın. Otomatik kanal açılır.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📂</div>
        <h3>Kategorilendirme</h3>
        <p>5 farklı kategori: Ödeme, Teknik, Hesap, Grup, Diğer</p>
      </div>

      <div class="feature">
        <div class="feature-icon">👥</div>
        <h3>Staff Panel</h3>
        <p>Staff üyeleri web panelinde tüm ticket'ları görebilir.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Takip & Yönetim</h3>
        <p>Ticket durumunu izleyin, kapatın, sebep belirtin.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">💬</div>
        <h3>Mesajlaşma</h3>
        <p>Web panelinden ticket'a mesaj ekleyin.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>7/24 Bot</h3>
        <p>Sentara Bot her zaman çevrimiçi.</p>
      </div>
    </div>
  </main>

  <footer>
    © 2025 Sentara Bot Support System
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
  <title>Giriş Yap - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg), #0f0f1a);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container {
      width: 100%;
      max-width: 400px;
      padding: 2rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      text-align: center;
    }

    .logo {
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--muted);
      margin-bottom: 2rem;
      font-size: 0.9rem;
    }

    .auth-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .btn {
      padding: 1rem;
      border: none;
      border-radius: 8px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.95rem;
      text-decoration: none;
      display: inline-block;
    }

    .btn-discord {
      background: #5865f2;
      color: white;
    }

    .btn-discord:hover {
      background: #4752c4;
      transform: translateY(-2px);
    }

    .back {
      display: inline-block;
      margin-top: 1.5rem;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .back:hover {
      color: var(--accent2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">sentara</div>
      <h1>Giriş Yap</h1>
      <p class="subtitle">Discord hesabınızla devam edin</p>

      <div class="auth-buttons">
        <a href="/auth/discord" class="btn btn-discord">🎮 Discord ile Giriş Yap</a>
      </div>

      <a href="/" class="back">← Ana Sayfaya Dön</a>
    </div>
  </div>
</body>
</html>`;
}

function renderDashboard(user) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
      --success: #4ade80;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg), #0f0f1a);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
    }

    header {
      background: rgba(124, 106, 247, 0.05);
      border-bottom: 1px solid var(--border);
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid var(--accent);
    }

    .logout {
      color: var(--text);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: all 0.2s;
    }

    .logout:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .card h3 {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
    }

    .card-value {
      font-size: 2.5rem;
      font-weight: 800;
    }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }

    .section h2 {
      font-size: 1.3rem;
      margin-bottom: 1.5rem;
    }

    .ticket-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ticket {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.2s;
    }

    .ticket:hover {
      border-color: var(--accent);
    }

    .ticket-info h4 {
      margin-bottom: 0.3rem;
    }

    .ticket-meta {
      color: var(--muted);
      font-size: 0.85rem;
    }

    .ticket-badge {
      display: inline-block;
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge-open {
      background: rgba(74, 222, 128, 0.2);
      color: var(--success);
    }

    .badge-closed {
      background: rgba(248, 113, 113, 0.2);
      color: #f87171;
    }

    @media (max-width: 768px) {
      main {
        padding: 1rem;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      header {
        flex-wrap: wrap;
      }

      .ticket {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">sentara</div>
    <div style="display: flex; gap: 1rem; align-items: center;">
      ${user.isStaff || user.isAdmin ? '<a href="/staff" style="color: var(--accent); text-decoration: none; font-weight: 700;">👨‍💼 Staff Panel</a>' : ''}
      ${user.isAdmin ? '<a href="/debug" style="color: #fca5a5; text-decoration: none; font-weight: 700;">🔍 Debug</a>' : ''}
      <div class="user-info">
        <img src="${user.discordAvatar}" alt="Avatar" class="user-avatar">
        <div>
          <div>${user.discordUsername}</div>
          <small>${user.robloxUsername || 'Yetkilendirmedi'}</small>
        </div>
        <a href="/logout" class="logout">Çıkış</a>
      </div>
    </div>
  </header>

  <main>
    <div class="grid">
      <div class="card">
        <h3>🎫 Açık Ticket'lar</h3>
        <div class="card-value" id="open-count">0</div>
      </div>

      <div class="card">
        <h3>✅ Kapalı Ticket'lar</h3>
        <div class="card-value" id="closed-count">0</div>
      </div>

      <div class="card">
        <h3>📅 Toplam Ticket</h3>
        <div class="card-value" id="total-count">0</div>
      </div>
    </div>

    <div class="section">
      <h2>🎫 Ticket'larınız</h2>
      <div class="ticket-list" id="tickets">
        <p style="color: var(--muted);">Yükleniyor...</p>
      </div>
    </div>
  </main>

  <script>
    async function loadTickets() {
      try {
        var res = await fetch('/api/tickets');
        var data = await res.json();

        if (!data.success) throw new Error(data.error);

        var tickets = data.tickets;
        var open = tickets.filter(function(t) { return t.status === 'open'; }).length;
        var closed = tickets.filter(function(t) { return t.status === 'closed'; }).length;

        document.getElementById('open-count').textContent = open;
        document.getElementById('closed-count').textContent = closed;
        document.getElementById('total-count').textContent = tickets.length;

        var html = '';
        if (tickets.length > 0) {
          tickets.forEach(function(t) {
            var badgeClass = t.status === 'open' ? 'badge-open' : 'badge-closed';
            var badgeText = t.status === 'open' ? '🟢 Açık' : '🔴 Kapalı';
            html += '<div class="ticket">' +
              '<div class="ticket-info">' +
              '<h4>' + t.ticketId + '</h4>' +
              '<div class="ticket-meta">' + t.subject + ' • Kategori: ' + t.category + '</div>' +
              '</div>' +
              '<span class="ticket-badge ' + badgeClass + '">' + badgeText + '</span>' +
              '</div>';
          });
        } else {
          html = '<p style="color: var(--muted);">Henüz ticket\'ınız yok.</p>';
        }

        document.getElementById('tickets').innerHTML = html;
      } catch (err) {
        document.getElementById('tickets').innerHTML = '<p style="color: #f87171;">❌ ' + err.message + '</p>';
      }
    }

    loadTickets();
    setInterval(loadTickets, 5000);
  </script>
</body>
</html>`;
}

function renderTicketsPage(user) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket'lar - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg), #0f0f1a);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
    }

    header {
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), #f76af7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
    }

    h2 {
      margin-bottom: 1.5rem;
    }

    .ticket-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .ticket-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ticket-card:hover {
      border-color: var(--accent);
      background: rgba(124, 106, 247, 0.05);
    }

    .ticket-id {
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 0.5rem;
    }

    .ticket-subject {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .ticket-meta {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .back {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .back:hover {
      color: #f76af7;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">sentara</div>
    <a href="/dashboard" class="back">← Dashboard</a>
  </header>

  <main>
    <div class="section">
      <h2>🎫 Ticket'lar</h2>
      <div class="ticket-grid" id="tickets">
        <p style="color: var(--muted);">Yükleniyor...</p>
      </div>
    </div>
  </main>

  <script>
    async function loadTickets() {
      try {
        var res = await fetch('/api/tickets');
        var data = await res.json();

        if (!data.success) throw new Error(data.error);

        var html = '';
        if (data.tickets.length > 0) {
          data.tickets.forEach(function(t) {
            html += '<div class="ticket-card" onclick="alert(\'Ticket: ' + t.ticketId + '\')">' +
              '<div class="ticket-id">' + t.ticketId + '</div>' +
              '<div class="ticket-subject">' + t.subject + '</div>' +
              '<div class="ticket-meta">Kategori: ' + t.category + ' • Durum: ' + t.status + '</div>' +
              '</div>';
          });
        } else {
          html = '<p style="color: var(--muted);">Henüz ticket\'ınız yok.</p>';
        }

        document.getElementById('tickets').innerHTML = html;
      } catch (err) {
        document.getElementById('tickets').innerHTML = '<p style="color: #f87171;">❌ ' + err.message + '</p>';
      }
    }

    loadTickets();
  </script>
</body>
</html>`;
}

function renderAuthorizePage(discordId) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yetkilendirme - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 2.5rem;
      border-radius: 16px;
      width: 100%;
      max-width: 450px;
      text-align: center;
    }
    .logo {
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, var(--accent), #f76af7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    p { color: var(--muted); margin-bottom: 2rem; font-size: 0.9rem; }
    input {
      width: 100%;
      padding: 1rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: white;
      font-family: inherit;
      margin-bottom: 1.5rem;
      outline: none;
    }
    input:focus { border-color: var(--accent); }
    .btn {
      width: 100%;
      padding: 1rem;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">sentara</div>
    <h1>Roblox Hesabını Bağla</h1>
    <p>Discord hesabınızı doğrulamak için Roblox kullanıcı adınızı girin.</p>
    <form action="/auth/authorize" method="POST">
      <input type="hidden" name="discordId" value="${discordId}">
      <input type="text" name="robloxUsername" placeholder="Roblox Kullanıcı Adı" required>
      <button type="submit" class="btn">Hesabı Doğrula</button>
    </form>
  </div>
</body>
</html>`;
}

function renderStaffPanel(user) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Staff Panel - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #0a0a0f; --surface: #13131a; --border: #2a2a3a; --accent: #7c6af7; --text: #e8e8ff; --muted: #7a7a9a; }
    body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; margin: 0; }
    header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .ticket-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: rgba(124, 106, 247, 0.1); color: var(--accent); }
    .btn { padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 700; }
    .btn-close { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <header>
    <div style="font-size: 1.5rem; font-weight: 800;">👨‍💼 Staff Panel</div>
    <a href="/dashboard" style="color: var(--accent); text-decoration: none;">← Dashboard</a>
  </header>
  <main>
    <h2>Tüm Açık Ticket'lar</h2>
    <table class="ticket-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Kullanıcı</th>
          <th>Konu</th>
          <th>Kategori</th>
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody id="staff-tickets">
        <tr><td colspan="5">Yükleniyor...</td></tr>
      </tbody>
    </table>
  </main>
  <script>
    async function loadStaffTickets() {
      const res = await fetch('/api/tickets/staff');
      const data = await res.json();
      const html = data.tickets.map(t => '<tr>' +
        '<td>' + t.ticketId + '</td>' +
        '<td>' + t.userName + '</td>' +
        '<td>' + t.subject + '</td>' +
        '<td>' + t.category + '</td>' +
        '<td><button class="btn btn-close" onclick="closeTicket(\\'' + t.ticketId + '\\')">Kapat</button></td>' +
        '</tr>').join('');
      document.getElementById('staff-tickets').innerHTML = html || '<tr><td colspan="5">Açık ticket yok.</td></tr>';
    }
    async function closeTicket(id) {
      if(!confirm('Kapatmak istediğine emin misin?')) return;
      await fetch('/api/tickets/' + id + '/close', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({reason: 'Staff tarafından kapatıldı'}) });
      loadStaffTickets();
    }
    loadStaffTickets();
  </script>
</body>
</html>`;
}

function renderDebugPage(user, stats, logs) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Debug Console - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code&display=swap" rel="stylesheet">
  <style>
    body { background: #05050a; color: #00ff41; font-family: 'Fira Code', monospace; padding: 2rem; margin: 0; }
    .grid { display: grid; grid-template-columns: 350px 1fr; gap: 2rem; }
    .card { background: #0a0a15; border: 1px solid #00ff41; padding: 1.5rem; border-radius: 8px; box-shadow: 0 0 15px rgba(0, 255, 65, 0.1); }
    h1, h2 { color: #fff; margin-top: 0; }
    pre { white-space: pre-wrap; font-size: 0.85rem; color: #4ade80; }
    .log-entry { border-bottom: 1px solid #1a1a2e; padding: 0.5rem 0; font-size: 0.8rem; }
    .type-INFO { color: #60a5fa; }
    .type-ERROR { color: #f87171; font-weight: bold; }
    .type-SUCCESS { color: #4ade80; }
    .nav { margin-bottom: 2rem; }
    .nav a { color: #00ff41; text-decoration: none; border: 1px solid #00ff41; padding: 0.5rem 1rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="nav"><a href="/dashboard">← Geri Dön</a></div>
  <h1>🔍 System Debug Console</h1>
  <div class="grid">
    <div class="left">
      <div class="card">
        <h2>System Stats</h2>
        <pre>${JSON.stringify(stats, null, 2)}</pre>
      </div>
      <br>
      <div class="card">
        <h2>Store State</h2>
        <p>Users: ${stats.db.users}</p>
        <p>Tickets: ${stats.db.tickets}</p>
        <p>Economies: ${stats.db.economies}</p>
      </div>
    </div>
    <div class="right">
      <div class="card">
        <h2>Recent Logs (${logs.length})</h2>
        <div id="logs">
          ${logs.reverse().map(l => `
            <div class="log-entry">
              <span style="color: #666;">[${l.timestamp.split('T')[1].split('.')[0]}]</span>
              <span class="type-${l.type}">${l.type}</span>: ${l.msg}
              <div style="color: #888; font-size: 0.75rem; margin-left: 1rem;">${l.details}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderMainPage, renderLoginPage, renderDashboard, renderTicketsPage, renderAuthorizePage, renderStaffPanel, renderDebugPage };


