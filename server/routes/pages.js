const express = require("express");
const {
  renderMainPage,
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
  renderWebhookPage,
} = require("../views");
const { users, tickets, economies, wikiArticles } = require("../../models/Store");
const { isSiteAdmin } = require("../../utils/adminCheck");

const router = express.Router();

router.get("/", (req, res) => {
  res.send(renderMainPage());
});

router.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderDashboard(req.user));
});

router.get("/tickets", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderTicketsPage(req.user));
});

router.get("/tickets/new", (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { SUPPORT_CATEGORIES } = require("../../config");
  const cats = Object.values(SUPPORT_CATEGORIES).map(c => c.name);
  res.send(renderCreateTicketPage(req.user, cats));
});

router.get("/staff", (req, res) => {
  const { isSiteStaff } = require("../../utils/adminCheck");
  if (!req.user || !isSiteStaff(req.user)) return res.redirect("/");
  res.send(renderStaffPanel(req.user));
});

router.get("/debug", (req, res) => {
  if (!req.user || !isSiteAdmin(req.user)) return res.redirect("/");
  const logger = require("../../utils/logger");
  const memory = process.memoryUsage();
  const stats = {
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memory.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + "MB",
    },
    db: {
      users: users.data.size,
      tickets: tickets.data.size,
      economies: economies.data.size,
      wikiArticles: wikiArticles.data.size,
    }
  };
  res.send(renderDebugPage(req.user, stats, logger.getLogs()));
});

router.get("/profile", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  let robloxGroups = [];
  if (req.user.robloxId) {
    try {
      const { fetchUserGroups } = require("../../bot/services/roleSyncService");
      robloxGroups = await fetchUserGroups(req.user.robloxId);
    } catch (err) {
      console.warn("Own profile groups fetch warning:", err.message);
    }
  }
  res.send(renderProfilePage(req.user, req.user, true, robloxGroups));
});

// Herkese açık profil sayfası
router.get("/profile/:discordId", async (req, res) => {
  const targetUser = users.findOne({ discordId: String(req.params.discordId) });
  if (!targetUser) {
    return res.status(404).send(renderLegalPage('Profil Bulunamadı', '<p>Bu kullanıcı bulunamadı veya profilini gizledi.</p>'));
  }
  const isOwn = req.user && String(req.user.discordId) === String(targetUser.discordId);
  let robloxGroups = [];
  if (targetUser.robloxId) {
    try {
      const { fetchUserGroups } = require("../../bot/services/roleSyncService");
      robloxGroups = await fetchUserGroups(targetUser.robloxId);
    } catch (err) {
      console.warn("Public profile groups fetch warning:", err.message);
    }
  }
  res.send(renderProfilePage(req.user, targetUser, isOwn, robloxGroups));
});

router.get("/settings", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderSettingsPage(req.user));
});

router.get("/notifications", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const User = require("../../models/User");
  const freshUser = await User.findById(req.user._id);
  const notifications = freshUser && freshUser.notifications ? freshUser.notifications : [];
  const sorted = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.send(renderNotificationsPage(req.user, sorted));
});

