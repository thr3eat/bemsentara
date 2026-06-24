# Panel System Enhancement & Advanced Features

## Overview
Comprehensive panel system overhaul with unit management, role-based access, interactive chat, surveys, and website integration.

---

## 1. Birim Koçu Sistemi (Unit Coach System)

### Requirement 1.1: Set Emre as Unit Coach
- **What**: Designate Emre (Discord ID: TBD) as the primary unit coach
- **Where**: Config or database
- **Access**: Admins only
- **Display**: Show coach name in panels/leaderboards

### Requirement 1.2: Coach-Branch Coach Chat
- **What**: Emre can chat with branch coaches interactively
- **Participants**: 
  - Emre (Birim Koçu)
  - 3 Branch Coaches (BAN, SES, SOHBET)
- **Medium**: Discord DMs or dedicated channel
- **Features**:
  - One-way notifications when message sent
  - Reply buttons
  - Session management
- **Status**: [To be detailed]

### Requirement 1.3: Unit Roles Visible in Server
- **Server**: 1466927911364726845
- **Roles to Display**:
  - Birim Koçu (Coach)
  - Birim Başkanı (Unit Boss)
  - Birim Yardımcısı (Unit Assistant)
  - Birim Personeli (Unit Members)
- **Sync**: Automatic sync when user joins/leaves unit
- **Visibility**: Public roles in server

### Requirement 1.4: Unit Leaderboard
- **Content**: Rank users by unit performance
- **Metrics**: 
  - Member count per unit
  - Active members
  - XP/Points per unit
- **Display**: Command `/leaderboard units` or panel tab
- **Refresh**: Real-time or hourly

---

## 2. Unit Boss & Assistant Chat System

### Requirement 2.1: Boss/Assistant Communication
- **Participants**: 
  - Birim Başkanı (Unit Boss)
  - Birim Yardımcısı (Unit Assistant)
- **Trigger**: "💬 Yardımcı ile Sohbet" button in panel
- **Mode**: Interactive conversation via DM
- **Features**:
  - Message sending
  - Reply buttons
  - Session open/close

### Requirement 2.2: Chat Session Management
- **Start**: Click button → Start session
- **Duration**: Until closed manually
- **Close**: "Sohbeti Kapat" button
- **History**: Store in database
- **Notifications**: Alert other party when message arrives

---

## 3. AI Raffle System Fix

### Requirement 3.1: Fix Broken AI Raffle
- **Current Issue**: `/ai-çekilişi` command not working in panel
- **Goal**: Enable XP/EkoCoin raffle via panel button
- **Parameters**:
  - XP amount
  - Winner count
  - Draw from: Unit/All users
- **Result**: Announce winner, distribute prize

---

## 4. Survey/Poll System

### Requirement 4.1: Create Survey System
- **Type**: Yes/No, Multiple Choice, Rating
- **Creator**: Admins only
- **Participants**: All users or specific role
- **Panel Button**: "📋 Anket Oluştur"
- **Result**: Show statistics

### Requirement 4.2: Survey Management
- **Store**: Database (Survey model)
- **Display**: List active surveys
- **Respond**: Users take survey
- **Results**: Real-time statistics dashboard

---

## 5. Missing System Panel Buttons

### Requirement 5.1: Audit
- **Button**: "📊 Denetim Günlüğü"
- **Function**: View/export audit logs
- **Access**: Mods+
- **Status**: [Check if exists]

### Requirement 5.2: User Management
- **Button**: "👥 Kullanıcı Yönetimi"
- **Functions**: Ban, mute, kick, timeout
- **Access**: Admins only
- **Status**: [Check if exists]

### Requirement 5.3: Role Management
- **Button**: "🎖️ Rol Yönetimi"
- **Functions**: Assign/remove roles
- **Access**: Admins only
- **Status**: [Check if exists]

### Requirement 5.4: System Statistics
- **Button**: "📈 Sistem İstatistikleri"
- **Shows**: Member count, XP distribution, etc.
- **Access**: Mods+
- **Status**: [Check if exists]

---

## 6. Role-Based Custom Panels

### Requirement 6.1: Dynamic Panel Generation
- **Concept**: Each role/permission level gets different buttons
- **Roles**:
  - Admin → Full access
  - Mod → Moderation + Chat
  - Unit Boss → Unit-specific options
  - Unit Coach → Coach-specific options
  - Staff → Basic options
  - User → Minimal options

### Requirement 6.2: Tab-Based Navigation
- **Structure**:
  ```
  [📊 Dashboard] [🎖️ My Roles] [📝 Tasks] [⚙️ Settings] [💬 Chat]
  ```
- **Dynamic**: Show/hide tabs based on role

### Requirement 6.3: Personal Dashboard
- **Content**:
  - User's stats (XP, rank, etc.)
  - Active units
  - Pending tasks
  - Recent achievements
  - Quick action buttons

---

## 7. Web Panel Integration

### Requirement 7.1: Web Panel Access
- **Path**: `/dashboard/panel`
- **Auth**: Same as website login (Discord OAuth or 6-digit password)
- **UI**: Replica of Discord panel
- **Responsiveness**: Mobile-friendly

### Requirement 7.2: Web Panel Features
- **Render**: All buttons/tabs from Discord
- **Interaction**: Click buttons → Execute actions
- **Feedback**: Real-time responses
- **Style**: Match website theme

### Requirement 7.3: Cross-Platform Sync
- **State**: Same for Discord and Web
- **Updates**: Real-time sync
- **Notifications**: Both platforms receive alerts

---

## Success Criteria

- [ ] Emre set as coach with visible designation
- [ ] Coach-Branch coach chat functional
- [ ] Unit roles visible and synced in server
- [ ] Unit leaderboard shows accurate rankings
- [ ] Boss/Assistant chat works smoothly
- [ ] AI raffle executes without errors
- [ ] Survey system allows creation and response
- [ ] All missing buttons added to panel
- [ ] Role-based panels functional
- [ ] Web panel fully integrated
- [ ] Cross-platform consistency verified

---

## Priority Order

1. 🔴 **HIGH**: Fix AI raffle + Add missing buttons
2. 🟠 **HIGH**: Unit roles + Leaderboard + Coach system
3. 🟠 **MEDIUM**: Boss/Assistant chat
4. 🟡 **MEDIUM**: Role-based panels
5. 🟡 **LOW**: Survey system
6. 🟢 **LOW**: Web panel integration

---

## Notes

- All changes must be database-persistent
- Backward compatible with existing systems
- Error handling for all operations
- Logging for all admin actions
