'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI, TICKET_SYSTEM_PROMPT, STORY_SYSTEM_PROMPT, PERSONAL_ASSISTANT_SYSTEM_PROMPT } = require('./aiService');
const staffAutomation = require('./staffAutomation');
const { getMarketSnapshot } = require('./marketSystem');

// ── Konfigürasyon ──────────────────────────────────────────────────────────
const GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104';

const RANDOM_DUTY_POOL = {
  'task_chat': { name: '💬 Aktif Sohbetçi', desc: 'Sohbet kanalında 15 mesaj yaz', target: 15, type: 'chat' },
  'task_voice': { name: '🎧 Ses Devriyesi', desc: 'Ses kanalında 15 dakika kal', target: 15, type: 'voice' },
  'task_ticket': { name: '🎫 Destekçi Mod', desc: 'En az 1 ticket/destek talebi çöz', target: 1, type: 'ticket' },
  'task_mod': { name: '🛡️ Düzen Muhafızı', desc: 'En az 1 moderasyon işlemi yap (Warn/Timeout)', target: 1, type: 'mod' },
  'task_greet': { name: '👋 Karşılama Elçisi', desc: 'Sohbette 3 yeni üyeye selam ver', target: 3, type: 'greet' },
  'task_word_game': { name: '🔤 Kelime Avcısı', desc: 'Kelime oyununda 5 doğru kelime yaz', target: 5, type: 'word_game' },
  'task_bom_game': { name: '💣 BOM Ustası', desc: 'BOM oyununda 5 doğru sayı yaz', target: 5, type: 'bom_game' },
  'task_report_entry': { name: '📝 Vaka Raporlama', desc: 'Vaka veya olay özetini rapor paneline gir', target: 1, type: 'report' },
  'task_community_help': { name: '🤝 Topluluk Rehberi', desc: 'Sohbette üyelere 10 mesajla rehberlik et', target: 10, type: 'chat' },
  'task_voice_presence': { name: '🎤 Ses Süresi', desc: 'Ses kanallarında en az 25 dk aktif kal', target: 25, type: 'voice' },
  'task_ticket_hero': { name: '🎟️ Ticket Çözücü', desc: 'Bugün en az 2 ticket vakası sonuçlandır', target: 2, type: 'ticket' }
};

function getRandomDutyDeck() {
  const keys = Object.keys(RANDOM_DUTY_POOL);
  const shuffled = keys.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

const CHOSEN_TASKS = {
  'task_chat': '💬 Aktif Sohbetçi: Sohbette en az 15 mesaj gönder.',
  'task_double_chat': '💬 Çift Sohbet: Sohbette en az 30 mesaj gönder.',
  'task_voice': '🎤 Ses Meraklısı: Ses kanallarında fazladan 15 dakika geçir.',
  'task_double_voice': '🎤 Ses Sever: Ses kanallarında fazladan 30 dakika geçir.',
  'task_ticket': '🎫 Destekçi: Bugün en az 1 ticket çöz.',
  'task_mod': '🛡️ Koruyucu: Bugün en az 1 moderasyon işlemi gerçekleştir.',
  'task_greet': '👋 Hoş Geldin Elçisi: Bugün en az 5 yeni üyeye hoş geldin de.',
  'task_double_greet': '👋 Hoş Geldin Lideri: Bugün en az 10 yeni üyeye hoş geldin de.',
  'task_word_game': '🔤 Kelime Avcısı: Kelime oyununda en az 5 doğru kelime yaz.',
  'task_bom_game': '💣 BOM Ustası: BOM oyununda en az 5 doğru sayı/bom yaz.',
  'task_chat_with_people': '💬 Sohbet Dostu: Sohbette insanlarla aktif olarak 20 mesaj yazış.'
};

const ROLES = {
  1: process.env.ROLE_STAJYER || '1518692395774906648', // Stajyer Personel
  2: process.env.ROLE_PERSONEL || '1518692394495643830', // Personel
  3: process.env.ROLE_GELISMIS || '1518692393660973186', // Kıdemli Personel
  4: process.env.ROLE_SEKRETER || '1518692392415395971', // Sekreter
  5: '1518709348506013706',                             // Kıdemli Sekreter
  6: '1518692391312298045',                             // Genel Koordinatör
};

const ROLE_NAMES = {
  1: '🎓 Stajyer Personel',
  2: '👔 Personel',
  3: '⭐ Kıdemli Personel',
  4: '👑 Sekreter',
  5: '👨‍✈️ Kıdemli Sekreter',
  6: '💼 Genel Koordinatör',
};

/**
 * Generates a formatted ASCII progress bar string
 */
function getProgressBar(percent, length = 10) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const filled = Math.min(length, Math.max(0, Math.round((pct / 100) * length)));
  const empty = Math.max(0, length - filled);
  return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` **%${pct}**`;
}

// ── Seviyeye özgü günlük görevler ─────────────────────────────────────────
const LEVEL_TASKS = {
  1: {
    name: 'Stajyer',
    dailyTasks: [
      '✅ Sohbet kanalına 2x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 10 dk kal (zorunlu)',
      '📚 Sunucu kurallarını oku ve hatırla',
      '👀 Diğer personelin nasıl çalıştığını izle',
      '💬 Sorularında yardım iste — öğrenmek normaldir!',
      '🎫 Ticket çözmeye başla (terfi için gerekli!)',
    ],
    rewards: '✨ Her tamamlanan gün terfi sayacına eklenir. Başarılı başlangıç yap!',
    penalties: '⏰ 3 gün görev yapmazsan rol alınır — disiplini koru!',
    tips: 'Stajyer olarak öğrenme dönemindeysin ama görevlerini aksatma!',
  },
  2: {
    name: 'Personel',
    dailyTasks: [
      '✅ Sohbet kanalına 4x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 20 dk kal (zorunlu)',
      '🎫 En az 2 ticket çözmeye çalış',
      '🚨 Kural ihlallerini raporla',
      '🛡️ En az 1 moderasyon işlemi yap',
      '💬 Yeni üyelere yardımcı ol',
    ],
    rewards: '✨ Her ticket çözümü terfi sayacına eklenir.',
    penalties: '⏰ 3 gün görev yapmazsan Stajyer\'e düşersin',
    tips: 'Personel olarak aktif olman ve moderasyon yapman bekleniyor. Sorumluluk artıyor!',
  },
  3: {
    name: 'Gelişmiş Personel',
    dailyTasks: [
      '✅ Sohbet kanalına 6x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 30 dk kal (zorunlu)',
      '🎫 Günde 3+ ticket çözmeye çalış',
      '💬 Sohbette aktif ol (haftada en az 50 mesaj)',
      '🛡️ Moderasyon kararlarında diğerlerine örnek ol',
      '📝 Sunucu gelişim önerisi yap (haftada 2)',
      '👥 Stajyerlere rehberlik et — liderlik göster!',
    ],
    rewards: '✨ Sekreterlik yolunda ilerliyor. En prestijli roldür!',
    penalties: '⏰ 3 gün görev yapmazsan Personele gerileme olur',
    tips: 'Bu seviyede liderlik becerilerin kritik. Ekibi yönet ve örnek ol!',
  },
  4: {
    name: 'Sekreter',
    dailyTasks: [
      '✅ Sohbet kanalına 10x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 60 dk kal (zorunlu)',
      '🎫 Ticket kalitesini denetle ve yönet',
      '👥 Stajyerleri eğit ve motive et',
      '📋 Haftalık personel raporu hazırla',
      '🔍 Sunucu güvenliğini aktif izle',
      '💡 Yöneticilere sunucu gelişim önerisi sun',
      '🤝 Ekibin moral duvarı ol — destek ver!',
    ],
    rewards: '👑 Sekreter rütbesinin getirdiği saygınlık ve sorumluluk sende.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreterlik gözden geçirilir',
    tips: 'Sunucunun yüzüsün. Disiplin ve liderlik göster!',
  },
  5: {
    name: "Kıdemli Sekreter",
    dailyTasks: [
      '✅ Sohbet kanalına 12x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 90 dk kal (zorunlu)',
      '🛡️ Tüm moderatör ekibini denetle ve yönet',
      '📈 Sunucu istatistiklerini raporla',
      '🤝 Yöneticilerle koordineli çalış'
    ],
    rewards: '👨‍✈️ Yüksek kademe yönetim rolü.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreterliğe gerileme olur',
    tips: 'Liderliği elden bırakma ve ekibi koordine et!'
  },
  6: {
    name: 'Genel Koordinatör',
    dailyTasks: [
      '✅ Sohbet kanalına 15x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 120 dk kal (zorunlu)',
      '👑 Tüm personel ve moderasyon operasyonlarını koordine et',
      '🎓 Yeni personellerin sınav süreçlerini tasarla',
      '📊 Haftalık/Aylık genel sunucu denetimini gerçekleştir'
    ],
    rewards: '💼 En üst ve en zorlu yetkili rütbesi.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreter\'in Babası rütbesine gerilersin',
    tips: 'En üst rütbedesin, ekibin tüm sorumluluğu senin omuzlarında!'
  }
};

// ── Günlük gereksinimler (sabit, hiç artmaz - ödül sistem seviye ile artar) ──
function getDailyRequirements(level, consecutiveDays = 0) {
  // 🔧 FIX: Multiplier kaldırıldı. Düzenli çalışan cezalandırılmak yerine ödüllendirilir
  // Ödüller checkDailyCompletion'da streakMultiplier ile artırılıyor
  const base = {
    1: { greets: 2, voiceMinutes: 10 },
    2: { greets: 4, voiceMinutes: 20 },
    3: { greets: 6, voiceMinutes: 30 },
    4: { greets: 10, voiceMinutes: 60 },
    5: { greets: 12, voiceMinutes: 90 },
    6: { greets: 15, voiceMinutes: 120 },
  };
  const b = base[level] || base[1];
  return {
    greets: b.greets,
    voiceMinutes: b.voiceMinutes,
  };
}

// ── Aktif gün az uyarı (< 2 gün) ──────────────────────────────────────────
async function checkLowActivityWarning(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  const activeDays = progress.stats?.activeDays || 0;
  const level = progress.level || 1;

  // Sadece 1 gün aktifse özel uyarı gönder
  if (activeDays === 1 && !progress.warnings?.lowActivityNotified) {
    const embed = new EmbedBuilder()
      .setColor(0xff9500)
      .setTitle('⚠️ Az Aktivite Uyarısı')
      .setDescription(
        `${ROLE_NAMES[level]} olarak **sadece 1 gün aktif** oldun. Biraz daha hareket etmemiz gerekecek!\n\n` +
        `Ne biraz acı? Hata mı yaptın? Problem var mı? Yöneticilere yazabilirsin. ✨\n\n` +
        `Şimdi **en az 2 gün aktif ol** ki sistemde dengeli kalalım. Başarabilirsin! 💪`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
      .setTimestamp();

    try {
      const user = await client.users.fetch(progress.userId);
      await user.send({ embeds: [embed] });
    } catch (_) { }

    progress.warnings.lowActivityNotified = true;
    await progress.save();
  }
}

// ── Terfi gereksinimleri (ZOR) ─────────────────────────────────────────────
const PROMOTION_REQUIREMENTS = {
  1: {
    ticketsSolved: 10,
    chatMessages: 50,
    totalVoiceMinutes: 120,
    activeDays: 10,
    moderationActions: 10,
    weeklyReports: 0,
    description: '10 ticket + 50 mesaj + 120 dk ses + 10 mod işlem + 10 gün aktif',
    promotionBonus: { points: 250, xp: 350 },
  },
  2: {
    ticketsSolved: 50,
    chatMessages: 200,
    totalVoiceMinutes: 500,
    activeDays: 25,
    moderationActions: 30,
    weeklyReports: 5,
    description: '50 ticket + 200 mesaj + 500 dk ses + 30 mod işlem + 5 rapor + 25 gün aktif',
    promotionBonus: { points: 500, xp: 750 },
  },
  3: {
    ticketsSolved: 150,
    chatMessages: 750,
    totalVoiceMinutes: 1500,
    activeDays: 45,
    moderationActions: 80,
    weeklyReports: 15,
    description: '150 ticket + 750 mesaj + 1500 dk ses + 80 mod işlem + 15 rapor + 45 gün aktif',
    promotionBonus: { points: 1000, xp: 1500 },
  },
  4: {
    ticketsSolved: 350,
    chatMessages: 1500,
    totalVoiceMinutes: 2500,
    activeDays: 60,
    moderationActions: 150,
    weeklyReports: 30,
    description: '350 ticket + 1500 mesaj + 2500 dk ses + 150 mod işlem + 30 rapor + 60 gün aktif',
    promotionBonus: { points: 2000, xp: 3000 }
  },
  5: {
    ticketsSolved: 500,
    chatMessages: 3000,
    totalVoiceMinutes: 5000,
    activeDays: 90,
    moderationActions: 250,
    weeklyReports: 45,
    description: '500 ticket + 3000 mesaj + 5000 dk ses + 250 mod işlem + 45 rapor + 90 gün aktif',
    promotionBonus: { points: 4000, xp: 5000 }
  },
  6: {
    ticketsSolved: 750,
    chatMessages: 5000,
    totalVoiceMinutes: 7500,
    activeDays: 120,
    moderationActions: 350,
    // 🔧 FIX: İmkânsız matematik - 60 rapor (420 gün) yerine 30 rapor (210 gün) yla
    weeklyReports: 30,
    description: 'Maksimum Seviye Aylık Kotası: 750 ticket + 5000 mesaj + 7500 dk ses + 120 gün aktif (Aylık/Dönemlik)',
    promotionBonus: { points: 6000, xp: 7500 }
  }
};

function todayStr() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getCurrentWeekKey(date = new Date()) {
  const current = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  current.setHours(0, 0, 0, 0);
  const day = current.getUTCDay() || 7; // Pazartesi=1, Pazar=7
  const thursday = new Date(current);
  thursday.setUTCDate(current.getUTCDate() + (4 - day));

  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function ensureWeeklyReportReset(progress, now = new Date()) {
  if (!progress.stats) progress.stats = {};
  const currentWeek = getCurrentWeekKey(now);
  if (progress.stats.weeklyReportWeek !== currentWeek) {
    progress.stats.weeklyReports = 0;
    progress.stats.weeklyReportWeek = currentWeek;
  }
}

function getTargetCheckDate() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(now);

  const partValues = {};
  for (const part of parts) {
    partValues[part.type] = part.value;
  }

  const year = parseInt(partValues.year, 10);
  const month = parseInt(partValues.month, 10) - 1; // 0-indexed
  const day = parseInt(partValues.day, 10);
  const hour = parseInt(partValues.hour, 10);

  // Create a UTC date representation using Istanbul local numbers to avoid system timezone interference
  const localDate = new Date(Date.UTC(year, month, day, hour, 0, 0, 0));

  if (hour < 4) {
    localDate.setUTCDate(localDate.getUTCDate() - 1);
  }

  const resYear = localDate.getUTCFullYear();
  const resMonth = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const resDay = String(localDate.getUTCDate()).padStart(2, '0');

  return `${resYear}-${resMonth}-${resDay}`;
}

async function hasInactivityRole(userId, client) {
  try {
    const StaffProgress = require('../../models/StaffProgress');
    const p = await StaffProgress.findOne({ userId }).catch(() => null);
    if (p && p.burnoutLeaveUntil) {
      if (new Date(p.burnoutLeaveUntil) > new Date()) {
        return true;
      } else {
        // 🔧 FIX: Mola süresi dolmuşsa otomatik temizle
        p.burnoutLeaveUntil = null;
        await p.save().catch(() => {});
        return false;
      }
    }

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return false;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;

    return member.roles.cache.some(role => {
      const name = role.name.toLowerCase();
      return name.includes('inaktif') ||
        name.includes('izinli') ||
        name.includes('inactive') ||
        name.includes('inactivity') ||
        name.includes('mazeretli') ||
        name.includes('mâzeretli');
    });
  } catch (err) {
    console.error('[staffSystem] hasInactivityRole error:', err.message);
    return false;
  }
}

async function verifyActiveStaffRole(userId, client, guildId) {
  try {
    const targetGuildId = guildId || GUILD_ID;
    const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!guild) {
      console.warn(`[staffSystem] verifyActiveStaffRole: Guild ${targetGuildId} not found. Defaulting to true.`);
      return true; // Safety fallback
    }

    let member = null;
    try {
      member = await guild.members.fetch(userId);
    } catch (e) {
      if (e.code === 10007 || e.status === 404) {
        // Unknown Member (explicitly left the server)
        console.log(`[staffSystem] verifyActiveStaffRole: User ${userId} is not a member of the guild.`);
        return false;
      }
      // Any other error (network/timeout/rate limit): treat as safety fallback (return true)
      console.warn(`[staffSystem] verifyActiveStaffRole: Failed to fetch member ${userId} due to error: ${e.message}. Defaulting to true.`);
      return true;
    }

    if (!member) return false;

    // Check if member is Administrator
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    // Check if member has at least one of the staff roles defined in ROLES
    const staffRoleIds = Object.values(ROLES);
    return staffRoleIds.some(roleId => roleId && member.roles.cache.has(roleId));
  } catch (err) {
    console.error('[staffSystem] verifyActiveStaffRole fatal error:', err.message);
    return true; // Safety fallback
  }
}

async function syncAndFilterActiveStaff(allProgress, client) {
  // Moderatör okulu sürecindeki kişilere moderatör ekibi bildirimleri gönderilmemeli
  const SCHOOL_ACTIVE_STATUSES = [
    'pending_contract',
    'in_school',
    'phase1_blocks_completed',
    'phase1_exam_submitted',
    'phase1_completed',
    'phase2_blocks_completed',
    'phase2_exam_submitted',
    'phase2_completed',
  ];
  return allProgress.filter(p => {
    const schoolStatus = p.schoolSystem?.status;
    if (schoolStatus && SCHOOL_ACTIVE_STATUSES.includes(schoolStatus)) {
      return false; // Okul sürecindeyse moderatör ekibi bildirimlerinden çıkar
    }
    return true;
  });
}

function getDailyTaskCompletionStats(progress) {
  const today = todayStr();
  const isToday = progress.daily?.date === today;

  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  if (progress.pip?.isActive && progress.pip?.signed) {
    req.greets = Math.min(req.greets * 2, 20);
    req.voiceMinutes = Math.min(req.voiceMinutes * 2, 180);
  }

  const targetVoice = req.voiceMinutes + (isToday ? (progress.daily?.transferredVoiceMinutes || 0) : 0);
  const targetGreets = req.greets + (isToday ? (progress.daily?.transferredGreets || 0) : 0);

  const greetsSent = isToday ? (progress.daily?.greetCount || 0) : 0;
  const voiceMinutes = isToday ? (progress.daily?.voiceMinutes || 0) : 0;

  const greetDone = greetsSent >= targetGreets;
  const voiceDone = voiceMinutes >= targetVoice;

  const greetPercent = targetGreets > 0 ? Math.min(100, Math.round((greetsSent / targetGreets) * 100)) : 100;
  const voicePercent = targetVoice > 0 ? Math.min(100, Math.round((voiceMinutes / targetVoice) * 100)) : 100;

  // Seçmeli zor görev (isteğe bağlı)
  let chosenTaskText = '💡 *Seçilmedi (Aşağıdaki Sistem Harekât Masası menüsünden seçebilirsiniz)*';
  let chosenTaskDone = false;

  if (progress.daily?.chosenTask && CHOSEN_TASKS[progress.daily.chosenTask]) {
    chosenTaskDone = !!progress.daily.chosenTaskCompleted;
    const taskName = CHOSEN_TASKS[progress.daily.chosenTask];
    chosenTaskText = `${chosenTaskDone ? '✅' : '⏳'} **${taskName}** ${chosenTaskDone ? '*(Tamamlandı! +Bonus Kazandın!)*' : '*(Devam Ediyor)*'}`;
  }

  const totalPercent = Math.min(100, Math.round(greetPercent * 0.45 + voicePercent * 0.45 + (chosenTaskDone ? 10 : 0)));
  const progressBar = getProgressBar(totalPercent);

  return {
    greetDone,
    voiceDone,
    greetPercent,
    voicePercent,
    totalPercent,
    progressBar,
    greetProgress: `${greetsSent}/${targetGreets}`,
    voiceProgress: `${voiceMinutes}/${targetVoice} dk`,
    greetsSent,
    targetGreets,
    voiceMinutes,
    targetVoice,
    chosenTaskText,
    chosenTaskDone
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// ╔─ MODERATÖR HİYERARŞİK DASHBOARD SİSTEMİ ──────────────────────────────────╗
// ║ 4-Seviye Navigasyon: Kategori → Alt-Kategori → Alt-Alt-Kategori → İşlem   ║
// ╚─────────────────────────────────────────────────────────────────────────────╝

/**
 * Ana Moderatör Dashboard'unu oluştur
 * Level 1: Kategori seçimi
 */
function generateModeratorDashboard() {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const embed = new EmbedBuilder()
    .setTitle('📊 MODERATÖR HİYERARŞİK YÖNETİM DASHBOARD')
    .setDescription(
      '**Hoş Geldiniz!** Aşağıda bulunan ana kategorilerden birini seçerek ' +
      'personel yönetimine başlayabilirsiniz.\n\n' +
      '🎯 **Sistem Özellikleri:**\n' +
      '• 4-Seviyeli Hiyerarşik Navigasyon\n' +
      '• Kategori → Alt-Kategori → Alt-Alt-Kategori → İşlemler\n' +
      '• Kurumsal Dashboard Tasarımı\n' +
      '• Renkli Durum İndikatörleri'
    )
    .setColor(0x2c3e50)
    .setThumbnail('https://cdn.discordapp.com/app-assets/discord.png')
    .addFields(
      { name: '👥 KATEGORİLER:', value: '`1` Personel Yönetimi | `2` Disiplin | `3` İK | `4` Sistem | `5` Raporlama', inline: false },
      { name: '⚡ HIZLI ERIŞIM:', value: 'Aşağıdaki butonlardan navigasyona başlayın', inline: false }
    )
    .setFooter({ text: 'Eko Yıldız • Moderatör Sistemi | Profesyonel Yönetim Aracı' })
    .setTimestamp();

  // Level 1: Ana Kategoriler
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mod_cat_personnel')
      .setLabel('👥 Personel Yönetimi')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥'),
    new ButtonBuilder()
      .setCustomId('mod_cat_discipline')
      .setLabel('🛡️ Disiplin')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛡️'),
    new ButtonBuilder()
      .setCustomId('mod_cat_hr')
      .setLabel('📋 İK')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mod_cat_system')
      .setLabel('⚙️ Sistem')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId('mod_cat_reporting')
      .setLabel('📊 Raporlama')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📊'),
    new ButtonBuilder()
      .setCustomId('mod_cat_settings')
      .setLabel('🔧 Ayarlar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔧')
  );

  return { embed, components: [row1, row2] };
}

/**
 * Level 2: Alt-Kategori Seçimi
 */
function getSubcategoryEmbed(category) {
  const { EmbedBuilder } = require('discord.js');

  const categories = {
    personnel: {
      title: '👥 PERSONEL YÖNETİMİ',
      description: 'Personel bilgileri, arama, rol atama ve görev yönetimi işlemleri',
      color: 0x3498db,
      subcategories: [
        { id: 'personnel_search', name: '🔍 Personel Arama', description: 'Ad, sicil numarası veya role göre personel ara' },
        { id: 'personnel_roles', name: '👑 Rol Atama', description: 'Personele rol ata veya mevcut rollerini yönet' },
        { id: 'personnel_leave', name: '📅 İzin Yönetimi', description: 'Personel izinleri kayıt et ve yönet' },
        { id: 'personnel_attendance', name: '📍 Devam Takibi', description: 'Günlük devam/devamsızlık kaydı' }
      ]
    },
    discipline: {
      title: '🛡️ DİSİPLİN İŞLEMLERİ',
      description: 'Uyarı, ceza, tedbir ve inceleme işlemleri',
      color: 0xe74c3c,
      subcategories: [
        { id: 'discipline_warnings', name: '⚠️ Uyarı Sistemi', description: 'Resmi uyarı ver ve uyarı geçmişi görüntüle' },
        { id: 'discipline_suspensions', name: '🚫 Askıya Alma', description: 'Personeli geçici olarak askıya al' },
        { id: 'discipline_reviews', name: '👁️ Disiplin İncelemeleri', description: 'Açık incelemeler ve soruşturma durumları' },
        { id: 'discipline_records', name: '📝 Disiplin Kayıtları', description: 'Tarihsel disiplin işlemlerini görüntüle' }
      ]
    },
    hr: {
      title: '📋 İNSAN KAYNAKLARI',
      description: 'Maaş, sosyal yardımlar, sözleşme ve fayda yönetimi',
      color: 0xf39c12,
      subcategories: [
        { id: 'hr_salary', name: '💰 Maaş Yönetimi', description: 'Maaş hesapla, denetçi artışları ve bonuslar' },
        { id: 'hr_benefits', name: '🎁 Sosyal Yardımlar', description: 'Sağlık, emeklilik ve diğer faydaları yönet' },
        { id: 'hr_contracts', name: '📜 Sözleşme Yönetimi', description: 'Çalışan sözleşmelerini gözden geçir ve güncelleştir' },
        { id: 'hr_promotions', name: '⬆️ Terfi Yönetimi', description: 'Terfi teklifleri ve kariyer planlama' }
      ]
    },
    system: {
      title: '⚙️ SİSTEM YÖNETİMİ',
      description: 'Sunucu ayarları, duyurular ve sistem konfigürasyonu',
      color: 0x9b59b6,
      subcategories: [
        { id: 'system_settings', name: '🔩 Sunucu Ayarları', description: 'Discord sunucu ayarlarını yapılandır' },
        { id: 'system_announcements', name: '📢 Duyurular', description: 'Tüm personele sistem duyuruları gönder' },
        { id: 'system_logs', name: '📜 Sistem Logları', description: 'Sistem ve audit loglarını görüntüle' },
        { id: 'system_backup', name: '💾 Yedekleme', description: 'Sistem verilerini yedekle ve geri yükle' }
      ]
    },
    reporting: {
      title: '📊 RAPORLAMA VE ANALİTİKS',
      description: 'İstatistikler, performans raporları ve analitik veriler',
      color: 0x1abc9c,
      subcategories: [
        { id: 'reporting_stats', name: '📈 İstatistikler', description: 'Personel ve sistem istatistiklerini göster' },
        { id: 'reporting_performance', name: '⭐ Performans Raporu', description: 'Personel performans analiz ve sıralama' },
        { id: 'reporting_audit', name: '🔍 Denetim Raporu', description: 'Tüm sistem işlemlerinin denetim izi' },
        { id: 'reporting_export', name: '📥 Rapor İndir', description: 'Raporları Excel/PDF formatında indir' }
      ]
    }
  };

  const cat = categories[category];
  if (!cat) return null;

  const embed = new EmbedBuilder()
    .setTitle(cat.title)
    .setDescription(cat.description)
    .setColor(cat.color)
    .setThumbnail('https://cdn.discordapp.com/app-assets/discord.png')
    .addFields(
      {
        name: '📍 ALT KATEGORİLER:',
        value: cat.subcategories.map(s => `**${s.name}** — ${s.description}`).join('\n\n'),
        inline: false
      },
      {
        name: '⚡ NAVIGASYON:',
        value: '✅ Aşağıdaki butonlardan alt-kategorileri seçin\n🔙 Ana Sayfaya dönmek için **GERİ** tuşuna basın',
        inline: false
      }
    )
    .setFooter({ text: 'Eko Yıldız • Alt-Kategori Seçimi' })
    .setTimestamp();

  return { embed, subcategories: cat.subcategories };
}

/**
 * Level 3: Alt-Alt-Kategori (İşlem Seçimi)
 */
function getActionEmbed(subcategoryId) {
  const { EmbedBuilder } = require('discord.js');

  const actions = {
    personnel_search: {
      title: '🔍 PERSONEL ARAMA',
      description: 'Sistemde personel bilgilerini arayın ve görüntüleyin',
      color: 0x3498db,
      actions: [
        { id: 'search_by_name', label: '👤 Ada Göre Ara', emoji: '👤', description: 'Personel adına göre ara' },
        { id: 'search_by_id', label: '🆔 Sicil No. ile Ara', emoji: '🆔', description: 'Sicil numarasına göre ara' },
        { id: 'search_by_role', label: '👑 Role Göre Ara', emoji: '👑', description: 'Belirli role sahip personelleri listele' },
        { id: 'search_active', label: '🟢 Aktif Personeli Göster', emoji: '🟢', description: 'Tüm aktif personeli listele' }
      ]
    },
    personnel_roles: {
      title: '👑 ROL ATAMA VE YÖNETİMİ',
      description: 'Personele rol atayın, kaldırın veya değiştirin',
      color: 0x3498db,
      actions: [
        { id: 'role_assign', label: '➕ Rol Ata', emoji: '➕', description: 'Personele yeni rol ata' },
        { id: 'role_remove', label: '➖ Rol Kaldır', emoji: '➖', description: 'Personelden rol çıkar' },
        { id: 'role_promote', label: '⬆️ Terfi Yap', emoji: '⬆️', description: 'Personeli daha yüksek role terfi ettir' },
        { id: 'role_demote', label: '⬇️ Hiyerarşi Aşağı Düşür', emoji: '⬇️', description: 'Personeli daha düşük role indir' }
      ]
    },
    personnel_leave: {
      title: '📅 İZİN YÖNETİMİ',
      description: 'Personel izinlerini kayıt edin ve yönetin',
      color: 0x3498db,
      actions: [
        { id: 'leave_request', label: '📝 İzin Talebi Oluştur', emoji: '📝', description: 'Yeni izin talebi ekle' },
        { id: 'leave_approve', label: '✅ İzni Onayla', emoji: '✅', description: 'Beklemede olan izni onayla' },
        { id: 'leave_reject', label: '❌ İzni Reddet', emoji: '❌', description: 'İzin talebini reddet' },
        { id: 'leave_balance', label: '📊 İzin Bakiyesi', emoji: '📊', description: 'Personel izin bakiyelerini göster' }
      ]
    },
    discipline_warnings: {
      title: '⚠️ UYARI SİSTEMİ',
      description: 'Resmi uyarı verin ve uyarı geçmişini takip edin',
      color: 0xe74c3c,
      actions: [
        { id: 'warn_issue', label: '⚠️ Uyarı Ver', emoji: '⚠️', description: 'Personele resmi uyarı ver' },
        { id: 'warn_view', label: '📋 Uyarı Geçmişi', emoji: '📋', description: 'Personelin tüm uyarılarını göster' },
        { id: 'warn_clear', label: '🗑️ Uyarı Sil', emoji: '🗑️', description: 'Belirli bir uyarıyı kayıtlardan sil' },
        { id: 'warn_stats', label: '📊 Uyarı İstatistikleri', emoji: '📊', description: 'Genel uyarı istatistiklerini göster' }
      ]
    },
    discipline_suspensions: {
      title: '🚫 ASKIYA ALMA İŞLEMLERİ',
      description: 'Personeli geçici olarak askıya alın veya yeniden aktif edin',
      color: 0xe74c3c,
      actions: [
        { id: 'susp_initiate', label: '🚫 Askıya Al', emoji: '🚫', description: 'Personeli geçici askıya al' },
        { id: 'susp_extend', label: '⏱️ Süre Uzat', emoji: '⏱️', description: 'Askıya alma süresini uzat' },
        { id: 'susp_remove', label: '✅ Askıya Alma Kaldır', emoji: '✅', description: 'Personeli aktif durama getir' },
        { id: 'susp_view', label: '👁️ Askıya Alınmış Personel', emoji: '👁️', description: 'Şu anda askıya alınmış personeli listele' }
      ]
    },
    hr_salary: {
      title: '💰 MAAŞ YÖNETİMİ',
      description: 'Maaşları hesaplayın, artırın ve bonusları yönetin',
      color: 0xf39c12,
      actions: [
        { id: 'salary_calculate', label: '🧮 Maaş Hesapla', emoji: '🧮', description: 'Aylık maaşı hesapla' },
        { id: 'salary_raise', label: '📈 Maaş Artışı', emoji: '📈', description: 'Personel maaşında artış yap' },
        { id: 'salary_bonus', label: '🎁 Bonus Ver', emoji: '🎁', description: 'Personele ek bonus öde' },
        { id: 'salary_history', label: '📜 Maaş Tarihi', emoji: '📜', description: 'Maaş değişiklikleri geçmişini göster' }
      ]
    },
    system_settings: {
      title: '🔩 SUNUCU AYARLARI',
      description: 'Discord sunucu ayarlarını yapılandırın',
      color: 0x9b59b6,
      actions: [
        { id: 'sys_channels', label: '📢 Kanal Ayarları', emoji: '📢', description: 'Sunucu kanallarını yönet' },
        { id: 'sys_roles', label: '👑 Rol Ayarları', emoji: '👑', description: 'Sunucu rollerini yapılandır' },
        { id: 'sys_perms', label: '🔐 İzin Ayarları', emoji: '🔐', description: 'Kanal ve rol izinlerini düzenle' },
        { id: 'sys_prefix', label: '⚡ Bot Komut Ayarları', emoji: '⚡', description: 'Bot prefix ve ayarlarını değiştir' }
      ]
    },
    reporting_stats: {
      title: '📈 İSTATİSTİKLER',
      description: 'Personel ve sistem istatistiklerini görüntüleyin',
      color: 0x1abc9c,
      actions: [
        { id: 'stats_personnel', label: '👥 Personel İstatistikleri', emoji: '👥', description: 'Personel sayısı, devirler vb.' },
        { id: 'stats_activity', label: '⚡ Aktivite İstatistikleri', emoji: '⚡', description: 'Sistemdeki aktivite metrikleri' },
        { id: 'stats_performance', label: '⭐ Performans Sıralaması', emoji: '⭐', description: 'Personel performans ranking' },
        { id: 'stats_trends', label: '📊 Trend Analizi', emoji: '📊', description: 'Zaman içindeki trend analizi' }
      ]
    }
  };

  const act = actions[subcategoryId];
  if (!act) return null;

  const embed = new EmbedBuilder()
    .setTitle(act.title)
    .setDescription(act.description)
    .setColor(act.color)
    .addFields(
      {
        name: '⚡ İŞLEMLER:',
        value: act.actions.map(a => `**${a.label}** — ${a.description}`).join('\n\n'),
        inline: false
      },
      {
        name: '💡 İPUÇU:',
        value: 'Aşağıdaki butonlardan gerçekleştirmek istediğiniz işlemi seçin. Tüm işlemler audit günlüğüne kaydedilecektir.',
        inline: false
      }
    )
    .setFooter({ text: 'Eko Yıldız • İşlem Seçimi' })
    .setTimestamp();

  return { embed, actions: act.actions };
}

/**
 * Level 4: İşlem Butonları Oluştur
 */
function createActionButtons(actions) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const rows = [];

  // Her 2 butona 1 row
  for (let i = 0; i < actions.length; i += 2) {
    const row = new ActionRowBuilder();
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod_action_${actions[i].id}`)
        .setLabel(actions[i].label.replace(/^[^\s]+\s+/, '')) // Emojisiz label
        .setStyle(ButtonStyle.Success)
        .setEmoji(actions[i].emoji)
    );

    if (i + 1 < actions.length) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mod_action_${actions[i + 1].id}`)
          .setLabel(actions[i + 1].label.replace(/^[^\s]+\s+/, ''))
          .setStyle(ButtonStyle.Success)
          .setEmoji(actions[i + 1].emoji)
      );
    } else {
      // Tek buton varsa GERİ butonunu ekle
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('mod_nav_back')
          .setLabel('GERİ')
          .setStyle(ButtonStyle.Danger)
      );
    }
    rows.push(row);
  }

  // Son satırda GERİ ve ANA SAYFA butonları
  if (actions.length % 2 === 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mod_nav_back')
          .setLabel('🔙 Geri')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('mod_nav_home')
          .setLabel('🏠 Ana Sayfa')
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return rows;
}