router.get("/legal/tos", (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'tr';

  const tr = `
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:2rem;">Son güncelleme: 1 Haziran 2026 &nbsp;|&nbsp; <em>Last updated: June 1, 2026</em></p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">1. Kabul</h2>
    <p>Sentara platformuna erişerek veya kullanarak bu Hizmet Koşullarını kabul etmiş sayılırsınız. Kabul etmiyorsanız platformu kullanmayınız.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">2. Hizmetin Kapsamı</h2>
    <p>Sentara; Discord ve Roblox hesabı doğrulama, destek talebi (ticket) yönetimi, ekonomi sistemi, wiki ve topluluk araçları sunan bir platformdur. Hizmet "olduğu gibi" sunulmaktadır.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">3. Hesap ve Kimlik Doğrulama</h2>
    <p>Platforma erişmek için geçerli bir Discord hesabı zorunludur. Roblox hesabı bağlama isteğe bağlıdır ancak bazı özelliklerin kullanımı için gereklidir. Hesap bilgilerinizin güvenliğinden siz sorumlusunuz.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">4. Yasaklı Davranışlar</h2>
    <p>Aşağıdaki eylemler kesinlikle yasaktır:</p>
    <ul style="margin:.75rem 0 .75rem 1.5rem;display:flex;flex-direction:column;gap:.4rem;">
      <li>Spam, taciz veya rahatsız edici içerik paylaşımı</li>
      <li>Başka kullanıcıların hesaplarına yetkisiz erişim girişimi</li>
      <li>Sistemleri kötüye kullanmak, açık aramak veya saldırı düzenlemek</li>
      <li>Roblox veya Discord Kullanım Koşullarını ihlal eden içerik</li>
      <li>Sahte kimlik veya yanıltıcı bilgi kullanımı</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">5. İçerik</h2>
    <p>Platforma yüklediğiniz veya paylaştığınız içeriklerden tamamen siz sorumlusunuz. Sentara, uygunsuz içerikleri önceden bildirim yapmaksızın kaldırma hakkını saklı tutar.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">6. Hesap Askıya Alma ve Sonlandırma</h2>
    <p>Bu koşulları ihlal eden hesaplar geçici veya kalıcı olarak askıya alınabilir. Önemli ihlallerde Discord'dan da yasaklanabilirsiniz.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">7. Sorumluluk Sınırlaması</h2>
    <p>Sentara, hizmet kesintileri, veri kayıpları veya platform kullanımından doğan dolaylı zararlardan sorumlu değildir. Platform "mevcut haliyle" sunulmaktadır.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">8. Değişiklikler</h2>
    <p>Bu koşullar zaman zaman güncellenebilir. Önemli değişlikler duyurulacaktır. Platformu kullanmaya devam etmeniz güncel koşulları kabul ettiğiniz anlamına gelir.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">9. İletişim</h2>
    <p>Sorularınız için Discord sunucumuzdan destek talebi oluşturabilirsiniz.</p>
  `;

  const en = `
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:2rem;">Last updated: June 1, 2026</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">1. Acceptance</h2>
    <p>By accessing or using the Sentara platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">2. Description of Service</h2>
    <p>Sentara is a platform providing Discord and Roblox account verification, support ticket management, economy system, wiki, and community tools. The service is provided "as is."</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">3. Account & Authentication</h2>
    <p>A valid Discord account is required to access the platform. Linking a Roblox account is optional but required for certain features. You are responsible for the security of your account credentials.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">4. Prohibited Conduct</h2>
    <p>The following actions are strictly prohibited:</p>
    <ul style="margin:.75rem 0 .75rem 1.5rem;display:flex;flex-direction:column;gap:.4rem;">
      <li>Spam, harassment, or sharing offensive content</li>
      <li>Unauthorized access attempts to other users' accounts</li>
      <li>Abusing, exploiting, or attacking platform systems</li>
      <li>Content that violates Roblox or Discord Terms of Service</li>
      <li>Using false identities or misleading information</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">5. Content</h2>
    <p>You are solely responsible for any content you upload or share on the platform. Sentara reserves the right to remove inappropriate content without prior notice.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">6. Account Suspension & Termination</h2>
    <p>Accounts that violate these terms may be temporarily or permanently suspended. In cases of serious violations, you may also be banned from the Discord server.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">7. Limitation of Liability</h2>
    <p>Sentara is not liable for service interruptions, data loss, or indirect damages arising from platform use. The platform is provided "as available."</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">8. Changes</h2>
    <p>These terms may be updated from time to time. Significant changes will be announced. Continued use of the platform constitutes acceptance of the updated terms.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">9. Contact</h2>
    <p>For questions, please open a support ticket through our Discord server.</p>
  `;

  const title = lang === 'en' ? 'Terms of Service' : 'Hizmet Koşulları';
  res.send(renderLegalPage(title, lang === 'en' ? en : tr, lang));
});

