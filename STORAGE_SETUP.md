# Firebase Storage Setup Guide

This guide will help you set up Firebase Storage for company logo uploads.

## Prerequisites

1. Firebase project with Blaze Plan (already set up)
2. Firebase CLI installed
3. Admin access to Firebase Console

## Step 1: Enable Firebase Storage in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **attendance-management-sy-f2ec9**
3. Click on **Storage** in the left sidebar
4. Click **Get Started** (if not already enabled)
5. Choose your storage location (recommended: **us-central1** or closest to your users)
6. Click **Done**

## Step 2: Deploy Storage Rules

The storage rules have already been configured in `storage.rules`. Deploy them using:

```bash
firebase deploy --only storage
```

This will set up security rules that:
- Allow **admins only** to upload/delete company logos
- Allow **all authenticated users** to view logos
- Enforce **5MB max file size** for logos
- Only allow **image files** (PNG, JPG, etc.)

## Step 3: Verify Setup

After deployment, you can verify:

1. Go to Firebase Console → Storage
2. You should see the storage bucket is active
3. Rules tab should show the deployed rules

## Step 4: Test Logo Upload

1. Log in as an **admin** user
2. Go to **Company Profile** page
3. Click on a company or create a new one
4. Click **Upload Logo** button
5. Select an image file (PNG or JPG, max 5MB)
6. Save the company profile

## Storage Structure

Logos are stored in Firebase Storage with this structure:

```
company-logos/
  ├── CompanyName_1234567890_logo.png
  ├── AnotherCompany_1234567891_logo.jpg
  └── ...
```

## Security

- Only users with `role: 'admin'` can upload/delete logos
- All authenticated users can read logos (needed for payslips and UI)
- Non-authenticated users cannot access any storage files
- File size limited to 5MB
- Only image file types allowed

## Troubleshooting

### Error: "Storage bucket not configured"

Solution: Enable Storage in Firebase Console (Step 1)

### Error: "Permission denied"

Solution:
1. Make sure you're logged in as admin user
2. Deploy storage rules: `firebase deploy --only storage`

### Error: "File too large"

Solution: Resize your image to be under 5MB

### Logo not showing in PDF

Solution:
1. Check that the logo URL is saved in the company document
2. Verify the logo file exists in Storage
3. Check browser console for any CORS errors

## Cost Considerations

Firebase Storage on Blaze plan charges for:
- **Storage**: $0.026/GB per month
- **Downloads**: $0.12/GB
- **Uploads**: $0.05/GB

Typical usage for company logos:
- Average logo size: 50KB
- 100 companies = ~5MB storage
- Estimated cost: **< $1/month** for typical usage

## Support

If you encounter issues:
1. Check Firebase Console → Storage → Files
2. Check Firebase Console → Storage → Rules
3. Review browser console for errors
4. Check that user has admin role in Firestore