/**
 * Navigasyon durumunu sakla (kullanıcıya özel)
 */
const navigationState = new Map();

function setNavState(userId, state) {
  navigationState.set(userId, state);
}

function getNavState(userId) {
  return navigationState.get(userId) || { level: 1, category: null, subcategory: null };
}

// ── Kullanıcı al/oluştur ──────────────────────────────────────────────────────

// 🔧 FIX: String/Number tip çakışması — tüm userId sorgularını String'e normalize et
const findStaffById = (userId) => StaffProgress.findOne({ userId: String(userId) });

async function getOrCreate(userId, guildId, client) {
  if (!client) {
    try {
      const { getDiscordClient } = require('../discordClient');
      client = getDiscordClient();
    } catch (_) { }
  }

  let p = await StaffProgress.findOne({ userId: String(userId) }); // 🔧 FIX: String dönüşümü

  if (p) {
    const terminalStatuses = ['dismissed', 'resigned', 'retired'];
    if (terminalStatuses.includes(p.status)) {
      // 🔧 FIX: Sadece dismissed için log; resigned/retired normal çıkış
      if (p.status === 'dismissed') {
        console.log(`[staffSystem] getOrCreate: ${userId} kovulmuş durumda, erişim engellendi.`);
      }
      return null;
    }

    if (p.status !== 'active') {
      let hasStaffRole = false;
      if (client) {
        try {
          const targetGuildId = guildId || GUILD_ID;
          const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
          if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              const staffRoleIds = Object.values(ROLES);
              hasStaffRole = member.permissions.has(PermissionFlagsBits.Administrator) || staffRoleIds.some(roleId => roleId && member.roles.cache.has(roleId));
            }
          }
        } catch (_) { }
      }

      if (hasStaffRole) {
        p.status = 'active';
        p.dismissedAt = null;
        p.dismissReason = null;
        await p.save();
      } else {
        // 🔧 FIX: Kaydı var ama rolü yok — sadece debug log; "kovuldu" değil
        console.log(`[staffSystem] getOrCreate: ${userId} DB kaydı var ama yetkili rolü bulunamadı. Null döndürülüyor.`);
        return null;
      }
    }
    return p;
  }

  // Kayıt hiç yok — ilk girişte rol yoksa hiç log yazdırma
  let initialLevel = null;
  let hasStaffRole = false;
  if (client) {
    try {
      const targetGuildId = guildId || GUILD_ID;
      const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          for (let lvl = 6; lvl >= 1; lvl--) {
            const roleId = ROLES[lvl];
            if (roleId && member.roles.cache.has(roleId)) {
              initialLevel = lvl;
              hasStaffRole = true;
              break;
            }
          }
          if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            hasStaffRole = true;
            if (!initialLevel) initialLevel = 1;
          }
        }
      }
    } catch (err) {
      console.error('[staffSystem] Error detecting initial staff level in getOrCreate:', err.message);
    }
  }

  if (!hasStaffRole) {
    // 🔧 FIX: Yeni kullanıcı — log YOK. Kovuldu bildirimi tetiklemez
    return null;
  }

  p = new StaffProgress({
    userId: String(userId), // 🔧 FIX: Her zaman string olarak kaydet
    guildId: guildId || GUILD_ID,
    level: initialLevel || 1,
    status: 'active'
  });
  await p.save();
  return p;
}

function resetDaily(progress) {
  const today = todayStr();

  // 🔧 Güvenlik: daily objesi tanımlı değilse oluştur
  if (!progress.daily) {
    const taskKeys = ['task_chat', 'task_double_chat', 'task_voice', 'task_double_voice', 'task_ticket', 'task_mod', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
    const randomTask = taskKeys[Math.floor(Math.random() * taskKeys.length)];
    progress.daily = {
      date: today,
      startedToday: false,
      greeted: false,
      greetCount: 0,
      voiceMinutes: 0,
      chosenTask: randomTask,
      chosenTaskCompleted: false,
      chatMessagesToday: 0,
      ticketsSolvedToday: 0,
      moderationActionsToday: 0,
      overtimeActive: false,
      overtimeTask: '',
      overtimeCompleted: false,
      overtimeProgress: 0,
      overtimeTarget: 0,
      nightShiftActive: false,
      nightShiftAcceptedAt: null,
      postponedToday: false,
      transferredVoiceMinutes: 0,
      transferredGreets: 0,
      transferToTomorrowVoice: 0,
      transferToTomorrowGreets: 0,
      greetMessageId: '',
      wordGamesPlayed: 0,
      bomGamesPlayed: 0
    };
    return;
  }

  // Tarih değişmişse sıfırla
  if (progress.daily.date !== today) {
    progress.stats = progress.stats || {};
    progress.stats.lastDayPostponed = !!progress.daily.postponedToday;

    const taskKeys = ['task_chat', 'task_double_chat', 'task_voice', 'task_double_voice', 'task_ticket', 'task_mod', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];

    // Filtrele: Dünün göreviyle aynı olmasın
    const prevTask = progress.daily.chosenTask;
    let filteredKeys = taskKeys;
    if (prevTask) {
      filteredKeys = taskKeys.filter(k => k !== prevTask);
    }
    if (filteredKeys.length === 0) filteredKeys = taskKeys;
    const randomTask = filteredKeys[Math.floor(Math.random() * filteredKeys.length)];

    // Dünün ertelenen hedeflerini bugüne aktar
    const nextTransferredVoice = progress.daily.transferToTomorrowVoice || 0;
    const nextTransferredGreets = progress.daily.transferToTomorrowGreets || 0;

    progress.daily.date = today;
    progress.daily.startedToday = false;
    progress.daily.greeted = false;
    progress.daily.greetCount = 0;
    progress.daily.voiceMinutes = 0;
    progress.daily.chosenTask = randomTask;
    progress.daily.chosenTaskCompleted = false;
    progress.daily.chatMessagesToday = 0;
    progress.daily.ticketsSolvedToday = 0;
    progress.daily.moderationActionsToday = 0;

    // Ek Mesai alanlarını sıfırla
    progress.daily.overtimeActive = false;
    progress.daily.overtimeTask = '';
    progress.daily.overtimeCompleted = false;
    progress.daily.overtimeProgress = 0;
    progress.daily.overtimeTarget = 0;
    progress.daily.nightShiftActive = false;
    progress.daily.nightShiftAcceptedAt = null;

    // Görev eksiltme/aktarma alanlarını güncelle
    progress.daily.postponedToday = false;
    progress.daily.transferredVoiceMinutes = nextTransferredVoice;
    progress.daily.transferredGreets = nextTransferredGreets;
    progress.daily.transferToTomorrowVoice = 0;
    progress.daily.transferToTomorrowGreets = 0;

    // İlerleme ve Takip Alanlarını Sıfırla
    progress.daily.greetMessageId = '';
    progress.daily.wordGamesPlayed = 0;
    progress.daily.bomGamesPlayed = 0;
  }
}

async function recordGreet(userId, client, guildId = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordGreet: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, guildId || GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return;
    }

    resetDaily(p);
    if (p.daily.greetMessageId) {
      await updateGreetProgressMessage(p, client).catch(() => { p.daily.greetMessageId = ''; });
    }

    if (p.daily.greeted) {
      return;
    }

    const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
    const targetGreets = req.greets + (p.daily.transferredGreets || 0);

    p.daily.greetCount = (p.daily.greetCount || 0) + 1;
    const isGreetDoneNow = p.daily.greetCount >= targetGreets;

    if (isGreetDoneNow) {
      p.daily.greeted = true;
      if (p.daily.greetMessageId) {
        await clearGreetProgressMessage(p, client).catch(() => { p.daily.greetMessageId = ''; });
      }

      // EkoCoin İyileştirmesi: Selamlaşma için +15 EkoCoin verelim (Seri çarpanı ile!)
      if (!p.gamification) {
        p.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 }, lastDailyClaim: '' };
      }
      const consecutiveDays = p.stats?.consecutiveDays || 0;
      const streakMultiplier = consecutiveDays >= 30 ? 2.0 : (consecutiveDays >= 15 ? 1.5 : (consecutiveDays >= 5 ? 1.2 : 1.0));
      const baseGreetCoins = 15;
      const greetCoins = Math.floor(baseGreetCoins * streakMultiplier);
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + greetCoins;

      // 🔧 FIX: checkDailyCompletion içinde save() yapılacak. Burada save() yapmıyoruz (race condition)
      // DM Bildirimi gönder
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🌅 1. Görev (Selamlaşma) Başarıyla Tamamlandı!')
            .setDescription(
              `Merhaba <@${userId}>,\n\n` +
              `Moderatör ekibi kanalına bugünün tüm gerekli selamlarını gönderdin ve günlük selamlaşma görevin (1. Görev) başarıyla tamamlandı! (${targetGreets}/${targetGreets}) 🎉\n\n` +
              (streakMultiplier > 1.0 ? `🔥 **Seri Çarpanı Aktif:** \`${consecutiveDays} Gün\` ardışık aktifliğin sayesinde **x${streakMultiplier}** ödül kazandın!\n\n` : "") +
              `💰 **+${greetCoins} EkoCoin (E.C.)** cüzdanına eklendi!\n` +
              `💳 Güncel Bakiyen: \`${p.gamification.ecoCoins} E.C.\``
            )
            .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('staff_update_progress')
              .setLabel('👤 Moderatör Anasayfası')
              .setStyle(ButtonStyle.Primary)
          );

          await discordUser.send({ embeds: [embed], components: [row] }).catch(() => { });
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Greet DM error:`, dmErr.message);
      }

      // Eko Milyoneri Başarımı Kontrolü
      try {
        const { checkEcoMillionaire } = require('./achievementManager');
        await checkEcoMillionaire(userId, p.gamification.ecoCoins, client).catch(() => { });
      } catch (_) { }

      // 🔧 FIX: Burada checkDailyCompletion çağrısı tek save() yapacak
      await checkDailyCompletion(p, client).catch(err => {
        console.error('[staffSystem] checkDailyCompletion failed:', err.message);
      });
    } else {
      // Selamlaşma henüz bitmedi - sadece kuru kayıt yap
      await p.save().catch(err => {
        console.error('[staffSystem] Save failed in recordGreet progress:', err.message);
      });

      if (p.daily.greetMessageId) {
        const refreshed = await updateGreetProgressMessage(p, client).catch(() => false);
        if (refreshed) {
          return;
        }
      }

      // Send a DM notification updating the user on their greet progress
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const embed = generateGreetProgressEmbed(p);
          const components = getGreetProgressComponents();
          const sentMsg = await discordUser.send({ embeds: [embed], components }).catch(() => null);
          if (sentMsg) {
            p.daily.greetMessageId = sentMsg.id;
            await p.save().catch(() => { });
          }
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Greet progress DM error:`, dmErr.message);
      }
    }
    await checkChosenTaskCompletion(p, client).catch(() => { });
  } catch (err) {
    console.error('[staffSystem] recordGreet error:', err.message);
  }
}

async function addVoiceMinutes(userId, minutes, client) {
  try {
    if (!userId || !minutes || minutes <= 0) {
      console.warn('[staffSystem] addVoiceMinutes: Invalid parameters', { userId, minutes });
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return;
    }

    resetDaily(p);
    const req = getDailyRequirements(p.level, p.stats.consecutiveDays || 0);
    const targetVoice = req.voiceMinutes + (p.daily.transferredVoiceMinutes || 0);
    const wasVoiceDoneBefore = (p.daily.voiceMinutes || 0) >= targetVoice;

    p.daily.voiceMinutes += minutes;
    p.stats.totalVoiceMinutes = (p.stats.totalVoiceMinutes || 0) + minutes;

    p.weeklyStats = p.weeklyStats || { voiceMinutes: 0, ticketsSolved: 0, moderationActions: 0 };
    p.weeklyStats.voiceMinutes = (p.weeklyStats.voiceMinutes || 0) + minutes;

    try {
      const StaffUnit = require('../../models/StaffUnit');
      const UnitBudget = require('../../models/UnitBudget');
      const userUnit = await StaffUnit.findOne({ userId });
      if (userUnit && userUnit.unitName) {
        const raw = (userUnit.unitName || '').toString().trim();
        const normalizedUnitName = raw.toUpperCase().includes('_BIRIMI') ? raw.toUpperCase() : `${raw.toUpperCase()}_BIRIMI`;
        let ub = await UnitBudget.findOne({ unitName: normalizedUnitName });
        if (!ub) {
          ub = new UnitBudget({ unitName: normalizedUnitName });
        }
        // FIX: Saatlik limit (60 dakika = 5 TL / 10 Elmas) ve günlük cap (50 TL / 100 Elmas)
        const dailyBudgetCap = 50;
        const dailyDiamondsCap = 100;
        const minuteRate = 1/12; // 60 dakika = 5 TL (0.083 TL per dakika)
        const diamondRate = 1/6;  // 60 dakika = 10 Elmas (0.167 Elmas per dakika)
        
        const budgetGain = Math.min(minutes * minuteRate, dailyBudgetCap - (ub.budget || 0));
        const diamondsGain = Math.min(minutes * diamondRate, dailyDiamondsCap - (ub.diamonds || 0));
        
        ub.budget = (ub.budget || 0) + budgetGain;
        ub.diamonds = (ub.diamonds || 0) + diamondsGain;
        await ub.save();
      }
    } catch (e) {
      console.error('[staffSystem] Unit budget increment error in voice:', e.message);
    }

    // Log voice activity to active duty session
    try {
      const { logDutyActivity } = require('./staffDutyService');
      await logDutyActivity(userId, 'voice', minutes);
    } catch (_) { }

    const isVoiceDoneNow = (p.daily.voiceMinutes || 0) >= targetVoice;

    if (!wasVoiceDoneBefore && isVoiceDoneNow) {
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎙️ 2. Görev (Ses Aktifliği) Başarıyla Tamamlandı!')
            .setDescription(
              `Merhaba <@${userId}>,\n\n` +
              `Bugünkü ses aktifliği göreviniz (**${targetVoice} dakika**) başarıyla tamamlandı! 🎉\n\n` +
              `Ses kanallarında aktif kalarak görevinizi yerine getirdiniz. Tebrikler! 🎤`
            )
            .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('staff_update_progress')
              .setLabel('👤 Moderatör Anasayfası')
              .setStyle(ButtonStyle.Primary)
          );

          await discordUser.send({ embeds: [embed], components: [row] }).catch(() => { });
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Voice task completion DM error:`, dmErr.message);
      }
    }

    // Ek Mesai / Ek Görev (Ses) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && (p.daily.overtimeTask === 'task_voice' || p.daily.overtimeTask === 'overtime_voice')) {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + minutes;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    // YENİ: Ses aktifliği için E.C. kazanımı (Saatte 15 E.C. -> Dakikada 0.25 E.C.)
    // Bunu sadece 60'ın katlarında veya saat başı hesaplayabiliriz ya da küsüratlı verip gösterebiliriz.
    // Şimdilik 60 dakikada bir toplu ödül verelim:
    const oldHours = Math.floor((p.stats.totalVoiceMinutes - minutes) / 60);
    const newHours = Math.floor(p.stats.totalVoiceMinutes / 60);
    if (newHours > oldHours) {
      const hoursGained = newHours - oldHours;
      const ecGained = hoursGained * 15;
      await addEkoCoin(p, ecGained, client, 'Sesli Kanal Aktifliği');
    }

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed in addVoiceMinutes:', err.message);
      return;
    });
    await checkChosenTaskCompletion(p, client).catch(() => { });
    await checkDailyCompletion(p, client).catch(err => {
      console.error('[staffSystem] checkDailyCompletion failed:', err.message);
    });
    try {
      const { checkAutoPromotion } = require('./unitService');
      await checkAutoPromotion(userId, client, 'voice').catch(() => { });
    } catch (_) { }
  } catch (err) {
    console.error('[staffSystem] addVoiceMinutes error:', err.message);
  }
}

// ── EkoCoin Ekleme ve Bildirim ─────────────────────────────────────────────
async function addEkoCoin(progress, amount, client, reason) {
  progress.gamification = progress.gamification || {};
  // Apply today's theme multiplier if action matches theme
  try {
    const theme = getTodayTheme();
    const lowerReason = (reason || '').toString().toLowerCase();
    let multiplier = 1;
    if (theme && theme.key) {
      // 🔧 FIX: Grid, Payroll, Auction günlerinin bonus kontrolü eklendi
      if ((theme.key === 'ticket' && /ticket|bilet/i.test(reason)) ||
        (theme.key === 'grid' && /grid|sektör|savunma/i.test(reason)) ||
        (theme.key === 'payroll' && /maaş|bordro|vip/i.test(reason)) ||
        (theme.key === 'auction' && /ihale|magazin/i.test(reason)) ||
        (theme.key === 'trading' && /elmas|borsa|kaldıraç|trade|al-?sat/i.test(reason)) ||
        (theme.key === 'justice' && /mahkeme|adalet|jüri|sicil/i.test(reason)) ||
        (theme.key === 'redacted' && /redacted|operasyon|istihbarat|ajan/i.test(reason))) {
        multiplier = theme.bonusMultiplier || 1.5;
      }
    }
    const applied = Math.ceil(amount * multiplier);
    progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + applied;
    // Adjust reason to include multiplier note
    reason = reason ? `${reason} (x${multiplier})` : `Görev Ödülü (x${multiplier})`;
  } catch (err) {
    progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + amount;
  }

  if (client) {
    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
      const user = await client.users.fetch(progress.userId);
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🎯 Görev Tamamlandı!')
        .setDescription(`**${reason}** görevini başarıyla bitirdin. Diğer göreve başlamak için aşağıdaki butona tıklayabilirsin!`)
        .setFooter({ text: 'Eko Yıldız • Personel Sistemi' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('talk_to_coach')
          .setLabel('👤 Mod Anasayfası')
          .setStyle(ButtonStyle.Primary)
      );

      await user.send({ embeds: [embed], components: [row] }).catch(() => { });
    } catch (_) { }
  }
}

// ── Daily Theme Helpers ─────────────────────────────────────────────────
function getTodayTheme(now = null) {
  const tzDate = new Date((now || new Date()).toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const day = tzDate.getDay(); // 0 Sun .. 6 Sat
  // Map: 1 Mon Ticket, 2 Tue Grid, 3 Wed Justice, 4 Thu Trading, 5 Fri Redacted Ops, 6 Sat Payroll, 0 Sun Auction
  const map = {
    1: { key: 'ticket', name: 'Lojistik & Destek (Ticket Günü)', emoji: '🟢', short: 'Ticket & Lojistik', recommended: 'Ticket çözümü ve birim lojistiği', bonusMultiplier: 1.5 },
    2: { key: 'grid', name: 'Sektör Savunma (Grid Control)', emoji: '🔴', short: 'Sektör & Savunma', recommended: 'Izgara Kontrol ve Savunma', bonusMultiplier: 1.3 },
    3: { key: 'justice', name: 'Adalet & Denetim', emoji: '🟡', short: 'Mahkeme & Sicil', recommended: 'Yapay Zeka Mahkemesi görevlerini incele', bonusMultiplier: 1.4 },
    4: { key: 'trading', name: 'Kaldıraç & Finans (Borsa Günü)', emoji: '🔵', short: 'Eko-Borsa', recommended: 'Al-Sat, Elmas & Kaldıraç', bonusMultiplier: 1.5 },
    5: { key: 'redacted', name: 'Gizli Teşkilat & İstihbarat', emoji: '🟣', short: 'Redacted Ops', recommended: 'Siber istihbarat görevlerini kontrol et', bonusMultiplier: 1.4 },
    6: { key: 'payroll', name: 'Bordro & VIP (Hafta Sonu)', emoji: '🟡', short: 'Maaş & VIP', recommended: 'Haftalık maaş kontrolü ve VIP mağaza', bonusMultiplier: 1.2 },
    0: { key: 'auction', name: 'İhale & Magazin (Pazar)', emoji: '🏆', short: 'İhale Masası', recommended: 'Personel ihalelerine katıl', bonusMultiplier: 1.1 }
  };
  return map[day] || map[1];
}

// ── Mod işlem kaydı (yeni) ─────────────────────────────────────────────────
const recentlyRewardedModActions = new Map();
const REWARD_DEDUP_WINDOW_MS = 10000; // 10 saniye

async function recordModerationAction(userId, client, targetUserId = null, actionType = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordModerationAction: Invalid userId');
      return;
    }

    // Mükerrer ödüllendirme/sayma kontrolü (10 saniye içinde aynı yetkili ve aynı hedef kullanıcı için tekil işlem)
    if (targetUserId && actionType) {
      const key = `${userId}:${targetUserId}`;
      const lastTime = recentlyRewardedModActions.get(key);
      if (lastTime && (Date.now() - lastTime) < REWARD_DEDUP_WINDOW_MS) {
        console.log(`[staffSystem] Duplicate moderation action reward blocked for ${userId} on ${targetUserId} (${actionType})`);
        return;
      }
      recentlyRewardedModActions.set(key, Date.now());

      // Bellek temizliği
      if (recentlyRewardedModActions.size > 500) {
        const now = Date.now();
        for (const [k, v] of recentlyRewardedModActions) {
          if (now - v > REWARD_DEDUP_WINDOW_MS) recentlyRewardedModActions.delete(k);
        }
      }
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    if (p.probationStatus) {
      if (!p.probationSigned) return;

      const { ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`probation_approve_${userId}_mod`).setLabel('✅ İşlemi Onayla').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`probation_reject_${userId}_mod`).setLabel('❌ İşlemi Reddet').setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('👥 İK Gelişim Süreci Onayı - Moderasyon İşlemi')
        .setDescription(`İK Gelişim Sözleşmesi (Probation) kapsamındaki yetkili <@${userId}> bir moderasyon işlemi gerçekleştirdi. Yetkili performansına eklenmesini onaylıyor musunuz?`)
        .setTimestamp();

      const { CHANNELS } = require('./staffAutomation');
      const logChan = await client.channels.fetch(CHANNELS.TERFI_LOG).catch(() => null);
      if (logChan && logChan.isTextBased()) {
        await logChan.send({ embeds: [embed], components: [row] });
      }
      return;
    }

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.moderationActions = (p.stats.moderationActions || 0) + 1;
    p.daily.moderationActionsToday = (p.daily.moderationActionsToday || 0) + 1;

    p.weeklyStats = p.weeklyStats || { voiceMinutes: 0, ticketsSolved: 0, moderationActions: 0 };
    p.weeklyStats.moderationActions = (p.weeklyStats.moderationActions || 0) + 1;

    try {
      const StaffUnit = require('../../models/StaffUnit');
      const UnitBudget = require('../../models/UnitBudget');
      const userUnit = await StaffUnit.findOne({ userId });
      if (userUnit && userUnit.unitName) {
        const raw = (userUnit.unitName || '').toString().trim();
        const normalizedUnitName = raw.toUpperCase().includes('_BIRIMI') ? raw.toUpperCase() : `${raw.toUpperCase()}_BIRIMI`;
        let ub = await UnitBudget.findOne({ unitName: normalizedUnitName });
        if (!ub) {
          // 🔧 FIX: userUnit.unitName yerine normalizedUnitName kullan (Birim kasası bölünmesi sorunu)
          ub = new UnitBudget({ unitName: normalizedUnitName });
        }
        ub.budget = (ub.budget || 0) + 5; // 5 TL per mod action
        ub.diamonds = (ub.diamonds || 0) + 20; // 20 diamonds per mod action
        await ub.save();
      }
    } catch (e) {
      console.error('[staffSystem] Unit budget increment error in mod:', e.message);
    }

    // Log mod activity to active duty session
    try {
      const { logDutyActivity } = require('./staffDutyService');
      await logDutyActivity(userId, 'mod', 1);
    } catch (_) { }

    // Ek Görev (Mod) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && p.daily.overtimeTask === 'task_mod') {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + 1;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    // YENİ: E.C. Kazandır
    await addEkoCoin(p, 10, client, 'Moderasyon İşlemi');

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkChosenTaskCompletion(p, client).catch(() => { });
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordModerationAction error:', err.message);
  }
}

// ── Haftalık rapor kaydı (yeni) ────────────────────────────────────────────
async function recordWeeklyReport(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordWeeklyReport: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);
    ensureWeeklyReportReset(p, new Date());

    p.stats.weeklyReports = (p.stats.weeklyReports || 0) + 1;
    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordWeeklyReport error:', err.message);
  }
}

function addChatMessage(p) {
  if (p && p.stats) {
    p.stats.chatMessages = (p.stats.chatMessages || 0) + 1;
  }
}

async function checkDailyCompletion(progress, client) {
  // 🔧 Güvenlik: Objeler tanımlı değilse oluştur
  if (!progress.stats) progress.stats = {};
  if (!progress.daily) progress.daily = { date: '', greeted: false, voiceMinutes: 0 };
  if (!progress.warnings) progress.warnings = { count: 0 };

  // 🔧 FIX: Moladayken DM göndermesini kapat (burnoutLeaveUntil check)
  const isOnBreak = progress.burnoutLeaveUntil && new Date(progress.burnoutLeaveUntil) > new Date();
  
  // 🔧 FIX: Mola süresi dolduysa otomatik sıfırla (kapanmayan mola sorunu)
  if (progress.burnoutLeaveUntil && new Date(progress.burnoutLeaveUntil) <= new Date()) {
    progress.burnoutLeaveUntil = null;
  }

  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
  const targetVoice = req.voiceMinutes + (progress.daily.transferredVoiceMinutes || 0);

  const greetDone = progress.daily.greeted;
  const voiceDone = progress.daily.voiceMinutes >= targetVoice;

  // ✅ BUGFIX: lastCompleteDay'in bugün olup olmadığını kontrol et
  const alreadyCompletedToday = progress.stats.lastCompleteDay === today;

  if (greetDone && voiceDone && !alreadyCompletedToday && !isOnBreak) {
    // Görev tamamlandı ve bugün ilk kez tamamlanıyor
    progress.stats.activeDays = (progress.stats.activeDays || 0) + 1;
    progress.stats.consecutiveDays = (progress.stats.consecutiveDays || 0) + 1;
    progress.stats.lastCompleteDay = today;
    progress.warnings.count = 0;

    // 🎮 Gamification: Günlük görev tamamlama ödülü
    if (!progress.gamification) {
      progress.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 }, lastDailyClaim: '' };
    }
    const levelMultiplier = 1 + (progress.level * 0.25); // Seviye arttıkça daha fazla ödül
    progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + Math.floor(25 * levelMultiplier); // Günlük 25+ puan
    progress.gamification.currentXP = (progress.gamification.currentXP || 0) + Math.floor(100 * levelMultiplier); // Günlük 100+ XP

    // EkoCoin İyileştirmesi: Tüm görevlerin tamamlanması halinde EkoCoin ödülü (Seri çarpanı ile!)
    const consecutiveDays = progress.stats?.consecutiveDays || 0;
    const streakMultiplier = consecutiveDays >= 30 ? 2.0 : (consecutiveDays >= 15 ? 1.5 : (consecutiveDays >= 5 ? 1.2 : 1.0));
    const baseCoinReward = Math.floor(40 * levelMultiplier);
    const coinReward = Math.floor(baseCoinReward * streakMultiplier);
    progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + coinReward;

    // Görev tamamlama mesajı gönder (moladayken değilse)
    if (client && !isOnBreak) {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const taskEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎉 GÜNLÜK GÖREVLER TAMAMLANDI!')
        .setDescription(
          `Tebrikler <@${progress.userId}>, bugünün tüm günlük görevlerini (Selamlaşma + Ses Aktifliği) başarıyla tamamladın!\n\n` +
          `✨ **+${Math.floor(100 * levelMultiplier)} XP** kazanıldı!\n` +
          (streakMultiplier > 1.0 ? `🔥 **Seri Çarpanı Aktif:** \`${consecutiveDays} Gün\` ardışık aktifliğin sayesinde **x${streakMultiplier}** ödül kazandın!\n\n` : "") +
          `💰 **+${coinReward} EkoCoin (E.C.)** kazanıldı!\n` +
          `💳 Güncel Bakiyen: \`${progress.gamification.ecoCoins} E.C.\``
        )
        .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('staff_update_progress')
          .setLabel('👤 Moderatör Anasayfası')
          .setStyle(ButtonStyle.Primary)
      );

      try {
        const user = await client.users.fetch(progress.userId);
        await user.send({ embeds: [taskEmbed], components: [row] }).catch(() => { });
      } catch (_) { }
    }

    // Eko Milyoneri Başarımı Kontrolü
    try {
      const { checkEcoMillionaire } = require('./achievementManager');
      await checkEcoMillionaire(progress.userId, progress.gamification.ecoCoins, client).catch(() => { });
    } catch (_) { }

    // Level up kontrol et
    const nextLevelXp = getXpForLevel((progress.gamification.level || 1) + 1);
    if (progress.gamification.currentXP >= nextLevelXp) {
      progress.gamification.level = (progress.gamification.level || 1) + 1;
      progress.gamification.currentXP = 0;

      // Level up mesajı gönder (moladayken değilse)
      if (client && progress.gamification.level > 1 && !isOnBreak) {
        const levelEmbed = new EmbedBuilder()
          .setColor(0xff006e)
          .setTitle(`🎉 LEVEL UP! ${progress.gamification.level}`)
          .setDescription(`Seni görüyoruz! Her görev seni daha güçlü yapıyor! 🚀`)
          .setFooter({ text: 'Eko Yıldız • Gamification' })
          .setTimestamp();

        try {
          const user = await client.users.fetch(progress.userId);
          await user.send({ embeds: [levelEmbed] });
        } catch (_) { }
      }
    }

    await progress.save().catch(err => {
      console.error('[staffSystem] Save failed in checkDailyCompletion:', err.message);
    });

    console.log(`[staffSystem] ${progress.userId} günlük görev tamamlandı — ${progress.stats.activeDays} gün`);
    await checkPromotion(progress, client);
  }
}

