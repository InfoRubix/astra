# Google Places API Setup Guide

This guide will help you set up Google Places API for the location search feature in the Company Profile page.

## What You Get

With Google Places API integrated, admins can:
- 🔍 **Search for office locations** like Google Maps
- 📍 **Auto-fill company details** including:
  - Company name
  - Full address (street, city, state, country, postal code)
  - Coordinates (latitude, longitude)
  - Phone number
  - Website
  - Rating & reviews count

**Cost:** FREE for moderate use (70,000+ searches/month with Google's $200 free credit)

---

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "**New Project**"
3. Enter project name: `Attendance Management System`
4. Click "**Create**"

### 2. Enable Places API

1. In Google Cloud Console, go to "**APIs & Services**" → "**Library**"
2. Search for "**Places API**"
3. Click on "**Places API**"
4. Click "**Enable**"

### 3. Get API Key

1. Go to "**APIs & Services**" → "**Credentials**"
2. Click "+ **CREATE CREDENTIALS**" → "**API Key**"
3. **Copy the API key** (looks like: `AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxX`)

### 4. Restrict API Key (IMPORTANT for Security!)

1. Click "**Edit**" on your newly created API key
2. Under "**API restrictions**":
   - Select "**Restrict key**"
   - Check ✓ "**Places API**"

3. Under "**Website restrictions**" (recommended):
   - Click "**HTTP referrers (websites)**"
   - Click "**+ ADD AN ITEM**"
   - Add your domains:
     ```
     localhost:3000/*
     yourapp.com/*
     *.yourapp.com/*
     ```

4. Click "**Save**"

### 5. Configure Your Application

1. Open the `.env` file in your project root
2. Find the line:
   ```
   REACT_APP_GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY_HERE
   ```
3. Replace `YOUR_GOOGLE_PLACES_API_KEY_HERE` with your actual API key:
   ```
   REACT_APP_GOOGLE_PLACES_API_KEY=AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxX
   ```
4. **Save the file**

### 6. Restart Your Application

**IMPORTANT:** You must restart your app for the environment variable to take effect!

```bash
# Stop the current app (Ctrl+C)
# Then restart:
npm start
```

---

## How to Use

### As Admin:

1. Login as **Admin**
2. Go to **Company Profile** page
3. Click "**Create Company**" or "**Edit**" existing company
4. In the "Location Information" section, you'll see a search box
5. Type your office name or address (e.g., "Petronas Twin Towers")
6. Select from the dropdown suggestions
7. **All details auto-fill automatically!** ✨

### What Gets Auto-Filled:

- ✅ Company Name
- ✅ Full Address
- ✅ Latitude & Longitude (exact coordinates!)
- ✅ Phone Number
- ✅ Website
- ✅ City, State, Country, Postal Code

---

## Pricing & Usage Limits

### Free Tier (Generous!)

Google provides:
- **$200 free credit** every month
- Places Autocomplete: **$2.83 per 1,000 requests**
- With free credit = **~70,000 searches/month FREE**

### Your Usage Estimate:

| Users | Searches/Month | Cost | Status |
|-------|----------------|------|--------|
| 100 | ~200-500 | $0 | ✅ FREE |
| 500 | ~1,000-2,000 | $0 | ✅ FREE |
| 1,000 | ~2,000-5,000 | $0 | ✅ FREE |
| 10,000 | ~20,000-50,000 | $0 | ✅ FREE |

**Most companies will stay in the FREE tier!**

---

## Troubleshooting

### "Failed to load Google Maps" Error

**Cause:** API key not configured or invalid

**Solution:**
1. Check `.env` file has correct API key
2. Restart your application (`npm start`)
3. Verify API key is correct in Google Cloud Console

### "This API key is not authorized" Error

**Cause:** API restrictions blocking your domain

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your API key
3. Under "Website restrictions", add your domain
4. For local development, add: `localhost:3000/*`

### Location search shows no results

**Cause:** Places API not enabled

**Solution:**
1. Go to Google Cloud Console
2. APIs & Services → Library
3. Search "Places API"
4. Click "Enable"

### Need to check your usage?

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "**APIs & Services**" → "**Dashboard**"
3. Click on "**Places API**"
4. View usage graphs and quotas

---

## Security Best Practices

1. ✅ **Never commit `.env` file** to git (already in `.gitignore`)
2. ✅ **Always restrict your API key** to specific APIs (Places API only)
3. ✅ **Add website restrictions** in production
4. ✅ **Monitor usage** regularly in Google Cloud Console
5. ✅ **Set up billing alerts** (optional, but recommended)

---

## Benefits Over Manual Entry

### Before (Manual):
1. Admin searches office location on Google Maps
2. Copy coordinates manually
3. Type address manually
4. Look up phone number separately
5. Find website separately
6. **Takes 5-10 minutes per company**
7. Prone to copy-paste errors

### After (With Google Places):
1. Type "Petronas Twin Towers"
2. Select from dropdown
3. **Done in 10 seconds!** ✨
4. All details auto-filled accurately
5. **No errors!**

---

## Support

If you encounter any issues:

1. Check the [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
2. Verify your API key in Google Cloud Console
3. Check browser console (F12) for error messages
4. Ensure you've restarted the app after adding the API key

---

## Summary Checklist

- [ ] Created Google Cloud project
- [ ] Enabled Places API
- [ ] Created API key
- [ ] Restricted API key (security!)
- [ ] Added API key to `.env` file
- [ ] Restarted the application
- [ ] Tested location search feature

**Once completed, you're ready to use the location search feature!** 🎉
