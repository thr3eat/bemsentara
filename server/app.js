const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("./passport");
const { SESSION_SECRET } = require("../config");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const pagesRoutes = require("./routes/pages");

const logger = require("../utils/logger");

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Debug Middleware (noisy polling endpoints filtered)
const SILENT_PATHS = ['/api/activity/', '/api/logs', '/api/health'];
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const isSilent = SILENT_PATHS.some(p => req.path.startsWith(p));
    if (!isSilent) {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

const FileSessionStore = require("./sessionStore");

app.use(
  session({
    store: new FileSessionStore(),
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ── Ban kontrolü: banlı kullanıcılar siteye giremez ─────────────────────────
app.use((req, res, next) => {
  // Auth ve API rotalarını atla
  if (req.path.startsWith('/auth') || req.path.startsWith('/api') || req.path === '/login' || req.path === '/logout' || req.path === '/') {
    return next();
  }
  if (req.user && req.user.isBanned) {
    return res.status(403).send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Erişim Engellendi</title>
    <style>body{background:#050508;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
    .box{background:rgba(20,20,30,.8);border:1px solid rgba(248,113,113,.3);border-radius:20px;padding:3rem;max-width:480px}
    h1{color:#f87171;font-size:2rem;margin-bottom:1rem}p{color:#a0a0c0;line-height:1.7}
    .reason{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);border-radius:10px;padding:1rem;margin:1.5rem 0;color:#fca5a5}
    a{color:#7c6af7;text-decoration:none}</style></head>
    <body><div class="box"><h1>🚫 Hesabınız Yasaklandı</h1>
    <p>Bu platforma erişiminiz kısıtlanmıştır.</p>
    ${req.user.banReason ? `<div class="reason"><strong>Sebep:</strong> ${req.user.banReason}</div>` : ''}
    <p style="font-size:.85rem;margin-top:1.5rem;">Haksız bir ban olduğunu düşünüyorsanız yöneticilerle iletişime geçin.</p>
    <p style="margin-top:1rem;"><a href="/logout">Çıkış Yap</a></p></div></body></html>`);
  }
  next();
});

app.use(authRoutes);
app.use(apiRoutes);
app.use(pagesRoutes);

module.exports = app;
