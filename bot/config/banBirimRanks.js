'use strict';

/**
 * Ban Birimi Rütbe Sistemi - Sezon 1 ve Sezon 2
 * Her rütbenin rengi, emojisi, yetkileri ve sezon bilgisi tanımlanır
 */

const BAN_BIRIM_RANKS_SEASON_1 = {
  // GİRİŞ SEVİYESİ (Aday ve Stajyerler)
  1: {
    rankId: 1,
    label: 'Ban Kursiyeri',
    englishLabel: 'Ban Trainee',
    emoji: '🟢',
    color: '#2ecc71', // Yeşil
    description: 'Eğitimi henüz devam eden, yetkisi olmayan aday',
    season: 1,
    tier: 'entry',
    permissions: [],
  },
  2: {
    rankId: 2,
    label: 'Stajyer Moderatör',
    englishLabel: 'Intern Mod',
    emoji: '🟡',
    color: '#f39c12', // Turuncu
    description: 'İlk pratik deneyimini kazanan, izleme yetkili personel',
    season: 1,
    tier: 'entry',
    permissions: ['view_logs'],
  },
  3: {
    rankId: 3,
    label: 'Küçük Muhafız',
    englishLabel: 'Junior Guard',
    emoji: '🔵',
    color: '#3498db', // Mavi
    description: 'Temel uyarı yetkilerine sahip ilk resmi rütbe',
    season: 1,
    tier: 'entry',
    permissions: ['warn', 'view_logs'],
  },

  // ORTA SEVİYE (Saha Çalışanları / Operatörler)
  4: {
    rankId: 4,
    label: 'Ban Görevlisi',
    englishLabel: 'Ban Officer',
    emoji: '🟣',
    color: '#9b59b6', // Mor
    description: 'Kuralları ihlal edenlere ilk müdahaleyi yapan standart personel',
    season: 1,
    tier: 'mid',
    permissions: ['warn', 'mute', 'view_logs', 'manage_tickets'],
  },
  5: {
    rankId: 5,
    label: 'İnfazcı',
    englishLabel: 'Enforcer',
    emoji: '🟠',
    color: '#e74c3c', // Kırmızı
    description: 'Doğrudan susturma ve kısa süreli ban yetkisi olan saha elemanı',
    season: 1,
    tier: 'mid',
    permissions: ['warn', 'mute', 'tempban', 'view_logs', 'manage_tickets'],
  },
  6: {
    rankId: 6,
    label: 'Kıdemli Muhafız',
    englishLabel: 'Senior Guard',
    emoji: '🟥',
    color: '#c0392b', // Koyu Kırmızı
    description: 'Karmaşık olaylara müdahale eden tecrübeli moderatör',
    season: 1,
    tier: 'mid',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'view_logs', 'manage_tickets', 'review_appeals'],
  },
  7: {
    rankId: 7,
    label: 'Ban Müfettişi',
    englishLabel: 'Ban Inspector',
    emoji: '⬛',
    color: '#2c3e50', // Koyu Gri
    description: 'Şüpheli durumları ve itirazları inceleyen araştırma görevlisi',
    season: 1,
    tier: 'mid',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'view_logs', 'manage_tickets', 'review_appeals', 'investigate'],
  },

  // ÜST SEVİYE (Yönetici ve Komuta Zinciri)
  8: {
    rankId: 8,
    label: 'Operasyon Şefi',
    englishLabel: 'Operation Chief',
    emoji: '🔴',
    color: '#e67e22', // Derin Turuncu
    description: 'Günlük ban operasyonlarını ve anlık krizleri yöneten şef',
    season: 1,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'view_logs', 'manage_tickets', 'review_appeals', 'investigate', 'manage_staff'],
  },
  9: {
    rankId: 9,
    label: 'Baş Denetçi',
    englishLabel: 'Chief Auditor',
    emoji: '🔺',
    color: '#34495e', // Koyu Mavi Gri
    description: 'Yanlış atılan banları ve moderatör hatalarını denetleyen üst rütbe',
    season: 1,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'unban', 'view_logs', 'manage_tickets', 'review_appeals', 'investigate', 'manage_staff', 'audit'],
  },
  10: {
    rankId: 10,
    label: 'Ban Komutanı',
    englishLabel: 'Ban Commander',
    emoji: '⭐',
    color: '#f1c40f', // Altın Sarısı
    description: 'Kalıcı (perma) ban yetkisini elinde tutan yüksek rütbeli subay',
    season: 1,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'permaban', 'unban', 'view_logs', 'manage_tickets', 'review_appeals', 'investigate', 'manage_staff', 'audit'],
  },
  11: {
    rankId: 11,
    label: 'Disiplin Generali',
    englishLabel: 'Disciplinary General',
    emoji: '👑',
    color: '#16a085', // Teal
    description: 'Birimin kurallarını ve ceza sürelerini belirleyen stratejik yönetici',
    season: 1,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'permaban', 'unban', 'view_logs', 'manage_tickets', 'review_appeals', 'investigate', 'manage_staff', 'audit', 'set_policies'],
  },

  // ELİT / ÖZEL RÜTBELER
  12: {
    rankId: 12,
    label: 'Adalet Yargıcı',
    englishLabel: 'Justice Adjudicator',
    emoji: '⚖️',
    color: '#8e44ad', // Mor
    description: 'Büyük ihlal davalarında son kararı veren yargı mercii',
    season: 1,
    tier: 'elite',
    permissions: ['all_permissions', 'final_judgment'],
  },
  13: {
    rankId: 13,
    label: 'Siber Engerek',
    englishLabel: 'Cyber Viper',
    emoji: '🐍',
    color: '#27ae60', // Yeşil
    description: 'Sadece çok gizli veya büyük bot saldırılarına müdahale eden özel tim rütbesi',
    season: 1,
    tier: 'elite',
    permissions: ['all_permissions', 'special_operations', 'bot_defense'],
  },
  14: {
    rankId: 14,
    label: 'Başyargıç',
    englishLabel: 'Grand Inquisitor',
    emoji: '🔥',
    color: '#c0392b', // Koyu Kırmızı
    description: 'Ban biriminin tüm operasyonel liderliğini üstlenen kişi',
    season: 1,
    tier: 'elite',
    permissions: ['all_permissions', 'full_leadership'],
  },
  15: {
    rankId: 15,
    label: 'Ban Baronu',
    englishLabel: 'Ban Overlord',
    emoji: '👹',
    color: '#000000', // Siyah
    description: 'Birimin en tepesindeki, sistemin kurucusu veya mutlak yetki sahibi lider',
    season: 1,
    tier: 'elite',
    permissions: ['all_permissions', 'absolute_authority', 'system_control'],
  },
};

