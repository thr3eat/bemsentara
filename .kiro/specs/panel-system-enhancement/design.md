# Design Document - Panel System Enhancement

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Discord Bot + Web Server               │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │         Panel Service Layer                  │   │
│  │  (mainPanelService.js enhancement)          │   │
│  └──────────────────────────────────────────────┘   │
│           ↓        ↓        ↓        ↓              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │Coach │ │Chat  │ │Role  │ │Survey│              │
│  │Mgmt  │ │Sys   │ │Mgmt  │ │Sys   │              │
│  └──────┘ └──────┘ └──────┘ └──────┘              │
│           ↓        ↓        ↓        ↓              │
│  ┌────────────────────────────────────────────────┐ │
│  │          Database / In-Memory Store            │ │
│  │  (Users, Units, Roles, Chats, Surveys)       │ │
│  └────────────────────────────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │         Web Server (Express Routes)          │   │
│  │  /dashboard/panel, /api/panel/*, etc        │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## 1. Coach Management System

### Data Model: Coach

```javascript
{
  _id: ObjectId,
  name: "Emre",                    // Coach name
  discordId: "123456789",          // Discord ID
  role: "birim_kochu",             // Role type
  assignedBranches: [              // Which branches they coach
    "BAN_BIRIMI",
    "SES_BIRIMI",
    "SOHBET_BIRIMI"
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Service: `coachManagementService.js`

```javascript
async function setCoach(userId, name)
  → Designate user as coach

async function getCoachForBranch(branch)
  → Return coach for specific branch

async function getCoachInfo()
  → Return Emre's info with branches
```

### Panel Integration

- Display coach name in header
- Show coach-branch relationships
- Edit coach assignments (admin only)

---

## 2. Chat System

### Data Model: Chat Session

```javascript
{
  _id: ObjectId,
  sessionId: "unique-id",
  type: "coach_branch",            // Type of chat
  participants: [
    { userId: "123", role: "coach" },
    { userId: "456", role: "branch_coach" }
  ],
  messages: [
    {
      senderId: "123",
      content: "Merhaba",
      timestamp: Date,
      read: false
    }
  ],
  status: "active",                // active, closed, archived
  createdAt: Date,
  closedAt: Date
}
```

### Service: `chatService.js`

```javascript
async function startChatSession(userId1, userId2, type)
  → Create new chat session

async function sendMessage(sessionId, userId, content)
  → Add message, notify other party

async function closeSession(sessionId)
  → Close and archive chat

async function getChatHistory(sessionId, limit)
  → Retrieve message history
```

### UI Components

**Discord (Button-based):**
```
[💬 Yardımcı ile Sohbet]
         ↓
    DM Opens
         ↓
   [Mesaj Gönder] [Sohbeti Kapat]
```

**Web (Text-based):**
```
┌─────────────────────────────┐
│  Yardımcı ile Sohbet        │
├─────────────────────────────┤
│                             │
│  Emre: Merhaba              │
│  18:30                      │
│                             │
│  You: Selam                 │
│  18:31                      │
│                             │
├─────────────────────────────┤
│ [Mesaj Yaz] [Sohbeti Kapat] │
└─────────────────────────────┘
```

---

## 3. Unit Roles System

### Discord Roles Structure

```
Server: 1466927911364726845
├─ BAN BİRİMİ
│  ├─ 🔴 BAN Birim Koçu
│  ├─ 🟠 BAN Birim Başkanı
│  ├─ 🟡 BAN Birim Yardımcısı
│  └─ 🟢 BAN Birim Personeli
├─ SES BİRİMİ
│  ├─ 🔴 SES Birim Koçu
│  ├─ 🟠 SES Birim Başkanı
│  ├─ 🟡 SES Birim Yardımcısı
│  └─ 🟢 SES Birim Personeli
└─ SOHBET BİRİMİ
   ├─ 🔴 SOHBET Birim Koçu
   ├─ 🟠 SOHBET Birim Başkanı
   ├─ 🟡 SOHBET Birim Yardımcısı
   └─ 🟢 SOHBET Birim Personeli
```

### Sync Service: `unitRoleSyncService.js`

```javascript
async function syncUserUnitRoles(userId, unitKey)
  → Assign unit-specific roles

async function ensureUnitRoles(guild, unitKey)
  → Create roles if missing

async function removeUserFromUnit(userId, unitKey)
  → Clean up user roles
```

---

## 4. Unit Leaderboard System

### Data Model: Unit Stats

```javascript
{
  _id: ObjectId,
  unitKey: "BAN_BIRIMI",
  memberCount: 15,
  activeMemberCount: 12,
  totalXP: 45000,
  totalEkoCoin: 1200,
  averageXPPerMember: 3000,
  lastUpdated: Date
}
```

### Calculation

```
Rank = Sort by (totalXP DESC, memberCount DESC, averageXPPerMember DESC)

Example:
1. BAN BİRİMİ    - 45000 XP, 15 members
2. SES BİRİMİ    - 38000 XP, 14 members
3. SOHBET BİRİMİ - 32000 XP, 12 members
```

### Panel Display

```
📊 BİRİM LIDERBORDU
─────────────────────
1. 🥇 BAN BİRİMİ
   XP: 45,000 | Members: 15 | Avg: 3,000

2. 🥈 SES BİRİMİ
   XP: 38,000 | Members: 14 | Avg: 2,714

3. 🥉 SOHBET BİRİMİ
   XP: 32,000 | Members: 12 | Avg: 2,667
```

---

## 5. Role-Based Panel System

### Permission Matrix

```javascript
const ROLE_PERMISSIONS = {
  "admin": ["*"],  // All access
  "mod": [
    "chat",
    "moderation",
    "audit",
    "user_manage"
  ],
  "unit_boss": [
    "chat",
    "unit_manage",
    "member_manage",
    "report_view"
  ],
  "coach": [
    "chat",
    "unit_view",
    "member_view",
    "report_view"
  ],
  "staff": [
    "chat",
    "report_view"
  ],
  "user": [
    "chat"
  ]
};
```

### Dynamic Panel Structure

```javascript
async function generatePanelForUser(userId) {
  const user = await User.findById(userId);
  const role = user.highestRole;  // Get primary role
  const permissions = ROLE_PERMISSIONS[role];
  
  return {
    tabs: [
      ...generateTabs(permissions),
      ...generateUnitTabs(user.units)
    ],
    buttons: filterButtonsByPermission(permissions)
  };
}
```

### Tab Structure

```
USER ROLES          TABS SHOWN
─────────────────────────────────
Admin               [Dashboard] [Audit] [Users] [Roles] [Surveys] [Chat] [Settings]
Mod                 [Dashboard] [Audit] [Moderation] [Chat] [Settings]
Unit Boss           [Dashboard] [My Unit] [Members] [Reports] [Chat] [Settings]
Coach               [Dashboard] [Branches] [Reports] [Chat] [Settings]
Staff               [Dashboard] [Report] [Chat] [Settings]
User                [Dashboard] [Chat] [Settings]
```

---

## 6. Survey System

### Data Model: Survey

```javascript
{
  _id: ObjectId,
  title: "Personel Doyum Anketi",
  description: "Personel sisteminden memnun musunuz?",
  type: "multiple",              // yes_no, multiple, rating
  options: [
    { id: 1, text: "Çok Memnunum" },
    { id: 2, text: "Memnunum" },
    { id: 3, text: "Kararsızım" },
    { id: 4, text: "Memnun Değilim" }
  ],
  targetRole: "staff",           // Who can respond
  responses: [
    { userId: "123", selectedOption: 1, timestamp: Date }
  ],
  status: "active",              // active, closed, archived
  createdAt: Date,
  closedAt: Date
}
```

### Service: `surveyService.js`

```javascript
async function createSurvey(title, options, targetRole)
  → Create new survey

async function submitResponse(surveyId, userId, optionId)
  → Record user's response

async function closeSurvey(surveyId)
  → Stop accepting responses

async function getSurveyResults(surveyId)
  → Get statistics and pie chart
```

---

## 7. Web Panel Integration

### Route Structure

```javascript
// Authentication
GET /auth/discord
GET /auth/discord/callback
POST /auth/login-password

// Dashboard
GET /dashboard          // Redirect to panel
GET /dashboard/panel    // Main panel page
GET /dashboard/panel/:tab

// API
GET /api/panel/data
GET /api/panel/user/:userId
POST /api/panel/action
POST /api/chat/send
POST /api/survey/respond
```

### Web Panel Component

```javascript
// /server/routes/pages.js or separate panel route

app.get('/dashboard/panel', isAuthenticated, async (req, res) => {
  const userPanel = await generatePanelForUser(req.user._id);
  res.render('panel', { 
    user: req.user,
    panel: userPanel,
    theme: req.user.theme || 'dark'
  });
});

app.post('/api/panel/action', isAuthenticated, async (req, res) => {
  const { action, params } = req.body;
  // Execute panel action and return result
});
```

### Frontend Structure

```html
<div class="panel">
  <div class="panel-header">
    <h2>Kontrol Paneli</h2>
    <span class="user-role">Admin</span>
  </div>
  
  <div class="panel-tabs">
    <button class="tab-btn active">Dashboard</button>
    <button class="tab-btn">Yönetim</button>
    <button class="tab-btn">Birimler</button>
    <button class="tab-btn">Ayarlar</button>
  </div>
  
  <div class="panel-content">
    <!-- Dynamic content based on role -->
  </div>
</div>
```

---

## 8. AI Raffle System Fix

### Current Issue Analysis

```
Expected: /ai-çekilişi [amount] [count]
Actual: Command exists but not working in panel
Fix: Ensure proper modal handling + API endpoint
```

### Solution Design

```javascript
// Panel Button
[🎲 AI Çekilişi]
  ↓
  Modal: Enter XP amount, winner count
  ↓
  POST /api/panel/raffle
  ↓
  Process via aiService
  ↓
  Return results and announce
```

---

## 9. Missing System Buttons

### Audit Button
- View all admin logs
- Filter by action, date, user
- Export to CSV

### User Management
- Ban/Unban
- Mute/Unmute
- Kick
- Timeout
- View stats

### Role Management
- Assign roles
- Remove roles
- Batch operations
- Role hierarchy

### System Statistics
- Total users, active, banned
- XP distribution chart
- Unit performance
- Command usage stats

---

## Database Schema Changes

### New Collections

- `coaches` - Coach assignments
- `chatSessions` - Active chats
- `surveys` - Survey definitions
- `unitStats` - Cached unit statistics

### Modified Collections

- `users` - Add `primaryRole`, `units`, `coachOf`
- `ServerConfig` - Add `coachId`, `unitLeaderboardChannel`

---

## Error Handling

```javascript
try {
  // Panel action
} catch (err) {
  if (err.type === 'PERMISSION_DENIED') {
    return "❌ Bu işleme yetkiniz yok."
  } else if (err.type === 'NOT_FOUND') {
    return "❌ İstenen kayıt bulunamadı."
  } else {
    return `❌ Hata: ${err.message}`
  }
}
```

---

## Security Considerations

1. **Role-Based Access**: Always verify user role before action
2. **Audit Logging**: Log all admin/mod actions
3. **Rate Limiting**: Prevent spam (survey responses, messages)
4. **Input Validation**: Sanitize all user inputs
5. **Session Management**: Secure session tokens
6. **CORS**: Restrict web panel to authorized domains

---

## Performance Notes

1. Cache unit stats (refresh hourly)
2. Paginate chat history (50 messages per load)
3. Index database queries (userId, sessionId)
4. Compress panel data (gzip on web)
5. CDN for static assets (buttons, icons)

---

## Implementation Timeline

```
Phase 1 (Week 1): Coach system + Unit roles
Phase 2 (Week 2): Chat system + Leaderboard
Phase 3 (Week 3): Role-based panels + Surveys
Phase 4 (Week 4): Web integration + AI raffle fix
Phase 5 (Week 5): Testing + Optimization
```

---

## Testing Strategy

- Unit tests for each service
- Integration tests for panel actions
- End-to-end tests for full workflows
- Load testing for concurrent users
- Security testing for permission checks