async function checkChosenTaskCompletion(progress, client) {
  try {
    if (!progress.daily || !progress.daily.chosenTask || progress.daily.chosenTaskCompleted) return;

    let completed = false;
    const task = progress.daily.chosenTask;

    if (task === 'task_chat') {
      if ((progress.daily.chatMessagesToday || 0) >= 15) {
        completed = true;
      }
    } else if (task === 'task_double_chat') {
      if ((progress.daily.chatMessagesToday || 0) >= 30) {
        completed = true;
      }
    } else if (task === 'task_voice') {
      const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
      if ((progress.daily.voiceMinutes || 0) >= req.voiceMinutes + 15) {
        completed = true;
      }
    } else if (task === 'task_double_voice') {
      const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
      if ((progress.daily.voiceMinutes || 0) >= req.voiceMinutes + 30) {
        completed = true;
      }
    } else if (task === 'task_ticket') {
      if ((progress.daily.ticketsSolvedToday || 0) >= 1) {
        completed = true;
      }
    } else if (task === 'task_mod') {
      if ((progress.daily.moderationActionsToday || 0) >= 1) {
        completed = true;
      }
    } else if (task === 'task_greet') {
      if ((progress.daily.greetCount || 0) >= 5) {
        completed = true;
      }
    } else if (task === 'task_double_greet') {
      if ((progress.daily.greetCount || 0) >= 10) {
        completed = true;
      }
    } else if (task === 'task_word_game') {
      if ((progress.daily.wordGamesPlayed || 0) >= 5) {
        completed = true;
      }
    } else if (task === 'task_bom_game') {
      if ((progress.daily.bomGamesPlayed || 0) >= 5) {
        completed = true;
      }
    } else if (task === 'task_chat_with_people') {
      if ((progress.daily.chatMessagesToday || 0) >= 20) {
        completed = true;
      }
    } else if (task === 'task_practice_scenario') {
      if ((progress.daily.practiceScenariosSolvedToday || 0) >= 1) {
        completed = true;
      }
    } else if (task === 'task_incident_report') {
      if ((progress.daily.incidentReportsToday || 0) >= 1) {
        completed = true;
      }
    } else if (task === 'task_duty_shift') {
      if ((progress.daily.dutyMinutesToday || 0) >= 30) {
        completed = true;
      }
    }

    if (completed) {
      progress.daily.chosenTaskCompleted = true;

      // FIXED: %25 yerine SABIT değerler - Rütbeye bağlı değil
      // Her görev tamamlanması = +2 Ticket, +10 Mesaj, +30 Ses Dk, +1 Aktif Gün
      const FIXED_TASK_BONUS = {
        ticketsSolved: 2,
        chatMessages: 10,
        totalVoiceMinutes: 30,
        activeDays: 1,
        moderationActions: 1,
        weeklyReports: 0
      };

      progress.stats.ticketsSolved = (progress.stats.ticketsSolved || 0) + FIXED_TASK_BONUS.ticketsSolved;
      progress.stats.chatMessages = (progress.stats.chatMessages || 0) + FIXED_TASK_BONUS.chatMessages;
      progress.stats.totalVoiceMinutes = (progress.stats.totalVoiceMinutes || 0) + FIXED_TASK_BONUS.totalVoiceMinutes;
      progress.stats.activeDays = (progress.stats.activeDays || 0) + FIXED_TASK_BONUS.activeDays;
      progress.stats.moderationActions = (progress.stats.moderationActions || 0) + FIXED_TASK_BONUS.moderationActions;

      await progress.save().catch(err => {
        console.error('[staffSystem] Save failed in checkChosenTaskCompletion:', err.message);
      });

      try {
        const { addNotification } = require("../../utils/notification");
        await addNotification(progress.userId, {
          title: "🎯 Seçmeli Görev Tamamlandı!",
          message: `Bugünün seçimli görevi olan "${CHOSEN_TASKS[task] || task}" başarıyla tamamlandı. Terfi hedeflerinize sabit bonus verildi!`,
          icon: "🎉"
        });
      } catch (nErr) {
        console.error("[staffSystem] checkChosenTaskCompletion notification error:", nErr.message);
      }

      // DM tebrik mesajı gönder
      if (client) {
        const discordUser = await client.users.fetch(progress.userId).catch(() => null);
        if (discordUser) {
          const taskLabel = CHOSEN_TASKS[task] || task;
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎯 Seçmeli Görev Başarıyla Tamamlandı!')
            .setDescription(
              `Tebrikler <@${progress.userId}>, bugünün seçimli görevi olan **"${taskLabel}"** başarıyla tamamlandı! 🎉\n\n` +
              `🚀 **Ödülünüz:** +${FIXED_TASK_BONUS.ticketsSolved} Ticket, +${FIXED_TASK_BONUS.chatMessages} Mesaj, +${FIXED_TASK_BONUS.totalVoiceMinutes} Ses Dk \n` +
              `Terfi hedeflerinize sabit bonus eklendi! 💪`
            )
            .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
            .setTimestamp();

          await discordUser.send({ embeds: [embed] }).catch(() => { });
        }
      }

      // Terfi durumunu kontrol et
      await checkPromotion(progress, client).catch(() => { });
    }
  } catch (err) {
    console.error('[staffSystem] checkChosenTaskCompletion error:', err.message);
  }
}

async function recordTicketSolved(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordTicketSolved: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    if (p.probationStatus) {
      if (!p.probationSigned) return;

      const { ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`probation_approve_${userId}_ticket`).setLabel('✅ İşlemi Onayla').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`probation_reject_${userId}_ticket`).setLabel('❌ İşlemi Reddet').setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('👥 İK Gelişim Süreci Onayı - Bilet Çözümü')
        .setDescription(`İK Gelişim Sözleşmesi (Probation) kapsamındaki yetkili <@${userId}> bir bilet çözdü. Yetkili performansına eklenmesini onaylıyor musunuz?`)
        .setTimestamp();

      const { CHANNELS } = require('./staffAutomation');
      const logChan = await client.channels.fetch(CHANNELS.TERFI_LOG).catch(() => null);
      if (logChan && logChan.isTextBased()) {
        await logChan.send({ embeds: [embed], components: [row] });
      }
      return;
    }

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
    p.daily.ticketsSolvedToday = (p.daily.ticketsSolvedToday || 0) + 1;

    p.weeklyStats = p.weeklyStats || { voiceMinutes: 0, ticketsSolved: 0, moderationActions: 0 };
    p.weeklyStats.ticketsSolved = (p.weeklyStats.ticketsSolved || 0) + 1;

    try {
      const StaffUnit = require('../../models/StaffUnit');
      const UnitBudget = require('../../models/UnitBudget');
      const userUnit = await StaffUnit.findOne({ userId });
      if (userUnit && userUnit.unitName) {
        const raw = (userUnit.unitName || '').toString().trim();
        const normalizedUnitName = raw.toUpperCase().includes('_BIRIMI') ? raw.toUpperCase() : `${raw.toUpperCase()}_BIRIMI`;
        let ub = await UnitBudget.findOne({ unitName: normalizedUnitName });
        if (!ub) {
          ub = new UnitBudget({ unitName: normalizedUnitName });
        }
        ub.budget = (ub.budget || 0) + 10; // 10 TL per ticket
        ub.diamonds = (ub.diamonds || 0) + 50; // 50 diamonds per ticket
        await ub.save();
      }
    } catch (e) {
      console.error('[staffSystem] Unit budget increment error in ticket:', e.message);
    }

    // Log ticket activity to active duty session
    try {
      const { logDutyActivity } = require('./staffDutyService');
      await logDutyActivity(userId, 'ticket', 1);
    } catch (_) { }

    // Ek Görev (Ticket) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && p.daily.overtimeTask === 'task_ticket') {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + 1;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    // 🎮 Gamification: XP ve Puan ekle
    if (!p.gamification) {
      p.gamification = {
        totalPoints: 0,
        level: 1,
        currentXP: 0,
        badges: {},
        streak: { current: 0, longest: 0, brokenDays: 0 },
        challengeProgress: {},
      };
    }

    // 📊 Seviye-bazlı puan artışı (sınıflandırma teşviki) - ⬆️ ARTTIRILDI
    const levelMultiplier = 1 + (p.level * 0.25); // Level arttıkça daha fazla puan (0.2 → 0.25)
    const xpGain = Math.floor(85 * levelMultiplier); // Ticket başına 85+ XP (55 → 85)
    const pointsGain = Math.floor(20 * levelMultiplier); // Ticket başına 20+ puan (12 → 20)
    p.gamification.totalPoints = (p.gamification.totalPoints || 0) + pointsGain;
    p.gamification.currentXP = (p.gamification.currentXP || 0) + xpGain;

    // Level up kontrol et
    const nextLevelXp = getXpForLevel((p.gamification.level || 1) + 1);
    if (p.gamification.currentXP >= nextLevelXp) {
      p.gamification.level = (p.gamification.level || 1) + 1;
      p.gamification.currentXP = 0;

      // Level up mesajı gönder
      if (client && p.gamification.level > 1) {
        const levelEmbed = new EmbedBuilder()
          .setColor(0xff006e)
          .setTitle(`🎉 LEVEL UP! ${p.gamification.level}`)
          .setDescription(`Seni görüyoruz! Her ticket seni daha güçlü yapıyor! 🚀`)
          .setFooter({ text: 'Eko Yıldız • Gamification' })
          .setTimestamp();

        try {
          const user = await client.users.fetch(userId);
          await user.send({ embeds: [levelEmbed] });
        } catch (_) { }
      }
    }

    // Sert çalışma takibi: gün içinde 3+ ticket = haftada 1 gün izin hediyesi
    if (!p.stats.dailyTicketsToday) p.stats.dailyTicketsToday = 0;
    p.stats.dailyTicketsToday += 1;

    if (p.stats.dailyTicketsToday % 2 === 0) {
      p.stats.breakCredits = (p.stats.breakCredits || 0) + 1;
      await sendBreakRewardDM(p, client).catch(err => {
        console.warn(`[staffSystem] sendBreakRewardDM error for ${userId}:`, err.message);
      });
    }

    // Hız ustası rozeti kontrol et
    if (p.stats.dailyTicketsToday === 5 && !p.gamification.badges?.speedRunner) {
      await checkAndUnlockBadges(p, client);
    }

    // YENİ: Gizli Başarım (Günde 30 Ticket)
    if (p.stats.dailyTicketsToday === 30) {
      try {
        const user = await client.users.fetch(userId);
        const secretEmbed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('🔥 GİZLİ BAŞARIM AÇILDI: Efsanevi Çalışan!')
          .setDescription('Bugün tam 30 ticket çözdün! Bu muazzam bir başarı! Sana özel **+1000 E.C.** bonus hediye ediyoruz!')
          .setFooter({ text: 'Eko Yıldız • Gizli Başarımlar' });
        await user.send({ embeds: [secretEmbed] }).catch(() => { });
        await addEkoCoin(p, 1000, client, 'GİZLİ BAŞARIM: Efsanevi Çalışan (30 Ticket)');
      } catch (_) { }
    }

    // YENİ: E.C. Kazandır
    await addEkoCoin(p, 5, client, 'Ticket Çözümü');

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed in recordTicketSolved:', err.message);
      return;
    });

    // Rozetleri kontrol et
    await checkAndUnlockBadges(p, client).catch(() => { });
    await checkChosenTaskCompletion(p, client).catch(() => { });

    // 🎫 Ticket görevi ilerleme DM'i
    await sendTicketTaskProgressDM(p, client).catch(() => { });

    try {
      const { checkAutoPromotion } = require('./unitService');
      await checkAutoPromotion(userId, client, 'ticket').catch(() => { });
    } catch (_) { }

    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordTicketSolved error:', err.message);
  }
}

/**
 * Ticket çözümü sonrası personele görev ilerleme DM'i gönderir.
 * - Ticket görevi varsa: progress bar + kaç tane kaldı
 * - Ticket görevi yoksa: EK GÖREV mesajı + %30 bonus teklifi
 */