const BAN_BIRIM_RANKS_SEASON_2 = {
  // SEZON 2: GİRİŞ VE ADAPTASYON SEVİYESİ
  1: {
    rankId: 1,
    label: 'Yeni Nesil Muhafız',
    englishLabel: 'Next-Gen Guard',
    emoji: '🌌',
    color: '#1a237e', // Koyu İndigo
    description: 'Eski sistemin ardından modern güvenlik protokolleriyle donatılmış ilk seviye personel',
    season: 2,
    tier: 'entry',
    permissions: [],
    seasonReward: true,
  },
  2: {
    rankId: 2,
    label: 'Siber Kadet',
    englishLabel: 'Cyber Cadet',
    emoji: '🤖',
    color: '#00bcd4', // Cyan
    description: 'Dijital iz sürme ve veri analizi üzerine eğitilen yeni sezon adayı',
    season: 2,
    tier: 'entry',
    permissions: ['view_logs', 'digital_analysis'],
    seasonReward: true,
  },
  3: {
    rankId: 3,
    label: 'Güvenlik Duvarı Operatörü',
    englishLabel: 'Firewall Operator',
    emoji: '🔥',
    color: '#ff6b6b', // Neon Kırmızı
    description: 'Sunucu sınırlarında nöbet tutan, ilk savunma hattı',
    season: 2,
    tier: 'entry',
    permissions: ['view_logs', 'digital_analysis', 'firewall_manage'],
    seasonReward: true,
  },

  // SEZON 2: GELİŞTİRİLMİŞ SAHA GÜCÜ (Vanguard)
  4: {
    rankId: 4,
    label: 'Ban Taktisyeni',
    englishLabel: 'Ban Tactician',
    emoji: '⚡',
    color: '#ffd700', // Elektrik Sarısı
    description: 'Olaylara kaba kuvvetle değil, stratejik planlamayla yaklaşan saha uzmanı',
    season: 2,
    tier: 'mid',
    permissions: ['warn', 'mute', 'strategic_planning'],
    seasonReward: true,
  },
  5: {
    rankId: 5,
    label: 'Kod İnfazcısı',
    englishLabel: 'Code Enforcer',
    emoji: '💻',
    color: '#00ff00', // Neon Yeşil
    description: 'İhlalleri sistem kodları seviyesinde tespit edip anında müdahale eden yetkili',
    season: 2,
    tier: 'mid',
    permissions: ['warn', 'mute', 'tempban', 'code_detection'],
    seasonReward: true,
  },
  6: {
    rankId: 6,
    label: 'Protokol Koruyucusu',
    englishLabel: 'Protocol Warden',
    emoji: '🛡️',
    color: '#00e6ff', // Açık Cyan
    description: 'Yeni sezon kurallarının eksiksiz uygulanmasından sorumlu kıdemli üye',
    season: 2,
    tier: 'mid',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'protocol_enforce'],
    seasonReward: true,
  },
  7: {
    rankId: 7,
    label: 'Ağ Avcısı',
    englishLabel: 'Network Hunter',
    emoji: '🕸️',
    color: '#ff00ff', // Neon Magenta
    description: 'Birden fazla hesaba (alt hesaplara) sahip kural ihlalcilerini avlayan özel birim',
    season: 2,
    tier: 'mid',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'network_tracking'],
    seasonReward: true,
  },

  // SEZON 2: KOMUTA VE YÜKSEK DENETİM
  8: {
    rankId: 8,
    label: 'Siber Müfreze Şefi',
    englishLabel: 'Cyber Squad Leader',
    emoji: '🎖️',
    color: '#ff3366', // Neon Pembe
    description: 'Operasyon ekiplerini koordineli şekilde sahaya süren şef',
    season: 2,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'squad_command'],
    seasonReward: true,
  },
  9: {
    rankId: 9,
    label: 'Veri Analisti / Yargıç',
    englishLabel: 'Data Arbitrator',
    emoji: '📊',
    color: '#00ffff', // Parlak Cyan
    description: 'Kanıtları yapay zeka ve log kayıtlarıyla inceleyip kesin karara bağlayan üst rütbe',
    season: 2,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'unban', 'data_analysis'],
    seasonReward: true,
  },
  10: {
    rankId: 10,
    label: 'Ban Mimarı',
    englishLabel: 'Ban Architect',
    emoji: '🏗️',
    color: '#ffff00', // Parlak Sarı
    description: 'Ceza sistemlerini ve ban veritabanını güncelleyen teknik komutan',
    season: 2,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'permaban', 'unban', 'system_architect'],
    seasonReward: true,
  },
  11: {
    rankId: 11,
    label: 'Kriz Generali',
    englishLabel: 'Crisis General',
    emoji: '⚔️',
    color: '#ff0099', // Neon Kırmızı Pembe
    description: 'Büyük çaplı saldırılarda veya sunucu baskınlarında tüm birimi yöneten lider',
    season: 2,
    tier: 'high',
    permissions: ['warn', 'mute', 'tempban', 'kick', 'ban', 'permaban', 'unban', 'crisis_management'],
    seasonReward: true,
  },

  // SEZON 2: ÜST DÜZEY / EFSANEVI RÜTBELER
  12: {
    rankId: 12,
    label: 'Gölge Operatör',
    englishLabel: 'Shadow Operative',
    emoji: '👤',
    color: '#1a1a1a', // Koyu Gri
    description: 'Kimliğini gizleyerek gizli görev yapan, en kritik anlarda ortaya çıkan ban ajanı',
    season: 2,
    tier: 'elite',
    permissions: ['all_permissions', 'shadow_operations'],
    seasonReward: true,
  },
  13: {
    rankId: 13,
    label: 'Dijital Cellat',
    englishLabel: 'Digital Executioner',
    emoji: '⚰️',
    color: '#ff3300', // Koyu Neon Kırmızı
    description: 'İtiraz hakkı olmaksızın en ağır IP ve cihaz banlarını uygulayan elite rütbe',
    season: 2,
    tier: 'elite',
    permissions: ['all_permissions', 'heavy_sanctions', 'ip_ban'],
    seasonReward: true,
  },
  14: {
    rankId: 14,
    label: 'Sistem Koruyucusu',
    englishLabel: 'System Sentinel',
    emoji: '🌐',
    color: '#00ff00', // Parlak Yeşil
    description: 'Tüm sunucu altyapısının adaletinden ve güvenliğinden sorumlu olan başyönetici',
    season: 2,
    tier: 'elite',
    permissions: ['all_permissions', 'system_protection', 'full_oversight'],
    seasonReward: true,
  },
  15: {
    rankId: 15,
    label: 'Nexus Mutlak Gücü',
    englishLabel: 'Nexus Overlord',
    emoji: '⭐',
    color: '#ffffff', // Beyaz
    description: '2. Sezonun en tepesindeki isim; sistemin kurallarını yazan ve her şeyi gören mutlak lider',
    season: 2,
    tier: 'elite',
    permissions: ['all_permissions', 'absolute_control', 'nexus_authority'],
    seasonReward: true,
  },
};

module.exports = {
  BAN_BIRIM_RANKS_SEASON_1,
  BAN_BIRIM_RANKS_SEASON_2,
  getAllRanks: (season = 1) => {
    return season === 2 ? BAN_BIRIM_RANKS_SEASON_2 : BAN_BIRIM_RANKS_SEASON_1;
  },
  getRank: (rankId, season = 1) => {
    const ranks = season === 2 ? BAN_BIRIM_RANKS_SEASON_2 : BAN_BIRIM_RANKS_SEASON_1;
    return ranks[rankId] || null;
  },
  getRankLabel: (rankId, season = 1) => {
    const rank = module.exports.getRank(rankId, season);
    return rank ? rank.label : 'Bilinmeyen Rütbe';
  },
};
