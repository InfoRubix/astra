const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true}); // Enable CORS for all origins
const nodemailer = require('nodemailer');
admin.initializeApp();

/**
 * Email configuration
 * Using environment variables from .env file
 */
// Create email transporter
const getEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // You can use 'outlook', 'yahoo', or custom SMTP
    auth: {
      user: process.env.EMAIL_USER || 'info@rubix.com.my',
      pass: process.env.EMAIL_PASS || ''
    }
  });
};

/**
 * Helper function to send email notification
 */
async function sendEmailNotification(to, subject, htmlContent) {
  try {
    const transporter = getEmailTransporter();
    const mailOptions = {
      from: `Attendance System <${process.env.EMAIL_USER || 'info@rubix.com.my'}>`,
      to: to,
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate HTML email template for check-in reminder
 */
function getCheckInEmailTemplate(userName, companyName, workStartTime) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Time to Check In!</h1>
        </div>
        <div class="content">
          <p>Good morning, <strong>${userName}</strong>!</p>
          <p>This is a friendly reminder that your work day is starting soon.</p>
          <p><strong>Work Start Time:</strong> ${workStartTime}</p>
          <p>Don't forget to check in for work to ensure accurate attendance tracking.</p>
          <a href="${process.env.APP_URL || 'https://your-app-domain.com'}/user/attendance" class="button">Check In Now</a>
        </div>
        <div class="footer">
          <p>This is an automated message from ${companyName} Attendance System</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email template for check-out reminder
 */
function getCheckOutEmailTemplate(userName, companyName, workEndTime) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏁 Time to Check Out!</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Your work day is ending soon!</p>
          <p><strong>Work End Time:</strong> ${workEndTime}</p>
          <p>Remember to check out to properly record your working hours.</p>
          <a href="${process.env.APP_URL || 'https://your-app-domain.com'}/user/attendance" class="button">Check Out Now</a>
        </div>
        <div class="footer">
          <p>This is an automated message from ${companyName} Attendance System</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Helper function to check if today is a work day for a company
 */
function isWorkDay(workDays) {
  const dayMap = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  };

  const today = new Date();
  const dayName = dayMap[today.getDay()];
  return workDays.includes(dayName);
}

/**
 * Helper function to calculate if it's time to send a reminder
 */
function shouldSendReminder(workTime, reminderMinutes, currentTime) {
  const [workHours, workMinutes] = workTime.split(':').map(Number);
  const workTimeMs = (workHours * 60 + workMinutes) * 60 * 1000;

  const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
  const currentTimeMs = (currentHours * 60 + currentMinutes) * 60 * 1000;

  const reminderTimeMs = workTimeMs - (reminderMinutes * 60 * 1000);

  // Check if current time is within a 5-minute window of the reminder time
  const timeDiff = Math.abs(currentTimeMs - reminderTimeMs);
  return timeDiff < (5 * 60 * 1000); // 5-minute window
}

/**
 * Cloud Function to send check-in reminders
 * Runs every hour and checks company settings to send personalized reminders
 */
exports.sendCheckInReminders = onSchedule({
  schedule: 'every 5 minutes', // Check every 5 minutes for more accurate timing
  timeZone: 'Asia/Kuala_Lumpur'
}, async (event) => {
  console.log('⏰ Running check-in reminder job at', new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour12: false
  }));

  try {
    const db = admin.firestore();

    // Get all company settings with notifications enabled
    const companySettingsSnapshot = await db.collection('companySettings')
      .where('enableNotifications', '==', true)
      .where('isActive', '==', true)
      .get();

    if (companySettingsSnapshot.empty) {
      console.log('No companies with notifications enabled');
      return null;
    }

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kuala_Lumpur'
    });

    console.log(`Current time: ${currentTime}`);

    let totalSent = 0;
    let totalFailed = 0;

    // Process each company
    for (const companyDoc of companySettingsSnapshot.docs) {
      const companySettings = companyDoc.data();
      const company = companySettings.company;

      console.log(`Checking company: ${company}`);
      console.log(`Work start time: ${companySettings.workStartTime}, Current time: ${currentTime}`);

      // Check if today is a work day for this company
      if (!isWorkDay(companySettings.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])) {
        console.log(`Today is not a work day for ${company}`);
        continue;
      }

      // Check if it's time to send reminder
      const reminderMinutes = companySettings.checkInReminderMinutes || 15;
      const [workHours, workMinutes] = companySettings.workStartTime.split(':').map(Number);
      const reminderTime = `${String(workHours).padStart(2, '0')}:${String(workMinutes - reminderMinutes).padStart(2, '0')}`;
      console.log(`Reminder should be sent at: ${reminderTime} (${reminderMinutes} min before ${companySettings.workStartTime})`);

      if (!shouldSendReminder(companySettings.workStartTime, reminderMinutes, currentTime)) {
        console.log(`Not time for ${company} reminder yet`);
        continue;
      }

      console.log(`Sending check-in reminders for ${company}`);

      // Get all users from this company
      const usersSnapshot = await db.collection('users')
        .where('company', '==', company)
        .get();

      if (usersSnapshot.empty) {
        console.log(`No users found for ${company}`);
        continue;
      }

      const userIds = usersSnapshot.docs.map(doc => doc.id);

      // Get FCM tokens for these users with check-in reminder enabled
      const tokensSnapshot = await db.collection('fcmTokens')
        .where('userId', 'in', userIds.slice(0, 10)) // Firestore 'in' query limit
        .where('active', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log(`No active tokens for ${company} users`);
        continue;
      }

      const tokens = [];
      const userTokenMap = {}; // Map to track which user gets which token
      const userIdsForEmail = []; // Track users for email notifications
      tokensSnapshot.forEach(doc => {
        const data = doc.data();
        // Only send to users who have check-in reminder enabled (default to true if not set)
        const checkInReminderEnabled = data.checkInReminder !== undefined ? data.checkInReminder : true;
        console.log(`User ${data.userId} - checkInReminder preference: ${checkInReminderEnabled}`);
        if (checkInReminderEnabled) {
          if (data.token) {
            tokens.push(data.token);
            userTokenMap[data.token] = data.userId;
            console.log(`✅ Will send check-in reminder to user ${data.userId}: ${data.token.substring(0, 30)}...`);
          }
          userIdsForEmail.push(data.userId);
        } else {
          console.log(`❌ Skipping user ${data.userId} - check-in reminder disabled`);
        }
      });

      if (tokens.length === 0) {
        console.log(`No valid tokens found for ${company}`);
        continue;
      }

      console.log(`Found ${tokens.length} tokens for ${company}`);

      // Prepare notification message
      const message = {
        notification: {
          title: '⏰ Time to Check In!',
          body: `Good morning! Don't forget to check in for work. Work starts at ${companySettings.workStartTime}.`,
        },
        data: {
          type: 'check-in-reminder',
          tag: 'check-in-reminder',
          url: '/user/attendance',
          company: company,
          timestamp: Date.now().toString()
        },
        webpush: {
          notification: {
            title: '⏰ Time to Check In!',
            body: `Good morning! Don't forget to check in for work. Work starts at ${companySettings.workStartTime}.`,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: 'check-in-reminder',
            requireInteraction: true
          },
          fcmOptions: {
            link: '/user/attendance'
          }
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'attendance-reminders'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Send to all devices using sendEach (compatible with Cloud Functions v2)
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        try {
          // Create messages array for sendEach
          const messages = batch.map(token => ({
            token: token,
            ...message
          }));

          const response = await admin.messaging().sendEach(messages);

          totalSent += response.successCount;
          totalFailed += response.failureCount;

          console.log(`${company} - Batch: Success: ${response.successCount}, Failed: ${response.failureCount}`);

          // Remove invalid tokens
          if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const errorCode = resp.error?.code;
                console.log(`Failed to send to token ${batch[idx].substring(0, 20)}... Error: ${errorCode}`);
                if (errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered') {
                  tokensToRemove.push(batch[idx]);
                }
              }
            });

            // Mark invalid tokens as inactive
            const writeBatch = db.batch();
            for (const token of tokensToRemove) {
              const tokenDocs = await db.collection('fcmTokens')
                .where('token', '==', token)
                .get();

              tokenDocs.forEach(doc => {
                writeBatch.update(doc.ref, { active: false });
              });
            }

            if (tokensToRemove.length > 0) {
              await writeBatch.commit();
              console.log(`Marked ${tokensToRemove.length} invalid tokens as inactive`);
            }
          }
        } catch (error) {
          console.error(`Error sending batch for ${company}:`, error);
          totalFailed += batch.length;
        }
      }

      // Send email notifications to users with check-in reminders enabled
      if (userIdsForEmail.length > 0) {
        console.log(`Sending email reminders to ${userIdsForEmail.length} users for ${company}`);

        let emailsSent = 0;
        let emailsFailed = 0;

        for (const userId of userIdsForEmail) {
          try {
            // Get user details
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
              console.log(`User ${userId} not found, skipping email`);
              continue;
            }

            const userData = userDoc.data();
            const userEmail = userData.email;
            const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';

            if (!userEmail) {
              console.log(`No email for user ${userId}, skipping`);
              continue;
            }

            // Send email
            const emailHtml = getCheckInEmailTemplate(userName, company, companySettings.workStartTime);
            const result = await sendEmailNotification(
              userEmail,
              `⏰ Time to Check In - ${company}`,
              emailHtml
            );

            if (result.success) {
              emailsSent++;
            } else {
              emailsFailed++;
            }
          } catch (error) {
            console.error(`Error sending email to user ${userId}:`, error);
            emailsFailed++;
          }
        }

        console.log(`${company} - Emails sent: ${emailsSent}, Emails failed: ${emailsFailed}`);
      }
    }

    console.log(`✅ Check-in reminders complete! Total Success: ${totalSent}, Total Failed: ${totalFailed}`);
    return { totalSent, totalFailed };

  } catch (error) {
    console.error('❌ Error in sendCheckInReminders:', error);
    return null;
  }
});