router.get("/legal/privacy", (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'tr';

  const tr = `
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:2rem;">Son güncelleme: 1 Haziran 2026 &nbsp;|&nbsp; <em>Last updated: June 1, 2026</em></p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">1. Giriş</h2>
    <p>Sentara olarak gizliliğinize önem veriyoruz. Bu politika, hangi verileri topladığımızı, nasıl kullandığımızı ve nasıl koruduğumuzu açıklar.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">2. Topladığımız Veriler</h2>
    <p><strong style="color:var(--text);">Discord OAuth2 aracılığıyla:</strong></p>
    <ul style="margin:.5rem 0 1rem 1.5rem;display:flex;flex-direction:column;gap:.3rem;">
      <li>Discord kullanıcı adı ve ID</li>
      <li>E-posta adresi (yalnızca hesap eşleştirme için)</li>
      <li>Profil fotoğrafı URL'si</li>
    </ul>
    <p><strong style="color:var(--text);">Roblox OAuth2 aracılığıyla (isteğe bağlı):</strong></p>
    <ul style="margin:.5rem 0 1rem 1.5rem;display:flex;flex-direction:column;gap:.3rem;">
      <li>Roblox kullanıcı adı ve ID</li>
    </ul>
    <p><strong style="color:var(--text);">Platform kullanımı sırasında:</strong></p>
    <ul style="margin:.5rem 0 1rem 1.5rem;display:flex;flex-direction:column;gap:.3rem;">
      <li>Destek talepleri (ticket içerikleri)</li>
      <li>Ekonomi bakiyesi ve envanter</li>
      <li>Profil biyografisi ve renk tercihleri</li>
      <li>Oturum bilgileri</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">3. Verilerin Kullanımı</h2>
    <p>Toplanan veriler yalnızca şu amaçlarla kullanılır:</p>
    <ul style="margin:.75rem 0 .75rem 1.5rem;display:flex;flex-direction:column;gap:.4rem;">
      <li>Kimlik doğrulama ve oturum yönetimi</li>
      <li>Discord sunucusunda rol senkronizasyonu</li>
      <li>Destek talebi takibi ve yönetimi</li>
      <li>Ekonomi sistemi işlemleri</li>
      <li>Platforma özgü kişiselleştirme</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">4. Veri Paylaşımı</h2>
    <p>Kişisel verileriniz hiçbir üçüncü tarafla satılmaz veya pazarlama amacıyla paylaşılmaz. Yalnızca Discord ve Roblox API'leri ile kimlik doğrulama sürecinde veri alışverişi yapılır; bu işlemler ilgili platformların kendi gizlilik politikalarına tabidir.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">5. Veri Saklama</h2>
    <p>Verileriniz hesabınız aktif olduğu sürece saklanır. Hesabınızı silmek için destek talebi açabilirsiniz; silme işlemi sonrası verileriniz kalıcı olarak kaldırılır.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">6. Veri Güvenliği</h2>
    <p>Verileriniz şifrelenmiş oturumlarla saklanır. Şifreler kesinlikle tutulmaz. OAuth2 token'ları sunucu tarafında yönetilir ve istemciye aktarılmaz.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">7. Haklarınız</h2>
    <p>Aşağıdaki haklara sahipsiniz:</p>
    <ul style="margin:.75rem 0 .75rem 1.5rem;display:flex;flex-direction:column;gap:.4rem;">
      <li>Saklanan verilerinizi görme ve indirme hakkı</li>
      <li>Verilerinizin düzeltilmesini talep etme hakkı</li>
      <li>Hesabınızın ve tüm verilerinizin silinmesini talep etme hakkı</li>
      <li>Roblox hesabı bağlantısını istediğiniz zaman kaldırma hakkı</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">8. Çerezler</h2>
    <p>Oturum yönetimi için yalnızca zorunlu oturum çerezi kullanılmaktadır. Üçüncü taraf izleme veya reklam çerezi kullanılmaz.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">9. İletişim</h2>
    <p>Gizlilik ile ilgili sorularınız için Discord sunucumuzdan destek talebi oluşturabilirsiniz.</p>
  `;

  const en = `
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:2rem;">Last updated: June 1, 2026</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">1. Introduction</h2>
    <p>At Sentara, we take your privacy seriously. This policy explains what data we collect, how we use it, and how we protect it.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">2. Data We Collect</h2>
    <p><strong style="color:var(--text);">Via Discord OAuth2:</strong></p>
    <ul style="margin:.5rem 0 1rem 1.5rem;display:flex;flex-direction:column;gap:.3rem;">
      <li>Discord username and user ID</li>
      <li>Email address (used only for account matching)</li>
      <li>Profile avatar URL</li>
    </ul>
    <p><strong style="color:var(--text);">Via Roblox OAuth2 (optional):</strong></p>
    <ul style="margin:.5rem 0 1rem 1.5rem;display:flex;flex-direction:column;gap:.3rem;">
      <li>Roblox username and user ID</li>
    </ul>
    <p><strong style="color:var(--text);">During platform use:</strong></p>
    <ul style="margin:.5rem 0 1rem 1.5rem;display:flex;flex-direction:column;gap:.3rem;">
      <li>Support ticket contents</li>
      <li>Economy balance and inventory</li>
      <li>Profile bio and color preferences</li>
      <li>Session data</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">3. How We Use Your Data</h2>
    <p>Collected data is used solely for:</p>
    <ul style="margin:.75rem 0 .75rem 1.5rem;display:flex;flex-direction:column;gap:.4rem;">
      <li>Authentication and session management</li>
      <li>Role synchronization on the Discord server</li>
      <li>Support ticket tracking and management</li>
      <li>Economy system operations</li>
      <li>Platform-specific personalization</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">4. Data Sharing</h2>
    <p>Your personal data is never sold or shared with third parties for marketing purposes. Data is only exchanged with Discord and Roblox APIs during the authentication process, which is subject to those platforms' own privacy policies.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">5. Data Retention</h2>
    <p>Your data is retained as long as your account is active. To delete your account, open a support ticket. All your data will be permanently removed after the deletion request is processed.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">6. Data Security</h2>
    <p>Your data is stored using encrypted sessions. Passwords are never stored. OAuth2 tokens are managed server-side and are never exposed to the client.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">7. Your Rights</h2>
    <p>You have the following rights:</p>
    <ul style="margin:.75rem 0 .75rem 1.5rem;display:flex;flex-direction:column;gap:.4rem;">
      <li>Right to view and download your stored data</li>
      <li>Right to request correction of your data</li>
      <li>Right to request deletion of your account and all associated data</li>
      <li>Right to unlink your Roblox account at any time</li>
    </ul>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">8. Cookies</h2>
    <p>Only a strictly necessary session cookie is used for session management. No third-party tracking or advertising cookies are used.</p>

    <h2 style="color:var(--text);font-size:1.2rem;font-weight:800;margin:1.5rem 0 .75rem;">9. Contact</h2>
    <p>For privacy-related questions, please open a support ticket through our Discord server.</p>
  `;

  const title = lang === 'en' ? 'Privacy Policy' : 'Gizlilik Politikası';
  res.send(renderLegalPage(title, lang === 'en' ? en : tr, lang));
});

