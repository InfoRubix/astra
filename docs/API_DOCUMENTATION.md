# Cloud Functions API Documentation

> Attendance Management System - Firebase Cloud Functions (v2)
>
> Runtime: Node.js 20 | Region: Default (us-central1), except `onLeaveStatusUpdate` (asia-southeast1)

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Firestore Collections Reference](#firestore-collections-reference)
4. [Scheduled Functions](#scheduled-functions)
   - [sendCheckInReminders](#1-sendcheckinreminders)
   - [sendCheckOutReminders](#2-sendcheckoutreminders)
   - [autoCheckoutBeforeMidnight](#3-autocheckoutbeforemidnight)
   - [cleanupExpiredFCMTokens](#4-cleanupexpiredfcmtokens)
5. [Callable Functions](#callable-functions)
   - [manualAutoCheckout](#5-manualautocheckout)
   - [sendTestNotification](#6-sendtestnotification)
6. [Firestore Trigger Functions](#firestore-trigger-functions)
   - [onLeaveStatusUpdate](#7-onleavestatusupdate)
7. [Helper Functions (Internal)](#helper-functions-internal)
8. [Deployment Instructions](#deployment-instructions)
9. [Testing Locally with Firebase Emulators](#testing-locally-with-firebase-emulators)

---

## Overview

This project contains seven Cloud Functions that power the notification, auto-checkout, and token-management features of the Attendance Management System. All functions are written using the **Firebase Cloud Functions v2** SDK.

| # | Function Name             | Type              | Schedule / Trigger                     |
|---|---------------------------|-------------------|----------------------------------------|
| 1 | `sendCheckInReminders`    | Scheduled         | Every 5 minutes (Asia/Kuala_Lumpur)    |
| 2 | `sendCheckOutReminders`   | Scheduled         | Every 5 minutes (Asia/Kuala_Lumpur)    |
| 3 | `autoCheckoutBeforeMidnight` | Scheduled      | `59 23 * * *` (Asia/Kuala_Lumpur)      |
| 4 | `cleanupExpiredFCMTokens` | Scheduled         | `0 2 * * *` (Asia/Kuala_Lumpur)        |
| 5 | `manualAutoCheckout`      | Callable (onCall) | Invoked by authenticated admin         |
| 6 | `sendTestNotification`    | Callable (onCall) | Invoked by authenticated user          |
| 7 | `onLeaveStatusUpdate`     | Firestore Trigger | `leaves/{leaveId}` document updated    |

Dependencies (from `functions/package.json`):

| Package             | Version  | Purpose                                     |
|---------------------|----------|---------------------------------------------|
| `firebase-admin`    | ^11.8.0  | Firestore, FCM, server-side Firebase access |
| `firebase-functions`| ^7.0.0   | Cloud Functions v2 SDK                      |
| `nodemailer`        | ^6.9.7   | Sending emails via SMTP / Gmail             |
| `cors`              | ^2.8.5   | CORS handling (imported but not directly used in current functions) |

---

## Environment Variables

Cloud Functions read environment variables from a `.env` file located at `functions/.env`. A template is provided at `functions/.env.example`.

| Variable     | Required | Description                                                                                          | Default Fallback           |
|--------------|----------|------------------------------------------------------------------------------------------------------|----------------------------|
| `EMAIL_USER` | Yes      | The sender email address used by Nodemailer. For Gmail, this is your Gmail address.                  | `info@rubix.com.my`        |
| `EMAIL_PASS` | Yes      | The email password or App Password. For Gmail, generate an App Password at https://myaccount.google.com/apppasswords. | (empty string)             |
| `APP_URL`    | No       | The deployed frontend URL (no trailing slash). Used in email templates for action-button links.       | `https://your-app-domain.com` |

**Important:** Never commit the real `.env` file to version control. Only the `.env.example` template should be tracked.

### Setting up Gmail App Passwords

1. Enable 2-Step Verification on your Google Account.
2. Go to https://myaccount.google.com/apppasswords.
3. Generate a new App Password for "Mail".
4. Use the generated 16-character password as the `EMAIL_PASS` value.

---

## Firestore Collections Reference

The following Firestore collections are read from or written to by the Cloud Functions:

| Collection         | Read By                                                  | Written By                                              |
|--------------------|----------------------------------------------------------|---------------------------------------------------------|
| `companySettings`  | sendCheckInReminders, sendCheckOutReminders              | --                                                      |
| `users`            | sendCheckInReminders, sendCheckOutReminders, autoCheckoutBeforeMidnight, manualAutoCheckout, onLeaveStatusUpdate | -- |
| `fcmTokens`        | sendCheckInReminders, sendCheckOutReminders, autoCheckoutBeforeMidnight, sendTestNotification | sendCheckInReminders (mark inactive), sendCheckOutReminders (mark inactive), cleanupExpiredFCMTokens (delete) |
| `attendance`       | autoCheckoutBeforeMidnight, manualAutoCheckout            | autoCheckoutBeforeMidnight (update), manualAutoCheckout (update) |
| `notifications`    | --                                                       | autoCheckoutBeforeMidnight (create)                     |
| `leaves`           | onLeaveStatusUpdate (trigger source)                     | --                                                      |

---

## Scheduled Functions

### 1. `sendCheckInReminders`

**Type:** Scheduled (onSchedule)

**Description:**
Runs every 5 minutes and checks all active companies with notifications enabled. For each company, it calculates whether the current time falls within a 5-minute window before the company's configured work start time (minus the configured reminder offset). If it is time, the function sends push notifications (FCM) and email reminders to all eligible employees who have not disabled check-in reminders.

**Schedule:**
```
every 5 minutes
```
**Timezone:** `Asia/Kuala_Lumpur` (UTC+8)

**Authentication:** None required (scheduled functions run automatically via Cloud Scheduler).

**Parameters/Input:** None (event-driven by schedule).

**Firestore Collections Read:**
- `companySettings` -- Queries documents where `enableNotifications == true` AND `isActive == true`. Reads fields:
  - `company` (string) -- Company name
  - `workStartTime` (string, `"HH:mm"` format) -- When the workday starts
  - `workDays` (array of strings) -- e.g., `["monday", "tuesday", ...]`; defaults to Monday-Friday
  - `checkInReminderMinutes` (number) -- Minutes before work start to send reminder; defaults to `15`
- `users` -- Queries by `company` field to get all users belonging to a company. Reads `email`, `firstName`, `lastName`.
- `fcmTokens` -- Queries by `userId` (limited to first 10 user IDs per company due to Firestore `in` query limit) and `active == true`. Reads `token`, `checkInReminder`, `userId`.

**Firestore Collections Written:**
- `fcmTokens` -- Marks tokens as `active: false` when FCM returns `messaging/invalid-registration-token` or `messaging/registration-token-not-registered`.

**Side Effects:**
- **Push notifications (FCM):** Sends a "Time to Check In!" notification to each eligible user's device via `admin.messaging().sendEach()`. Notifications are sent in batches of 500 tokens.
  - Includes web push, Android, and APNs configurations.
  - Web push tag: `check-in-reminder`
  - Deep link: `/user/attendance`
- **Emails:** Sends an HTML check-in reminder email to each eligible user via Nodemailer/Gmail.
- **Token cleanup:** Invalid FCM tokens are marked as inactive in the `fcmTokens` collection.

**Return Value:**
```js
{ totalSent: number, totalFailed: number }
```
Returns `null` if no companies have notifications enabled or if an unhandled error occurs.

**Error Handling:**
- Wraps the entire function in a try/catch; logs the error and returns `null` on failure.
- Individual FCM batch send failures are caught per-batch; the batch's token count is added to `totalFailed`.
- Invalid tokens are cleaned up automatically.
- Individual email failures are caught per-user and counted separately (`emailsFailed`).

**Known Limitations:**
- The Firestore `in` query on `userId` is limited to the first 10 user IDs per company (`userIds.slice(0, 10)`). Companies with more than 10 employees will only have the first 10 users receive push notifications per batch.

---

### 2. `sendCheckOutReminders`

**Type:** Scheduled (onSchedule)

**Description:**
Functionally identical to `sendCheckInReminders`, but triggers reminders based on each company's `workEndTime` instead of `workStartTime`. Sends "Time to Check Out!" push notifications and emails to eligible employees.

**Schedule:**
```
every 5 minutes
```
**Timezone:** `Asia/Kuala_Lumpur` (UTC+8)

**Authentication:** None required (scheduled).

**Parameters/Input:** None.

**Firestore Collections Read:**
- `companySettings` -- Same query as check-in reminders. Additionally reads:
  - `workEndTime` (string, `"HH:mm"` format) -- When the workday ends
  - `checkOutReminderMinutes` (number) -- Minutes before work end to send reminder; defaults to `10`
- `users` -- Same as check-in reminders.
- `fcmTokens` -- Same query structure. Reads `checkOutReminder` preference instead of `checkInReminder`.

**Firestore Collections Written:**
- `fcmTokens` -- Marks invalid tokens as `active: false` (same as check-in).

**Side Effects:**
- **Push notifications (FCM):** Sends a "Time to Check Out!" notification.
  - Web push tag: `check-out-reminder`
  - Deep link: `/user/attendance`
- **Emails:** Sends an HTML check-out reminder email to each eligible user.
- **Token cleanup:** Same as check-in reminders.

**Return Value:**
```js
{ totalSent: number, totalFailed: number }
```
Returns `null` on error or if no companies qualify.

**Error Handling:** Same pattern as `sendCheckInReminders`.

**Known Limitations:** Same 10-user `in` query limit applies.

---

### 3. `autoCheckoutBeforeMidnight`

**Type:** Scheduled (onSchedule)

**Description:**
Runs at 11:59 PM daily. Finds all attendance records for the current date where the user has checked in but has not checked out. For each such record, it performs an automatic checkout at 11:59 PM, calculates working hours (capped at 16 hours maximum) and overtime (anything over 8 hours), updates the attendance record, and sends notifications (in-app, push, and email) to the affected users.

**Schedule:**
```
59 23 * * *
```
(11:59 PM every day)

**Timezone:** `Asia/Kuala_Lumpur` (UTC+8)

**Authentication:** None required (scheduled).

**Parameters/Input:** None.

**Firestore Collections Read:**
- `attendance` -- Queries all documents where `dateString == "<today YYYY-MM-DD>"`. Reads:
  - `clockInTime` / `checkInTime` (Timestamp) -- Check-in time
  - `clockOutTime` / `checkOutTime` (Timestamp) -- Check-out time (to determine if already checked out)
  - `userId`, `userName`, `userEmail`, `company`, `notes`
- `fcmTokens` -- For each affected user, queries by `userId` and `active == true` to send push notifications.

**Firestore Collections Written:**
- `attendance` -- Updates each qualifying record with:
  ```js
  {
    clockOutTime: Timestamp(23:59:00),
    checkOutTime: Timestamp(23:59:00),
    workingHours: number,        // decimal, capped at 16
    overtimeHours: number,       // max(0, workingHours - 8)
    status: "checked-out",
    autoCheckout: true,
    autoCheckoutTime: Timestamp(23:59:00),
    autoCheckoutReason: "Automatic checkout at midnight - user forgot to check out",
    notes: "<existing notes>\n[AUTO CHECKOUT] System automatically checked out at 11:59 PM",
    updatedAt: serverTimestamp()
  }
  ```
- `notifications` -- Creates a new document per affected user:
  ```js
  {
    userId: string,
    type: "auto-checkout",
    title: "Auto Checkout",
    message: "You were automatically checked out at 11:59 PM. Working hours: Xh...",
    priority: "high",
    read: false,
    createdAt: serverTimestamp()
  }
  ```

**Side Effects:**
- **In-app notifications:** Created in the `notifications` collection (see above).
- **Push notifications (FCM):** Sends an "Auto Checkout Notification" push to each affected user's active tokens.
  - Web push tag: `auto-checkout`
  - Deep link: `/user/attendance`
- **Emails:** Sends an HTML email to each affected user's email address with an auto-checkout summary (date, working hours, a warning to check out manually in the future).

**Return Value:**
```js
{
  success: boolean,
  date: string,           // "YYYY-MM-DD"
  totalRecords: number,   // total attendance docs found for today
  processed: number,      // records that were auto checked out
  skipped: number,        // records already checked out or with no check-in
  errors: number,         // records that failed to process
  notificationsSent: number
}
```

**Error Handling:**
- Top-level try/catch returns `{ success: false, error: string }` on unhandled errors.
- Individual record processing is wrapped in try/catch; failures increment `errorCount` but do not halt the loop.
- Notification sending failures are caught per-user and logged but do not affect the overall result.

---

### 4. `cleanupExpiredFCMTokens`

**Type:** Scheduled (onSchedule)

**Description:**
Runs daily at 2:00 AM to clean up stale and inactive FCM tokens from the `fcmTokens` collection. Performs two cleanup steps:
1. **Inactive tokens:** Deletes all documents where `active == false`.
2. **Stale tokens:** Deletes all documents where `updatedAt` is older than 30 days. Also deletes documents that have no `updatedAt` field but have a `createdAt` older than 30 days.

All deletions are performed in batches of 500 to respect Firestore batch-write limits.

**Schedule:**
```
0 2 * * *
```
(2:00 AM every day)

**Timezone:** `Asia/Kuala_Lumpur` (UTC+8)

**Authentication:** None required (scheduled).

**Parameters/Input:** None.

**Firestore Collections Read:**
- `fcmTokens` -- Queries documents by `active == false`, and by `updatedAt` / `createdAt` older than 30 days.

**Firestore Collections Written:**
- `fcmTokens` -- Deletes qualifying documents in batches.

**Side Effects:**
- Permanently removes expired/inactive FCM token documents from Firestore.

**Return Value:**
```js
{
  success: boolean,
  inactiveDeleted: number,
  staleDeleted: number,
  totalDeleted: number,
  errors: number,
  timestamp: string        // ISO 8601
}
```
On error, also includes `error: string`.

**Error Handling:**
- Top-level try/catch returns the partial progress plus the error message.
- Individual batch-commit failures are caught; failed counts are added to `totalErrors` but processing continues.
- Uses cursor-based pagination (`startAfter`) to handle cases where documents with `createdAt < cutoff` have a valid `updatedAt` and should not be deleted.

---

## Callable Functions

### 5. `manualAutoCheckout`

**Type:** Callable (onCall)

**Description:**
Allows an admin to manually trigger the auto-checkout process for the current day. Unlike the scheduled `autoCheckoutBeforeMidnight`, this function sets the checkout time to the current time (not 11:59 PM), making it suitable for testing or mid-day forced checkouts.

**Authentication:**
- **Required:** The caller must be authenticated (`request.auth` must exist).
- **Role check:** The caller's `users` document must have `role == "admin"`. Non-admin users receive a `permission-denied` error.

**Parameters/Input:**
None. The function uses `request.auth.uid` to identify the calling admin.

**Client-side invocation example:**
```js
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const manualAutoCheckout = httpsCallable(functions, 'manualAutoCheckout');

const result = await manualAutoCheckout();
console.log(result.data);
```

**Firestore Collections Read:**
- `users` -- Reads the admin's document to verify `role == "admin"`.
- `attendance` -- Queries all documents where `dateString == "<today YYYY-MM-DD>"`.

**Firestore Collections Written:**
- `attendance` -- Updates qualifying records (checked in, not checked out) with:
  ```js
  {
    clockOutTime: Timestamp(now),
    checkOutTime: Timestamp(now),
    workingHours: number,        // decimal, capped at 16
    overtimeHours: number,       // max(0, workingHours - 8)
    status: "checked-out",
    autoCheckout: true,
    autoCheckoutTime: Timestamp(now),
    autoCheckoutReason: "Manual auto checkout triggered by admin",
    notes: "<existing notes>\n[MANUAL AUTO CHECKOUT] Admin triggered automatic checkout",
    updatedAt: serverTimestamp()
  }
  ```

**Side Effects:**
- Unlike the scheduled version, this function does **not** send push notifications, emails, or create in-app notifications. It only updates Firestore records.

**Return Value (Success):**
```js
{
  success: true,
  date: string,              // "YYYY-MM-DD"
  totalRecords: number,
  processed: number,
  skipped: number,
  errors: number,
  processedUsers: [
    {
      userId: string,
      userName: string,
      workingHours: string    // e.g., "7.50"
    }
  ]
}
```

**Return Value (No records):**
```js
{
  success: true,
  processed: 0,
  message: "No attendance records found for today",
  date: string
}
```

**Error Handling:**
- Throws `HttpsError('unauthenticated', ...)` if user is not logged in.
- Throws `HttpsError('permission-denied', ...)` if user is not an admin.
- Throws `HttpsError('internal', ...)` on any unexpected error during processing.
- Individual record failures are caught, increment `errorCount`, and processing continues.

---

### 6. `sendTestNotification`

**Type:** Callable (onCall)

**Description:**
Sends a test push notification to the currently authenticated user's device. Used to verify that FCM (Firebase Cloud Messaging) is configured correctly on the user's browser/device.

**Authentication:**
- **Required:** The caller must be authenticated (`request.auth` must exist). Any authenticated user (admin or regular user) can call this function.

**Parameters/Input:**
None. Uses `request.auth.uid` to look up the user's FCM token.

**Client-side invocation example:**
```js
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendTestNotification = httpsCallable(functions, 'sendTestNotification');

const result = await sendTestNotification();
console.log(result.data); // { success: true, messageId: "..." }
```

**Firestore Collections Read:**
- `fcmTokens` -- Reads the document at `fcmTokens/{userId}`. Checks `active` and `token` fields.

**Firestore Collections Written:**
None.

**Side Effects:**
- **Push notification (FCM):** Sends a single "Test Notification" via `admin.messaging().send()` to the user's registered FCM token.
  - Title: "Test Notification"
  - Body: "This is a test notification. Your notifications are working!"
  - Data type: `test`
  - Tag: `test-notification`
  - Deep link: `/user/settings`

**Return Value (Success):**
```js
{
  success: true,
  messageId: string   // FCM message ID
}
```

**Error Handling:**
- Throws `HttpsError('unauthenticated', ...)` if user is not logged in.
- Throws `HttpsError('not-found', ...)` if no FCM token document exists for the user, or if the token field is missing.
- Throws `HttpsError('failed-precondition', ...)` if the token exists but is marked as inactive (`active: false`).
- Throws `HttpsError('internal', ...)` for any other unexpected errors (e.g., FCM send failure).
- All errors are logged with full details (code, message, details).

---

## Firestore Trigger Functions

### 7. `onLeaveStatusUpdate`

**Type:** Firestore Trigger (onDocumentUpdated)

**Description:**
Automatically fires whenever a document in the `leaves` collection is updated. If the document's `status` field changed **from `"pending"`** to either `"approved"` or `"rejected"`, the function sends an email notification to the employee informing them of the decision. Uses professionally styled HTML email templates with leave details.

**Trigger Path:**
```
leaves/{leaveId}
```

**Region:** `asia-southeast1` (Singapore)

**Authentication:** Not applicable (Firestore triggers fire automatically on document changes, regardless of who made the change).

**Parameters/Input:** None (event-driven). The function receives `event.data.before` and `event.data.after` containing the document snapshots.

**Conditions for email to be sent:**
1. The `status` field must have changed (before !== after).
2. The previous status must be `"pending"`.
3. The new status must be either `"approved"` or `"rejected"`.

If any condition is not met, the function returns `null` without sending an email.

**Firestore Collections Read:**
- `leaves` -- The trigger source document. Reads:
  - `status` (string) -- `"pending"`, `"approved"`, or `"rejected"`
  - `userId` (string)
  - `leaveType` (string) -- e.g., "Annual Leave", "Medical Leave"
  - `startDate` (Timestamp)
  - `endDate` (Timestamp)
  - `totalDays` (number, defaults to 1)
  - `approvedBy` (string, for approved leaves)
  - `adminComments` (string, optional, for approved leaves)
  - `rejectedBy` (string, for rejected leaves)
  - `rejectionReason` (string, for rejected leaves, defaults to "No reason provided")
- `users` -- Reads the employee's document by `userId` to get `email`, `firstName`, `lastName`.

**Firestore Collections Written:**
None.

**Side Effects:**
- **Email (approval):** Sends an HTML email with a green-themed template containing:
  - Leave type, start date, end date, total days, approved by, admin comments (if any).
  - Subject: "Leave Request Approved - {leaveType}"
- **Email (rejection):** Sends an HTML email with a red-themed template containing:
  - Leave type, start date, end date, total days, rejected by, rejection reason.
  - Subject: "Leave Request Rejected - {leaveType}"
- Dates are formatted as `dd MMM yyyy` (e.g., "15 Jan 2026") using the `en-GB` locale.

**Return Value:**
```js
// On successful email send:
{ success: true, messageId: string }

// On email send failure:
{ success: false, error: string }
```
Returns `null` if the status change conditions are not met, or if the user/email is not found.

**Error Handling:**
- Returns `null` (no-op) if:
  - Status did not change.
  - Previous status was not `"pending"`.
  - New status is neither `"approved"` nor `"rejected"`.
  - User document does not exist.
  - User has no email address.
- Top-level try/catch logs the error and returns `{ success: false, error: string }`.

---

## Helper Functions (Internal)

These are not exported as Cloud Functions but are used internally:

### `getEmailTransporter()`
Creates and returns a Nodemailer transporter configured with Gmail (or another SMTP service). Uses `EMAIL_USER` and `EMAIL_PASS` environment variables.

### `sendEmailNotification(to, subject, htmlContent)`
Sends an HTML email using the transporter. Returns `{ success: true, messageId }` or `{ success: false, error }`.

### `getCheckInEmailTemplate(userName, companyName, workStartTime)`
Returns an HTML string for the check-in reminder email. Green-themed header with a "Check In Now" button linking to `APP_URL/user/attendance`.

### `getCheckOutEmailTemplate(userName, companyName, workEndTime)`
Returns an HTML string for the check-out reminder email. Blue-themed header with a "Check Out Now" button linking to `APP_URL/user/attendance`.

### `getLeaveApprovalEmailTemplate(userName, leaveType, startDate, endDate, totalDays, approvedBy, adminComments)`
Returns an HTML string for the leave-approved notification email. Green gradient header with detailed leave information card.

### `getLeaveRejectionEmailTemplate(userName, leaveType, startDate, endDate, totalDays, rejectedBy, rejectionReason)`
Returns an HTML string for the leave-rejected notification email. Red gradient header with detailed leave information card and rejection reason.

### `isWorkDay(workDays)`
Checks if the current day of the week (e.g., "monday") is included in the provided `workDays` array. Returns `boolean`.

### `shouldSendReminder(workTime, reminderMinutes, currentTime)`
Calculates whether the current time falls within a 5-minute window of the computed reminder time (`workTime - reminderMinutes`). Returns `boolean`.

---

## Deployment Instructions

### Prerequisites

1. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```
2. **Logged in** to Firebase:
   ```bash
   firebase login
   ```
3. **Project selected**:
   ```bash
   firebase use <your-project-id>
   ```

### Setting up environment variables

1. Copy the example env file:
   ```bash
   cp functions/.env.example functions/.env
   ```
2. Edit `functions/.env` and fill in your real values:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-gmail-app-password
   APP_URL=https://your-deployed-app.web.app
   ```

### Installing dependencies

```bash
cd functions
npm install
```

### Deploying all functions

From the project root:

```bash
firebase deploy --only functions
```

### Deploying a single function

```bash
firebase deploy --only functions:sendCheckInReminders
firebase deploy --only functions:sendCheckOutReminders
firebase deploy --only functions:autoCheckoutBeforeMidnight
firebase deploy --only functions:cleanupExpiredFCMTokens
firebase deploy --only functions:manualAutoCheckout
firebase deploy --only functions:sendTestNotification
firebase deploy --only functions:onLeaveStatusUpdate
```

### Deploying multiple specific functions

```bash
firebase deploy --only functions:sendCheckInReminders,functions:sendCheckOutReminders
```

### Viewing logs

```bash
firebase functions:log
```

Or filter by function name:

```bash
firebase functions:log --only sendCheckInReminders
```

### Important notes on deployment

- The `firebase.json` configuration includes a predeploy hook that runs `npm run build` in the functions directory (currently a no-op echo).
- The runtime is configured as `nodejs20` in `firebase.json`.
- The `onLeaveStatusUpdate` function is explicitly deployed to the `asia-southeast1` region. All other functions use the default region.
- Scheduled functions require the **Cloud Scheduler** API to be enabled in your Google Cloud project. Firebase typically enables this automatically on first deploy.
- The **Blaze (pay-as-you-go)** billing plan is required for scheduled functions and outbound network requests (email sending).

---

## Testing Locally with Firebase Emulators

The project includes emulator configuration in `firebase.json`:

| Emulator   | Port  |
|------------|-------|
| Auth       | 9099  |
| Firestore  | 8080  |
| Storage    | 9199  |
| Functions  | 5001  |
| Hosting    | 5000  |
| Emulator UI| 4000  |

### Starting the emulators

```bash
firebase emulators:start
```

Or start only the functions emulator:

```bash
firebase emulators:start --only functions
```

Or use the npm script from the `functions/` directory:

```bash
cd functions
npm run serve
```

### Accessing the Emulator UI

Open http://localhost:4000 in your browser to access the Emulator Suite UI. From here you can:

- View function logs in real time.
- Browse and edit Firestore data.
- Trigger Firestore document updates to test `onLeaveStatusUpdate`.

### Testing scheduled functions

Scheduled functions do not run automatically in the emulator. Use the **Firebase Functions Shell** to invoke them manually:

```bash
cd functions
npm run shell
```

Then in the shell:

```js
// Test check-in reminders
sendCheckInReminders()

// Test check-out reminders
sendCheckOutReminders()

// Test auto checkout
autoCheckoutBeforeMidnight()

// Test FCM token cleanup
cleanupExpiredFCMTokens()
```

### Testing callable functions

Callable functions can be tested from the Firebase Functions Shell with simulated auth context:

```js
// Test sendTestNotification with authenticated user
sendTestNotification({}, { auth: { uid: 'test-user-id' } })

// Test manualAutoCheckout with admin auth
manualAutoCheckout({}, { auth: { uid: 'admin-user-id' } })
```

Alternatively, call them from your frontend app connected to the emulator:

```js
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
connectFunctionsEmulator(functions, 'localhost', 5001);

const sendTest = httpsCallable(functions, 'sendTestNotification');
const result = await sendTest();
```

### Testing the Firestore trigger

To test `onLeaveStatusUpdate`, update a document in the `leaves` collection via the Emulator UI or programmatically:

1. Create a leave document with `status: "pending"` in the Firestore emulator.
2. Update the document's `status` field to `"approved"` or `"rejected"`.
3. Check the Functions emulator logs for email-sending output.

**Note:** Email sending will attempt to use real SMTP credentials even in the emulator. To avoid sending real emails during testing, either:
- Use a test email service like [Ethereal](https://ethereal.email/).
- Temporarily modify `EMAIL_USER` and `EMAIL_PASS` in your `.env` to point to a test account.
- Check the emulator function logs for the email content without actually sending.

### Environment variables in the emulator

The emulator automatically reads from `functions/.env`. Ensure this file exists and has valid values before starting the emulator if you want email functionality to work.

---

## Appendix: FCM Notification Payloads

### Check-In Reminder
```json
{
  "notification": {
    "title": "Time to Check In!",
    "body": "Good morning! Don't forget to check in for work. Work starts at {workStartTime}."
  },
  "data": {
    "type": "check-in-reminder",
    "tag": "check-in-reminder",
    "url": "/user/attendance",
    "company": "{companyName}",
    "timestamp": "{epochMs}"
  }
}
```

### Check-Out Reminder
```json
{
  "notification": {
    "title": "Time to Check Out!",
    "body": "Your work day is ending at {workEndTime}. Don't forget to check out!"
  },
  "data": {
    "type": "check-out-reminder",
    "tag": "check-out-reminder",
    "url": "/user/attendance",
    "company": "{companyName}",
    "timestamp": "{epochMs}"
  }
}
```

### Auto Checkout Notification
```json
{
  "notification": {
    "title": "Auto Checkout Notification",
    "body": "You were automatically checked out at 11:59 PM. Working hours: {hours}h"
  },
  "data": {
    "type": "auto-checkout",
    "url": "/user/attendance"
  }
}
```

### Test Notification
```json
{
  "notification": {
    "title": "Test Notification",
    "body": "This is a test notification. Your notifications are working!"
  },
  "data": {
    "type": "test",
    "tag": "test-notification",
    "url": "/user/settings"
  }
}
```
