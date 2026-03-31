# Admin User Setup Guide

## How to Create an Admin User

Since the registration system creates regular users by default, you need to manually change a user's role to 'admin' in Firebase. Follow these steps:

### Option 1: Using Firebase Console (Recommended)

1. **Register a new user account** through the app's registration page
   - Go to `/register` 
   - Fill in the form with admin details
   - Complete registration (this creates a 'user' role by default)

2. **Open Firebase Console**
   - Go to https://console.firebase.google.com/
   - Select your project: `attendance-management-sy-f2ec9`

3. **Navigate to Firestore Database**
   - Click "Firestore Database" in the left sidebar
   - Click on the "users" collection

4. **Find and Edit the User Document**
   - Find the user document you just created (by email)
   - Click on the document to open it
   - Find the `role` field
   - Change the value from `"user"` to `"admin"`
   - Click "Update"

5. **Logout and Login Again**
   - The user will now be redirected to the admin dashboard
   - You'll see the admin navigation and features

### Option 2: Create First Admin via Code (Advanced)

If you want to programmatically create the first admin, you can temporarily modify the registration code:

1. **Edit** `src/pages/auth/Register.js`
2. **Change line 25** from `role: 'user'` to `role: 'admin'` temporarily
3. **Register your admin account**
4. **Change it back** to `role: 'user'` for regular users

### Admin Features Available

Once you have admin access, you can:

- ✅ **View Admin Dashboard** - Comprehensive statistics and analytics
- ✅ **Employee Management** - View all employees and their details  
- ✅ **Leave Approvals** - Approve/reject leave requests with workflow
- ✅ **Claims Management** - Review and process expense claims
- ✅ **Reports & Analytics** - Generate attendance and performance reports
- ✅ **System Monitoring** - View system status and health metrics

## How to Identify User vs Admin in Firebase Console

### Method 1: Check Firestore Database
1. **Go to Firebase Console** → Firestore Database
2. **Click on "users" collection**
3. **Look at each user document**:
   - **Users**: `role: "user"`
   - **Admins**: `role: "admin"`
4. **Other identifying fields**:
   - `email`: Shows the user's email
   - `firstName` + `lastName`: Full name
   - `department`: Their department
   - `position`: Their job position

### Method 2: Check Authentication Tab
1. **Go to Firebase Console** → Authentication → Users
2. **This shows all registered users** (but NOT their roles)
3. **Copy the UID** of the user you want to check
4. **Go to Firestore** → users → find document with that UID
5. **Check the `role` field**

### Visual Example in Firestore:
```
📁 users (collection)
  📄 abc123uid... (document)
    ├── email: "john@company.com"
    ├── firstName: "John"
    ├── lastName: "Smith"
    ├── companyName: "ABC Corp"
    ├── role: "user" ← REGULAR USER
    ├── department: "IT"
    └── position: "Developer"
    
  📄 def456uid... (document)
    ├── email: "admin@company.com"
    ├── firstName: "Admin"
    ├── lastName: "User"
    ├── companyName: "ABC Corp"
    ├── role: "admin" ← ADMIN USER
    ├── department: "Management"
    └── position: "System Administrator"

📁 companies (collection)
  📄 abc-corp (document)
    ├── name: "ABC Corp"
    ├── employeeCount: 2
    ├── createdAt: [timestamp]
    └── settings: { workingHours, leaveTypes }
```

### Admin vs User Interface

**Admin Interface:**
- Dark blue header with "Admin Panel" 
- Red avatar indicating admin status
- Navigation badges showing pending approvals
- Additional menu items (Employees, Leave Management, etc.)
- Notification bell with pending count

**User Interface:**
- Standard blue header with "Employee Portal"
- Green avatar for regular users  
- Basic navigation (Dashboard, Attendance, Leaves, Claims, Profile)
- User-focused features only

### Test Admin Credentials (After Setup)

Create an admin user with these details for testing:
- **Email**: admin@company.com
- **Password**: Admin123!
- **Name**: System Administrator
- **Company Name**: Your Company Name
- **Department**: IT
- **Position**: System Admin

Then follow the Firebase Console steps above to change the role to 'admin'.

### Security Notes

- Only users with `role: 'admin'` can access admin routes
- Firestore security rules prevent regular users from accessing admin data
- Admin users can switch to user view for testing purposes
- All admin actions are logged for audit purposes

### Troubleshooting

**Issue**: Can't access admin panel after changing role
**Solution**: Logout and login again to refresh the user session

**Issue**: Getting permission denied errors  
**Solution**: Ensure Firestore rules are deployed correctly

**Issue**: Admin features not showing
**Solution**: Verify the user document has `role: "admin"` (exactly, case-sensitive)

---

## Development Tips

- Start with one admin user for testing
- Regular users are created automatically through registration  
- Admin can create additional admin users later through the employee management system
- Use the Firebase console for quick role changes during development