# 📋 Sidebar Menu Structure - Updated

## New Navigation Structure

### User Menu (Regular Users)

```
📊 Dashboard
   └─ Dashboard

⏰ Time Management
   ├─ Attendance
   └─ Forgotten Check-outs

📝 Requests
   ├─ Leaves
   └─ Claims

🏢 Information
   ├─ Announcements
   └─ Payslips

⚙️ Settings (Collapsible Group)
   ├─ 👤 Profile
   └─ 🔔 Notifications
```

### User Menu (Team Leaders)

```
📊 Dashboard
   └─ Dashboard

⏰ Time Management
   ├─ Attendance
   └─ Forgotten Check-outs

📝 Requests
   ├─ Leaves
   └─ Claims

👥 Team Approvals (Collapsible Group)
   ├─ Leave Requests
   ├─ Forgotten Checkouts
   └─ Claim Expenses

🏢 Information
   ├─ Announcements
   └─ Payslips

⚙️ Settings (Collapsible Group)
   ├─ 👤 Profile
   └─ 🔔 Notifications
```

## Key Changes

### ✅ What Changed:

1. **"Account" section renamed to "Settings"**
   - Changed from generic "Account" to more descriptive "Settings"
   - Now uses Settings icon (⚙️) as the section icon

2. **Settings is now a collapsible group**
   - Similar to "Team Approvals" for leaders
   - Can be expanded/collapsed
   - State persists in localStorage

3. **Profile moved under Settings**
   - Profile is now a sub-item under Settings
   - Uses existing Profile page (`/user/profile`)

4. **Notifications added under Settings**
   - New "Notifications" menu item
   - Links to `/user/settings`
   - Shows notification management page

5. **Settings page simplified**
   - No longer has tabs
   - Directly shows Notification Settings
   - Profile has its own dedicated page

## Menu Behavior

### Collapsible Groups:

**Settings** (type: 'group', key: 'settings')
- Click the section header to expand/collapse
- Collapsed state saved to localStorage
- Shows chevron icon (up/down)

**Team Approvals** (type: 'group', key: 'teamApprovals') - *Only for leaders*
- Same collapsible behavior
- Only visible for users with leader position

### Navigation:

- Click "Profile" → Navigate to `/user/profile` (existing Profile page)
- Click "Notifications" → Navigate to `/user/settings` (Notification Settings page)

## Routes

| Menu Item | Route | Page |
|-----------|-------|------|
| Profile | `/user/profile` | `src/pages/user/Profile.js` (existing) |
| Notifications | `/user/settings` | `src/pages/user/Settings.js` (new, notification-only) |

## Visual Structure

### Sidebar Appearance:

**When Settings is Collapsed:**
```
⚙️ Settings  ▼
```

**When Settings is Expanded:**
```
⚙️ Settings  ▲
   👤 Profile
   🔔 Notifications
```

## Benefits

✅ **Better Organization** - Settings are grouped logically
✅ **Cleaner Menu** - Reduced top-level items
✅ **Consistent Pattern** - Matches Team Approvals structure
✅ **No Redundancy** - Profile page isn't duplicated
✅ **Scalable** - Easy to add more settings in future

## Future Additions

The Settings group can easily be extended with:
- 🔐 Security settings
- 🌐 Language preferences
- 🎨 Theme customization
- 📧 Email preferences
- 🔔 Notification history

Simply add new items to the Settings items array!

---

**Last Updated:** January 2025
**Status:** ✅ Implemented