router.get("/wiki", (req, res) => {
  const articles = wikiArticles.find({}).sort({ createdAt: -1 });
  res.send(renderWikiListPage(req.user, articles, isSiteAdmin(req.user)));
});

router.get("/wiki/:id", (req, res) => {
  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.redirect("/wiki");

  // Görüntülenme sayısını artır (session başına bir kez)
  const viewKey = `wiki_viewed_${req.params.id}`;
  if (!req.session[viewKey]) {
    req.session[viewKey] = true;
    article.views = (article.views || 0) + 1;
    article.save().catch(() => {});
  }

  res.send(renderWikiArticlePage(req.user, article, isSiteAdmin(req.user)));
});

router.get("/admin", (req, res) => {
  if (!req.user || !isSiteAdmin(req.user)) return res.redirect("/");
  res.send(renderAdminPage(req.user));
});

router.get("/leaderboard", (req, res) => {
  const { economies, users } = require("../../models/Store");
  const allEco = economies.find({}).sort({ balance: -1 }).slice(0, 10);
  const topUsers = allEco.map(e => {
    const user = users.findOne({ discordId: e.userId });
    return {
      username: user ? user.discordUsername : "Bilinmiyor",
      avatar: user ? user.discordAvatar : "https://cdn.discordapp.com/embed/avatars/0.png",
      balance: e.balance
    };
  });
  res.send(renderLeaderboardPage(req.user, topUsers));
});

router.get("/shop", (req, res) => {
  const { SHOP_ITEMS } = require("../../bot/config/shopItems");
  res.send(renderShopPage(req.user, SHOP_ITEMS));
});

router.get("/webhook", (req, res) => {
  res.send(renderWebhookPage(req.user));
});

module.exports = router;