async function sendTicketTaskProgressDM(p, client) {
  if (!client) return;
  const discordUser = await client.users.fetch(p.userId).catch(() => null);
  if (!discordUser) return;

  const hasTicketTask = p.daily?.chosenTask === 'task_ticket';
  const nextReq = PROMOTION_REQUIREMENTS[p.level];
  const solved = p.stats.ticketsSolved || 0;
  const required = nextReq?.ticketsSolved || 1;
  const pct = Math.min(100, Math.round((solved / required) * 100));

  // Progress bar oluştur (20 blok)
  const filled = Math.round(pct / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

  if (hasTicketTask && !p.daily?.chosenTaskCompleted) {
    // Görev var ve henüz tamamlanmadı — ilerleme göster
    const solvedToday = p.daily?.ticketsSolvedToday || 0;
    const taskTarget = 1; // task_ticket = 1 ticket
    const taskPct = Math.min(100, Math.round((solvedToday / taskTarget) * 100));
    const taskFilled = Math.round(taskPct / 5);
    const taskBar = '█'.repeat(taskFilled) + '░'.repeat(20 - taskFilled);

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('🎫 Ticket Görevi — İlerleme Güncellendi')
      .setDescription(
        `**Bugünkü Ticket Görevi Durumu:**\n` +
        `\`[${taskBar}] ${taskPct}%\`\n` +
        `📊 Bugün: **${solvedToday}/${taskTarget}** ticket çözüldü\n\n` +
        `**Terfi İlerlemen (Ticket):**\n` +
        `\`[${bar}] ${pct}%\`\n` +
        `🎯 Toplam: **${solved}/${required}** ticket\n\n` +
        `💪 Devam et! Görevi tamamlamak **%25 terfi katkısı** sağlıyor!`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    await discordUser.send({ embeds: [embed] }).catch(() => { });

  } else if (!hasTicketTask) {
    // Ticket görevi YOK — özel bonus mesajı
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🎫 TİCKET GÖREVİN YOKKEN TİCKET GÖREVİNİ YAPTIN!')
      .setDescription(
        `Tebrikler! Bugün seçmeli görevin **ticket çözümü** olmadığı hâlde ticket çözdün! 🔥\n\n` +
        `**Terfi İlerlemen (Ticket):**\n` +
        `\`[${bar}] ${pct}%\`\n` +
        `🎯 Toplam: **${solved}/${required}** ticket\n\n` +
        `🎁 **EK GÖREV TAMAMLADIN!**\n` +
        `1 tane daha ek görev yaparsan **dilediğin rütbe terfi alma görevin** yapılmış olarak sayılacak!\n\n` +
        `> 💡 **%30 bonus** - Bu extra görevi tamamladığında terfi gereksinimlerinin **%30'u** otomatik olarak doldurulur.`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi — Ek Görev Sistemi' })
      .setTimestamp();

    await discordUser.send({ embeds: [embed] }).catch(() => { });

    // %30 bonus ekle (extra görev ödülü olarak işaretle)
    if (!p.daily) p.daily = {};
    if (!p.daily.extraTicketBonusGiven) {
      p.daily.extraTicketBonusGiven = true;
      // Terfi istatistiklerine %30 katkı
      if (nextReq) {
        const bonus30 = (val, req) => Math.ceil((req || 0) * 0.30);
        p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + bonus30(null, nextReq.ticketsSolved);
        p.stats.chatMessages = (p.stats.chatMessages || 0) + bonus30(null, nextReq.chatMessages);
        p.stats.totalVoiceMinutes = (p.stats.totalVoiceMinutes || 0) + bonus30(null, nextReq.totalVoiceMinutes);
        p.stats.activeDays = (p.stats.activeDays || 0) + bonus30(null, nextReq.activeDays);
        p.stats.moderationActions = (p.stats.moderationActions || 0) + bonus30(null, nextReq.moderationActions);
      }
      await p.save().catch(() => { });
    }
  }
  // Görev zaten tamamlandıysa sessizce çık (checkChosenTaskCompletion kendi DM'ini gönderir)
}

async function recordChatMessage(userId, client, guildId = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordChatMessage: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, guildId || GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.chatMessages = (p.stats.chatMessages || 0) + 1;
    p.daily.chatMessagesToday = (p.daily.chatMessagesToday || 0) + 1;

    // Ek Görev (Sohbet) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && p.daily.overtimeTask === 'task_chat') {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + 1;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkAndUnlockBadges(p, client).catch(() => { });
    await checkChosenTaskCompletion(p, client).catch(() => { });
    try {
      const { checkAutoPromotion } = require('./unitService');
      await checkAutoPromotion(userId, client, 'chat').catch(() => { });
    } catch (_) { }
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordChatMessage error:', err.message);
  }
}

async function checkPromotion(progress, client) {
  try {
    if (!progress || !progress.stats) {
      console.warn('[staffSystem] checkPromotion: Invalid progress object');
      return;
    }

    const currentLevel = progress.level || 1;
    const req = PROMOTION_REQUIREMENTS[currentLevel];
    if (!req) {
      console.debug(`[staffSystem] No promotion requirements for level ${currentLevel}`);
      return;
    }

    const stats = progress.stats;
    
    // 🔧 FIX: Bilet kontrolü eklendi - bedava terfi açığı kapatıldı
    // Ticket çözmek terfi şartı ama bilet sayısı kontrolü yapılmıyordu
    const hasEnoughTickets = (stats.ticketsSolved || 0) >= req.ticketsSolved;
    
    // 🔧 FIX: Ses süresi kontrolü eklendi - seste 1 dk durmayan adama terfi butonu çıkıyor
    const hasEnoughVoice = (stats.totalVoiceMinutes || 0) >= req.totalVoiceMinutes;
    
    const ok =
      hasEnoughTickets &&
      hasEnoughVoice &&
      (stats.chatMessages || 0) >= req.chatMessages &&
      (stats.activeDays || 0) >= req.activeDays &&
      (stats.moderationActions || 0) >= req.moderationActions &&
      (stats.weeklyReports || 0) >= req.weeklyReports;

    if (ok) {
      // 🔧 FIX: Seviye 6 şartları tanımlandı ama currentLevel >= 6 return'ü vardı
      // Seviye 6'dan sonra terfi sınavı açılmayacağı için kontrol kalkalıldı
      // if (currentLevel >= 6) { return; } <- BU SATIR HATALI

      // Sınav zaten planlanmış ve tarihi geçmişse anında tetikle (catch-up)
      if (progress.exam && progress.exam.status === 'scheduled' && progress.exam.scheduledAt) {
        const scheduledDate = new Date(progress.exam.scheduledAt);
        const now = new Date();
        
        // 🔧 FIX: Saat uyuşmazlığı — sadece en az 1 saat geçmişse catch-up yap
        // "Yeni planlandı" durumundan ayırt etmek için 1 saat tampon kullan
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const isGenuinelyPast = scheduledDate <= oneHourAgo;
        
        if (isGenuinelyPast) {
          try {
            const { checkActiveExams } = require('./aiExamService');
            if (client) {
              console.log(`[staffSystem] checkPromotion catch-up: ${progress.userId} sınav tarihi geçmiş (${scheduledDate.toISOString()}), tetikleniyor.`);
              await checkActiveExams(client);
            }
          } catch (catchupErr) {
            console.error('[staffSystem] checkPromotion catch-up error:', catchupErr.message);
          }
        }
        return; // Zaten sınav planlanmış, yeniden planlama yapma
      }

      // Seviye 6'da ise başarılı tamamlama mesajı gönder
      if (currentLevel >= 6) {
        console.log(`[staffSystem] ${progress.userId} Seviye 6 (Genel Koordinatör) maksimum seviyede. Tebrikler!`);
        
        try {
          const user = await client.users.fetch(progress.userId).catch(() => null);
          if (user) {
            const maxLevelEmbed = new EmbedBuilder()
              .setColor(0xffd700)
              .setTitle('🏆 MAKSİMUM SEVİYE ULAŞILDI!')
              .setDescription(
                `Tebrikler! Seviye 6 (Genel Koordinatör) rütbesinin tüm şartlarını karşıladın!\n\n` +
                `🏅 Bu sunucunun en yüksek rütbesine ulaştın. Ekibi yönet, sunucuyu büyüt!`
              )
              .setTimestamp();
            await user.send({ embeds: [maxLevelEmbed] }).catch(() => {});
          }
        } catch (_) {}
        return;
      }
      // Her rütbe geçişinde terfi yerine sınav sürecini başlat
      if (!progress.exam || progress.exam.status === 'none') {
        try {
          const targetLevel = currentLevel + 1;
          const targetRoleName = ROLE_NAMES[targetLevel] || `Seviye ${targetLevel}`;

          const { generateExamQuestions } = require('./aiExamService');
          const questions = await generateExamQuestions(targetLevel);

          const scheduled = new Date();
          scheduled.setDate(scheduled.getDate() + 2); // 2 gün sonra
          scheduled.setHours(12, 0, 0, 0); // Öğlen 12:00

          progress.exam = {
            status: 'scheduled',
            scheduledAt: scheduled,
            questions: questions,
            currentQuestionIndex: 0,
            answers: [],
            lastExamAttempt: null
          };
          await progress.save();

          try {
            const { addNotification } = require("../../utils/notification");
            await addNotification(progress.userId, {
              title: "🎓 Terfi Sınavına Hak Kazandınız!",
              message: `Tebrikler! ${targetRoleName} rütbesine terfi etmek için gerekli tüm koşulları başarıyla tamamladınız ve sınava hak kazandınız.`,
              icon: "🎓"
            });
          } catch (nErr) {
            console.error("[staffSystem] checkPromotion notification error:", nErr.message);
          }

          // DM Gönder
          const user = await client.users.fetch(progress.userId).catch(() => null);
          if (user) {
            const infoEmbed = new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle(`🎓 TEBRİKLER! ${targetRoleName} Terfi Sınavına Hak Kazandın!`)
              .setDescription(
                `Merhaba <@${progress.userId}>, **${targetRoleName}** rütbesine terfi etmek için gerekli tüm koşulları başarıyla tamamladın!\n\n` +
                `Bu yeni rütbeye ulaşabilmen için **10 soruluk çoktan seçmeli bir Yapay Zeka Sınavı**'nı başarıyla geçmen gerekiyor.\n\n` +
                `📅 **Sınav Tarihi:** ${scheduled.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Öğlen 12:00)\n\n` +
                `📋 **Sınav İpuçları & Bilgileri:**\n` +
                `• Sınavda en az **8 doğru** yapman gerekmektedir.\n` +
                `• Konular: Yetki düzeyinize uygun moderasyon standartları, sunucu kuralları ve yönetim rehberi.\n` +
                `• Sınav saati geldiğinde bot sana otomatik olarak bir DM gönderecektir.\n\n` +
                `Hazırlanmak için 2 günün var, bol şans! 💪`
              )
              .setFooter({ text: 'Eko Yıldız • Sınav ve Eğitim Sistemi' })
              .setTimestamp();
            await user.send({ embeds: [infoEmbed] }).catch(() => { });
          }
          console.log(`[staffSystem] ${progress.userId} has qualified for Level ${targetLevel} exam. Scheduled at: ${scheduled}`);
        } catch (e) {
          console.error('[staffSystem] Sınav planlanırken hata:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[staffSystem] checkPromotion error:', err.message);
  }
}

async function promote(progress, client) {
  try {
    if (!progress || !client) {
      console.warn('[staffSystem] promote: Missing progress or client');
      return;
    }

    const oldLevel = progress.level || 1;
    const newLevel = oldLevel + 1;
    if (newLevel > 6) return;

    // 🎁 Terfi bonusu ekle
    const req = PROMOTION_REQUIREMENTS[oldLevel];
    if (req && req.promotionBonus) {
      progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + req.promotionBonus.points;
      progress.gamification.currentXP = (progress.gamification.currentXP || 0) + req.promotionBonus.xp;
    }

    progress.level = newLevel;
    progress.promotedAt = new Date();
    // İstatistik sıfırla
    progress.stats.ticketsSolved = 0;
    progress.stats.chatMessages = 0;
    progress.stats.totalVoiceMinutes = 0;
    progress.stats.activeDays = 0;
    progress.stats.moderationActions = 0;
    progress.stats.weeklyReports = 0;

    await progress.save().catch(err => {
      console.error('[staffSystem] Save failed in promote:', err.message);
      return;
    });

    // ── Role management ──────────────────────────────────────────────────────
    const guild = await client.guilds.fetch(GUILD_ID).catch(err => {
      console.warn(`[staffSystem] Guild ${GUILD_ID} not found:`, err.code);
      return null;
    });

    if (!guild) {
      console.error(`[staffSystem] Cannot access guild ${GUILD_ID} for role assignment`);
      return;
    }

    const member = await guild.members.fetch(progress.userId).catch(err => {
      console.warn(`[staffSystem] Member ${progress.userId} not found:`, err.code);
      return null;
    });
    if (!member) {
      console.warn(`[staffSystem] Cannot access member ${progress.userId} for role assignment`);
      return;
    }

    const oldRoleId = ROLES[oldLevel];
    const newRoleId = ROLES[newLevel];

    // Eski rolü kaldır
    if (oldRoleId) {
      await member.roles.remove(oldRoleId, 'Terfi').catch(roleErr => {
        console.warn(`[staffSystem] Cannot remove old role (${oldRoleId}):`, roleErr.code, roleErr.message);
        if (roleErr.code === 50) {
          console.error('[staffSystem] ⚠️ Bot missing ManageRoles permission');
        }
      });
    }

    // Yeni rolü ekle
    if (newRoleId) {
      await member.roles.add(newRoleId, 'Terfi').catch(roleErr => {
        console.warn(`[staffSystem] Cannot add new role (${newRoleId}):`, roleErr.code, roleErr.message);
        if (roleErr.code === 50) {
          console.error('[staffSystem] ⚠️ Bot missing ManageRoles permission');
        }
      });
    }

    await staffAutomation.syncMainGuildRoles(client, progress.userId).catch(() => { });

    const isFinal = newLevel === 6;
    const embed = new EmbedBuilder()
      .setColor(isFinal ? 0xffd700 : 0x4ade80)
      .setTitle(isFinal ? '🏆 TEBRİKLER! Genel Koordinatör oldun!' : `🎉 TERFİ! ${ROLE_NAMES[newLevel]}`)
      .setDescription(
        isFinal
          ? `Eko Yıldız'ın en üst yetkili rütbesi olan **Genel Koordinatör** rütbesine ulaştın! Bu sınavı geçerek yetkinliğini kanıtladın. Başarılar dileriz! 💼`
          : `**${ROLE_NAMES[oldLevel]}** → **${ROLE_NAMES[newLevel]}**\n\n${getNextRequirementsText(newLevel)}`
      )
      .addFields(
        { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        { name: '📊 Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    try {
      const user = await client.users.fetch(progress.userId);
      await user.send({ embeds: [embed] });
    } catch (dmErr) {
      console.warn(`[staffSystem] Cannot send promotion DM to ${progress.userId}:`, dmErr.code);
    }

    // YENİ: Roblox Rütbelerini Senkronize Et
    await staffAutomation.syncStaffRobloxRanks(client, progress.userId);

    // YENİ: Yönetim Discorduna Log Gönder
    await staffAutomation.sendAdminLog(client, 'TERFI_LOG', embed);

    // YENİ: Yönetim Listesini Güncelle
    await staffAutomation.updateDynamicModList(client);

    console.log(`[staffSystem] ${progress.userId} promoted to level ${newLevel}`);
  } catch (err) {
    console.error('[staffSystem] promote error:', err.message);
  }
}

async function demote(progress, client, reason = "Belirtilmedi") {
  try {
    const oldLevel = progress.level;
    const newLevel = oldLevel - 1;

    if (newLevel < 1) {
      console.warn(`[staffSystem] Personel ${progress.userId} zaten en düşük rütbede.`);
      return false;
    }

    progress.level = newLevel;
    progress.promotedAt = new Date();
    await progress.save();

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return false;

    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return false;

    const oldRoleId = ROLES[oldLevel];
    const newRoleId = ROLES[newLevel];

    if (oldRoleId) {
      await member.roles.remove(oldRoleId, `Tenzilat: ${reason}`).catch(() => { });
    }
    if (newRoleId) {
      await member.roles.add(newRoleId, `Tenzilat: ${reason}`).catch(() => { });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle(`📉 TENZİLAT! ${ROLE_NAMES[newLevel]}`)
      .setDescription(`**${ROLE_NAMES[oldLevel]}** → **${ROLE_NAMES[newLevel]}**\n\nMaalesef rütben düşürüldü.\n**Sebep:** ${reason}`)
      .addFields(
        { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        { name: '📊 Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    try {
      const user = await client.users.fetch(progress.userId);
      await user.send({ embeds: [embed] });
    } catch (dmErr) { }

    const staffAutomation = require('./staffAutomation');
    await staffAutomation.syncStaffRobloxRanks(client, progress.userId);
    await staffAutomation.syncStaffDiscordRoles(client, progress.userId);
    await staffAutomation.sendAdminLog(client, 'TERFI_LOG', embed);
    await staffAutomation.updateDynamicModList(client);

    return true;
  } catch (err) {
    console.error('[staffSystem] demote error:', err.message);
    return false;
  }
}

function getNextRequirementsText(level) {
  const req = PROMOTION_REQUIREMENTS[level];
  if (!req) return '🏆 En üst seviyeye ulaştın! Sunucu seni sayıyor! 💫';
  const lines = [
    req.ticketsSolved > 0 && `• ${req.ticketsSolved} ticket çöz (Her biri insanı mutlu ediyor!)`,
    req.chatMessages > 0 && `• ${req.chatMessages} mesaj gönder (Sohbet kanalında aktif ol!)`,
    req.totalVoiceMinutes > 0 && `• ${req.totalVoiceMinutes} dk sesli sohbette bulun (Oyuncularla iç içe!)`,
    req.moderationActions > 0 && `• ${req.moderationActions} moderasyon işlemi (Adil ve nazik ol!)`,
    req.weeklyReports > 0 && `• ${req.weeklyReports} haftalık rapor (Yöneticilere görünürlük!)`,
    req.activeDays > 0 && `• ${req.activeDays} gün aktif ol (Haftaları taksitle yapabilirsin!)`,
  ].filter(Boolean);
  const dailyReq = getDailyRequirements(level);
  lines.push(`\n📅 **Günlük (Çok Kolay):**\n• ${dailyReq.greets}x selam\n• ${dailyReq.voiceMinutes} dk ses`);
  lines.push(`\n💪 **Başarabilirsin!** İlk başta zor görünür ama yavaş yavaş alışırsın.`);
  return lines.join('\n');
}

// ── AI Sabah Brifing DM'i ─────────────────────────────────────────────────
async function sendMorningBriefing(progress, client) {
  const briefingEnabled = progress.settings?.dailyBriefingEnabled !== false;

  if (!briefingEnabled) {
    console.log(`[staffSystem] Daily briefing disabled for user ${progress.userId}. Skipping DM.`);
  }

  if (await hasInactivityRole(progress.userId, client)) return;

  const StaffUnit = require('../../models/StaffUnit');
  let userUnit = null;
  try {
    userUnit = await StaffUnit.findOne({ userId: progress.userId });
  } catch (err) {
    console.error('[staffSystem] sendMorningBriefing unit fetch error:', err.message);
  }

  resetDaily(progress);

  let allowedTasks = ['task_chat', 'task_double_chat', 'task_voice', 'task_double_voice', 'task_ticket', 'task_mod', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
  if (userUnit && userUnit.unitName) {
    if (userUnit.unitName === 'BAN_BIRIMI') {
      allowedTasks = ['task_ticket', 'task_mod'];
    } else if (userUnit.unitName === 'SES_BIRIMI') {
      allowedTasks = ['task_voice', 'task_double_voice'];
    } else if (userUnit.unitName === 'SOHBET_BIRIMI') {
      allowedTasks = ['task_chat', 'task_double_chat', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
    }
  }

  // 🔧 FIX: chosenTask ataması briefing kapalı olsa bile her zaman yapılmalı
  // Aksi halde briefingi kapatan yetkililere görev tanımlanmıyor → terfi yavaşlıyor
  if (!progress.daily.chosenTask || !allowedTasks.includes(progress.daily.chosenTask)) {
    const prevTask = progress.daily.chosenTask;
    
    let filteredTasks = allowedTasks;
    if (prevTask && allowedTasks.includes(prevTask)) {
      const differentTasks = allowedTasks.filter(t => t !== prevTask);
      if (differentTasks.length > 0) {
        filteredTasks = differentTasks;
      } else {
        filteredTasks = allowedTasks;
      }
    }
    if (filteredTasks.length === 0) filteredTasks = allowedTasks;

    const randomTask = filteredTasks[Math.floor(Math.random() * filteredTasks.length)];
    progress.daily.chosenTask = randomTask;
    progress.daily.chosenTaskCompleted = false;
    await progress.save().catch(() => { });
  }

  // Brifing kapalıysa burada dur — görev atanmış ama DM gönderilmez
  if (!briefingEnabled) return;

  try {
    const embed = await generateMorningBriefingEmbed(progress, client);
    const components = await getMorningBriefingComponents(progress);
    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (user) {
      await user.send({ embeds: [embed], components }).catch(() => { });
      console.log(`[staffSystem] Morning briefing sent to ${progress.userId}`);
    }
  } catch (err) {
    console.error('[staffSystem] sendMorningBriefing send error:', err.message);
  }
}

function isPromotionEligible(progress) {
  if (!progress || !progress.stats) return false;
  const currentLevel = progress.level || 1;
  const req = PROMOTION_REQUIREMENTS[currentLevel];
  if (!req) return false;

  const s = progress.stats;
  const ticketsOk = (s.ticketsSolved || 0) >= (req.ticketsSolved || 0);
  const chatOk = (s.chatMessages || 0) >= (req.chatMessages || 0);
  const activeDaysOk = (s.activeDays || 0) >= (req.activeDays || 0);
  const modActionsOk = (s.moderationActions || 0) >= (req.moderationActions || 0);
  const reportsOk = (s.weeklyReports || 0) >= (req.weeklyReports || 0);

  return ticketsOk && chatOk && activeDaysOk && modActionsOk && reportsOk;
}

async function generateMorningBriefingEmbed(progress, client) {
  resetDaily(progress);

  // Initialize briefing settings if missing
  if (!progress.briefingSettings) {
    progress.briefingSettings = {
      enabledSections: {
        greeting: true,
        status: true,
        promotion: true,
        tasks: true,
        quickLinks: true
      },
      order: ['greeting', 'status', 'promotion', 'tasks', 'quickLinks']
    };
  }

  const enabled = progress.briefingSettings.enabledSections || {};
  const order = progress.briefingSettings.order || ['greeting', 'status', 'promotion', 'tasks', 'quickLinks'];

  const fieldsMap = {};

  // 1. ☀️ SABAH SELAMASI
  if (enabled.greeting !== false) {
    let aiMessage = '';
    let displayName = progress.userId;
    try {
      const u = await client.users.fetch(progress.userId).catch(() => null);
      if (u) displayName = u.globalName || u.username;
    } catch (_) { }

    const prompt = `${displayName} için samimi 1-2 cümlelik sabah selaması yap. Şehir: ${progress.city || 'Türkiye'}. Cümleler sorgulamadan olmalı (nokta ile bitmeli).`;
    aiMessage = await chatWithAI([{ role: 'user', content: prompt }]).catch(() => '');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'Günaydın! 💪';

    fieldsMap['greeting'] = { name: '☀️ Sabah Selamı', value: aiMessage, inline: false };
  }

  // 2. ⚡ DURUM & NÖBET
  if (enabled.status !== false) {
    let statusText = '';
    if (progress.burnoutLeaveUntil && new Date(progress.burnoutLeaveUntil) > new Date()) {
      const endTime = Math.floor(progress.burnoutLeaveUntil.getTime() / 1000);
      statusText = `☕ **İsteğe Bağlı Kahve Molasında** (<t:${endTime}:R>)`;
    } else if (progress.duty?.isActive) {
      const mins = Math.floor((Date.now() - new Date(progress.duty.startedAt)) / 1000 / 60);
      const hrs = Math.floor(mins / 60);
      statusText = `🟢 **Aktif Nöbette** (${hrs}h ${mins % 60}m)`;
    } else {
      statusText = `🔴 **Serbest**`;
    }
    fieldsMap['status'] = { name: '⚡ Durum', value: statusText, inline: true };
  }

  // 3. 🚀 TERFİ YOLU
  if (enabled.promotion !== false) {
    const eligible = isPromotionEligible(progress);
    const nextReq = PROMOTION_REQUIREMENTS[progress.level];

    if (eligible) {
      fieldsMap['promotion'] = {
        name: '🚀 Terfi Durumu',
        value: `🎉 **TERFİYE HAK KAZANDINIZ!** ✅\nTüm terfi şartları (%100) başarıyla tamamlandı. Aşağıdaki **\`🚀 TERFİ ET / SINAVA GİR\`** butonuna basarak rütbenizi yükseltebilirsiniz!`,
        inline: false
      };
    } else if (nextReq) {
      const s = progress.stats || {};
      const pct = Math.min(100, Math.floor(((s.ticketsSolved || 0) / (nextReq.ticketsSolved || 1)) * 100));
      let promText = `⭐ **${ROLE_NAMES[progress.level]}** ➔ 👑 **${ROLE_NAMES[progress.level + 1] || 'Üst Rütbe'}**\n`;
      promText += `🎫 Ticket: \`${s.ticketsSolved || 0}/${nextReq.ticketsSolved}\` | 💬 Mesaj: \`${s.chatMessages || 0}/${nextReq.chatMessages}\`\n`;
      promText += `📅 Gün: \`${s.activeDays || 0}/${nextReq.activeDays}\` | 🛡️ Mod: \`${s.moderationActions || 0}/${nextReq.moderationActions}\`\n${getProgressBar(pct)}`;
      fieldsMap['promotion'] = { name: '🚀 Terfi Yolu', value: promText, inline: false };
    }
  }

  // 4. 📋 BUGÜNKÜ GÖREV ÖZETİ
  if (enabled.tasks !== false) {
    const stats = getDailyTaskCompletionStats(progress);
    let tasksText =
      `📌 **Zorunlu Günlük Görevler:**\n` +
      `💬 **Sohbet & Selamlaşma:** \`${stats.greetProgress}\` ${stats.greetDone ? '✅' : '⏳'}\n` +
      `🎤 **Ses Kanalı Süresi:** \`${stats.voiceProgress}\` ${stats.voiceDone ? '✅' : '⏳'}\n\n` +
      `🎯 **Seçmeli Ek Görev (İsteğe Bağlı Bonus):**\n` +
      `${stats.chosenTaskText}\n\n` +
      `📊 **İlerleme:** ${stats.progressBar}`;

    fieldsMap['tasks'] = {
      name: `📋 Bugünkü Görev Özeti`,
      value: tasksText,
      inline: false
    };
  }

  // 5. 💡 HIZLI ERİŞİM VE DETAYLAR REHBERİ
  if (enabled.quickLinks !== false) {
    fieldsMap['quickLinks'] = {
      name: '💡 Hızlı Detaylar & Analiz',
      value: '*Cüzdan, Borsa, Detaylı KPI ve Disiplin geçmişiniz için aşağıdaki menüyü kullanabilirsiniz.*',
      inline: false
    };
  }

  // Assemble fields according to order
  const fields = [];
  for (const key of order) {
    if (fieldsMap[key]) {
      fields.push(fieldsMap[key]);
    }
  }

  if (fields.length === 0) {
    fields.push({
      name: '⚙️ Brifing Özelleştirildi',
      value: 'Tüm bölümler kapalı. Açmak için **"⚙️ Brifing Ayarları"** menüsünü kullanın.',
      inline: false
    });
  }

  const avatar = (await client.users.fetch(progress.userId).catch(() => null))?.displayAvatarURL?.({ size: 128 }) || null;
  const eligible = isPromotionEligible(progress);

  let displayName = progress.userId;
  try {
    const u = await client.users.fetch(progress.userId).catch(() => null);
    if (u) displayName = u.globalName || u.username;
  } catch (_) { }

  const embed = new EmbedBuilder()
    .setColor(eligible ? 0x2ecc71 : progress.level >= 4 ? 0xFFD700 : progress.level >= 3 ? 0x4ade80 : 0x7c6af7)
    .setAuthor({ name: `👤 ${displayName} | ${ROLE_NAMES[progress.level] || 'Moderatör'}`, iconURL: avatar })
    .setTitle('☀️ Günlük Yetkili Brifingi')
    .setThumbnail(avatar)
    .addFields(fields)
    .setFooter({ text: `Sentara V6.0 | ${progress.city || 'TR'}` })
    .setTimestamp();

  return embed;
}

function generateBriefingSettingsEmbed(progress) {
  if (!progress.briefingSettings) {
    progress.briefingSettings = {
      enabledSections: { greeting: true, status: true, promotion: true, tasks: true, quickLinks: true },
      order: ['greeting', 'status', 'promotion', 'tasks', 'quickLinks']
    };
  }

  const enabled = progress.briefingSettings.enabledSections || {};

  const embed = new EmbedBuilder()
    .setTitle('⚙️ GÜNLÜK BRİFİNG AYARLARI VE ÖZELLEŞTİRME')
    .setColor(0x7c6af7)
    .setDescription(
      'Moderatör Anasayfası Brifinginizde gösterilecek alanları seçebilir ve görünümünü özelleştirebilirsiniz.\n\n' +
      '**Mevcut Bölüm Durumları:**\n' +
      `☀️ **Sabah Selamı:** ${enabled.greeting !== false ? '✅ Açık' : '❌ Kapalı'}\n` +
      `⚡ **Durum & Nöbet:** ${enabled.status !== false ? '✅ Açık' : '❌ Kapalı'}\n` +
      `🚀 **Terfi Yolu & İlerleme:** ${enabled.promotion !== false ? '✅ Açık' : '❌ Kapalı'}\n` +
      `📋 **Görev Özeti:** ${enabled.tasks !== false ? '✅ Açık' : '❌ Kapalı'}\n` +
      `💡 **Hızlı Detaylar & İpuçları:** ${enabled.quickLinks !== false ? '✅ Açık' : '❌ Kapalı'}\n\n` +
      '*Aşağıdaki butonları kullanarak bölümleri açıp kapatabilir veya varsayılana sıfırlayabilirsiniz.*'
    )
    .setFooter({ text: 'Eko Yıldız • Brifing Ayarları' })
    .setTimestamp();

  return embed;
}

function getBriefingSettingsComponents(progress) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const enabled = progress.briefingSettings?.enabledSections || {};

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_briefing_toggle_greeting')
      .setLabel(`☀️ Selam: ${enabled.greeting !== false ? 'Kapat' : 'Aç'}`)
      .setStyle(enabled.greeting !== false ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('staff_briefing_toggle_status')
      .setLabel(`⚡ Durum: ${enabled.status !== false ? 'Kapat' : 'Aç'}`)
      .setStyle(enabled.status !== false ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('staff_briefing_toggle_promotion')
      .setLabel(`🚀 Terfi: ${enabled.promotion !== false ? 'Kapat' : 'Aç'}`)
      .setStyle(enabled.promotion !== false ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_briefing_toggle_tasks')
      .setLabel(`📋 Görevler: ${enabled.tasks !== false ? 'Kapat' : 'Aç'}`)
      .setStyle(enabled.tasks !== false ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('staff_briefing_toggle_quickLinks')
      .setLabel(`💡 İpuçları: ${enabled.quickLinks !== false ? 'Kapat' : 'Aç'}`)
      .setStyle(enabled.quickLinks !== false ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('staff_briefing_reset_settings')
      .setLabel('🔄 Sıfırla')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_briefing_return_home')
      .setLabel('🔙 Anasayfaya Dön')
      .setStyle(ButtonStyle.Primary)
  );

  return [row1, row2, row3];
}

function generateTutorialEmbed(step = 1) {
  const embed = new EmbedBuilder().setColor(0x7c6af7).setTimestamp();

  if (step === 1) {
    embed
      .setTitle('🔰 MODERATÖR ANASAYFASI REHBERİ (1/3) — Nöbet ve Durum')
      .setDescription(
        '**Hoş Geldiniz!** Moderatör Anasayfasına ilk girişinizde sistemin temel kullanımını keşfedelim:\n\n' +
        '🟢 **`⚡ Nöbete Başla / Bitir` Butonu:**\n' +
        'Sunucuda aktif şekilde görev yapmaya başladığınızda nöbeti başlatırsınız. Nöbet süreniz, aktifliğiniz ve puanlarınız otomatik kaydedilir.\n\n' +
        '✍️ **`✍️ Rapor Gir` Paneli:**\n' +
        'Gün içinde çözdüğünüz vakaları ve aldığınız notları rapor paneline aktarabilirsiniz.\n\n' +
        '🔄 **`🔄 Güncelle`:**\n' +
        'Anasayfa verilerinizi anlık olarak yeniler.\n\n' +
        '*Devam etmek için aşağıdaki **"▶️ Sonraki Adım"** butonuna basın.*'
      )
      .setFooter({ text: 'Adım 1 / 3 — Nöbet & Durum Yönetimi' });
  } else if (step === 2) {
    embed
      .setTitle('🔰 MODERATÖR ANASAYFASI REHBERİ (2/3) — Terfi ve Görev İlerlemesi')
      .setDescription(
        '🚀 **Terfi Yolu ve Görev Takibi:**\n\n' +
        '🎫 **Ticket, Sohbet ve Ses Süreleri:**\n' +
        'Anasayfadaki canlı ilerleme çubuğu (`[████░░░░░░] %40`), bir sonraki rütbeye geçmek için gereken şartları göstermektedir.\n\n' +
        '🎉 **Otomatik Terfi İzni:**\n' +
        'Şartlar %100 olduğunda otomatik **`🚀 TERFİ ET / SINAVA GİR`** butonu belirir.\n\n' +
        '*Devam etmek için aşağıdaki **"▶️ Sonraki Adım"** butonuna basın.*'
      )
      .setFooter({ text: 'Adım 2 / 3 — Terfi Yolu & KPI' });
  } else {
    embed
      .setTitle('🔰 MODERATÖR ANASAYFASI REHBERİ (3/3) — Özelleştirme ve Ayarlar')
      .setDescription(
        '⚙️ **Briefing Özelleştirme & İşlem Menüsü:**\n\n' +
        '📊 **Detaylı İşlem Menüsü:**\n' +
        'Aşağıdaki açılır menüden Cüzdan bakiyenizi, Borsa durumunu, Liderlik tablosunu ve Maaş talebini yönetebilirsiniz.\n\n' +
        '⚙️ **Brifing Ayarları:**\n' +
        'İstediğiniz zaman Brifinginizdeki bölümleri gizleyebilir, açabilir veya özelleştirebilirsiniz.\n\n' +
        '☕ **Kahve Molası:**\n' +
        'Yoğun günlerde 15 dakikalık mola alarak dinlenebilirsiniz.\n\n' +
        '🎉 **Tebrikler! Rehberi tamamladınız. Artık hazırsınız!**'
      )
      .setFooter({ text: 'Adım 3 / 3 — Tamamlama' });
  }

  return embed;
}

function getTutorialComponents(step = 1) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const row = new ActionRowBuilder();

  if (step > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_tutorial_prev_${step}`)
        .setLabel('◀️ Önceki Adım')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (step < 3) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_tutorial_next_${step}`)
        .setLabel('▶️ Sonraki Adım')
        .setStyle(ButtonStyle.Primary)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('staff_tutorial_finish')
      .setLabel(step === 3 ? '✅ Rehberi Tamamla & Anasayfaya Geç' : '⏩ Rehberi Atla')
      .setStyle(step === 3 ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return [row];
}

async function getMorningBriefingComponents(progress) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

  const isOnDuty = !!progress?.duty?.isActive;
  const eligible = isPromotionEligible(progress);

  // Row 1: Anlık Operasyonlar (Refresh | Duty | Terfi | Rapor)
  const refreshBtn = new ButtonBuilder()
    .setCustomId('staff_update_progress')
    .setLabel('🔄 Güncelle')
    .setStyle(ButtonStyle.Secondary);

  const reportBtn = new ButtonBuilder()
    .setCustomId('staff_daily_report_btn')
    .setLabel('✍️ Rapor Gir')
    .setStyle(ButtonStyle.Secondary);

  const dutyPrimaryBtn = new ButtonBuilder()
    .setCustomId(isOnDuty ? 'staff_duty_end' : 'staff_duty_start')
    .setLabel(isOnDuty ? '🛑 Nöbeti Bitir' : '⚡ Nöbete Başla')
    .setStyle(isOnDuty ? ButtonStyle.Danger : ButtonStyle.Success);

  const rowTop = new ActionRowBuilder();
  rowTop.addComponents(refreshBtn, dutyPrimaryBtn, reportBtn);

  if (eligible) {
    const claimPromBtn = new ButtonBuilder()
      .setCustomId('staff_claim_promotion')
      .setLabel('🚀 TERFİ ET / SINAVA GİR')
      .setStyle(ButtonStyle.Success);
    rowTop.addComponents(claimPromBtn);
  }

  // Row 2: Sub-Menu (Sadeleştirilmiş İşlem Menüsü)
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('staff_briefing_submenu')
    .setPlaceholder('📊 Detaylı İstatistikler ve İşlem Menüsü...')
    .addOptions([
      {
        label: '📊 Detaylı İstatistikler & Eko-Cüzdan',
        description: 'Maaş, Borsa, Borç ve Seviye İstatistikleri',
        value: 'staff_menu_details',
        emoji: '📊'
      },
      {
        label: '📋 Günlük Görevler & Selamlaşma',
        description: 'Günün görev durumu ve selamlaşma puanları',
        value: 'staff_menu_tasks',
        emoji: '📋'
      },
      {
        label: '🏆 Performans & KPI Dökümü',
        description: 'Sicil kayıtları, uyarılar ve KPI skor detayları',
        value: 'staff_menu_performance',
        emoji: '🏆'
      },
      {
        label: '⚙️ Brifing Ayarları & Özelleştirme',
        description: 'Brifing bölümlerini açın, kapatın veya düzenleyin',
        value: 'staff_menu_briefing_settings',
        emoji: '⚙️'
      },
      {
        label: '🔰 Anasayfa Rehberi (Tutorial)',
        description: 'Anasayfa rehberini ve kullanım turunu tekrar başlatın',
        value: 'staff_menu_tutorial',
        emoji: '🔰'
      },
      {
        label: '☕ İsteğe Bağlı Kahve Molası',
        description: 'İstediğiniz an 15 dakikalık dinlenme molası alın',
        value: 'staff_menu_coffee',
        emoji: '☕'
      },
      {
        label: '⚖️ Abuse Dileğesi & Ceza İtirazı',
        description: 'Sistem tarafından uygulanan cezalara itiraz edin',
        value: 'staff_menu_abuse_appeal',
        emoji: '⚖️'
      }
    ]);

  const rowSubmenu = new ActionRowBuilder().addComponents(selectMenu);

  // Row 3: Sistem Harekât Masası
  const combinedOptions = [
    { label: '💬 Aktif Sohbetçi', description: 'Sohbette en az 15 mesaj gönder', value: 'task_chat' },
    { label: '🎤 Ses Meraklısı', description: 'Ses kanallarında fazladan 15 dakika geçir', value: 'task_voice' },
    { label: '🎫 Destekçi', description: 'Bugün en az 1 ticket çöz', value: 'task_ticket' },
    { label: '🛡️ Koruyucu', description: 'Bugün en az 1 moderasyon işlemi gerçekleştir', value: 'task_mod' },
    { label: '🏖️ İzin Kredisi Kullan', description: 'İzin krediniz varsa 1 gün izin kullanın.', value: 'staff_action_use_leave', emoji: '🌴' },
    { label: '📊 İzin Durumu Sorgula', description: 'Güncel izin kredilerinizi görün.', value: 'staff_action_leave_status', emoji: '📅' },
    { label: '🪙 Haftalık Maaşımı Al', description: 'Haftalık yetkili maaşınızı çekin.', value: 'staff_action_claim_salary', emoji: '🪙' },
    { label: '💳 Kurumsal Kredi & Finans', description: 'Maaş avansı çekin veya borç yatırın.', value: 'staff_action_finance_center', emoji: '💳' },
    { label: '📊 Yetkili Liderlik Tablosu', description: 'Haftanın Top 5 yetkilisini görün.', value: 'staff_action_leaderboard', emoji: '📊' }
  ];

  const combinedSelect = new StringSelectMenuBuilder()
    .setCustomId('staff_system_desk')
    .setPlaceholder('📁 SİSTEM HAREKÂT MASASI')
    .addOptions(combinedOptions.slice(0, 25));

  const rowDesk = new ActionRowBuilder().addComponents(combinedSelect);

  return [rowTop, rowSubmenu, rowDesk];
}

/**
 * Rütbeye özel toleranslı görev yapmama sınırı (gün cinsinden)
 * Level 1 (Stajyer): 3 gün
 * Level 2 (Personel): 5 gün
 * Level 3 (Kıdemli Personel): 25 gün
 * Level 4 (Sekreter): 30 gün
 * Level 5 (Kıdemli Sekreter): 35 gün
 * Level 6 (Genel Koordinatör): 40 gün
 */
function getInactivityLimit(level) {
  if (level <= 1) return 3;
  if (level === 2) return 5;
  if (level === 3) return 25;
  if (level === 4) return 30;
  if (level === 5) return 35;
  return 40;
}

// ── Uyarı DM ──────────────────────────────────────────────────────────────
async function sendWarningDM(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;

  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const maxLimit = getInactivityLimit(progress.level);
  const warnCount = progress.warnings?.count || 1;
  const warnLeft = Math.max(0, maxLimit - warnCount);
  const roleName = ROLE_NAMES[progress.level] || 'Moderatör';

  // Quick guard: if both today's greet and voice tasks are already done, skip sending warning
  try {
    const todayCheck = todayStr();
    const quickGreetDone = progress.daily?.date === todayCheck && progress.daily?.greeted;
    const quickVoiceDone = progress.daily?.date === todayCheck && (progress.daily?.voiceMinutes || 0) >= (req.voiceMinutes || 0);
    if (quickGreetDone && quickVoiceDone) {
      console.log(`[staffSystem] sendWarningDM skipped for ${progress.userId} — tasks already completed today.`);
      return;
    }
  } catch (_) { }

  // Escalating Anger & Tone based on ratio = warnCount / maxLimit
  const ratio = warnCount / maxLimit;
  let title = `🟢 Günlük Görev Hatırlatması (${warnCount}/${maxLimit} Gün)`;
  let color = 0x2ecc71; // Green
  let toneHeader = `Merhaba ${roleName} 👋 İşlerin yoğun galiba, hiç sorun değil! Müsait olduğunda görevini tamamlamayı unutma 💪`;
  let aiTonePrompt = 'nazik, anlayışlı ve dostça';

  if (ratio > 0.8) {
    title = `🔥 ÖFKELİ MUHTIRA & SON İHTAR (${warnCount}/${maxLimit} Gün)`;
    color = 0xe74c3c; // Red
    toneHeader =
      `⚠️ **SON İHTAR! SİSTEM VE YÖNETİM ÇILDIRMAK ÜZERE!** 🔥\n` +
      `Tam **${warnCount} gündür** hiçbir görev yapmadın! **${roleName}** RÜTBENİ VE TÜM YETKİLERİNİ KAYBETMENE SADECE **${warnLeft} GÜN** KALDI!\n` +
      `Bugün nöbete başlamazsan rütben düşürülecek ve yetkilerin tamamen askıya alınacak! 🔥`;
    aiTonePrompt = 'SON DERECE ÖFKELİ, SERT VE TEHDİTKAR (RÜTBE GİDİYOR!)';
  } else if (ratio > 0.55) {
    title = `😠 SERT UYARI: Görev İhmali Devam Ediyor (${warnCount}/${maxLimit} Gün)`;
    color = 0xe67e22; // Orange
    toneHeader =
      `Bu tutum kabul edilemez! 😠 Rütben yükseldikçe alt kademedeki personele örnek olman gerekirken **${warnCount} gündür** ortalarda yoksun!\n` +
      `Yöneticilerin ve Sentara'nın sabrı tükenmeye başladı.`;
    aiTonePrompt = 'KIZGIN, TEPKİLİ VE CİDDİ';
  } else if (ratio > 0.25) {
    title = `⚠️ Görev İhmali Uyarısı (${warnCount}/${maxLimit} Gün)`;
    color = 0xf1c40f; // Yellow
    toneHeader = `Bayağıdır görev yapmıyorsun! 🧐 **${roleName}** rütbesinin getirdiği sorumlulukları unutma. Ekip arkadaşların senin aktifliğini bekliyor!`;
    aiTonePrompt = 'CİDDİ VE DİKKAT ÇEKİCİ UYARI';
  }

  // System Notification
  try {
    const { addNotification } = require("../../utils/notification");
    await addNotification(progress.userId, {
      title: title,
      message: `${warnCount}/${maxLimit} gündür görev yapılmadı. Kalan süre: ${warnLeft} gün.`,
      icon: ratio > 0.8 ? "🔥" : ratio > 0.55 ? "😠" : "⏰"
    });
  } catch (nErr) { }

  // AI Koçu Duygusal Uyarı Mesajı
  let aiWarn = '';
  try {
    const prompt = `Eko Yıldız personeli ${roleName} ${warnCount} gündür görev yapmadı (Limit: ${maxLimit} gün).
Bu uyarının tonu: ${aiTonePrompt}.
Kısa (max 120 karakter), bu tona uygun Türkçe uyarı cümlesi yaz!`;
    aiWarn = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiWarn = aiWarn?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { }

  const today = todayStr();
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;
  const greetsSent = progress.daily?.greetCount || 0;
  const voiceMins = progress.daily?.voiceMinutes || 0;

  const taskStatusText =
    `• **Selamlaşma Görevi:** ${isGreetDone ? '✅ Tamamlandı' : '❌ Eksik'} (${greetsSent}/${req.greets} selam)\n` +
    `• **Ses Aktifliği Görevi:** ${voiceDone ? '✅ Tamamlandı' : '❌ Eksik'} (${voiceMins}/${req.voiceMinutes} dk)`;

  const stats = getDailyTaskCompletionStats(progress);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `${toneHeader}\n\n` +
      (aiWarn ? `🤖 **AI Koçu:** ${aiWarn}\n\n` : '') +
      `**🕐 ${warnLeft === 1 ? '⚠️ SON GÜN! BUGÜN NÖBETE GEÇ!' : `${warnLeft} gün daha yapılmazsa rolünüz alınır.`}**\n\n` +
      `📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**\n\n` +
      `📋 **Görevlerinin Durumu:**\n` +
      `${taskStatusText}\n\n` +
      (ratio > 0.8 ? `� **Çıkış Yolu:** İzin kredi çekmek veya hemen nöbete başlamakla sorunu çözebilirsin!` : `�💡 **Meşgulseniz:** İzin kredinizi kullanabilir veya yöneticilerle iletişime geçebilirsiniz. 😊`)
    )
    .addFields(
      { name: '⚠️ İnaktif Gün', value: `${warnCount}/${maxLimit} Gün`, inline: true },
      { name: '📊 Seviye', value: roleName, inline: true },
      { name: '🕐 Kalan Tolerans', value: warnLeft <= 2 ? `🔴 ${warnLeft} gün (KRİTİK)` : `${warnLeft} gün`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Disiplin & Takip Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

function shouldOfferInactivitySupport(progress) {
  if (!progress || !progress.stats) return false;
  const highStreak = (progress.stats.consecutiveDays || 0) >= 7;
  const highPerformance = progress.level >= 3 || (progress.stats.ticketsSolved || 0) >= 75 || (progress.stats.activeDays || 0) >= 14;
  return highStreak && highPerformance;
}

async function offerInactivitySupportIfNeeded(progress, client) {
  if (!shouldOfferInactivitySupport(progress)) return;
  const today = todayStr();
  if (!progress.leaves) progress.leaves = {};
  if (progress.leaves.lastInactivityOfferDate === today) return;
  progress.leaves.lastInactivityOfferDate = today;
  await progress.save().catch(() => { });
  await sendInactivityOfferDM(progress, client).catch(() => { });
}

async function sendInactivityOfferDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} uzun süredir düzenli aktif değil. Bu kişinin geçmişteki yüksek performansı ve streaki yüksek. Türkçe, üzgün ama anlayışlı bir destek mesajı yaz. Mesajın sonunda kullanıcının "İnaktiflik Talep Et" butonuna basmasını iste.`;
  let aiMessage = '';
  try {
    aiMessage = await chatWithAI([{ role: 'user', content: prompt }], 'Sen nazik, destekleyici ve empatik bir çalışan koçusun.');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { aiMessage = ''; }

  const embed = new EmbedBuilder()
    .setColor(0x6f42c1)
    .setTitle('😔 N’oldu? Neden aktif değilsin?')
    .setDescription(
      `${aiMessage || 'Uzun süredir seni sunucuda göremiyoruz. N’oldu? Neden aktif değilsin?'}\n\n` +
      `Eğer istersen inaktiflik talep edebilirsin. Sebebini aşağıdan paylaş, böylece seni daha doğru anlayalım.`
    )
    .addFields(
      { name: '⭐ Seviyen', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🔥 Ardışık Günler', value: `${progress.stats?.consecutiveDays || 0}`, inline: true },
      { name: '🏆 Toplam Ticket', value: `${progress.stats?.ticketsSolved || 0}`, inline: true }
    )
    .setFooter({ text: 'Eko Yıldız • Personel Desteği' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_inactivity_request')
        .setLabel('İnaktiflik Talep Et')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Secondary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

function reasonNeedsProof(reason) {
  if (!reason) return false;
  return /sağlık|okul|ders|hastalık|ameliyat|tedavi|psikolojik|mental|aile|kardeş|cenaze|yakın|baba|anne|çocuk|engelli|rapor|rehabilitasyon|okul|sınav|kaza/i.test(reason);
}

function getLatestPendingInactivityRequest(progress) {
  if (!progress.leaves || !Array.isArray(progress.leaves.inactivityRequests)) return null;
  return progress.leaves.inactivityRequests
    .filter(req => req.type === 'inactivity' && req.status === 'pending')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

async function saveInactivitySummary(progress, request) {
  if (!progress.coachMemory) progress.coachMemory = new Map();
  const summary = `İnaktiflik sebebi: ${request.reason || 'Belirtilmedi'}\nKanıt: ${request.evidence || 'Yok'}\nKendini iyi hissediyor mu: ${request.wellbeingResponse || 'Henüz yanıtlanmadı'}`;
  progress.coachMemory.set(`inactivity_${request.id}`, summary);
}

async function approveInactivityRequest(progress, request, client) {
  if (!progress.leaves) progress.leaves = {};
  request.status = 'approved';
  request.approved = true;
  request.approvedAt = new Date();
  request.type = 'inactivity';
  if (!progress.leaves.inactivityRequests) progress.leaves.inactivityRequests = [];
  if (!progress.leaves.usedDays) progress.leaves.usedDays = [];
  const today = todayStr();
  if (!progress.leaves.usedDays.includes(today)) {
    progress.leaves.usedDays.push(today);
  }
  await saveInactivitySummary(progress, request).catch(() => { });
  await progress.save().catch(() => { });
  await sendInactivityWellbeingPrompt(progress, request, client).catch(() => { });
  return true;
}

async function sendInactivityProofRequestDM(progress, request, client) {
  const embed = new EmbedBuilder()
    .setColor(0xff9500)
    .setTitle('📎 İnaktiflik için kanıt gerekli')
    .setDescription(
      `Sebebine göre bu inaktiflik talebi sağlık, okul veya benzeri hassas bir durum içeriyor. Lütfen aşağıdan kanıt veya ek açıklama paylaş.`
    )
    .addFields(
      { name: 'Sebep', value: request.reason || 'Belirtilmedi' },
      { name: 'Nasıl paylaşabilirsin?', value: 'Buraya link, belge ya da kısa açıklama ekle. Eğer dosya eklemek istersen direkt bu DM kanalına da gönderebilirsin.' }
    )
    .setFooter({ text: 'Eko Yıldız • İnaktiflik Desteği' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_inactivity_proof')
        .setLabel('Kanıt / Ek Açıklama Gönder')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

async function sendInactivityWellbeingPrompt(progress, request, client) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('💚 Kendini iyi hissediyor musun?')
    .setDescription(
      `İnaktiflik talebin onaylandı. Şu anda biraz dinlenebilirsin. Sana bir soru soracağız çünkü sağlığın ve ruh halin bizim için önemli.

` +
      `🔹 Eğer kendini iyi hissetmiyorsan, bize haber ver. Eğer iyisen de bunu bilmek güzel.`
    )
    .setFooter({ text: 'Eko Yıldız • İyi Olman Önemli' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_inactivity_wellbeing_yes')
        .setLabel('Evet, iyiyim')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_inactivity_wellbeing_no')
        .setLabel('Hayır, iyi değilim')
        .setStyle(ButtonStyle.Danger)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

async function submitInactivityRequest(userId, reason, evidence, client) {
  try {
    const progress = await getOrCreate(userId, GUILD_ID, client);
    if (!progress || progress.status !== 'active') {
      return { success: false, message: 'Aktif personel değil misin? Bu işlemi yapamazsın.' };
    }
    if (!progress.leaves) progress.leaves = {};
    if (!progress.leaves.inactivityRequests) progress.leaves.inactivityRequests = [];

    const request = {
      id: `inactivity_${Date.now()}`,
      createdAt: new Date(),
      reason: reason?.trim() || '',
      evidence: evidence?.trim() || '',
      status: 'pending',
      approved: false,
      approvedAt: null,
      proofRequestedAt: null,
      wellbeingResponse: null,
      wellbeingAnsweredAt: null,
      type: 'inactivity'
    };
    progress.leaves.inactivityRequests.push(request);
    const needsProof = reasonNeedsProof(request.reason);
    if (needsProof && !request.evidence) {
      request.proofRequestedAt = new Date();
      await progress.save();
      await sendInactivityProofRequestDM(progress, request, client).catch(() => { });
      return {
        success: true,
        message: 'Talebiniz alındı. Sağlık/okul gibi bir durum görüyoruz; lütfen kanıt veya ek açıklama gönderin.'
      };
    }
    if (!request.evidence && !needsProof) {
      // Yine de onayla, çünkü istek destek amaçlıdır.
      await approveInactivityRequest(progress, request, client);
      return { success: true, message: 'İnaktiflik talebin onaylandı. Bugün dinlenebilirsin.' };
    }
    // Sağlık/okul gibi durumsa kanıt varsa onayla
    if (needsProof && request.evidence) {
      await approveInactivityRequest(progress, request, client);
      return { success: true, message: 'İnaktiflik talebin kanıtla birlikte alındı ve onaylandı.' };
    }
    // Genel durum, yeterli.
    await approveInactivityRequest(progress, request, client);
    return { success: true, message: 'İnaktiflik talebin onaylandı. Bugün dinlenebilirsin.' };
  } catch (err) {
    console.error('[staffSystem] submitInactivityRequest error:', err.message);
    return { success: false, message: 'İnaktiflik talebin işlenirken hata oluştu.' };
  }
}

async function handleInactivitySupportModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const reason = interaction.fields.getTextInputValue('inactivity_reason');
    const evidence = interaction.fields.getTextInputValue('inactivity_evidence');
    const result = await submitInactivityRequest(interaction.user.id, reason, evidence, client);
    await interaction.editReply({ content: result.message });
  } catch (err) {
    console.error('[staffSystem] handleInactivitySupportModal error:', err.message);
    await interaction.editReply({ content: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
}

async function handleInactivityProofModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const evidence = interaction.fields.getTextInputValue('proof_link');
    const progress = await getOrCreate(interaction.user.id, GUILD_ID, client);
    if (!progress) {
      return interaction.editReply({ content: 'Personel kaydın bulunamadı.' });
    }
    const request = getLatestPendingInactivityRequest(progress);
    if (!request) {
      return interaction.editReply({ content: 'Gönderilecek bekleyen bir inaktiflik talebin yok.' });
    }
    
    // 🔧 FIX: Kanıt kaydedildikten sonra durumu under_review yap
    // Aksi halde her buton basımında tekrar kanıt isteniyor
    request.evidence = evidence?.trim() || request.evidence;
    request.status = 'under_review'; // Döngüyü kıran bayrak
    request.evidenceSubmittedAt = new Date();
    
    await progress.save();
    const result = await submitInactivityRequest(interaction.user.id, request.reason, request.evidence, client);
    await interaction.editReply({ content: result.message });
  } catch (err) {
    console.error('[staffSystem] handleInactivityProofModal error:', err.message);
    await interaction.editReply({ content: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
}

async function recordInactivityWellbeingResponse(userId, response, client) {
  try {
    const progress = await getOrCreate(userId, GUILD_ID, client);
    if (!progress) return { success: false, message: 'Personel kaydın bulunamadı.' };
    const request = progress.leaves?.inactivityRequests?.slice().reverse().find(r => r.type === 'inactivity' && r.approved);
    if (!request) {
      return { success: false, message: 'Onaylanmış bir inaktiflik talebin yok.' };
    }
    request.wellbeingResponse = response;
    request.wellbeingAnsweredAt = new Date();
    await saveInactivitySummary(progress, request).catch(() => { });
    await progress.save().catch(() => { });

    const supportPrompt = `Bu kişi inaktiflik için izin aldı. Sebebi: ${request.reason}. Kanıt: ${request.evidence || 'Yok'}. Kendini iyi hissediyor musun? sorusuna verdiği cevap: ${response}. Kısa, nazik ve destekleyici bir mesaj yaz.`;
    let aiResponse = '';
    try {
      aiResponse = await chatWithAI([{ role: 'user', content: supportPrompt }], 'Sen şefkatli ve destekleyici bir iş koçusun.');
      aiResponse = aiResponse?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
    } catch (_) { aiResponse = ''; }

    if (client) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('💬 Durum Güncellemesi Kaydedildi')
          .setDescription(aiResponse || 'Cevabınız kaydedildi. Kendine iyi bak, buradayız.')
          .setFooter({ text: 'Eko Yıldız • Seninle birlikteyiz' })
          .setTimestamp();
        await user.send({ embeds: [embed] }).catch(() => { });
      }
    }
    return { success: true, message: 'Cevabın kaydedildi. Sana destek mesajı gönderdim.' };
  } catch (err) {
    console.error('[staffSystem] recordInactivityWellbeingResponse error:', err.message);
    return { success: false, message: 'Cevabın kaydedilirken hata oluştu.' };
  }
}

async function handleInactivityButtonResponse(interaction, client, response) {
  await interaction.deferReply({ ephemeral: true });
  const result = await recordInactivityWellbeingResponse(interaction.user.id, response, client);
  await interaction.editReply({ content: result.message });
}

async function handleInactivityRequestButton(interaction, client) {
  const modal = new (require('discord.js').ModalBuilder)()
    .setCustomId('modal_inactivity_support')
    .setTitle('İnaktiflik Talep Formu');
  const { TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const reasonInput = new TextInputBuilder()
    .setCustomId('inactivity_reason')
    .setLabel('Neden aktif değilsin?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  const evidenceInput = new TextInputBuilder()
    .setCustomId('inactivity_evidence')
    .setLabel('Kanıt / Ek Açıklama (opsiyonel)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);
  modal.addComponents(
    new ActionRowBuilder().addComponents(reasonInput),
    new ActionRowBuilder().addComponents(evidenceInput)
  );
  return interaction.showModal(modal);
}

async function handleInactivityProofButton(interaction, client) {
  const modal = new (require('discord.js').ModalBuilder)()
    .setCustomId('modal_inactivity_proof')
    .setTitle('İnaktiflik Kanıtı Gönder');
  const { TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const proofInput = new TextInputBuilder()
    .setCustomId('proof_link')
    .setLabel('Kanıt Linki / Açıklama')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(proofInput));
  return interaction.showModal(modal);
}

async function handleInactivityWellbeingButton(interaction, client, response) {
  await interaction.deferReply({ ephemeral: true });
  const result = await recordInactivityWellbeingResponse(interaction.user.id, response, client);
  await interaction.editReply({ content: result.message });
}

async function handleInactivitySupportRequest(interaction, client) {
  return handleInactivityRequestButton(interaction, client);
}

async function sendRequirementIncreaseDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('📈 Görev Gereksinimlerin Arttı!')
    .setDescription(
      `${progress.stats?.consecutiveDays} gün aktif kaldığın için gereksinimler ikiye katlandı!\n\n` +
      `📋 **Yeni günlük zorunlulukların:**\n` +
      `• Sohbete **${req.greets}x** selam\n` +
      `• Ses kanalında **${req.voiceMinutes} dk** kal\n\n` +
      `Bu zor — ama güçlü olduğunu biliyoruz! 💪`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) { }
}

// ── Sert çalışma ödülü: 1 gün izin kredisi ─────────────────────────────────
async function sendBreakRewardDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const totalCredits = progress.stats?.breakCredits || 0;
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🎁 SEVİYE ATLAMA ÖDÜLÜ: 1 Günlük İzin!')
    .setDescription(
      `Harika bir iş çıkardın! 🌟 **${totalCredits === 1 ? 'İlk' : totalCredits}.** kez bu başarıyı başardın!\n\n` +
      `**Ödülün:** 📅 **1 Günlük İzin Kredisi**\n\n` +
      `Yarın veya sonraki gün kalmak istersen bu krediyi kullanabilirsin.\n` +
      `Yöneticilere "izin kredisi kullanmak istiyorum" diyerek haberdar et.\n\n` +
      `Toplam kreditin: **${totalCredits}**\n\n` +
      `💪 Devam et, bu hız çok iyi!`
    )
    .addFields(
      { name: '🎯 Başarı', value: 'Bu gün 3+ Ticket çözdün!', inline: false },
      { name: '📊 Seviyesi', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🏆 Toplam Ödülü', value: `${totalCredits} gün izin`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Ödül Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
    console.log(`[staffSystem] Break reward gönderildi: ${progress.userId} (total: ${totalCredits})`);
  } catch (_) { }
}

// ── Motivasyon mesajları: rasgele teşvik ─────────────────────────────────
async function sendRandomMotivationDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const motivations = [
    {
      title: '💪 Devam Et!',
      messages: [
        `${ROLE_NAMES[progress.level]}, sizi sunucuda görmek harika! Hızınızı korumanız çok önemli.`,
        `Bugün ${progress.stats?.ticketsSolved || 0} ticket çözdüğünüz için teşekkürler! Sunucumuzu daha iyi bir yer yapıyorsunuz.`,
        `Aktif olduğunuz için teşekkürler! Eko Yıldız'ın sizi gerek duyuyor. 🌟`,
      ]
    },
    {
      title: '🎯 Hedef Hatırlatması',
      messages: [
        `Terfi olmak için hâlâ ${((PROMOTION_REQUIREMENTS[progress.level]?.ticketsSolved || 0) - (progress.stats?.ticketsSolved || 0))} ticket çözmek gerekli. Yaklaşıyor!`,
        `Sekreter olmak istiyorsanız, her ticket'ı çözmek sizi bir adım ileriye götürüyor.`,
        `Bu seviyedeki son hedefine yaklaşıyorsun. Biraz daha çaba!`,
      ]
    },
    {
      title: '🌈 İlham Verici',
      messages: [
        `Eko Yıldız'ın en iyi personelleri sizin gibi çalışanlardır. Başarılı bir ekibin parçasısınız!`,
        `Her ticket'ın çözülmesi bir kullanıcıyı mutlu ediyor. Teşekkürler! 😊`,
        `Sunucuda sesiniz duyuluyor ve saygınlık kazanıyorsunuz. Devam edin!`,
      ]
    }
  ];

  const motiv = motivations[Math.floor(Math.random() * motivations.length)];
  const msg = motiv.messages[Math.floor(Math.random() * motiv.messages.length)];

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle(motiv.title)
    .setDescription(msg)
    .addFields(
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '⭐ Aktif Gün', value: `${progress.stats?.consecutiveDays || 0} gün`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Motivasyon Mesajı ✨' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) { }
}

// ── İZİN SİSTEMİ — Personele ara ara izin ────────────────────────────────────
/**
 * İzin günü kullandığını kaydet
 * @param {String} userId - Personel ID'si
 * @param {Date} leaveDate - İzin tarihi (YYYY-MM-DD)
 * @param {String} reason - İzin sebebi
 */
async function requestLeave(userId, leaveDate, reason) {
  try {
    const p = await getOrCreate(userId, GUILD_ID);

    if (p.status !== 'active') {
      return { success: false, message: 'Aktif personel değilsin.' };
    }

    const monthlyLimit = 2; // Ayda maksimum 2 gün izin (sıkılaştırıldı)
    const weeklyLimit = 1;  // Haftada maksimum 1 gün izin

    if ((p.leaves.monthlyLeaveUsed || 0) >= monthlyLimit) {
      return { success: false, message: `Bu ayın izin hakkını kullandın (Limit: ${monthlyLimit} gün)` };
    }

    if ((p.leaves.weeklyLeaveUsed || 0) >= weeklyLimit) {
      return { success: false, message: `Bu haftanın izin hakkını kullandın (Limit: ${weeklyLimit} gün)` };
    }

    if (!p.leaves.usedDays) p.leaves.usedDays = [];
    if (p.leaves.usedDays.includes(leaveDate)) {
      return { success: false, message: 'Bu gün için zaten izin kullanmışsın.' };
    }

    // İzin günü ekle
    p.leaves.usedDays.push(leaveDate);
    p.leaves.monthlyLeaveUsed = (p.leaves.monthlyLeaveUsed || 0) + 1;
    p.leaves.weeklyLeaveUsed = (p.leaves.weeklyLeaveUsed || 0) + 1;
    p.leaves.lastLeaveDate = leaveDate;
    p.leaves.totalCredits = (p.leaves.totalCredits || 0) + 1;

    await p.save();

    return {
      success: true,
      message: `İzin onaylandı: ${leaveDate}`,
      remaining: monthlyLimit - p.leaves.monthlyLeaveUsed
    };
  } catch (err) {
    console.error('[staffSystem] İzin hatası:', err.message);
    return { success: false, message: 'İzin işleminde hata oluştu.' };
  }
}

/**
 * İzin durmunu göster
 */
async function getLeaveStatus(userId) {
  try {
    const p = await getOrCreate(userId, GUILD_ID);

    const monthlyLimit = 2; // Sıkılaştırıldı
    const weeklyLimit = 1;

    return {
      totalCredits: p.leaves.totalCredits || 0,
      monthlyUsed: p.leaves.monthlyLeaveUsed || 0,
      monthlyRemaining: Math.max(0, monthlyLimit - (p.leaves.monthlyLeaveUsed || 0)),
      weeklyUsed: p.leaves.weeklyLeaveUsed || 0,
      weeklyRemaining: Math.max(0, weeklyLimit - (p.leaves.weeklyLeaveUsed || 0)),
      usedDays: p.leaves.usedDays || [],
    };
  } catch (err) {
    console.error('[staffSystem] İzin durum hatası:', err.message);
    return null;
  }
}

/**
 * İzin kredileri ile günü skip et
 */
async function useLeaveCredit(userId) {
  try {
    const p = await findStaffById(userId);
    if (!p) return { success: false, message: 'Kayıt bulunamadı.' };

    if ((p.stats?.breakCredits || 0) <= 0) {
      return { success: false, message: 'İzin kredtin yok.' };
    }

    // Günü skip et (görevleri yapmamış gibi say ama uyarı verme)
    p.stats.breakCredits = (p.stats.breakCredits || 1) - 1;
    p.daily.greeted = true;
    p.daily.voiceMinutes = getDailyRequirements(p.level, p.stats.consecutiveDays || 0).voiceMinutes;
    p.daily.date = todayStr();
    p.stats.lastCompleteDay = todayStr();

    await p.save();

    return {
      success: true,
      message: 'Bugün izin kredisi kullanarak skip ettirdin!',
      creditsRemaining: p.stats.breakCredits
    };
  } catch (err) {
    console.error('[staffSystem] Kredi hata:', err.message);
    return { success: false, message: 'İşlem başarısız.' };
  }
}

async function removeRole(progress, client, reasonText = null) {
  try {
    const userRoleName = ROLE_NAMES[progress.level] || 'Moderatör';
    const reasonHeader = reasonText || '3 gün üst üste görev yapamadığın';

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(progress.userId, {
        title: "⏸️ Rolünüz Askıya Alındı",
        message: `${reasonHeader} için personel rolleriniz askıya alındı. Yöneticilerle görüşerek tekrar başlayabilirsiniz.`,
        icon: "⚠️"
      });
    } catch (nErr) {
      console.error("[staffSystem] removeRole notification error:", nErr.message);
    }

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(progress.userId).catch(() => null);
      if (member) {
        const rolesToRemove = [
          ...Object.values(ROLES),
          '1518709348506013706', // Kıdemli Sekreter (Level 5)
          '1518692389169135666', // Moderatör Ekibi
          '1518708137920823327', // modizm
          '1518707673846251691', // adminizm
          '1518692384928567456'  // Kaptan
        ];

        for (const rId of rolesToRemove) {
          if (member.roles.cache.has(rId)) {
            await member.roles.remove(rId, `${reasonHeader} - Sistemden atıldı`).catch(() => { });
          }
        }
      }
    }

    try {
      const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
      if (mainGuild) {
        const mainMember = await mainGuild.members.fetch(progress.userId).catch(() => null);
        if (mainMember) {
          const rolesToRemove = [
            ...Object.values(ROLES),
            '1518709348506013706',
            '1518692389169135666',
            '1518708137920823327',
            '1518707673846251691',
            '1518692384928567456'
          ];
          for (const rId of rolesToRemove) {
            if (mainMember.roles.cache.has(rId)) {
              await mainMember.roles.remove(rId, 'Görev yapılmadığı için sistemden silindi').catch(() => { });
            }
          }
        }
      }
    } catch (e) { }

    const embed = new EmbedBuilder()
      .setColor(0xff9500)
      .setTitle('⏸️ Personel Rolü Duraklatıldı — Geri Dön!')
      .setDescription(
        `**${reasonHeader}** için **${userRoleName}** rolün alındı. ⚠️\n\n` +
        `💡 **Ama endişelenme! Geri gelmek ÇOOOOK basit:**\n` +
        `🤝 Yöneticilere yazabilirsin\n` +
        `💬 Neden yapamadığını anlatabilirsin\n` +
        `📋 Plan yapabilirsiniz\n` +
        `✨ Sonra tekrar başlarsın!\n\n` +
        `🎁 **Meşgulseniz:**\n` +
        `İzin sistemi var! İzin talep edebilirsin. Anlıyoruz!\n\n` +
        `😊 Herkes ara sıra durgunluk yaşıyor. Sorun değil!\n` +
        `Biz seninle çözeriz. Geri dön! 💪`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seni özleyeceğiz! 💚' })
      .setTimestamp();

    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (user) await user.send({ embeds: [embed] }).catch(() => { });
    await StaffProgress.deleteOne({ userId: progress.userId });
    console.log(`[staffSystem] Rol alındı: ${progress.userId} (${reasonHeader})`);
  } catch (err) {
    console.error('[staffSystem] Rol alma hatası:', err.message);
  }
}

// ── Öğlen hatırlatma (13:00) ──────────────────────────────────────────────
async function sendMidDayReminder(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;
  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  const greetsSent = progress.daily?.date === today ? (progress.daily?.greetCount || 0) : 0;
  const voiceMinutes = progress.daily?.date === today ? (progress.daily?.voiceMinutes || 0) : 0;

  const missing = [];
  if (!isGreetDone) missing.push(`✅ Sohbete ${req.greets - greetsSent}x daha selam ver (Gereken: ${req.greets})`);
  if (!voiceDone) missing.push(`🎤 ${req.voiceMinutes - voiceMinutes} dk daha ses kanalında kal (Gereken: ${req.voiceMinutes} dk)`);

  if (missing.length === 0) return; // Zaten tamamlamış

  const stats = getDailyTaskCompletionStats(progress);

  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('🌤️ Öğlen Hatırlatması — Biraz Daha Kaldı!')
    .setDescription(
      `Günün yarısı geçti! Hâlâ yapman gerekenler var ama merak etme, çok az kaldı:\n\n` +
      missing.map(m => `• ${m}`).join('\n') +
      `\n\n📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**` +
      `\n\n☕ Bir ara ver, sonra bitir. Zaman yeter! 💪`
    )
    .addFields(
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🎤 Ses (bugün)', value: `${voiceMinutes}/${req.voiceMinutes} dk`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

// ── Akşam son uyarı (19:00) ───────────────────────────────────────────────
async function sendEveningWarning(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;
  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  if (isGreetDone && voiceDone) return; // Tamamlamış

  const stats = getDailyTaskCompletionStats(progress);
  const warnCount = progress.warnings?.count || 0;

  // AI acil uyarı mesajı
  let aiMsg = '';
  try {
    const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} akşam 19:00'da hâlâ günlük görevini yapmamış.
Bu kişinin ${warnCount} uyarısı var. Çok kısa (max 80 karakter), sakin ve anlayışlı Türkçe uyarı yaz.`;
    aiMsg = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiMsg = aiMsg?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { }

  const greetsSent = progress.daily?.date === today ? (progress.daily?.greetCount || 0) : 0;
  const voiceMinutes = progress.daily?.date === today ? (progress.daily?.voiceMinutes || 0) : 0;

  const embed = new EmbedBuilder()
    .setColor(0xff9500)
    .setTitle('🌙 Akşam Son Uyarısı (19:00)')
    .setDescription(
      (aiMsg ? `🤖 **AI:** ${aiMsg}\n\n` : '') +
      `**Gece 23:30'a kadar** görevlerini tamamlamazsan yarın uyarı sayacın artacak!\n\n` +
      `📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**\n\n` +
      `📋 **Yapman gerekenler:**\n` +
      (!isGreetDone ? `• ✅ Sohbete **${req.greets - greetsSent}x** daha selam ver (Gereken: ${req.greets})\n` : '') +
      (!voiceDone ? `• 🎤 **${req.voiceMinutes - voiceMinutes} dk** daha ses kanalında kal (Gereken: ${req.voiceMinutes} dk)\n` : '') +
      `\n🕐 **${7 - warnCount} uyarı hakkın kaldı.** (Sonra rol geçici olarak alınır)\n\n` +
      `Meşgulsen, yapabilecekten bile yararlı! Kısmi tamamlama da iyi!`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

// ── KÖV (KOV) SİSTEMİ — Yönetici tarafından personel alınması ────────────────
async function dismissStaff(userId, reason, dismissedBy, client) {
  const p = await StaffProgress.findOne({ userId });
  if (!p) return { success: false, message: 'Personel sisteminde kayıtlı değil.' };
  if (p.status !== 'active') return { success: false, message: 'Zaten aktif değil.' };

  const levelName = ROLE_NAMES[p.level];

  // Kov kaydı
  p.status = 'dismissed';
  p.dismissedAt = new Date();
  p.dismissReason = reason?.slice(0, 300) || 'Yönetici Kararı';
  await p.save();

  // Rolleri kaldır
  const rolesToRemove = [
    ...Object.values(ROLES),
    '1518709348506013706', // Kıdemli Sekreter (Level 5)
    '1518692389169135666', // Moderatör Ekibi
    '1518708137920823327', // modizm
    '1518707673846251691', // adminizm
  ];

  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of rolesToRemove) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, `Kov: ${reason || 'Yönetici Kararı'}`).catch(() => { });
        }
      }
    }

    const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
    if (mainGuild) {
      const mainMember = await mainGuild.members.fetch(userId).catch(() => null);
      if (mainMember) {
        for (const roleId of rolesToRemove) {
          if (roleId && mainMember.roles.cache.has(roleId)) {
            await mainMember.roles.remove(roleId, `Kov: ${reason || 'Yönetici Kararı'}`).catch(() => { });
          }
        }
      }
    }
  } catch (_) { }

  // Kullanıcıya DM
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('⛔ Personel Sisteminden Çıkarıldın')
      .setDescription(
        `**${levelName}** görevinden yönetici tarafından çıkarıldın.\n\n` +
        `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
        `Bu kararı itiraz etmek veya daha fazla bilgi almak için yöneticilere yazabilirsin.`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();
    await user.send({ embeds: [embed] });
  } catch (_) { }

  const totalDays = p.stats?.activeDays || 0;
  console.log(`[staffSystem] Kov (İşten Çıkarma): ${userId} (${levelName}, ${totalDays} gün), Sebep: ${reason}`);
  return { success: true, totalDays, levelName };
}

async function runDailyCheck(client) {
  if (global.SPAM_STOPPED) {
    console.log('[staffSystem] runDailyCheck skipped (global.SPAM_STOPPED is true)');
    return;
  }
  const checkDate = getTargetCheckDate();
  console.log(`[staffSystem] Günlük kontrol başladı (Hedef Tarih: ${checkDate})...`);

  try {
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 6 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    for (const p of allProgress) {
      // 🔧 Güvenlik: Objeler tanımlı değilse oluştur
      if (!p.stats) p.stats = {};
      if (!p.daily) p.daily = { date: '', greeted: false, voiceMinutes: 0 };
      if (!p.warnings) p.warnings = { count: 0 };
      if (!p.leaves) p.leaves = { totalCredits: 0, usedDays: [], lastLeaveDate: null, monthlyLeaveUsed: 0, weeklyLeaveUsed: 0 };
      if (!p.gamification) p.gamification = { totalPoints: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 } };
      ensureWeeklyReportReset(p, new Date());

      // İstatistik alanlarını başlat
      p.stats.dailyTicketsToday = p.stats.dailyTicketsToday || 0;
      p.stats.ticketsSolved = p.stats.ticketsSolved || 0;
      p.stats.chatMessages = p.stats.chatMessages || 0;
      p.stats.activeDays = p.stats.activeDays || 0;
      p.stats.consecutiveDays = p.stats.consecutiveDays || 0;
      p.stats.moderationActions = p.stats.moderationActions || 0;
      p.stats.weeklyReports = p.stats.weeklyReports || 0;
      p.stats.lastCompleteDay = p.stats.lastCompleteDay || '';
      p.stats.breakCredits = p.stats.breakCredits || 0;

      // Günlük ticket sayacını sıfırla
      p.stats.dailyTicketsToday = 0;

      // Aylık/haftalık izin sayacını sıfırla
      const todayDate = new Date();
      const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      const startOfWeek = new Date(todayDate);
      startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());

      // Aylık izin sayıldı mı kontrol et
      if (p.leaves.lastLeaveDate) {
        const lastLeaveDate = new Date(p.leaves.lastLeaveDate);
        if (lastLeaveDate < startOfMonth) {
          p.leaves.monthlyLeaveUsed = 0;
        }
        if (lastLeaveDate < startOfWeek) {
          p.leaves.weeklyLeaveUsed = 0;
        }
      }

      // PIP Kontrolü (Eğer aktif ise)
      if (p.pip?.isActive) {
        if (!p.pip.signed) {
          // Kontrat imzalanmamışsa otomatik demote / rol askı
          p.pip.isActive = false;
          await p.save();
          await removeRole(p, client, 'Performans İyileştirme Planı (PIP) Kontratını imzalamadığınız');
          continue;
        }

        const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
        const targetVoice = Math.min(req.voiceMinutes * 2, 180) + (p.daily?.transferredVoiceMinutes || 0);
        const targetGreets = Math.min(req.greets * 2, 20);
        const greetDone = p.daily?.date === checkDate && (p.daily?.greetCount || 0) >= targetGreets;
        const voiceDone = p.daily?.date === checkDate && (p.daily?.voiceMinutes || 0) >= targetVoice;
        const completedToday = greetDone && voiceDone;

        const isOnLeave = p.leaves?.usedDays?.includes(checkDate);
        const isUserInactive = isOnLeave || (await hasInactivityRole(p.userId, client));

        if (isUserInactive) {
          await p.save();
        } else if (completedToday) {
          p.pip.consecutiveSuccessDays = (p.pip.consecutiveSuccessDays || 0) + 1;
          if (p.pip.consecutiveSuccessDays >= 3) {
            p.pip.isActive = false;
            p.pip.signed = false;
            p.warnings.count = 0; // Reset warnings
            await p.save();
            try {
              const user = await client.users.fetch(p.userId);
              const successEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎉 PIP BAŞARIYLA TAMAMLANDI!')
                .setDescription(`Tebrikler! 3 günlük PIP (Performans İyileştirme Planı) sürecini başarıyla tamamladınız ve yetkilerinizi korudunuz. Görevinize normal hedeflerle devam edebilirsiniz.`)
                .setTimestamp();
              await user.send({ embeds: [successEmbed] }).catch(() => { });
            } catch (_) { }
          } else {
            await p.save();
          }
        } else {
          // Failed to complete PIP target
          p.pip.isActive = false;
          p.pip.signed = false;
          await p.save();
          try {
            const user = await client.users.fetch(p.userId);
            const failEmbed = new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('❌ PIP BAŞARISIZ OLDU')
              .setDescription(`Performans İyileştirme Planı (PIP) hedeflerini tamamlayamadığınız için rütbeniz düşürülmüştür.`)
              .setTimestamp();
            await user.send({ embeds: [failEmbed] }).catch(() => { });
          } catch (_) { }
          await removeRole(p, client);
        }
        continue;
      }

      // Bugünü veya hedef günü kontrol et (görevi tamamladı mı?)
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const greetDone = p.daily?.date === checkDate && p.daily?.greeted;
      const voiceDone = p.daily?.date === checkDate && (p.daily?.voiceMinutes || 0) >= targetVoice;
      const completedToday = (p.stats.lastCompleteDay === checkDate) || (greetDone && voiceDone);

      const activeDays = p.stats?.activeDays || 0;
      const isOnLeave = p.leaves?.usedDays?.includes(checkDate);
      const isUserInactive = isOnLeave || (await hasInactivityRole(p.userId, client));

      if (isUserInactive) {
        // İzinli/inaktif gün — uyarı veya ceza verilmez, streak sıfırlanmaz.
        await p.save();
      } else if (!completedToday) {
        // Bugün görev yapılmadı ve izinli değil — uyarı ver
        p.stats.consecutiveDays = 0;
        p.warnings.count = (p.warnings.count || 0) + 1;
        p.warnings.lowActivityNotified = false; // Aktif gün < 2 kontrolü için sıfırla

        // Rütbeye özel inaktiflik sınırını kontrol et
        const maxLimit = getInactivityLimit(p.level);
        if (p.warnings.count >= maxLimit) {
          p.pip = {
            isActive: true,
            signed: false,
            startedAt: null,
            consecutiveSuccessDays: 0
          };
          await p.save();

          try {
            const user = await client.users.fetch(p.userId);
            const pipNotifyEmbed = new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle("⚠️ Performans İyileştirme Planı (PIP) Kontratı")
              .setDescription(
                `Sayın Yetkili <@${p.userId}>,\n\n` +
                `Günlük hedeflerinizi ${maxLimit} gün boyunca aksattığınız tespit edilmiştir. Sistem tarafından kadrodan ihraç edilmek veya tenzilat (demote) almak üzeresiniz.\n\n` +
                `Ancak İnsan Kaynakları politikalarımız gereği size son bir şans tanınarak **Performans İyileştirme Planı (PIP)** başlatılmıştır.\n\n` +
                `• **Ne Yapmalısınız?** Panelinizdeki **[📋 PIP Kontratını İmzala]** butonuna tıklayarak kontratı imzalamalı ve 3 gün boyunca iki katı olan hedefleri başarıyla tamamlamalısınız.\n` +
                `• **İmzalamazsanız?** Görevinize son verilecektir.`
              )
              .setFooter({ text: 'Eko Yıldız • İnsan Kaynakları' })
              .setTimestamp();

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const pipRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('staff_pip_sign')
                .setLabel('📋 PIP Kontratını İmzala')
                .setStyle(ButtonStyle.Primary)
            );

            await user.send({ embeds: [pipNotifyEmbed], components: [pipRow] }).catch(() => { });
          } catch (_) { }
        } else {
          await sendWarningDM(p, client);
          await p.save();
        }
      } else {
        // Bugün görev yapıldı — devam ettir
        if (p.stats.consecutiveDays > 0 && p.stats.consecutiveDays % 30 === 0) {
          await sendRequirementIncreaseDM(p, client);
        }
        await p.save().catch(() => { });
      }

      // ⚠️ Aktif gün < 2 uyarısı (Bugün görevler yapıldıysa veya izinli/inaktifse gönderme!)
      if (activeDays < 2 && !isUserInactive && !completedToday) {
        await checkLowActivityWarning(p, client);
      }
    }

    console.log(`[staffSystem] Tamamlandı — ${allProgress.length} personel kontrol edildi`);

    // Check for browser notification permission prompts for staff members
    try {
      const { sendNotificationPermissionPrompt } = require("../../utils/notification");
      await sendNotificationPermissionPrompt(client);
    } catch (promptErr) {
      console.error("[NotificationPrompt] Daily scheduler check error:", promptErr.message);
    }

    // Save last run check date in database configuration to prevent duplicate runs and enable catch-up
    try {
      const ServerConfig = require('../../models/ServerConfig');
      let config = await ServerConfig.findOne({ guildId: GUILD_ID });
      if (!config) {
        config = new ServerConfig({ guildId: GUILD_ID });
      }
      config.set('lastDailyCheckRunDate', checkDate);
      await config.save().catch(() => { });
      console.log(`[staffSystem] Saved lastDailyCheckRunDate in DB: ${checkDate}`);
    } catch (dbErr) {
      console.error('[staffSystem] Failed to save lastDailyCheckRunDate in DB:', dbErr.message);
    }
  } catch (err) {
    console.error('[staffSystem] Günlük kontrol hatası:', err.message);
  }
}

// ── Scheduler — sabah brifing + gün içi hatırlatmalar ──────────────────────
function startStaffScheduler(client) {
  async function refreshMarketState() {
    try {
      const Ticket = require('../../models/Ticket');
      const pendingTickets = await Ticket.countDocuments({ status: { $ne: 'closed' } }).catch(() => 0);
      const activeStaff = await StaffProgress.countDocuments({ status: 'active' }).catch(() => 0);
      const staffRecords = await StaffProgress.find({ status: 'active' }).catch(() => []);
      const warnings = staffRecords.reduce((sum, p) => sum + (p.warnings?.count || 0), 0);
      const chatMessages = staffRecords.reduce((sum, p) => sum + (p.stats?.chatMessages || 0), 0);

      const snapshot = getMarketSnapshot({ pendingTickets, warnings, chatMessages, activeStaff });
      await StaffProgress.updateMany(
        { status: 'active' },
        {
          $set: {
            marketMultiplier: snapshot.multiplier,
            marketState: snapshot.state,
            diamondRate: snapshot.diamondRate,
            interestRate: snapshot.interestRate,
            crisisTaxRate: snapshot.crisisTaxRate,
            marketTrend: snapshot.trend,
            marketRiskScore: snapshot.riskScore,
            marketLastUpdatedAt: new Date()
          }
        }
      ).catch(() => { });

      console.log(`[staffSystem] Market snapshot refreshed: ${snapshot.state} x${snapshot.multiplier.toFixed(1)} | 1 💎 = ${snapshot.diamondRate} TL`);
    } catch (err) {
      console.error('[staffSystem] Market snapshot refresh error:', err.message);
    }
  }

  function scheduleAt(hour, minute, callback) {
    function run() {
      if (global.SPAM_STOPPED) {
        console.log(`[staffSystem] scheduleAt skipped for ${hour}:${minute} (global.SPAM_STOPPED is true)`);
        return;
      }
      const now = new Date();
      // Turkey is permanently UTC+3
      const nowGmt3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const currentYear = nowGmt3.getUTCFullYear();
      const currentMonth = nowGmt3.getUTCMonth();
      const currentDate = nowGmt3.getUTCDate();

      // Target time in Turkey timezone (using UTC methods on GMT+3 shifted date)
      const targetGmt3 = new Date(Date.UTC(currentYear, currentMonth, currentDate, hour, minute, 0, 0));
      if (targetGmt3 <= nowGmt3) {
        targetGmt3.setUTCDate(targetGmt3.getUTCDate() + 1);
      }

      const delay = targetGmt3.getTime() - nowGmt3.getTime();

      console.log(`[staffSystem] Scheduled task for ${hour}:${minute} (Istanbul time). Real execution in ${Math.round(delay / 1000 / 60)} minutes.`);

      setTimeout(async () => {
        if (global.SPAM_STOPPED) return;
        try {
          await callback();
        } catch (err) {
          console.error('[staffSystem] Scheduler hata:', err.message);
        }
        run(); // Ertesi gün için tekrar planla
      }, delay);
    }
    run();
  }

  // 🔧 FIX: V6 notification asla çalışmıyordu. Scheduler başında 1 kere çalıştır
  setImmediate(() => {
    console.log('[staffSystem] V6 Welcome Notification başlatılıyor...');
    sendV6WelcomeNotification(client).catch(err => {
      console.error('[staffSystem] V6 Notification hatası:', err.message);
    });
  });

  // Her saat başı market snapshot güncellemesi
  setInterval(() => {
    refreshMarketState().catch(() => { });
  }, 60 * 60 * 1000).unref();

  refreshMarketState().catch(() => { });

  // 09:00 — Sabah brifing (tüm personele)
  scheduleAt(9, 0, async () => {
    console.log('[staffSystem] 09:00 sabah brifing gönderiliyor...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      await sendMorningBriefing(p, client).catch(() => { });
    }
  });

  // 00:05 — Pazartesi haftalık rapor sayacını temizle
  scheduleAt(0, 5, async () => {
    const now = new Date();
    const nowGmt3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    if (nowGmt3.getUTCDay() !== 1) return; // Sadece Pazartesi sabahı haftalık raporları sıfırla

    console.log('[staffSystem] Haftalık rapor sayacı sıfırlanıyor...');
    const rawProgress = await StaffProgress.find({ status: 'active' });
    for (const p of rawProgress) {
      if (!p.stats) p.stats = {};
      p.stats.weeklyReports = 0;
      p.stats.weeklyReportWeek = getCurrentWeekKey(nowGmt3);
      await p.save().catch(() => { });
    }
  });

  // 13:00 — Öğlen hatırlatma (görevi tamamlamamış olanlara)
  scheduleAt(13, 0, async () => {
    console.log('[staffSystem] 13:00 öğlen hatırlatması...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && p.daily?.voiceMinutes >= targetVoice;
      if (!isComplete) {
        await sendMidDayReminder(p, client).catch(() => { });
      }
    }
  });

  // 19:00 — Akşam uyarısı (hâlâ tamamlamamışlara)
  scheduleAt(19, 0, async () => {
    console.log('[staffSystem] 19:00 akşam uyarısı...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && (p.daily?.voiceMinutes || 0) >= targetVoice;
      if (!isComplete) {
        await sendEveningWarning(p, client).catch(() => { });
      }
    }
  });

  // 15:00 — Öğleden sonra motivasyon mesajı (aktif olan personele)
  scheduleAt(15, 0, async () => {
    console.log('[staffSystem] 15:00 motivasyon mesajları gönderiliyor...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    const shouldSendMotivation = Math.random() > 0.5;
    if (!shouldSendMotivation) {
      console.log('[staffSystem] 15:00 motivasyon: bugün tüm personele mesaj gönderilmeyecek.');
      return;
    }

    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      await sendRandomMotivationDM(p, client).catch(() => { });
    }
  });

  // 18:00 — Akşam eğlenceleri (gamification fun message'ları)
  scheduleAt(18, 0, async () => {
    console.log('[staffSystem] 18:00 eğlenceli mesajları gönderiliyor...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      // %60 şansla eğlenceli mesaj gönder
      if (Math.random() > 0.4) {
        await sendFunMessage(p.userId, client).catch(() => { });
      }
    }
  });

  // 21:00 — Akşam geç saatlerde teşvik mesajı
  scheduleAt(21, 0, async () => {
    console.log('[staffSystem] 21:00 gece motivasyonu...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const activeVoice = new Set();
    if (guild) {
      guild.voiceStates.cache.forEach((voiceState, userId) => {
        if (voiceState.channelId && !voiceState.member?.user.bot) {
          activeVoice.add(userId);
        }
      });
    }

    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && (p.daily?.voiceMinutes || 0) >= targetVoice;

      // Gece aktif olanlara önce gece mesaisi teklifi gönder
      if (!isComplete && activeVoice.has(p.userId) && !p.daily?.overtimeActive) {
        await sendNightShiftOffer(p, client).catch(() => { });
        continue;
      }

      // Tamamlayanları tebrik et, tamamlayamayanlara son çağrı yap
      if (isComplete) {
        const embed = new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ Günlük Görevleri Tamamladın!')
          .setDescription(`Muhteşem! Bugünün görevlerini başarıyla tamamladın! 🌟\n\nYarın da bu tempoyu koruyabilirsin. İyi geceler!`)
          .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
          .setTimestamp();
        try {
          const user = await client.users.fetch(p.userId);
          await user.send({ embeds: [embed] });
        } catch (_) { }
      } else {
        const today = todayStr();
        const stats = getDailyTaskCompletionStats(p);
        const targetVoice = req.voiceMinutes + (p.daily?.date === today ? (p.daily?.transferredVoiceMinutes || 0) : 0);
        const targetGreets = req.greets + (p.daily?.date === today ? (p.daily?.transferredGreets || 0) : 0);

        const isGreetDone = p.daily?.date === today && p.daily?.greeted;
        const greetsSent = p.daily?.date === today ? (p.daily?.greetCount || 0) : 0;
        const voiceMinutes = p.daily?.date === today ? (p.daily?.voiceMinutes || 0) : 0;

        const embed = new EmbedBuilder()
          .setColor(0xff3333)
          .setTitle('🚨 SON ÇAĞRI: Günlük Görevler İçin Son 2.5 Saat!')
          .setDescription(
            `Hey <@${p.userId}>, bugünün günlük görevlerini tamamlaman için **son 2.5 saat** kaldı! ⏰\n\n` +
            `Görevin gece **23:30'da** sıfırlanacak ve kontrol edilecektir. Haklarının yanmaması için lütfen kalan hedeflerini tamamla!\n\n` +
            `📊 **Mevcut İlerlemen:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**\n\n` +
            `📋 **Kalan Görevlerin:**\n` +
            (!isGreetDone ? `• 👋 **${targetGreets - greetsSent}x** daha yeni üyeye hoş geldin de (Gereken: ${targetGreets}x)\n` : '') +
            (voiceMinutes < targetVoice ? `• 🎤 **${targetVoice - voiceMinutes} dk** daha ses kanalında kal (Gereken: ${targetVoice} dk)\n` : '') +
            (p.daily?.chosenTask && !p.daily?.chosenTaskCompleted ? `• 🎯 Seçmeli Görev: **${CHOSEN_TASKS[p.daily.chosenTask] || p.daily.chosenTask}**\n` : '') +
            `\n⚠️ **Unutma:** Görevleri tamamlamazsan uyarı alabilirsin. Şu anki ardışık günlerin: **${p.stats?.consecutiveDays || 0} gün**.`
          )
          .setFooter({ text: 'Eko Yıldız • Son Hatırlatma Sistemi' })
          .setTimestamp();

        try {
          const user = await client.users.fetch(p.userId);
          await user.send({ embeds: [embed] });
        } catch (_) { }
      }
    }
  });

  // 23:30 — Günlük kapanış kontrol + uyarı
  scheduleAt(23, 30, async () => {
    console.log('[staffSystem] 23:30 günlük kapanış...');
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of rawProgress) {
      await applyNightShiftMorningCarryover(p).catch(() => { });
      await p.save().catch(() => { });
    }
    await runDailyCheck(client);
  });

  // 17:00 — Doğrulama kontrolü
  scheduleAt(17, 0, async () => {
    console.log('[staffSystem] 17:00 doğrulama kontrolü...');
    await checkStaffVerifications(client);
  });

  // 12:00 — Günlük sınav kontrolü
  scheduleAt(12, 0, async () => {
    console.log('[staffSystem] 12:00 sınav kontrolü...');
    try {
      const { checkActiveExams } = require('./aiExamService');
      await checkActiveExams(client);
    } catch (err) {
      console.error('[staffSystem] Sınav kontrolü hatası:', err.message);
    }
  });

  // Her 1 dakikada bir ses aktifliği kontrolü
  setInterval(async () => {
    if (global.SPAM_STOPPED) return;
    try {
      const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (!guild) return;

      const staffRoleIds = Object.values(ROLES);

      // Tüm aktif yetkilileri veritabanından al
      const allActiveStaff = await StaffProgress.find({ status: 'active' }).catch(() => []);
      const activeStaffIds = new Set(allActiveStaff.map(p => p.userId));

      // Sunucudaki tüm ses kanallarını gez
      const voiceStates = guild.voiceStates.cache;
      for (const [userId, voiceState] of voiceStates) {
        // Eğer bir kanaldaysa, bot değilse
        if (voiceState.channelId && !voiceState.member?.user.bot) {
          // Üye önbellekte yoksa fetch et
          const member = voiceState.member || await guild.members.fetch(userId).catch(() => null);
          if (!member) continue;

          // Veritabanında aktifse, Discord üzerinde yetkili rolü varsa veya Administrator ise yetkili kabul et
          const isStaff = activeStaffIds.has(userId) ||
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            staffRoleIds.some(rid =>
              rid && !['PERSONEL_ROLE_ID', 'GELISMIS_ROLE_ID', 'SEKRETER_ROLE_ID'].includes(rid)
              && member.roles.cache.has(rid)
            );

          if (isStaff) {
            // 1 dakika ses aktifliği ekle
            await addVoiceMinutes(userId, 1, client).catch(err => {
              console.error(`[staffSystem] addVoiceMinutes interval error for ${userId}:`, err.message);
            });
          }
        }
      }
    } catch (err) {
      console.error('[staffSystem] Ses aktifliği interval hatası:', err.message);
    }
  }, 60000).unref();

  console.log('[staffSystem] Scheduler başlatıldı (09:00 / 12:00 / 13:00 / 17:00 / 19:00 / 23:30)');

  // Başlangıçta hemen doğrulama kontrolünü bir defa yap
  setTimeout(() => checkStaffVerifications(client), 10000); // 10 saniye sonra
  setTimeout(() => {
    try {
      const { checkActiveExams } = require('./aiExamService');
      checkActiveExams(client);
    } catch (_) { }
  }, 15000); // 15 saniye sonra

  // Bot başlatıldığında kaçırılan günlük kontrolleri kontrol et ve çalıştır (Catch-up Mekanizması)
  (async () => {
    try {
      console.log('[staffSystem] Başlangıç günlük kontrol doğrulayıcısı çalışıyor...');
      const checkDate = getTargetCheckDate();
      const ServerConfig = require('../../models/ServerConfig');

      let config = await ServerConfig.findOne({ guildId: GUILD_ID });
      if (!config) {
        config = new ServerConfig({ guildId: GUILD_ID });
      }

      const lastCheck = config.get('lastDailyCheckRunDate') || '';
      console.log(`[staffSystem] Son başarılı kontrol tarihi: ${lastCheck || 'Yok'}, Hedef tarih: ${checkDate}`);

      if (lastCheck !== checkDate) {
        const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
        const currentHour = tzDate.getHours();
        const currentMinute = tzDate.getMinutes();

        // 23:30 geçildi mi veya arada boşta kalan geçmiş günler mi var kontrol et
        const isPastCheckTime = (currentHour > 23) || (currentHour === 23 && currentMinute >= 30);
        const todayString = todayStr();
        const yesterdayDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayString = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterdayDate);

        const isLastCheckMissed = lastCheck !== yesterdayString && lastCheck !== todayString;

        // Only run catch-up if it's past today's scheduled cutoff OR
        // if last check is older than yesterday (genuine missed-day),
        // otherwise skip to avoid sending warnings on normal restarts.
        if (isPastCheckTime || (isLastCheckMissed && lastCheck && lastCheck < yesterdayString)) {
          console.log('[staffSystem] ⚠️ Günlük kontrolün kaçırıldığı tespit edildi! Catch-up çalıştırılıyor...');
          const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
          for (const p of rawProgress) {
            await applyNightShiftMorningCarryover(p).catch(() => { });
            await p.save().catch(() => { });
          }
          await runDailyCheck(client);

          config.set('lastDailyCheckRunDate', checkDate);
          await config.save().catch(() => { });
          console.log(`[staffSystem] ✅ Günlük kontrol catch-up tamamlandı. Son tarih güncellendi: ${checkDate}`);
        } else {
          console.log('[staffSystem] Günlük kontrol henüz zamanı gelmedi veya zaten güncel.');
        }
      }
    } catch (startupErr) {
      console.error('[staffSystem] Başlangıç kontrol hatası:', startupErr.message);
    }
  })();
}

// ── PERSONEL DOĞRULAMA KONTROLÜ (ROBLOX & DISCORD) ─────────────────────────
async function checkStaffVerifications(client) {
  try {
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    const User = require('../../models/User');
    const { BASE_URL } = require('../../config');
    let notifiedCount = 0;
    const { fetchUserGroups } = require('./roleSyncService');
    const { ROBLOX, ADMIN_GUILD_ID } = require('./staffAutomation');

    for (const p of allProgress) {
      const user = await User.findOne({ discordId: p.userId });

      const missingRoblox = !user || !user.robloxId;
      const missingGuild = !p.guildJoined; // guildJoined is in StaffProgress

      // EĞER KULLANICI MODERATÖR SUNUCUSUNDAYSA UYARIYI ATMA
      let inModeratorServer = false;
      try {
        const modGuild = await client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
        if (modGuild) {
          const modMember = await modGuild.members.fetch(p.userId).catch(() => null);
          if (modMember) inModeratorServer = true;
        }
      } catch (e) { }

      if (inModeratorServer) {
        console.log(`[staffSystem] checkStaffVerifications: ${p.userId} yönetim sunucusunda, uyarı atlandı.`);
        continue;
      }

      let missingRobloxGroup = false;
      if (!missingRoblox) {
        try {
          const userGroups = await fetchUserGroups(user.robloxId);
          if (!userGroups.some(g => g.group.id === ROBLOX.EKOYILDIZ_MOD)) {
            missingRobloxGroup = true;
          }
        } catch (err) {
          console.warn(`[checkStaffVerifications] Grup kontrolü yapılamadı (User: ${user.robloxId}):`, err.message);
        }
      }

      if (missingRoblox || missingGuild || missingRobloxGroup) {
        let instructionText = "";
        if (missingRoblox) {
          instructionText = `❌ **Aşama 1 - Roblox Hesabını Bağla:** [Buraya Tıklayarak](${BASE_URL}/dashboard) hesabınızı hemen bağlayın.\n\n*(Bu aşamayı tamamladıktan sonra sıradaki adım size iletilecektir)*`;
        } else if (missingRobloxGroup) {
          instructionText = `❌ **Aşama 2 - Roblox Moderatör Grubuna Katıl:** Hemen yetkili grubumuza katılın: https://www.roblox.com/communities/130659145/EkoY-ld-z-Moderat-r-Ekibi#!/about\n\n*(Gruba katılma isteği gönderdikten sonra aşağıdaki **"✅ Doğrulamayı Tamamla"** butonuna tıklayarak veya sunucuda \`/personel-dogrula\` yazarak işleminizi anında onaylatabilirsiniz!)*`;
        } else if (missingGuild) {
          instructionText = `❌ **Aşama 3 - Yönetim Sunucusuna Katıl:** Hemen yönetim sunucumuza katılın: https://discord.gg/fjwjMgH54N\n\n*(Bu son adımdır, tamamladığınızda yetkileriniz aktif kalacaktır)*`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('🚨 DİKKAT: Eksik Doğrulama İşlemi')
          .setDescription(
            `Merhaba <@${p.userId}>, EkoYıldız moderatör ekibinde bulunuyorsun ancak sistemlerimizde **doğrulamanın eksik olduğu tespit edildi.**\n\n` +
            `Görevinize devam edebilmeniz ve yetkilerinizi alabilmeniz için işlemleri aşama aşama tamamlamanız gerekmektedir. Lütfen aşağıdaki adımı gerçekleştirin:\n\n` +
            instructionText +
            `\n\nBu uyarıyı dikkate almazsanız yetkileriniz sistem tarafından otomatik olarak alınabilir.`
          )
          .setFooter({ text: 'EkoYıldız Yüksek Güvenlikli Otomasyon Sistemi' })
          .setTimestamp();

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("btn_personel_check")
            .setLabel("✅ Doğrulamayı Tamamla")
            .setStyle(ButtonStyle.Success)
        );

        try {
          const discordUser = await client.users.fetch(p.userId);
          if (discordUser) {
            await discordUser.send({ embeds: [embed], components: [row] });
            notifiedCount++;
          }
        } catch (_) { }
      }
    }
    console.log(`[staffSystem] Personel doğrulamaları kontrol edildi. ${notifiedCount} kişiye uyarı gönderildi.`);
  } catch (err) {
    console.error('[staffSystem] checkStaffVerifications hatası:', err.message);
  }
}

// ── SİSTEM GÜNCELLEME BİLDİRİMLERİ ─────────────────────────────────────────
/**
 * Tüm personele sistem güncellemesi hakkında bildir
 */
async function notifyAllStaffAboutUpdate(title, description, changes, client) {
  try {
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`🔄 Personel Sistemi Güncellendi - ${title}`)
      .setDescription(description)
      .addFields({
        name: '📝 Yapılan Değişiklikler',
        value: changes.join('\n'),
        inline: false,
      })
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Sürüm Güncelleme' })
      .setTimestamp();

    for (const p of allProgress) {
      try {
        const user = await client.users.fetch(p.userId);
        if (user) await user.send({ embeds: [embed] }).catch(() => { });
      } catch (_) { }
    }

    console.log(`[staffSystem] ${allProgress.length} personele güncelleme bildirimi gönderildi`);
  } catch (err) {
    console.error('[staffSystem] Bildirim hatası:', err.message);
  }
}

// Başlangıçta çalışacak - tüm personele sistem yükseltmesi hakkında bildir
async function sendSystemUpdateNotification(client) {
  try {
    // Sadece systemIntroducedV5: false veya undefined olanları bul
    const rawProgress = await StaffProgress.find({
      level: { $gte: 1, $lte: 5 },
      status: 'active',
      $or: [
        { 'gamification.systemIntroducedV5': false },
        { 'gamification.systemIntroducedV5': { $exists: false } }
      ]
    });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    if (allProgress.length === 0) return;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle('🚀 EKOYILDIZ Moderasyon Personel Sistemi V5.0')
      .setDescription(
        'Hoşgeldiniz moderatörler.. Ben Sentara, EkoYıldız\'ın yeni nesil personel ve moderasyon botuyum. Sistemimiz V5.0 sürümüne yükseltildi! İşte bu güncellemede gelen yenilikler:\n\n' +
        '**🌴 İnaktiflik & İzin Koruma Sistemi:**\n' +
        '• Artık sunucuda inaktiflik, mazeret veya izin rolleri olan yetkililerimize hiçbir bildirim, hatırlatma veya uyarı gitmez.\n\n' +
        '**⏰ Saat Dilimi & Gece Koruma Algoritması:**\n' +
        '• Gece yarısı/sabah erken saatlerdeki görev kontrolü sıfırlanma bugları düzeltildi. Saat 04:00\'e kadar olan kontroller dün yapılmış gibi değerlendirilir.\n\n' +
        '**📊 Görev İlerleme Yüzdeleri & Grafik İlerleme Barı:**\n' +
        '• Artık `/profil`, `/personeldurum` ve DM hatırlatma mesajlarında günlük görevlerinizin yüzde kaçını tamamladığınızı gösteren bir grafik barı (`[██████░░░░]`) bulunuyor!\n\n' +
        '**🛡️ Koç Spam Koruması & node-cron Entegrasyonu:**\n' +
        '• Aylık koç sınav bildirimlerindeki spam bugları düzeltildi ve her ay kullanıcı başına maksimum 1 mesaj limiti getirildi.\n\n' +
        '**🤖 Gerçekçi Moderasyon & AI Koç Roleplay Sistemi:**\n' +
        '• AI Koçlarınız artık birer disiplinli, deneyimli ve gerçekçi moderatör rolünde sizinle konuşur! Kuralları, analizleri ve sunucu hedeflerini gerçekçi bir mentor gibi yönlendirir.\n\n' +
        '**🔒 Sistem Güvenliği (Self-Shutdown):**\n' +
        '• Discord yasaklamalarını önlemek için bot, herhangi bir spam döngüsü tespit ettiğinde kendini güvenli bir şekilde kapatır.\n\n' +
        '**🎁 Versiyon V5.0 Güncelleme Ödülünüz:**\n' +
        '• Yeni sürüme hoş geldiniz hediyesi olarak **300 EkoCoin** ve **800 XP** sizi bekliyor! Aşağıdaki **ÖDÜLÜ AL** butonuna basarak claim edebilirsiniz.'
      )
      .setFooter({ text: 'Eko Yıldız • Personel Yönetim Sistemi V5.0' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('claim_version_reward')
        .setLabel('🎁 ÖDÜLÜ AL')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('test_features')
        .setLabel('🚀 ÖZELLİKLERİ TEST ET')
        .setStyle(ButtonStyle.Primary)
    );

    for (const p of allProgress) {
      try {
        const user = await client.users.fetch(p.userId);
        if (user) {
          await user.send({ embeds: [embed], components: [row] }).catch(() => { });

          p.gamification = p.gamification || {};
          p.gamification.systemIntroducedV5 = true;
          await p.save().catch(() => { });
        }
      } catch (_) { }
    }

    console.log(`[staffSystem] ${allProgress.length} personele V5.0 güncelleme bildirimi gönderildi`);
  } catch (err) {
    console.error('[staffSystem] Sistem bildirimi hatası:', err.message);
  }
}

// ─── V6.0 İnteraktif Hoşgeldin & Tanıtım Bildirimi ─────────────────────────
async function sendV6WelcomeNotification(client) {
  try {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const rawProgress = await StaffProgress.find({
      level: { $gte: 1, $lte: 6 },
      status: 'active',
      $or: [
        { 'gamification.systemIntroducedV6': false },
        { 'gamification.systemIntroducedV6': { $exists: false } }
      ]
    });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    if (allProgress.length === 0) return;

    // ── Sayfa 1: Büyük Hoşgeldin ────────────────────────────────────────────
    const page1 = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('🌟 MODERATÖRLER HOŞGELDİNİZ!! 🌟')
      .setDescription(
        '> *"Ben **Eko** ve boş durmadım!"*\n\n' +
        '🤖 Merhaba! Ben **Sentara**, EkoYıldız\'ın güçlendirilmiş yapay zeka moderasyon botuyum.\n\n' +
        'Siz çalışırken ben de çalıştım — ve bu kez sunucunuzu gerçek bir **profesyonel iş yönetim platformuna** dönüştürecek bir sürü şey getirdim! 🚀\n\n' +
        '**📦 Versiyon: V6.0 — Gerçekçi İş Hayatı Entegrasyon Paketi**\n\n' +
        '> Aşağıdaki butonlara basarak yenilikleri keşfet! 👇'
      )
      .addFields(
        { name: '🎯 Bu güncellemede ne var?', value: '5 sayfalık interaktif tanıtım turuna hoşgeldiniz! Her bölümde sistemin farklı bir özelliğini keşfedeceksiniz.', inline: false },
        { name: '⏰ Tahmini Süre', value: '~3 dakika okuma', inline: true },
        { name: '🎁 Ödül', value: '500 TL + 1500 Elmas (💎)', inline: true }
      )
      .setImage('https://i.imgur.com/z3PFMTJ.gif')
      .setFooter({ text: 'Eko Yıldız V6.0 • Sayfa 1/5 — Para Birimi ve XP Yenilikleri' })
      .setTimestamp();

    // ── Sayfa 2: Para Birimi Yenileme ────────────────────────────────────────
    const page2 = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('💰 Yeni Para Birimi: TL & 💎 Elmas Sistemi')
      .setDescription(
        '**EkoCoin (E.C.) → Türk Lirası (TL)**\n' +
        '**XP (Tecrübe Puanı) → Elmas (💎)**\n\n' +
        'Para birimimiz ve rütbe atlamanızı sağlayan puanlarımız tamamen yenilendi! Tüm mevcut bakiyeleriniz birebir korundu.\n\n'
      )
      .addFields(
        { name: '💼 Maaş Bordrosu Sistemi', value: 'Artık maaşınız gerçek bir muhasebe faturası gibi: **Brüt kazanç - Disiplin Cezası (%15/uyarı) - Gelir Vergisi (%10) = Net Maaş**', inline: false },
        { name: '🏆 Liderlik Tablosu', value: 'Sıralamalar artık **Elmas (💎)** cinsinden gösteriliyor. En fazla Elmas kazanan Hafta\'nın Yetkilisi olur!', inline: false },
        { name: '📊 Nasıl Kullanılır?', value: '`Kişisel İşlemler Menüsü → 🪙 Haftalık Maaşımı Al` butonuna bas!', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız V6.0 • Sayfa 2/5 — Nöbet & Mola Sistemi' });

    // ── Sayfa 3: Nöbet & Mola Sistemi ─────────────────────────────────────
    const page3 = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('⚡ Nöbet & ☕ Kahve Molası Sistemi')
      .setDescription(
        'Artık moderatörlük bir oyun gibi değil, **gerçek bir iş vardiyası** gibi çalışıyor!\n\n' +
        '**Nöbet Başlatma:** `⚡ Nöbete Başla` butonuna bas. Ses, bilet ve mod işlemlerin otomatik loglanır.\n' +
        '**Kahve Molası:** Nöbetteyken `☕ Mola Ver` butonu belirir! Tıkla ve dinlen. Kaç dakika mola yaptığın üst yönetime loglanır.\n' +
        '**Vardiya Devri:** Nöbeti bitirirken çıkan forma **Devir Notu** yaz — bir sonraki moderatöre profesyonelce teslim et!\n\n'
      )
      .addFields(
        { name: '🎁 Nöbet Ödülleri', value: 'Nöbet süresine, çözülen bilete ve mod işlemine göre otomatik **TL ve Elmas (💎)** kazanırsın!', inline: false },
        { name: '🟡 Durum Renkleri', value: '🟢 Aktif Nöbette · 🟡 Kahve Molasında · 🔴 Nöbette Değil', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız V6.0 • Sayfa 3/5 — AI Sistemleri' });

    // ── Sayfa 4: AI Sistemleri ─────────────────────────────────────────────
    const page4 = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🧠 3 Yeni Yapay Zeka Sistemi')
      .setDescription('Sunucunuzda şimdi 3 farklı AI aracı çalışıyor!\n\u200b')
      .addFields(
        { name: '🧠 AI Performans Karnesi', value: 'AI Baş Mentor Koçu haftalık tüm verilerinizi (KPI, uyarı, takdir, nöbet) analiz ederek size **resmi harf notu (A+/B/C/F)** içeren kişisel bir karne verir!\n`Kişisel İşlemler → 🧠 AI Performans Karnesi`', inline: false },
        { name: '🎓 AI Pratik Eğitimi', value: '5 farklı gerçekçi moderasyon senaryosundan birine cevap ver, AI puan (0-100) ver ve geri bildirim yap! 70+ puan alırsan **+15 💎 Elmas & +5 TL** kazanırsın!\n`Kişisel İşlemler → 🎓 AI Pratik Eğitimi`', inline: false },
        { name: '🤖 AI Mod Asistanı', value: 'Anında kural ihlali veya ceza/mute süresi tavsiyesi almak için `🤖 AI Asistan` butonuna bas!', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız V6.0 • Sayfa 4/5 — Acil Sistem & Görevler' });

    // ── Sayfa 5: Acil Sistem & Son ────────────────────────────────────────
    const page5 = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🚨 Acil Durum Alarmı & Yeni Görevler')
      .setDescription('\u200b')
      .addFields(
        { name: '🚨 Acil Durum / Baskın Alarmı', value: 'Baskın, token raid, bypass reklam gibi acil durumlarda `Kişisel İşlemler → 🚨 Acil Durum Alarmı` seçeneğini kullan! Üst yönetim **@here** pingiyle anında uyarılır.', inline: false },
        { name: '📅 3 Yeni Günlük Görev', value: '🎓 **Akademi Öğrencisi** — Günde 1 AI senaryosu çöz\n📝 **Rapor Sunucusu** — Günde 1 Vaka/Vardiya Raporu gir\n⚡ **Görev Başında** — 30 dakika aktif nöbette kal', inline: false },
        { name: '🎁 V6.0 Güncelleme Ödülünüz', value: 'Aşağıdaki **ÖDÜLÜ AL** butonuna basarak **500 TL + 1500 Elmas (💎)** hediyenizi alabilirsiniz!', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız V6.0 • Sayfa 5/5 — İyi nöbetler! 💚' })
      .setTimestamp();

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('claim_v6_reward')
        .setLabel('🎁 V6.0 ÖDÜLÜNÜ AL')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('🏠 Mod Anasayfasını Aç')
        .setStyle(ButtonStyle.Primary)
    );

    for (const p of allProgress) {
      try {
        const user = await client.users.fetch(p.userId).catch(() => null);
        if (!user) continue;

        // 🔧 FIX: setTimeout loop yerine Promise.all ile paralel gönder (bot kilidi)
        // 50 kişiye 5 sayfa × 800ms = 3+ dakika kaybı. Bunun yerine paralel gönderin.
        try {
          await Promise.all([
            user.send({ embeds: [page1] }).catch(() => { }),
            user.send({ embeds: [page2] }).catch(() => { }).then(() => new Promise(r => setTimeout(r, 100))),
            user.send({ embeds: [page3] }).catch(() => { }).then(() => new Promise(r => setTimeout(r, 200))),
            user.send({ embeds: [page4] }).catch(() => { }).then(() => new Promise(r => setTimeout(r, 300))),
            user.send({ embeds: [page5], components: [claimRow] }).catch(() => { }).then(() => new Promise(r => setTimeout(r, 400))),
          ]);
        } catch (_) { }

        p.gamification = p.gamification || {};
        p.gamification.systemIntroducedV6 = true;
        await p.save().catch(() => { });
      } catch (_) { }
    }

    console.log(`[staffSystem] ${allProgress.length} personele V6.0 hoşgeldin bildirimi gönderildi.`);
  } catch (err) {
    console.error('[staffSystem] V6 Bildirim hatası:', err.message);
  }
}


async function notifyStaff(userId, title, message, color = 0x7c6af7, client) {
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    await user.send({ embeds: [embed] });
  } catch (err) {
    console.warn(`[staffSystem] Bildirim gönderilemedi (${userId}):`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// 🎮 GAMİFİCATION SİSTEMİ (OYUNLAŞTIRMA)
// ═══════════════════════════════════════════════════════════════════════════════════

// Rozet tanımları
const BADGES = {
  firstTicket: { name: '🎫 İlk Ticket', desc: 'İlk ticket\'ini çözdün!', xp: 50 },
  weekWarrior: { name: '⚔️ Hafta Savaşçısı', desc: '7 gün ardışık başarı!', xp: 200 },
  monthMaster: { name: '👑 Ay Hakimi', desc: '30 gün ardışık başarı!', xp: 500 },
  ticketHero: { name: '🦸 Ticket Kahramanı', desc: '50 ticket çözdün!', xp: 300 },
  supportStar: { name: '⭐ Destek Yıldızı', desc: '100 ticket çözdün!', xp: 750 },
  legendaryHelper: { name: '🌟 Efsane Yardımcı', desc: '250 ticket çözdün!', xp: 2000 },
  perfectWeek: { name: '💯 Mükemmel Hafta', desc: '7 gün 100% başarı!', xp: 400 },
  socialButterfly: { name: '🦋 Sosyal Kelebeği', desc: '10 anket yönettin!', xp: 300 },
  moderator: { name: '🛡️ Moderatör', desc: '30 moderasyon işlemi!', xp: 350 },
  speedRunner: { name: '⚡ Hız Ustası', desc: 'Aynı gün 5 ticket!', xp: 250 },
  noMissWeek: { name: '🎯 Hedefçi', desc: '7 gün uyarısız!', xp: 300 },
  chatterbox: { name: '💬 Muhabbetçi', desc: 'Sohbette 500 mesaj gönderdin!', xp: 300 },
};

/**
 * XP ve seviye hesapla
 */
function getXpForLevel(level) {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

/**
 * Rozetleri kontrol et ve kilidi aç
 */
async function checkAndUnlockBadges(progress, client) {
  if (!progress.gamification) {
    progress.gamification = {
      totalPoints: 0,
      level: 1,
      currentXP: 0,
      badges: {},
      streak: { current: 0, longest: 0, brokenDays: 0 },
    };
  }

  const badges = progress.gamification.badges || {};
  const stats = progress.stats || {};
  let newBadges = [];

  // Rozetleri kontrol et
  if (stats.ticketsSolved === 1 && !badges.firstTicket) {
    badges.firstTicket = true;
    newBadges.push('firstTicket');
  }

  if (stats.consecutiveDays === 7 && !badges.weekWarrior) {
    badges.weekWarrior = true;
    newBadges.push('weekWarrior');
  }

  if (stats.consecutiveDays === 30 && !badges.monthMaster) {
    badges.monthMaster = true;
    newBadges.push('monthMaster');
  }

  if ((stats.ticketsSolved || 0) >= 50 && !badges.ticketHero) {
    badges.ticketHero = true;
    newBadges.push('ticketHero');
  }

  if ((stats.ticketsSolved || 0) >= 100 && !badges.supportStar) {
    badges.supportStar = true;
    newBadges.push('supportStar');
  }

  if ((stats.ticketsSolved || 0) >= 250 && !badges.legendaryHelper) {
    badges.legendaryHelper = true;
    newBadges.push('legendaryHelper');
  }

  if ((stats.surveysCompleted || 0) >= 10 && !badges.socialButterfly) {
    badges.socialButterfly = true;
    newBadges.push('socialButterfly');
  }

  if ((stats.moderationActions || 0) >= 30 && !badges.moderator) {
    badges.moderator = true;
    newBadges.push('moderator');
  }

  if (!badges.noMissWeek && progress.warnings?.count === 0 && stats.consecutiveDays >= 7) {
    badges.noMissWeek = true;
    newBadges.push('noMissWeek');
  }

  if ((stats.dailyTicketsToday || 0) >= 5 && !badges.speedRunner) {
    badges.speedRunner = true;
    newBadges.push('speedRunner');
  }

  if ((stats.chatMessages || 0) >= 500 && !badges.chatterbox) {
    badges.chatterbox = true;
    newBadges.push('chatterbox');
  }

  // Yeni rozetler için gönder
  if (newBadges.length > 0) {
    for (const badgeId of newBadges) {
      await sendBadgeUnlockedDM(progress, badgeId, client).catch(() => { });
    }
  }

  await progress.save().catch(() => { });
  return newBadges;
}

/**
 * Rozet açıldığında bildir
 */
async function sendBadgeUnlockedDM(progress, badgeId, client) {
  const badge = BADGES[badgeId];
  if (!badge) return;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🏆 ROZET AÇILDI: ${badge.name}`)
    .setDescription(
      `\`\`\`\n${badge.name}\n\`\`\`\n\n` +
      `**${badge.desc}**\n\n` +
      `✨ +${badge.xp} XP kazandın!\n\n` +
      `Harika bir başarı! Bu rozeti taşı gurulla! 💪`
    )
    .setFooter({ text: 'Eko Yıldız • Gamification' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
    console.log(`[staffSystem] Rozet açıldı: ${progress.userId} → ${badgeId}`);
  } catch (_) { }
}

/**
 * Leaderboard al (Top 25) - Geliştirilmiş versiyon
 */
async function getLeaderboard(category = 'points') {
  try {
    let sortField;
    switch (category) {
      case 'xp':
        sortField = { 'gamification.currentXP': -1 };
        break;
      case 'level':
        sortField = { 'level': -1 };
        break;
      case 'badges':
        sortField = { 'gamification.badges': -1 };
        break;
      case 'streak':
        sortField = { 'gamification.streak.current': -1 };
        break;
      default: // points
        sortField = { 'gamification.totalPoints': -1 };
    }

    const allProgress = await StaffProgress.find({ status: 'active' })
      .sort(sortField)
      .limit(25)
      .select('userId gamification stats level');

    const { getDiscordClient } = require('../discordClient');
    const client = getDiscordClient();

    const leaderboardData = await Promise.all(
      allProgress.map(async (p, idx) => {
        let username = `Kullanıcı #${p.userId}`;
        if (client) {
          const userObj = await client.users.fetch(p.userId).catch(() => null);
          if (userObj) {
            username = userObj.username;
          }
        }
        return {
          rank: idx + 1,
          userId: p.userId,
          username: username,
          points: p.gamification?.totalPoints || 0,
          level: p.level,
          xpLevel: p.gamification?.level || 1,
          xp: p.gamification?.currentXP || 0,
          tickets: p.stats?.ticketsSolved || 0,
          badges: Object.values(p.gamification?.badges || {}).filter(Boolean).length,
          streak: p.gamification?.streak?.current || 0,
          isPremium: false
        };
      })
    );

    return leaderboardData;
  } catch (err) {
    console.error('[staffSystem] Leaderboard hatası:', err.message);
    return [];
  }
}

/**
 * Kullanıcının leaderboard sırasını bul
 */
async function getUserLeaderboardRank(userId, category = 'points') {
  try {
    let sortField;
    switch (category) {
      case 'xp':
        sortField = { 'gamification.currentXP': -1 };
        break;
      case 'level':
        sortField = { 'level': -1 };
        break;
      case 'badges':
        // 🔧 FIX: badges obje olduğu için sayıya çevirip sırlama yapması lazım
        // Bunun yerine hafıza içinde sıralalyoruz
        sortField = { 'gamification.totalPoints': -1 }; // Fallback
        break;
      case 'streak':
        sortField = { 'gamification.streak.current': -1 };
        break;
      default:
        sortField = { 'gamification.totalPoints': -1 };
    }

    const allProgress = await StaffProgress.find({ status: 'active' })
      .sort(sortField)
      .select('userId gamification stats level');

    // 🔧 FIX: badges kategorisinde hafıza içinde badge sayısına göre sırala
    if (category === 'badges') {
      allProgress.sort((a, b) => {
        const badgesA = Object.values(a.gamification?.badges || {}).filter(Boolean).length;
        const badgesB = Object.values(b.gamification?.badges || {}).filter(Boolean).length;
        return badgesB - badgesA; // Descending
      });
    }

    const userRank = allProgress.findIndex(p => p.userId === userId) + 1;
    const userData = allProgress.find(p => p.userId === userId);

    if (!userData) return null;

    const { getDiscordClient } = require('../discordClient');
    const client = getDiscordClient();
    let username = `Kullanıcı #${userData.userId}`;
    if (client) {
      const userObj = await client.users.fetch(userData.userId).catch(() => null);
      if (userObj) {
        username = userObj.username;
      }
    }

    return {
      rank: userRank,
      total: allProgress.length,
      userId: userData.userId,
      username: username,
      points: userData.gamification?.totalPoints || 0,
      level: userData.level,
      xpLevel: userData.gamification?.level || 1,
      xp: userData.gamification?.currentXP || 0,
      tickets: userData.stats?.ticketsSolved || 0,
      badges: Object.values(userData.gamification?.badges || {}).filter(Boolean).length,
      streak: userData.gamification?.streak?.current || 0,
    };
  } catch (err) {
    console.error('[staffSystem] getUserLeaderboardRank hatası:', err.message);
    return null;
  }
}

/**
 * Haftalık Challenge (Zorluk) sistemi
 */
const WEEKLY_CHALLENGES = [
  {
    id: 'ticketBlitz',
    name: '🚀 Ticket Patlaması',
    goal: 10,
    description: 'Bu hafta 10 ticket çöz!',
    reward: 750, // 500 → 750 (artırıldı)
    xpReward: 400,
  },
  {
    id: 'perfectStreak',
    name: '💯 Mükemmel Hafta',
    goal: 7,
    description: '7 gün uyarısız kalmayı başar!',
    reward: 600, // 400 → 600 (artırıldı)
    xpReward: 350,
  },
  {
    id: 'chat_50',
    name: '💬 Geveze Personel',
    goal: 100,
    description: 'Bu hafta sohbet kanalına 100 mesaj gönder!',
    reward: 500,
    xpReward: 300,
  },
  {
    id: 'socialStar',
    name: '⭐ Sosyal Yıldız',
    goal: 4,
    description: 'Her gün sohbete 5+ selam ver!',
    reward: 400, // 250 → 400 (artırıldı)
    xpReward: 250,
  },
  {
    id: 'moderationMaster',
    name: '🛡️ Moderasyon Ustası',
    goal: 8,
    description: '8 moderasyon işlemi yap!',
    reward: 550,
    xpReward: 320,
  },
  {
    id: 'endlessHelper',
    name: '♾️ Sonsuz Yardımcı',
    goal: 15,
    description: 'Haftada 15 ticket çöz (zorlu!)',
    reward: 1000, // Yeni, çok cazip
    xpReward: 600,
  },
];

/**
 * Mevcut hafta challenge'ı döndür
 */
function getWeeklyChallenge() {
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % WEEKLY_CHALLENGES.length;
  return WEEKLY_CHALLENGES[week];
}

/**
 * Personele eğlenceli mesaj gönder
 */
async function sendFunMessage(userId, client) {
  if (await hasInactivityRole(userId, client)) return;
  const funMessages = [
    {
      title: '🎮 OYUN ZAMANINDA!',
      desc: 'Sende kaç puan var? Leaderboard\'a bak! `/leaderboard`',
      color: 0x9d4edd,
    },
    {
      title: '⚡ ÇOK HIZLISSIN!',
      desc: 'Şu hızla gidersen sekreter olursun! Devam et! 💨',
      color: 0x00b4d8,
    },
    {
      title: '🌟 ROZETLER KAZAN!',
      desc: 'Biraz daha ilerlersen yeni rozetler açılacak! Heyecanlı mı? 🏆',
      color: 0xffd60a,
    },
    {
      title: '🎯 HAFTALIK CHALLENGE!',
      desc: `Bu hafta "${getWeeklyChallenge().name}" challenge\'ı var. Başarabilir misin?`,
      color: 0xff006e,
    },
    {
      title: '💪 BÜ GÜZEL!',
      desc: 'Seni sunucuda görmek çok mutlu ediyor! Devam et! 😊',
      color: 0x06ffa5,
    },
  ];

  const msg = funMessages[Math.floor(Math.random() * funMessages.length)];
  const embed = new EmbedBuilder()
    .setColor(msg.color)
    .setTitle(msg.title)
    .setDescription(msg.desc)
    .setFooter({ text: 'Eko Yıldız • Eğlence' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
  } catch (_) { }
}

async function completeOvertime(progress, client) {
  try {
    progress.daily.overtimeCompleted = true;
    progress.daily.overtimeActive = false;

    const isNightShift = progress.daily.nightShiftActive && progress.daily.overtimeTask === 'overtime_voice';
    if (isNightShift) {
      progress.daily.nightShiftActive = false;
      progress.daily.nightShiftAcceptedAt = null;
    }

    // Determine rewards
    let coinsReward = 50;
    let xpReward = 150;
    let taskNameText = 'Ek Görev';

    if (progress.daily.overtimeTask === 'overtime_voice') {
      if (isNightShift) {
        coinsReward = 150;
        xpReward = 450;
        taskNameText = 'Gece Mesaisi (20 Dakika)';
      } else {
        coinsReward = 100;
        xpReward = 300;
        taskNameText = 'Ses Ek Mesaisi (20 Dakika)';
      }
    } else {
      const taskLabels = {
        'task_chat': 'Ek Sohbet Görevi (10 Mesaj)',
        'task_voice': 'Ek Ses Görevi (15 Dakika)',
        'task_ticket': 'Ek Ticket Görevi (1 Çözüm)',
        'task_mod': 'Ek Moderasyon Görevi (1 İşlem)'
      };
      taskNameText = taskLabels[progress.daily.overtimeTask] || 'Ek Görev';
    }

    // Add EkoCoins and XP
    progress.gamification = progress.gamification || {};
    progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + coinsReward;
    progress.gamification.currentXP = (progress.gamification.currentXP || 0) + xpReward;

    // Check level up
    const nextLevelXp = getXpForLevel((progress.gamification.level || 1) + 1);
    if (progress.gamification.currentXP >= nextLevelXp) {
      progress.gamification.level = (progress.gamification.level || 1) + 1;
      progress.gamification.currentXP = 0;
    }

    await progress.save();

    // Send DM
    if (client) {
      try {
        const user = await client.users.fetch(progress.userId).catch(() => null);
        if (user) {
          const embed = new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('🔥 EK GÖREV / EK MESAİ TAMAMLANDI!')
            .setDescription(
              `Tebrikler <@${progress.userId}>, bugünün **"${taskNameText}"** ek mesai görevini başarıyla tamamladın!\n\n` +
              `✨ **+${xpReward} XP** kazanıldı!\n` +
              `💰 **+${coinsReward} EkoCoin (E.C.)** kazanıldı!\n` +
              `💳 Güncel Bakiyen: \`${progress.gamification.ecoCoins} E.C.\``
            )
            .setFooter({ text: 'Eko Yıldız • Ek Görev Sistemi' })
            .setTimestamp();
          await user.send({ embeds: [embed] }).catch(() => { });
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Overtime completion DM error:`, dmErr.message);
      }
    }
  } catch (err) {
    console.error('[staffSystem] completeOvertime error:', err.message);
  }
}

async function sendNightShiftOffer(progress, client) {
  if (!progress || !client) return;
  if (progress.daily?.overtimeActive || progress.daily?.nightShiftActive) return;
  if (await hasInactivityRole(progress.userId, client)) return;

  try {
    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (!user) return;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
    const today = todayStr();
    const greetsDone = progress.daily?.date === today ? (progress.daily?.greetCount || 0) : 0;
    const voiceDone = progress.daily?.date === today ? (progress.daily?.voiceMinutes || 0) : 0;
    const remainingGreets = Math.max(0, req.greets - greetsDone);

    const embed = new EmbedBuilder()
      .setColor(0x6b21a8)
      .setTitle('🌙 GECE MESAİSİ TEKLİFİ')
      .setDescription(
        `Selam <@${progress.userId}>, gece aktif olduğunu gördüm. Eğer bu gece ekstra bir mesai yaparsan **1.5x ödül** kazanabilirsin! 💫\n\n` +
        `Bu gece saat 23:30'a kadar kalan günlük görevlerini bitirirsen, ayrıca ek gece mesaisi bonusu kazanabilirsin.`
      )
      .addFields(
        { name: '📌 Kalan Hedeflerin', value: `• Selamlaşma: **${remainingGreets}** adet\n• Ses: **${Math.max(0, req.voiceMinutes - voiceDone)}** dk`, inline: false },
        { name: '⚡ Gece Mesaisi Avantajı', value: '• +150 E.C. ve +450 XP bonuslu ek görev\n• Gece aktifliğini kazanca dönüştür', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız • Gece Mesaisi Sistemi' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_accept_nightshift')
        .setLabel('⚡ Gece Mesaisi Al')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_decline_nightshift')
        .setLabel('❌ Bu Gece Dinlen')
        .setStyle(ButtonStyle.Secondary)
    );

    await user.send({ embeds: [embed], components: [row] }).catch(() => { });
  } catch (err) {
    console.error('[staffSystem] sendNightShiftOffer error:', err.message);
  }
}

async function applyNightShiftMorningCarryover(progress) {
  if (!progress || !progress.daily || !progress.daily.nightShiftActive) return;

  const today = todayStr();
  if (progress.daily.date !== today) return;

  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const remainingVoice = Math.max(0, req.voiceMinutes - (progress.daily.voiceMinutes || 0));
  const remainingGreets = progress.daily.greeted ? 0 : req.greets;

  if (remainingVoice > 0) {
    progress.daily.transferToTomorrowVoice = (progress.daily.transferToTomorrowVoice || 0) + remainingVoice;
  }
  if (remainingGreets > 0) {
    progress.daily.transferToTomorrowGreets = (progress.daily.transferToTomorrowGreets || 0) + remainingGreets;
  }

  progress.daily.nightShiftActive = false;
  progress.daily.nightShiftAcceptedAt = null;

  // ⚠️ CRITICIAL: Burada resetDaily() çağrı YAPMA!
  // Çünkü 23:30'da carryover yapıldığında todayStr() hala bugünü gösterir.
  // Ama 00:00'da resetDaily() zaten tetiklenir ve transferler aktarılır.
}

async function recordOvertimeTask(userId, type, client) {
  try {
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return { success: false, message: 'Aktif personel bulunamadı.' };
    }

    resetDaily(p);

    if (p.daily.overtimeActive) {
      return { success: false, message: 'Bugün zaten aktif bir ek göreviniz veya ek mesainiz var!' };
    }

    if (type === 'night_shift') {
      p.daily.overtimeActive = true;
      p.daily.overtimeTask = 'overtime_voice';
      p.daily.overtimeTarget = 20; // 20 dk seste kal
      p.daily.overtimeProgress = 0;
      p.daily.overtimeCompleted = false;
      p.daily.nightShiftActive = true;
      p.daily.nightShiftAcceptedAt = new Date();
      await p.save();

      return {
        success: true,
        taskName: '🌙 Gece Mesaisi',
        description: 'Gece aktifliğini ekstra ödüle çevir. Ses kanallarında fazladan **20 dakika** kal.',
        reward: '💰 +150 E.C. ve ✨ +450 XP (1.5x bonus)'
      };
    }

    if (type === 'ek_mesai') {
      // Ses Ek Mesaisi
      p.daily.overtimeActive = true;
      p.daily.overtimeTask = 'overtime_voice';
      p.daily.overtimeTarget = 20; // 20 dk seste kal
      p.daily.overtimeProgress = 0;
      p.daily.overtimeCompleted = false;
      await p.save();

      return {
        success: true,
        taskName: '⚡ Ses Ek Mesaisi',
        description: 'Ses kanallarında fazladan **20 dakika** geçir.',
        reward: '💰 +100 E.C. ve ✨ +300 XP'
      };
    } else {
      // Ek Görev
      const taskKeys = ['task_chat', 'task_voice', 'task_ticket', 'task_mod'];
      const randomTask = taskKeys[Math.floor(Math.random() * taskKeys.length)];

      p.daily.overtimeActive = true;
      p.daily.overtimeTask = randomTask;
      p.daily.overtimeCompleted = false;
      p.daily.overtimeProgress = 0;

      let taskName = '';
      let description = '';
      let target = 0;

      if (randomTask === 'task_chat') {
        target = 10;
        taskName = '💬 Ek Sohbet Görevi';
        description = 'Sohbette fazladan **10 mesaj** gönder.';
      } else if (randomTask === 'task_voice') {
        target = 15;
        taskName = '🎤 Ek Ses Görevi';
        description = 'Ses kanallarında fazladan **15 dakika** geçir.';
      } else if (randomTask === 'task_ticket') {
        target = 1;
        taskName = '🎫 Ek Ticket Görevi';
        description = 'Bugün fazladan **1 ticket** çöz.';
      } else if (randomTask === 'task_mod') {
        target = 1;
        taskName = '🛡️ Ek Moderasyon Görevi';
        description = 'Bugün fazladan **1 moderasyon işlemi** gerçekleştir.';
      }

      p.daily.overtimeTarget = target;
      await p.save();

      return {
        success: true,
        taskName,
        description,
        reward: '💰 +50 E.C. ve ✨ +150 XP'
      };
    }
  } catch (err) {
    console.error('[staffSystem] recordOvertimeTask error:', err.message);
    return { success: false, message: 'Ek görev tanımlanırken hata oluştu.' };
  }
}

async function postponeDailyTask(userId, client) {
  try {
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return { success: false, message: 'Aktif personel bulunamadı.' };
    }

    resetDaily(p);

    if (p.postponeBlocked) {
      return { success: false, message: 'Görev eksiltme yetkiniz AI Koç tarafından askıya alınmıştır!' };
    }

    if (p.stats && p.stats.lastDayPostponed) {
      return { success: false, message: 'Görev erteleme/eksiltme hakkını üst üste iki gün kullanamazsınız!' };
    }

    if (p.daily.postponedToday) {
      return { success: false, message: 'Bugün zaten görev eksiltme hakkınızı kullandınız!' };
    }

    const req = getDailyRequirements(p.level, p.stats.consecutiveDays || 0);
    const todayTargetVoice = req.voiceMinutes + (p.daily.transferredVoiceMinutes || 0);

    const remainingVoice = Math.max(0, todayTargetVoice - (p.daily.voiceMinutes || 0));

    // Selamlaşma için: eğer selam verilmemişse selamı ertele
    const remainingGreets = p.daily.greeted ? 0 : 1;

    if (remainingVoice <= 0 && remainingGreets <= 0) {
      return { success: false, message: 'Bugünkü tüm görevlerinizi zaten tamamladınız, eksiltecek görev kalmadı!' };
    }

    let resultText = '';

    if (remainingVoice > 0) {
      p.daily.transferToTomorrowVoice = (p.daily.transferToTomorrowVoice || 0) + remainingVoice;
      // 🔧 FIX: TransferredVoiceMinutes eksi gitmemesi için Math.max(0, ...) ekle
      p.daily.transferredVoiceMinutes = Math.max(0, (p.daily.transferredVoiceMinutes || 0) - remainingVoice);
      resultText += `• **${remainingVoice} dakika** ses aktifliği yarınki görevinize aktarıldı.\n`;
    }

    if (remainingGreets > 0) {
      p.daily.transferToTomorrowGreets = (p.daily.transferToTomorrowGreets || 0) + remainingGreets;
      // 🔧 FIX: TransferredGreets eksi gitmemesi için Math.max(0, ...) ekle
      p.daily.transferredGreets = Math.max(0, (p.daily.transferredGreets || 0) - remainingGreets);
      // Bugün tamamlanmış sayılması için greeted'ı true yapalım
      p.daily.greeted = true;
      resultText += `• **Selamlaşma görevi** yarınki görevinize aktarıldı.\n`;
    }

    p.daily.postponedToday = true;
    await p.save();

    // Günlük görevin tamamlanıp tamamlanmadığını kontrol et
    await checkDailyCompletion(p, client).catch(() => { });

    return {
      success: true,
      message: resultText
    };
  } catch (err) {
    console.error('[staffSystem] postponeDailyTask error:', err.message);
    return { success: false, message: 'Görev erteleme işlemi sırasında hata oluştu.' };
  }
}

// ── V5.1 HATA GIDERME VE AYARLAR YENILIKLERI ──

function generateGreetProgressEmbed(progress) {
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const targetGreets = req.greets + (progress.daily?.transferredGreets || 0);
  const stats = getDailyTaskCompletionStats(progress);

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🌅 Selamlaşma İlerlemesi')
    .setDescription(
      `Merhaba <@${progress.userId}>,\n\n` +
      `Grupta selam verdin! Selamlaşma görevi ilerlemen: **${progress.daily.greetCount}/${targetGreets}**\n\n` +
      `📊 **Genel Görev İlerlemen:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
    .setTimestamp();
}

function getGreetProgressComponents() {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_update_greet_progress')
      .setLabel('🔄 Güncelle')
      .setStyle(ButtonStyle.Primary)
  );
  return [row];
}

async function updateGreetProgressMessage(progress, client) {
  if (!progress.daily?.greetMessageId) return false;
  const discordUser = await client.users.fetch(progress.userId).catch(() => null);
  if (!discordUser) return false;

  const dmChannel = discordUser.dmChannel || await discordUser.createDM().catch(() => null);
  if (!dmChannel) return false;

  const message = await dmChannel.messages.fetch(progress.daily.greetMessageId).catch(() => null);
  if (!message) {
    progress.daily.greetMessageId = '';
    return false;
  }

  const embed = generateGreetProgressEmbed(progress);
  const components = getGreetProgressComponents();
  await message.edit({ embeds: [embed], components }).catch(() => { progress.daily.greetMessageId = ''; });
  return !!progress.daily.greetMessageId;
}

async function clearGreetProgressMessage(progress, client) {
  if (!progress.daily?.greetMessageId) return false;
  const discordUser = await client.users.fetch(progress.userId).catch(() => null);
  if (!discordUser) return false;

  const dmChannel = discordUser.dmChannel || await discordUser.createDM().catch(() => null);
  if (!dmChannel) return false;

  const message = await dmChannel.messages.fetch(progress.daily.greetMessageId).catch(() => null);
  if (!message) {
    progress.daily.greetMessageId = '';
    return false;
  }

  await message.delete().catch(() => { });
  progress.daily.greetMessageId = '';
  return true;
}

function generateSettingsEmbed(progress) {
  const briefingStatus = progress.settings?.dailyBriefingEnabled !== false ? '🟢 Açık' : '🔴 Kapalı';
  const warningsStatus = progress.settings?.warningsEnabled !== false ? '🟢 Açık' : '🔴 Kapalı';

  return new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle('⚙️ Personel Bildirim & Görev Ayarları')
    .setDescription(
      `Buradan bot bildirimlerinizi ve ayarlarınızı yapılandırabilirsiniz.\n\n` +
      `📅 **Sabah Brifingi:** Günlük görevlerinizin başladığını hatırlatan sabah mesajları.\n` +
      `⚠️ **Uyarı Bildirimleri:** Görevlerinizi yapmadığınızda gelen hatırlatma ve uyarı mesajları.`
    )
    .addFields(
      { name: 'Sabah Brifingi', value: briefingStatus, inline: true },
      { name: 'Uyarı Bildirimleri', value: warningsStatus, inline: true }
    )
    .setFooter({ text: 'Eko Yıldız • Ayarlar' })
    .setTimestamp();
}

function getSettingsComponents(progress) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const briefingLabel = progress.settings?.dailyBriefingEnabled !== false
    ? '📅 Sabah Brifingi: Kapat'
    : '📅 Sabah Brifingi: Aç';
  const briefingStyle = progress.settings?.dailyBriefingEnabled !== false
    ? ButtonStyle.Danger
    : ButtonStyle.Success;

  const warningsLabel = progress.settings?.warningsEnabled !== false
    ? '⚠️ Uyarılar: Kapat'
    : '⚠️ Uyarılar: Aç';
  const warningsStyle = progress.settings?.warningsEnabled !== false
    ? ButtonStyle.Danger
    : ButtonStyle.Success;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_toggle_briefing')
      .setLabel(briefingLabel)
      .setStyle(briefingStyle),
    new ButtonBuilder()
      .setCustomId('staff_toggle_warnings')
      .setLabel(warningsLabel)
      .setStyle(warningsStyle),
    new ButtonBuilder()
      .setCustomId('staff_settings_back')
      .setLabel('◀️ Geri Dön')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

async function recordGamePlay(userId, gameType, client) {
  try {
    if (!userId) return;
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    resetDaily(p);

    if (gameType === 'word') {
      p.daily.wordGamesPlayed = (p.daily.wordGamesPlayed || 0) + 1;
    } else if (gameType === 'bom') {
      p.daily.bomGamesPlayed = (p.daily.bomGamesPlayed || 0) + 1;
    }

    await p.save().catch(() => { });
    await checkChosenTaskCompletion(p, client).catch(() => { });
  } catch (err) {
    console.error('[staffSystem] recordGamePlay error:', err.message);
  }
}

// ── Interactive Walkthrough (Ne yapacağımı bilmiyorum?) ─────────────────
const WALK_PLANS = {
  default: {
    id: 'default',
    title: 'Günlük Hızlı Plan',
    description: 'Bugün öncelikle takip etmen gereken adımları sırayla gösterir. İstersen planı kabul et, sistem adımları günlere dağıtsın.',
    steps: [
      { id: 'open_panel', text: 'Paneli aç: Moderasyon Anasayfası ile tüm menülere eriş.', action: false },
      { id: 'daily_tasks', text: 'Günlük Görevler: Selamlaşma ve ses hedeflerini kontrol et ve tamamla.', action: true },
      { id: 'start_duty', text: 'Nöbete Başla: Ses kanalında aktif ol ve ticket çöz.', action: true },
      { id: 'unit_fund', text: 'Birim Fonlama: Birim lideriysen sponsorluk veya fon yönetimi yap.', action: false },
      { id: 'vip_store', text: 'VIP Mağaza: Profil teması veya rozet satın al.', action: false }
    ]
  }
};

async function startWalkthrough(userId, client) {
  try {
    const p = await getOrCreate(userId, GUILD_ID, client);
    const plan = WALK_PLANS.default;
    p.walkthrough = {
      active: true,
      step: 0,
      planId: plan.id,
      plan: plan,
      accepted: false,
      completedSteps: [],
      schedule: {}
    };
    await p.save().catch(() => { });
    await sendWalkthroughStep(p, client);
  } catch (err) {
    console.error('[staffSystem] startWalkthrough error:', err.message);
  }
}

function formatStepIndex(progress) {
  const plan = progress.walkthrough?.plan || WALK_PLANS.default;
  const max = (plan.steps || []).length;
  const idx = Math.max(0, Math.min(progress.walkthrough?.step || 0, max - 1));
  return { idx, max };
}

async function sendWalkthroughStep(progress, client) {
  try {
    if (!progress.walkthrough || !progress.walkthrough.active) return;
    const plan = progress.walkthrough.plan || WALK_PLANS.default;
    const { idx, max } = formatStepIndex(progress);
    const step = plan.steps[idx];

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle(`🧭 ${plan.title} — Adım ${idx + 1}/${max}`)
      .setDescription(step.text + (plan.description && idx === 0 ? '\n\n' + plan.description : ''))
      .setColor(0x3498db)
      .setTimestamp();

    const row = new ActionRowBuilder();
    if (idx > 0) row.addComponents(new ButtonBuilder().setCustomId(`walkthrough_prev_${progress.userId}`).setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary));
    if (idx < max - 1) row.addComponents(new ButtonBuilder().setCustomId(`walkthrough_next_${progress.userId}`).setLabel('İleri ▶️').setStyle(ButtonStyle.Primary));

    // Action button for steps that are actionable
    if (step.action && !progress.walkthrough.completedSteps?.includes(step.id)) {
      row.addComponents(new ButtonBuilder().setCustomId(`walkthrough_complete_${progress.userId}_${step.id}`).setLabel('✔️ Yapıldı').setStyle(ButtonStyle.Success));
    }

    // Accept plan (only shown on first step and not yet accepted)
    if (idx === 0 && !progress.walkthrough.accepted) {
      row.addComponents(new ButtonBuilder().setCustomId(`walkthrough_accept_${progress.userId}`).setLabel('Planı Kabul Et').setStyle(ButtonStyle.Primary));
    }

    row.addComponents(new ButtonBuilder().setCustomId(`walkthrough_done_${progress.userId}`).setLabel('Bitti ✅').setStyle(ButtonStyle.Secondary));

    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (!user) return;
    await user.send({ embeds: [embed], components: [row] }).catch(() => { });
  } catch (err) {
    console.error('[staffSystem] sendWalkthroughStep error:', err.message);
  }
}

function datePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function handleWalkthroughAction(userId, action, client, extra) {
  try {
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p) return;
    p.walkthrough = p.walkthrough || { active: false, step: 0, plan: WALK_PLANS.default };
    const plan = p.walkthrough.plan || WALK_PLANS.default;
    const { idx, max } = formatStepIndex(p);

    if (action === 'next') {
      p.walkthrough.step = Math.min((p.walkthrough.step || 0) + 1, max - 1);
    } else if (action === 'prev') {
      p.walkthrough.step = Math.max((p.walkthrough.step || 0) - 1, 0);
    } else if (action === 'done') {
      p.walkthrough.active = false;
      p.walkthrough.step = 0;
      await p.save().catch(() => { });
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) await user.send('✅ Rehberi tamamladın! Tekrar başlatmak istersen her zaman "Ne yapacağımı bilmiyorum?" butonuna tıklayabilirsin.').catch(() => { });
      return;
    } else if (action === 'accept') {
      // Accept plan: generate a simple schedule mapping each step to consecutive days starting today
      p.walkthrough.accepted = true;
      p.walkthrough.acceptedAt = new Date();
      p.walkthrough.schedule = {};
      for (let i = 0; i < plan.steps.length; i++) {
        const day = datePlusDays(i);
        p.walkthrough.schedule[day] = p.walkthrough.schedule[day] || [];
        p.walkthrough.schedule[day].push(plan.steps[i].id);
      }
      // Notify user
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) await user.send(`✅ Plan kabul edildi. Adımlar bugün ve sonraki günlere dağıtıldı. Takibini panelden yapabilirsin.`).catch(() => { });
    } else if (action === 'complete' && extra) {
      // extra expected as step id
      const stepId = extra;
      p.walkthrough.completedSteps = p.walkthrough.completedSteps || [];
      if (!p.walkthrough.completedSteps.includes(stepId)) p.walkthrough.completedSteps.push(stepId);
      // auto-advance if current step
      if (plan.steps[idx] && plan.steps[idx].id === stepId) {
        p.walkthrough.step = Math.min(idx + 1, max - 1);
      }
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) await user.send(`✔️ "${stepId}" işaretlendi.`).catch(() => { });
    }

    await p.save().catch(() => { });
    await sendWalkthroughStep(p, client);
  } catch (err) {
    console.error('[staffSystem] handleWalkthroughAction error:', err.message);
  }
}

// ╔─ 🔧 ANKET SİSTEMİ FİX ────────────────────────────────────────────────╗
// ║ surveysCompleted sayacı hiç artırılmıyordu. Bunları arttıran fonksiyon  ║
// ╚─────────────────────────────────────────────────────────────────────────╝

/**
 * Yetkili anket yönetimi kaydeder
 * @param {string} userId - Kullanıcı ID
 * @param {string} surveyTitle - Anket başlığı
 * @param {Object} client - Discord client
 */
async function recordSurvey(userId, surveyTitle = 'Anket', client = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordSurvey: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return;
    }

    resetDaily(p);

    // surveysCompleted sayacını arttır
    p.stats.surveysCompleted = (p.stats.surveysCompleted || 0) + 1;

    // Badge kontrolü yapılacak
    await p.save().catch(err => {
      console.error('[staffSystem] recordSurvey save error:', err.message);
    });

    console.log(`[staffSystem] ${userId} anket yönetimini tamamladı: "${surveyTitle}"`);

    // Badge kontrolü (socialButterfly badge'i için)
    await checkAndUnlockBadges(p, client).catch(() => { });

  } catch (err) {
    console.error('[staffSystem] recordSurvey error:', err.message);
  }
}

// ╔─────────────────────────────────────────────────────────────────────────╗


// ║ resign ve retire fonksiyonları dışa export ediliyordu ama gövde yoktu  ║
// ╚─────────────────────────────────────────────────────────────────────────╝

/**
 * Yetkiliyi istifa ettir
 * @param {string} userId - Kullanıcı ID
 * @param {string} reason - İstifa nedeni
 * @param {Object} client - Discord client
 */
async function resignFromStaff(userId, reason = 'Kişisel sebepler', client = null) {
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) {
      console.warn(`[staffSystem] resignFromStaff: User ${userId} not found in staff system`);
      return false;
    }

    const prevLevel = p.level || 1;
    const prevRole = ROLE_NAMES[prevLevel] || 'Bilinmiyor';

    // İstifa işaretle
    p.status = 'resigned';
    p.resignedAt = new Date();
    p.resignReason = reason;
    p.level = 0; // Aktif değil

    await p.save();

    // Yöneticilere bildir
    console.log(`[staffSystem] ${userId} ${prevRole} rütbesinden istifa etti: "${reason}"`);

    if (client) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(
          `👋 İstifanız alındı.\n` +
          `**Rütbeniz:** ${prevRole}\n` +
          `**Sebep:** ${reason}\n` +
          `Gelecekte tekrar katılmak istersen yöneticilere yazabilirsin.`
        ).catch(() => { });
      } catch (_) { }
    }

    return true;
  } catch (err) {
    console.error('[staffSystem] resignFromStaff error:', err.message);
    return false;
  }
}

/**
 * Yetkiliyi emekliye çıkar (sistem tarafından)
 * @param {string} userId - Kullanıcı ID
 * @param {string} reason - Emeklilik nedeni
 * @param {Object} client - Discord client
 */
async function retireFromStaff(userId, reason = 'Sistem tarafından', client = null) {
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) {
      console.warn(`[staffSystem] retireFromStaff: User ${userId} not found in staff system`);
      return false;
    }

    const prevLevel = p.level || 1;
    const prevRole = ROLE_NAMES[prevLevel] || 'Bilinmiyor';
    const activeDays = p.stats?.activeDays || 0;

    // Emeklilik işaretle
    p.status = 'retired';
    p.retiredAt = new Date();
    p.retirementReason = reason;
    p.level = 0; // Aktif değil

    await p.save();

    console.log(`[staffSystem] ${userId} emekliye çıkarıldı. Rütbe: ${prevRole}, Aktif Gün: ${activeDays}`);

    if (client) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(
          `🎖️ Emekliye çıkıştınız.\n` +
          `**Rütbeniz:** ${prevRole}\n` +
          `**Aktif Gün:** ${activeDays} gün\n` +
          `**Sebep:** ${reason}\n` +
          `Hizmetleriniz için teşekkürler! Hononu hak ettiniz. 🏆`
        ).catch(() => { });
      } catch (_) { }
    }

    return true;
  } catch (err) {
    console.error('[staffSystem] retireFromStaff error:', err.message);
    return false;
  }
}

module.exports = {
  getOrCreate,
  recordGreet,
  addVoiceMinutes,
  recordTicketSolved,
  recordModerationAction,
  recordChatMessage,
  recordWeeklyReport,
  recordSurvey,  // 🔧 FIX: Anket sayacı artırma fonksiyonu
  checkPromotion,
  promote,
  demote,
  startStaffScheduler,
  resignFromStaff,
  retireFromStaff,
  dismissStaff,
  sendBreakRewardDM,
  sendRandomMotivationDM,
  requestLeave,
  getLeaveStatus,
  useLeaveCredit,
  notifyAllStaffAboutUpdate,
  sendSystemUpdateNotification,
  sendV6WelcomeNotification,
  notifyStaff,
  // Gamification
  checkAndUnlockBadges,
  sendBadgeUnlockedDM,
  getLeaderboard,
  getUserLeaderboardRank,
  getWeeklyChallenge,
  sendFunMessage,
  BADGES,
  WEEKLY_CHALLENGES,
  getXpForLevel,
  ROLES,
  ROLE_NAMES,
  LEVEL_TASKS,
  PROMOTION_REQUIREMENTS,
  getDailyRequirements,
  getNextRequirementsText,
  GUILD_ID,
  CHOSEN_TASKS,
  checkChosenTaskCompletion,
  checkDailyCompletion,
  getDailyTaskCompletionStats,
  hasInactivityRole,
  getTargetCheckDate,
  completeOvertime,
  recordOvertimeTask,
  postponeDailyTask,
  generateMorningBriefingEmbed,
  getMorningBriefingComponents,
  startWalkthrough,
  sendWalkthroughStep,
  handleWalkthroughAction,
  // AI helpers
  chatWithAI,
  PERSONAL_ASSISTANT_SYSTEM_PROMPT,
  TICKET_SYSTEM_PROMPT,
  STORY_SYSTEM_PROMPT,
  generateGreetProgressEmbed,
  getGreetProgressComponents,
  generateSettingsEmbed,
  getSettingsComponents,
  recordGamePlay,
  resetDaily,
  addEkoCoin,
  handleInactivitySupportRequest,
  handleInactivityProofButton,
  handleInactivityWellbeingButton,
  handleInactivitySupportModal,
  handleInactivityProofModal,
  todayStr,
  // Hierarchical Dashboard System
  generateModeratorDashboard,
  getSubcategoryEmbed,
  getActionEmbed,
  createActionButtons,
  setNavState,
  getNavState,
  getProgressBar,
  generateBriefingSettingsEmbed,
  getBriefingSettingsComponents,
  generateTutorialEmbed,
  getTutorialComponents,
  getInactivityLimit,
};