/**
 * Cloud Function to send check-out reminders
 * Runs every hour and checks company settings to send personalized reminders
 */
exports.sendCheckOutReminders = onSchedule({
  schedule: 'every 5 minutes', // Check every 5 minutes for more accurate timing
  timeZone: 'Asia/Kuala_Lumpur'
}, async (event) => {
  console.log('🏁 Running check-out reminder job at', new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour12: false
  }));

  try {
    const db = admin.firestore();

    // Get all company settings with notifications enabled
    const companySettingsSnapshot = await db.collection('companySettings')
      .where('enableNotifications', '==', true)
      .where('isActive', '==', true)
      .get();

    if (companySettingsSnapshot.empty) {
      console.log('No companies with notifications enabled');
      return null;
    }

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kuala_Lumpur'
    });

    console.log(`Current time: ${currentTime}`);

    let totalSent = 0;
    let totalFailed = 0;

    // Process each company
    for (const companyDoc of companySettingsSnapshot.docs) {
      const companySettings = companyDoc.data();
      const company = companySettings.company;

      console.log(`Checking company: ${company}`);
      console.log(`Work end time: ${companySettings.workEndTime}, Current time: ${currentTime}`);

      // Check if today is a work day for this company
      if (!isWorkDay(companySettings.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])) {
        console.log(`Today is not a work day for ${company}`);
        continue;
      }

      // Check if it's time to send reminder
      const reminderMinutes = companySettings.checkOutReminderMinutes || 10;
      const [workHours, workMinutes] = companySettings.workEndTime.split(':').map(Number);
      const reminderTime = `${String(workHours).padStart(2, '0')}:${String(workMinutes - reminderMinutes).padStart(2, '0')}`;
      console.log(`Reminder should be sent at: ${reminderTime} (${reminderMinutes} min before ${companySettings.workEndTime})`);

      if (!shouldSendReminder(companySettings.workEndTime, reminderMinutes, currentTime)) {
        console.log(`Not time for ${company} reminder yet`);
        continue;
      }

      console.log(`Sending check-out reminders for ${company}`);

      // Get all users from this company
      const usersSnapshot = await db.collection('users')
        .where('company', '==', company)
        .get();

      if (usersSnapshot.empty) {
        console.log(`No users found for ${company}`);
        continue;
      }

      const userIds = usersSnapshot.docs.map(doc => doc.id);

      // Get FCM tokens for these users with check-out reminder enabled
      const tokensSnapshot = await db.collection('fcmTokens')
        .where('userId', 'in', userIds.slice(0, 10)) // Firestore 'in' query limit
        .where('active', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log(`No active tokens for ${company} users`);
        continue;
      }

      const tokens = [];
      const userTokenMap = {}; // Map to track which user gets which token
      const userIdsForEmail = []; // Track users for email notifications
      tokensSnapshot.forEach(doc => {
        const data = doc.data();
        // Only send to users who have check-out reminder enabled (default to true if not set)
        const checkOutReminderEnabled = data.checkOutReminder !== undefined ? data.checkOutReminder : true;
        console.log(`User ${data.userId} - checkOutReminder preference: ${checkOutReminderEnabled}`);
        if (checkOutReminderEnabled) {
          if (data.token) {
            tokens.push(data.token);
            userTokenMap[data.token] = data.userId;
            console.log(`✅ Will send check-out reminder to user ${data.userId}: ${data.token.substring(0, 30)}...`);
          }
          userIdsForEmail.push(data.userId);
        } else {
          console.log(`❌ Skipping user ${data.userId} - check-out reminder disabled`);
        }
      });

      if (tokens.length === 0) {
        console.log(`No valid tokens found for ${company}`);
        continue;
      }

      // Prepare notification message
      const message = {
        notification: {
          title: '🏁 Time to Check Out!',
          body: `Your work day is ending at ${companySettings.workEndTime}. Don't forget to check out!`,
        },
        data: {
          type: 'check-out-reminder',
          tag: 'check-out-reminder',
          url: '/user/attendance',
          company: company,
          timestamp: Date.now().toString()
        },
        webpush: {
          notification: {
            title: '🏁 Time to Check Out!',
            body: `Your work day is ending at ${companySettings.workEndTime}. Don't forget to check out!`,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: 'check-out-reminder',
            requireInteraction: true
          },
          fcmOptions: {
            link: '/user/attendance'
          }
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'attendance-reminders'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Send to all devices using sendEach (compatible with Cloud Functions v2)
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        try {
          // Create messages array for sendEach
          const messages = batch.map(token => ({
            token: token,
            ...message
          }));

          const response = await admin.messaging().sendEach(messages);

          totalSent += response.successCount;
          totalFailed += response.failureCount;

          console.log(`${company} - Batch: Success: ${response.successCount}, Failed: ${response.failureCount}`);

          // Remove invalid tokens
          if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const errorCode = resp.error?.code;
                console.log(`Failed to send to token ${batch[idx].substring(0, 20)}... Error: ${errorCode}`);
                if (errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered') {
                  tokensToRemove.push(batch[idx]);
                }
              }
            });

            // Mark invalid tokens as inactive
            const writeBatch = db.batch();
            for (const token of tokensToRemove) {
              const tokenDocs = await db.collection('fcmTokens')
                .where('token', '==', token)
                .get();

              tokenDocs.forEach(doc => {
                writeBatch.update(doc.ref, { active: false });
              });
            }

            if (tokensToRemove.length > 0) {
              await writeBatch.commit();
              console.log(`Marked ${tokensToRemove.length} invalid tokens as inactive`);
            }
          }
        } catch (error) {
          console.error(`Error sending batch for ${company}:`, error);
          totalFailed += batch.length;
        }
      }

      // Send email notifications to users with check-out reminders enabled
      if (userIdsForEmail.length > 0) {
        console.log(`Sending email reminders to ${userIdsForEmail.length} users for ${company}`);

        let emailsSent = 0;
        let emailsFailed = 0;

        for (const userId of userIdsForEmail) {
          try {
            // Get user details
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
              console.log(`User ${userId} not found, skipping email`);
              continue;
            }

            const userData = userDoc.data();
            const userEmail = userData.email;
            const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';

            if (!userEmail) {
              console.log(`No email for user ${userId}, skipping`);
              continue;
            }

            // Send email
            const emailHtml = getCheckOutEmailTemplate(userName, company, companySettings.workEndTime);
            const result = await sendEmailNotification(
              userEmail,
              `🏁 Time to Check Out - ${company}`,
              emailHtml
            );

            if (result.success) {
              emailsSent++;
            } else {
              emailsFailed++;
            }
          } catch (error) {
            console.error(`Error sending email to user ${userId}:`, error);
            emailsFailed++;
          }
        }

        console.log(`${company} - Emails sent: ${emailsSent}, Emails failed: ${emailsFailed}`);
      }
    }

    console.log(`✅ Check-out reminders complete! Total Success: ${totalSent}, Total Failed: ${totalFailed}`);
    return { totalSent, totalFailed };

  } catch (error) {
    console.error('❌ Error in sendCheckOutReminders:', error);
    return null;
  }
});

