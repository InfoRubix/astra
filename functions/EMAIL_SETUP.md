# Email Notifications Setup Guide

This document explains how to configure email notifications for check-in and check-out reminders.

## Features

- **Check-In Email Reminders**: Sent before work start time
- **Check-Out Email Reminders**: Sent before work end time
- **Professional HTML Templates**: Beautiful, responsive email designs
- **Automatic Delivery**: Scheduled via Firebase Cloud Functions

## Prerequisites

1. Gmail account (or another email service provider)
2. Firebase CLI installed
3. Firebase project with Cloud Functions enabled

## Setup Instructions

### Step 1: Install Dependencies

Navigate to the `functions` folder and install the required packages:

```bash
cd functions
npm install
```

This will install `nodemailer` along with other dependencies.

### Step 2: Create App Password (For Gmail)

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Select **Mail** as the app and **Other** as the device
5. Name it "Attendance System" and click **Generate**
6. Copy the 16-character password (you'll need this in Step 3)

### Step 3: Set Environment Variables

Set your email credentials as Firebase environment variables:

```bash
# Set email user (your Gmail address)
firebase functions:config:set email.user="your-email@gmail.com"

# Set email password (use the App Password from Step 2)
firebase functions:config:set email.pass="your-app-password-here"

# Set your app URL (optional, for email links)
firebase functions:config:set app.url="https://your-app-domain.com"
```

**Alternative: Using .env file (for local development)**

Create a `.env` file in the `functions` folder:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here
APP_URL=https://your-app-domain.com
```

### Step 4: Deploy Cloud Functions

Deploy the updated functions to Firebase:

```bash
firebase deploy --only functions
```

This will deploy:
- `sendCheckInReminders` - Runs every 5 minutes to check for check-in reminders
- `sendCheckOutReminders` - Runs every 5 minutes to check for check-out reminders

### Step 5: Verify Setup

1. Check Firebase Console → Functions to ensure functions are deployed
2. Check Firebase Console → Functions → Logs to monitor execution
3. Test with a user who has:
   - Check-in/check-out reminders enabled in notification settings
   - Valid email address in their user profile
   - Company settings with notifications enabled

## Configuration Options

### Using Different Email Providers

To use a different email provider (Outlook, Yahoo, etc.), update the `emailTransporter` in `functions/index.js`:

```javascript
const emailTransporter = nodemailer.createTransport({
  service: 'outlook', // Change to: 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

### Custom SMTP Configuration

For custom SMTP servers:

```javascript
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.your-domain.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## How It Works

### Check-In Email Flow

1. Cloud Function runs every 5 minutes (scheduled)
2. Checks company settings for companies with notifications enabled
3. Calculates if current time matches reminder time (e.g., 15 minutes before work start)
4. Gets all users from that company with check-in reminders enabled
5. Sends push notification to devices
6. Sends HTML email to each user's email address

### Check-Out Email Flow

Same as check-in, but for work end time reminders.

## Email Template Customization

To customize email templates, edit the functions in `functions/index.js`:

- `getCheckInEmailTemplate()` - Check-in email HTML
- `getCheckOutEmailTemplate()` - Check-out email HTML

## Troubleshooting

### Emails Not Sending

1. **Check Cloud Function Logs**:
   ```bash
   firebase functions:log
   ```

2. **Verify Email Credentials**:
   - Ensure EMAIL_USER and EMAIL_PASS are set correctly
   - For Gmail, use App Password (not regular password)

3. **Check User Settings**:
   - User must have check-in/check-out reminders enabled
   - User must have a valid email in their profile

4. **Check Company Settings**:
   - `enableNotifications` must be `true`
   - `isActive` must be `true`
   - Work start/end times must be set

### Gmail Blocking Emails

If Gmail blocks sending:
- Enable 2-Step Verification
- Use App Password (not regular password)
- Check "Less secure app access" is OFF (use App Passwords instead)

### Cost Considerations

- Cloud Functions run every 5 minutes
- Each email send counts towards your email provider's limits
- Gmail free tier: ~500 emails/day
- Consider upgrading to SendGrid, Mailgun, or AWS SES for higher volumes

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data
3. **Rotate App Passwords** periodically
4. **Monitor function logs** for unauthorized access
5. **Set up billing alerts** in Firebase Console

## Support

For issues or questions:
1. Check Firebase Console logs
2. Review this documentation
3. Contact system administrator
