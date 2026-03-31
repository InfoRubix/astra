# Attendance Management System

A comprehensive attendance management system built with React and Firebase, featuring role-based access control, leave management, claims processing, payroll integration, and mobile notifications.

## Features

### User Features
- ✅ Check-in/Check-out with GPS verification
- ✅ Forgotten check-out request submission (7-day validity)
- ✅ Leave application and balance tracking
- ✅ Claim submission with receipt uploads
- ✅ Personal dashboard and attendance history
- ✅ Malaysia public holidays integration
- ✅ Device notifications for check-in/check-out reminders
- ✅ Mobile-first responsive design
- ✅ PWA capabilities for mobile app experience

### Admin Features (System Admin)
- ✅ Multi-company management
- ✅ Employee management and registration
- ✅ Leave approval/rejection workflow
- ✅ Claim management and approval
- ✅ Forgotten check-out request processing
- ✅ Payslip generation with PDF export
- ✅ Performance reports and analytics
- ✅ Memo/announcement system
- ✅ Company-department-staff hierarchy
- ✅ CSV bulk upload functionality
- ✅ Real-time notifications

### Company Admin Features
- ✅ Company-wide employee management
- ✅ Branch management and oversight
- ✅ Company-level leave and claim processing
- ✅ Forgotten check-out request management
- ✅ Company reports and analytics
- ✅ Company-wide announcements
- ✅ Branch performance monitoring

### Branch Admin Features
- ✅ Branch-specific employee management
- ✅ Branch leave and claim processing
- ✅ Branch forgotten check-out request handling
- ✅ Branch reports and analytics
- ✅ Branch announcements
- ✅ Department-level management within branch

## Tech Stack

- **Frontend**: React 18, Material-UI, React Router
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Hosting**: Netlify
- **Charts**: Recharts
- **PDF Generation**: jsPDF
- **Date Handling**: date-fns


## Documentation

### Setup Guides
- [Firebase Setup Guide](docs/setup/FIREBASE_SETUP.md) - Complete Firebase configuration and deployment
- [Admin User Setup](docs/setup/ADMIN_SETUP.md) - How to create and manage admin users

### Feature Documentation
- [Notification System](docs/notifications/QUICK_START.md) - Quick start guide for device notifications
- [FCM Setup Guide](docs/notifications/FCM_SETUP_GUIDE.md) - Full Firebase Cloud Messaging setup for mobile

## Quick Setup

1. **Firebase Setup**
   - Create Firebase project
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Set up Firebase Storage
   - See [Firebase Setup Guide](docs/setup/FIREBASE_SETUP.md) for detailed steps

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

3. **Install & Run**
   ```bash
   npm install
   npm start
   ```

4. **Create Admin User**
   - Register through the app
   - Change role in Firebase Console
   - See [Admin Setup Guide](docs/setup/ADMIN_SETUP.md)

## Project Structure

```
src/
├── components/
│   ├── admin/          # System admin components
│   ├── company-admin/  # Company admin components
│   ├── branch-admin/   # Branch admin components
│   ├── user/           # User-specific components
│   └── common/         # Shared components (layouts, etc.)
├── pages/
│   ├── admin/          # System admin pages
│   ├── company-admin/  # Company admin pages
│   ├── branch-admin/   # Branch admin pages
│   ├── user/           # User pages
│   └── auth/           # Authentication pages
├── services/           # Firebase and API services
├── hooks/              # Custom React hooks
├── contexts/           # React contexts (Auth, etc.)
├── utils/              # Utility functions and services
└── styles/             # Global styles

docs/
├── setup/              # Setup and configuration guides
└── notifications/      # Notification system documentation
```

## Environment Variables

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Optional: Firebase Cloud Messaging (for mobile notifications)
REACT_APP_FIREBASE_VAPID_KEY=your_vapid_key
```

See [Firebase Setup Guide](docs/setup/FIREBASE_SETUP.md) for detailed configuration.

## Deployment

The app is configured for Netlify deployment:

1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `build`
4. Add environment variables in Netlify dashboard

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## License & Terms

This software is proprietary to RUBIX TECHNOLOGY. Unauthorized reproduction, distribution, or modification is prohibited. For licensing inquiries, please contact RUBIX TECHNOLOGY directly.

---

**© 2025 RUBIX TECHNOLOGY. All right reserved.**