/**
 * Auto Checkout Function
 * Runs at 11:59 PM daily to automatically check out users who forgot to check out
 */
exports.autoCheckoutBeforeMidnight = onSchedule({
  schedule: '59 23 * * *', // Run at 11:59 PM every day
  timeZone: 'Asia/Kuala_Lumpur'
}, async (event) => {
  console.log('🌙 Running auto checkout at 11:59 PM', new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour12: false
  }));

  try {
    const db = admin.firestore();

    // Get today's date string in YYYY-MM-DD format (Malaysia timezone)
    const now = new Date();
    const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const year = malaysiaTime.getFullYear();
    const month = String(malaysiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(malaysiaTime.getDate()).padStart(2, '0');
    const todayDateString = `${year}-${month}-${day}`;

    console.log(`📅 Processing auto checkout for date: ${todayDateString}`);

    // Query all attendance records for today that are checked in but not checked out
    const attendanceQuery = await db.collection('attendance')
      .where('dateString', '==', todayDateString)
      .get();

    if (attendanceQuery.empty) {
      console.log('No attendance records found for today');
      return { success: true, processed: 0, message: 'No records to process' };
    }

    console.log(`Found ${attendanceQuery.size} attendance records for today`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const notifications = [];

    // Process each attendance record
    for (const doc of attendanceQuery.docs) {
      const attendanceData = doc.data();
      const attendanceId = doc.id;

      // Check if user has checked in but not checked out
      const hasCheckedIn = attendanceData.clockInTime || attendanceData.checkInTime;
      const hasCheckedOut = attendanceData.clockOutTime || attendanceData.checkOutTime;

      if (!hasCheckedIn) {
        console.log(`⏭️ Skipping ${attendanceId} - No check-in found`);
        skippedCount++;
        continue;
      }

      if (hasCheckedOut) {
        console.log(`⏭️ Skipping ${attendanceId} - Already checked out`);
        skippedCount++;
        continue;
      }

      try {
        // Calculate checkout time as 11:59 PM of today
        const checkoutTime = new Date(malaysiaTime);
        checkoutTime.setHours(23, 59, 0, 0);

        // Get check-in time
        let checkInTime;
        const clockIn = attendanceData.clockInTime || attendanceData.checkInTime;
        if (clockIn?.toDate) {
          checkInTime = clockIn.toDate();
        } else if (clockIn instanceof Date) {
          checkInTime = clockIn;
        } else {
          checkInTime = new Date(clockIn);
        }

        // Calculate working hours in decimal format
        const millisecondsDiff = checkoutTime - checkInTime;
        const workingHours = millisecondsDiff / (1000 * 60 * 60); // Convert to hours

        // Cap at 16 hours maximum (reasonable limit)
        const cappedWorkingHours = Math.min(workingHours, 16);

        // Calculate overtime (anything over 8 hours)
        const overtimeHours = Math.max(0, cappedWorkingHours - 8);

        console.log(`⏰ Auto checkout for user ${attendanceData.userId}:`);
        console.log(`   Check-in: ${checkInTime.toLocaleString()}`);
        console.log(`   Auto checkout: ${checkoutTime.toLocaleString()}`);
        console.log(`   Working hours: ${cappedWorkingHours.toFixed(2)}h`);
        console.log(`   Overtime: ${overtimeHours.toFixed(2)}h`);

        // Update attendance record
        const updateData = {
          clockOutTime: admin.firestore.Timestamp.fromDate(checkoutTime),
          checkOutTime: admin.firestore.Timestamp.fromDate(checkoutTime),
          workingHours: parseFloat(cappedWorkingHours.toFixed(2)),
          overtimeHours: parseFloat(overtimeHours.toFixed(2)),
          status: 'checked-out',
          autoCheckout: true,
          autoCheckoutTime: admin.firestore.Timestamp.fromDate(checkoutTime),
          autoCheckoutReason: 'Automatic checkout at midnight - user forgot to check out',
          notes: (attendanceData.notes || '') + '\n[AUTO CHECKOUT] System automatically checked out at 11:59 PM',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('attendance').doc(attendanceId).update(updateData);

        console.log(`✅ Successfully auto checked out user ${attendanceData.userId}`);
        processedCount++;

        // Prepare notification for user
        notifications.push({
          userId: attendanceData.userId,
          userName: attendanceData.userName,
          userEmail: attendanceData.userEmail,
          company: attendanceData.company,
          workingHours: cappedWorkingHours.toFixed(2)
        });

      } catch (error) {
        console.error(`❌ Error processing auto checkout for ${attendanceId}:`, error);
        errorCount++;
      }
    }

    // Send notifications to users who were auto checked out
    if (notifications.length > 0) {
      console.log(`📧 Sending notifications to ${notifications.length} users`);

      for (const notif of notifications) {
        try {
          // Create in-app notification
          await db.collection('notifications').add({
            userId: notif.userId,
            type: 'auto-checkout',
            title: '🌙 Auto Checkout',
            message: `You were automatically checked out at 11:59 PM. Working hours: ${notif.workingHours}h. Please remember to check out manually next time.`,
            priority: 'high',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Try to send FCM notification
          const tokenDocs = await db.collection('fcmTokens')
            .where('userId', '==', notif.userId)
            .where('active', '==', true)
            .get();

          if (!tokenDocs.empty) {
            const tokens = tokenDocs.docs.map(doc => doc.data().token).filter(Boolean);

            if (tokens.length > 0) {
              const message = {
                notification: {
                  title: '🌙 Auto Checkout Notification',
                  body: `You were automatically checked out at 11:59 PM. Working hours: ${notif.workingHours}h`,
                },
                data: {
                  type: 'auto-checkout',
                  url: '/user/attendance'
                },
                webpush: {
                  notification: {
                    title: '🌙 Auto Checkout Notification',
                    body: `You were automatically checked out at 11:59 PM. Working hours: ${notif.workingHours}h`,
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    tag: 'auto-checkout'
                  },
                  fcmOptions: {
                    link: '/user/attendance'
                  }
                }
              };

              const messages = tokens.map(token => ({ token, ...message }));
              await admin.messaging().sendEach(messages);
            }
          }

          // Send email notification
          if (notif.userEmail) {
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                  .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                  .button { display: inline-block; padding: 12px 30px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                  .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🌙 Auto Checkout Notification</h1>
                  </div>
                  <div class="content">
                    <p>Hi <strong>${notif.userName}</strong>,</p>
                    <p>You were automatically checked out at <strong>11:59 PM</strong> because you forgot to check out manually.</p>

                    <div class="warning">
                      <strong>⚠️ Important:</strong> Please remember to check out manually before leaving work to ensure accurate attendance tracking.
                    </div>

                    <p><strong>Today's Summary:</strong></p>
                    <ul>
                      <li>Auto Checkout Time: 11:59 PM</li>
                      <li>Working Hours: ${notif.workingHours} hours</li>
                      <li>Date: ${todayDateString}</li>
                    </ul>

                    <p>If this was a mistake or you need to adjust your checkout time, please submit a "Forgotten Checkout Request" in the system.</p>

                    <a href="${process.env.APP_URL || 'https://your-app-domain.com'}/user/attendance" class="button">View Attendance</a>
                  </div>
                  <div class="footer">
                    <p>This is an automated message from ${notif.company} Attendance System</p>
                    <p>Please do not reply to this email</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            await sendEmailNotification(
              notif.userEmail,
              `🌙 Auto Checkout - ${notif.company}`,
              emailHtml
            );
          }

          console.log(`✅ Notification sent to ${notif.userName}`);
        } catch (error) {
          console.error(`❌ Error sending notification to ${notif.userId}:`, error);
        }
      }
    }

    const summary = {
      success: true,
      date: todayDateString,
      totalRecords: attendanceQuery.size,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      notificationsSent: notifications.length
    };

    console.log('✅ Auto checkout completed:', summary);
    return summary;

  } catch (error) {
    console.error('❌ Error in autoCheckoutBeforeMidnight:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Manual trigger for auto checkout (for testing purposes)
 * Call this from admin panel to manually run auto checkout
 */
exports.manualAutoCheckout = onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Only allow admins to trigger manual auto checkout
  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(request.auth.uid).get();

  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can trigger manual auto checkout');
  }

  console.log('🔧 Manual auto checkout triggered by admin:', request.auth.uid);

  try {
    // Get today's date string in YYYY-MM-DD format (Malaysia timezone)
    const now = new Date();
    const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const year = malaysiaTime.getFullYear();
    const month = String(malaysiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(malaysiaTime.getDate()).padStart(2, '0');
    const todayDateString = `${year}-${month}-${day}`;

    console.log(`📅 Processing manual auto checkout for date: ${todayDateString}`);

    // Query all attendance records for today that are checked in but not checked out
    const attendanceQuery = await db.collection('attendance')
      .where('dateString', '==', todayDateString)
      .get();

    if (attendanceQuery.empty) {
      return {
        success: true,
        processed: 0,
        message: 'No attendance records found for today',
        date: todayDateString
      };
    }

    console.log(`Found ${attendanceQuery.size} attendance records for today`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const processedUsers = [];

    // Process each attendance record
    for (const doc of attendanceQuery.docs) {
      const attendanceData = doc.data();
      const attendanceId = doc.id;

      // Check if user has checked in but not checked out
      const hasCheckedIn = attendanceData.clockInTime || attendanceData.checkInTime;
      const hasCheckedOut = attendanceData.clockOutTime || attendanceData.checkOutTime;

      if (!hasCheckedIn) {
        skippedCount++;
        continue;
      }

      if (hasCheckedOut) {
        skippedCount++;
        continue;
      }

      try {
        // Calculate checkout time as current time (for testing)
        const checkoutTime = malaysiaTime;

        // Get check-in time
        let checkInTime;
        const clockIn = attendanceData.clockInTime || attendanceData.checkInTime;
        if (clockIn?.toDate) {
          checkInTime = clockIn.toDate();
        } else if (clockIn instanceof Date) {
          checkInTime = clockIn;
        } else {
          checkInTime = new Date(clockIn);
        }

        // Calculate working hours in decimal format
        const millisecondsDiff = checkoutTime - checkInTime;
        const workingHours = millisecondsDiff / (1000 * 60 * 60);
        const cappedWorkingHours = Math.min(workingHours, 16);
        const overtimeHours = Math.max(0, cappedWorkingHours - 8);

        // Update attendance record
        const updateData = {
          clockOutTime: admin.firestore.Timestamp.fromDate(checkoutTime),
          checkOutTime: admin.firestore.Timestamp.fromDate(checkoutTime),
          workingHours: parseFloat(cappedWorkingHours.toFixed(2)),
          overtimeHours: parseFloat(overtimeHours.toFixed(2)),
          status: 'checked-out',
          autoCheckout: true,
          autoCheckoutTime: admin.firestore.Timestamp.fromDate(checkoutTime),
          autoCheckoutReason: 'Manual auto checkout triggered by admin',
          notes: (attendanceData.notes || '') + '\n[MANUAL AUTO CHECKOUT] Admin triggered automatic checkout',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('attendance').doc(attendanceId).update(updateData);

        processedCount++;
        processedUsers.push({
          userId: attendanceData.userId,
          userName: attendanceData.userName,
          workingHours: cappedWorkingHours.toFixed(2)
        });

        console.log(`✅ Auto checked out user ${attendanceData.userName}`);

      } catch (error) {
        console.error(`❌ Error processing auto checkout for ${attendanceId}:`, error);
        errorCount++;
      }
    }

    const summary = {
      success: true,
      date: todayDateString,
      totalRecords: attendanceQuery.size,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      processedUsers: processedUsers
    };

    console.log('✅ Manual auto checkout completed:', summary);
    return summary;

  } catch (error) {
    console.error('❌ Error in manual auto checkout:', error);
    throw new HttpsError('internal', `Failed to run manual auto checkout: ${error.message}`);
  }
});

/**
 * Test function to send immediate notification
 * Call this manually to test: firebase functions:shell then sendTestNotification()
 */
exports.sendTestNotification = onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;

  try {
    const db = admin.firestore();

    console.log('Testing notification for user:', userId);

    // Get user's FCM token
    const tokenDoc = await db.collection('fcmTokens').doc(userId).get();

    console.log('Token document exists:', tokenDoc.exists);

    if (!tokenDoc.exists) {
      throw new HttpsError('not-found', 'No FCM token found for user. Please enable notifications first in User Settings.');
    }

    const tokenData = tokenDoc.data();
    console.log('Token data:', { active: tokenData.active, hasToken: !!tokenData.token });

    if (!tokenData.active) {
      throw new HttpsError('failed-precondition', 'FCM token is inactive. Please re-enable notifications in User Settings.');
    }

    if (!tokenData.token) {
      throw new HttpsError('not-found', 'FCM token is missing. Please re-enable notifications in User Settings.');
    }

    const token = tokenData.token;

    // Send test notification
    const message = {
      notification: {
        title: '🔔 Test Notification',
        body: 'This is a test notification. Your notifications are working!',
      },
      data: {
        type: 'test',
        tag: 'test-notification',
        url: '/user/settings'
      },
      token: token
    };

    const response = await admin.messaging().send(message);

    console.log('Test notification sent successfully:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending test notification:', error);

    // If it's already an HttpsError, re-throw it
    if (error instanceof HttpsError) {
      throw error;
    }

    // Otherwise, wrap it in an HttpsError with detailed message
    const errorMessage = error.message || 'Unknown error occurred';
    console.error('Full error details:', {
      code: error.code,
      message: error.message,
      details: error.details
    });

    throw new HttpsError('internal', `Failed to send test notification: ${errorMessage}`);
  }
});

/**
 * Generate HTML email template for leave approval
 */
function getLeaveApprovalEmailTemplate(userName, leaveType, startDate, endDate, totalDays, approvedBy, adminComments) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Leave Request Approved</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">✅ Leave Request Approved</h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
                    Dear <strong>${userName}</strong>,
                  </p>

                  <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
                    Your <strong>${leaveType}</strong> leave request has been <span style="color: #4caf50; font-weight: 600;">approved</span>!
                  </p>

                  <!-- Leave Details Card -->
                  <div style="background-color: #f8f9fa; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px; font-size: 16px; color: #333; font-weight: 600;">Leave Details:</h3>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Leave Type:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${leaveType}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Start Date:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${startDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">End Date:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${endDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Total Days:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${totalDays} day${totalDays > 1 ? 's' : ''}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Approved By:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${approvedBy}</td>
                      </tr>
                    </table>
                    ${adminComments ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                      <p style="margin: 0; font-size: 14px; color: #666;">Admin Comments:</p>
                      <p style="margin: 5px 0 0; font-size: 14px; color: #333; font-style: italic;">"${adminComments}"</p>
                    </div>
                    ` : ''}
                  </div>

                  <p style="margin: 20px 0 0; font-size: 14px; color: #666; line-height: 1.6;">
                    This leave has been added to your schedule. Enjoy your time off!
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    This is an automated notification from Attendance Management System
                  </p>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} RUBIX TECHNOLOGY. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email template for leave rejection
 */
function getLeaveRejectionEmailTemplate(userName, leaveType, startDate, endDate, totalDays, rejectedBy, rejectionReason) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Leave Request Rejected</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f44336 0%, #c62828 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">❌ Leave Request Not Approved</h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
                    Dear <strong>${userName}</strong>,
                  </p>

                  <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
                    We regret to inform you that your <strong>${leaveType}</strong> leave request has been <span style="color: #f44336; font-weight: 600;">rejected</span>.
                  </p>

                  <!-- Leave Details Card -->
                  <div style="background-color: #fff8f8; border-left: 4px solid #f44336; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px; font-size: 16px; color: #333; font-weight: 600;">Leave Request Details:</h3>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Leave Type:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${leaveType}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Start Date:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${startDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">End Date:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${endDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Total Days:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${totalDays} day${totalDays > 1 ? 's' : ''}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666; padding: 5px 0;">Rejected By:</td>
                        <td style="font-size: 14px; color: #333; font-weight: 600; padding: 5px 0; text-align: right;">${rejectedBy}</td>
                      </tr>
                    </table>
                    ${rejectionReason ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #fee;">
                      <p style="margin: 0; font-size: 14px; color: #666; font-weight: 600;">Reason for Rejection:</p>
                      <p style="margin: 5px 0 0; font-size: 14px; color: #d32f2f; font-weight: 500;">"${rejectionReason}"</p>
                    </div>
                    ` : ''}
                  </div>

                  <p style="margin: 20px 0 0; font-size: 14px; color: #666; line-height: 1.6;">
                    If you have any questions or would like to discuss this decision, please contact your manager or HR department.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    This is an automated notification from Attendance Management System
                  </p>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} RUBIX TECHNOLOGY. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Cloud Function: Cleanup expired and inactive FCM tokens
 * Runs daily at 2:00 AM Malaysia time
 * - Deletes tokens marked as inactive (active: false)
 * - Deletes tokens older than 30 days that haven't been updated
 * - Processes deletions in batches to avoid Firestore limits
 */
exports.cleanupExpiredFCMTokens = onSchedule({
  schedule: '0 2 * * *', // Run at 2:00 AM every day
  timeZone: 'Asia/Kuala_Lumpur'
}, async (event) => {
  console.log('Running FCM token cleanup at', new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour12: false
  }));

  const db = admin.firestore();
  const BATCH_SIZE = 500; // Firestore batch write limit
  let totalInactiveDeleted = 0;
  let totalStaleDeleted = 0;
  let totalErrors = 0;

  try {
    // --- Step 1: Delete all tokens marked as inactive ---
    console.log('Step 1: Finding inactive FCM tokens (active: false)...');

    let inactiveQuery = db.collection('fcmTokens')
      .where('active', '==', false)
      .limit(BATCH_SIZE);

    let inactiveSnapshot = await inactiveQuery.get();

    while (!inactiveSnapshot.empty) {
      const writeBatch = db.batch();
      inactiveSnapshot.docs.forEach(doc => {
        writeBatch.delete(doc.ref);
      });

      try {
        await writeBatch.commit();
        totalInactiveDeleted += inactiveSnapshot.size;
        console.log(`Deleted batch of ${inactiveSnapshot.size} inactive tokens`);
      } catch (batchError) {
        console.error('Error deleting inactive token batch:', batchError);
        totalErrors += inactiveSnapshot.size;
      }

      // Fetch the next batch
      inactiveSnapshot = await inactiveQuery.get();
    }

    console.log(`Step 1 complete: Deleted ${totalInactiveDeleted} inactive tokens`);

    // --- Step 2: Delete tokens older than 30 days that haven't been updated ---
    console.log('Step 2: Finding stale FCM tokens (older than 30 days)...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

    let staleQuery = db.collection('fcmTokens')
      .where('updatedAt', '<', cutoffTimestamp)
      .limit(BATCH_SIZE);

    let staleSnapshot = await staleQuery.get();

    while (!staleSnapshot.empty) {
      const writeBatch = db.batch();
      staleSnapshot.docs.forEach(doc => {
        writeBatch.delete(doc.ref);
      });

      try {
        await writeBatch.commit();
        totalStaleDeleted += staleSnapshot.size;
        console.log(`Deleted batch of ${staleSnapshot.size} stale tokens`);
      } catch (batchError) {
        console.error('Error deleting stale token batch:', batchError);
        totalErrors += staleSnapshot.size;
      }

      // Fetch the next batch
      staleSnapshot = await staleQuery.get();
    }

    // Also handle tokens that have no updatedAt field and were created more than 30 days ago
    let noUpdateQuery = db.collection('fcmTokens')
      .where('createdAt', '<', cutoffTimestamp)
      .limit(BATCH_SIZE);

    let noUpdateSnapshot = await noUpdateQuery.get();

    while (!noUpdateSnapshot.empty) {
      const writeBatch = db.batch();
      let batchCount = 0;

      noUpdateSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only delete if there is no updatedAt field (already handled above otherwise)
        if (!data.updatedAt) {
          writeBatch.delete(doc.ref);
          batchCount++;
        }
      });

      if (batchCount > 0) {
        try {
          await writeBatch.commit();
          totalStaleDeleted += batchCount;
          console.log(`Deleted batch of ${batchCount} stale tokens (no updatedAt)`);
        } catch (batchError) {
          console.error('Error deleting stale token batch (no updatedAt):', batchError);
          totalErrors += batchCount;
        }
      }

      // If every doc in the snapshot had an updatedAt, we need to paginate past them
      if (batchCount === 0) {
        const lastDoc = noUpdateSnapshot.docs[noUpdateSnapshot.docs.length - 1];
        noUpdateQuery = db.collection('fcmTokens')
          .where('createdAt', '<', cutoffTimestamp)
          .startAfter(lastDoc)
          .limit(BATCH_SIZE);
      }

      noUpdateSnapshot = await noUpdateQuery.get();
    }

    console.log(`Step 2 complete: Deleted ${totalStaleDeleted} stale tokens`);

    // --- Summary ---
    const summary = {
      success: true,
      inactiveDeleted: totalInactiveDeleted,
      staleDeleted: totalStaleDeleted,
      totalDeleted: totalInactiveDeleted + totalStaleDeleted,
      errors: totalErrors,
      timestamp: new Date().toISOString()
    };

    console.log('FCM token cleanup completed:', JSON.stringify(summary));
    return summary;

  } catch (error) {
    console.error('Error in cleanupExpiredFCMTokens:', error);
    return {
      success: false,
      inactiveDeleted: totalInactiveDeleted,
      staleDeleted: totalStaleDeleted,
      totalDeleted: totalInactiveDeleted + totalStaleDeleted,
      errors: totalErrors,
      error: error.message
    };
  }
});

/**
 * Cloud Function: Send email when leave status is updated
 * Triggered automatically when a leave document is updated in Firestore
 */
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');

exports.onLeaveStatusUpdate = onDocumentUpdated({
  document: 'leaves/{leaveId}',
  region: 'asia-southeast1', // Singapore region
}, async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Only send email if status changed from 'pending' to 'approved' or 'rejected'
    if (beforeData.status === afterData.status || beforeData.status !== 'pending') {
      console.log('No status change or not from pending status, skipping email');
      return null;
    }

    const newStatus = afterData.status;
    if (newStatus !== 'approved' && newStatus !== 'rejected') {
      console.log('Status not approved/rejected, skipping email');
      return null;
    }

    // Get user details
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(afterData.userId).get();

    if (!userDoc.exists) {
      console.error('User not found:', afterData.userId);
      return null;
    }

    const userData = userDoc.data();
    const userEmail = userData.email;
    const userName = `${userData.firstName} ${userData.lastName}`;

    if (!userEmail) {
      console.error('User email not found for:', afterData.userId);
      return null;
    }

    // Format dates
    const formatDate = (dateField) => {
      if (!dateField) return 'N/A';
      const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const startDate = formatDate(afterData.startDate);
    const endDate = formatDate(afterData.endDate);
    const totalDays = afterData.totalDays || 1;
    const leaveType = afterData.leaveType || 'Leave';

    // Prepare email content based on status
    let subject, htmlContent;

    if (newStatus === 'approved') {
      const approvedBy = afterData.approvedBy || 'Admin';
      const adminComments = afterData.adminComments || '';

      subject = `✅ Leave Request Approved - ${leaveType}`;
      htmlContent = getLeaveApprovalEmailTemplate(
        userName,
        leaveType,
        startDate,
        endDate,
        totalDays,
        approvedBy,
        adminComments
      );
    } else {
      const rejectedBy = afterData.rejectedBy || 'Admin';
      const rejectionReason = afterData.rejectionReason || 'No reason provided';

      subject = `❌ Leave Request Rejected - ${leaveType}`;
      htmlContent = getLeaveRejectionEmailTemplate(
        userName,
        leaveType,
        startDate,
        endDate,
        totalDays,
        rejectedBy,
        rejectionReason
      );
    }

    // Send email
    console.log(`Sending ${newStatus} email to ${userEmail} for leave type: ${leaveType}`);
    const result = await sendEmailNotification(userEmail, subject, htmlContent);

    if (result.success) {
      console.log(`✅ Leave ${newStatus} email sent successfully to ${userEmail}`);
    } else {
      console.error(`❌ Failed to send leave ${newStatus} email:`, result.error);
    }

    return result;

  } catch (error) {
    console.error('Error in sendLeaveStatusEmail function:', error);
    return { success: false, error: error.message };
  }
});
