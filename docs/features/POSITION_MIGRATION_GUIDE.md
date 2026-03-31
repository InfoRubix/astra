# Position Migration Guide

## Problem

The company-specific positions in `src/utils/positionHierarchy.js` are hardcoded in the JavaScript code and not stored in Firebase. This creates a disconnect between:
- Predefined positions (in code)
- Custom positions added through the UI (in Firebase)

When you add "Admin" position through the Position Management page, it gets stored in Firebase, but the predefined positions like "Managing Partner", "Senior Lawyer", etc., remain only in the code.

## Solution

A migration system has been created to sync all predefined positions from the code to Firebase, allowing them to be managed through the admin interface.

## Files Created

### 1. `src/utils/migratePositionsToFirebase.js`
Migration utility that:
- Reads all predefined positions from `COMPANY_POSITIONS` constant
- Syncs them to Firebase `positions` collection
- Adds system-level positions (Admin, System Administrator, Super Admin)
- Skips positions that already exist
- Marks all synced positions with `isPredefined: true` flag
- Tracks migration source with `source: 'migration'`

### 2. `src/components/admin/PositionMigration.js`
React component that provides a UI to:
- Check migration status
- Display current position counts
- Trigger the migration process
- Show migration results
- Display errors if any occur

### 3. Updated `src/pages/admin/PositionManagement.js`
- Imports the PositionMigration component
- Displays it at the top of the Position Management page
- Automatically reloads positions after successful migration

## How to Use

### Step 1: Navigate to Position Management
1. Log in as an admin
2. Go to **Position Management** page
3. You'll see a new "Sync Predefined Positions to Database" card at the top

### Step 2: Check Migration Status
The card will automatically show:
- Total positions in database
- Number of previously migrated positions
- Whether migration is recommended

### Step 3: Run the Migration
1. Click **"Sync Positions to Database"** button
2. A confirmation dialog will appear explaining what will happen
3. Click **"Confirm & Sync"** to start the migration
4. Wait for the process to complete (usually a few seconds)

### Step 4: Review Results
After migration, you'll see:
- ✅ Number of positions added
- ⏭️ Number of positions skipped (already existed)
- ❌ Number of errors (if any)
- Detailed list of all added positions

## What Gets Migrated

### Company Positions
For each company (ASIAH HISAM, AFC, RUBIX), all predefined positions will be synced:

**ASIAH HISAM** (Law Firm):
- Level 0: Managing Partner, Senior Partner, Director, CEO, General Manager
- Level 1: Partner, Legal Manager, HR Manager, Finance Manager, Operations Manager, Administration Manager, Company Administrator
- Level 2: Senior Lawyer, Senior Paralegal, Senior Accountant, Supervisor, Team Lead
- Level 3: Lawyer, Paralegal, Legal Assistant, Legal Clerk, Secretary, HR Executive, Administrative Assistant, Accountant, Clerk, Staff

**AFC** (Mortgage/Financial Services):
- Level 0: General Manager, Director, CEO
- Level 1: Finance Manager, Operations Manager, Branch Manager, Mortgage Manager, Loan Manager, Administration Manager
- Level 2: Senior Loan Officer, Senior Financial Advisor, Senior Accountant, Supervisor, Team Lead
- Level 3: Loan Officer, Financial Advisor, Mortgage Consultant, Accountant, Customer Service, Administrative Assistant, Clerk, Secretary, Staff

**RUBIX** (Tech/Business Company):
- Level 0: General Manager, Director, CEO
- Level 1: Project Manager, Finance Manager, Operations Manager, Marketing Manager, Sales Manager, Administration Manager
- Level 2: Senior Developer, Senior Executive, Team Lead, Supervisor, Senior Accountant
- Level 3: Developer, Junior Developer, Accountant, Marketing Executive, Sales Executive, Customer Service, Administrative Assistant, Clerk, Secretary, Staff

### System-Level Positions
These are available for all companies:
- Admin (Level -1)
- System Administrator (Level -1)
- Super Admin (Level -1)

## Data Structure

Each migrated position in Firebase will have:
```javascript
{
  positionName: "Managing Partner",
  companyName: "ASIAH HISAM",
  level: 0,
  isPredefined: true,
  isCustom: false,
  isDeleted: false,
  createdAt: serverTimestamp(),
  createdBy: "admin_user_id",
  createdByName: "Admin Name",
  source: "migration",
  description: "Level 0 position - Top Management"
}
```

## Benefits

After migration:
1. ✅ All predefined positions are visible in the Position Management UI
2. ✅ Positions can be edited through the UI
3. ✅ Positions can be marked as deleted (soft delete)
4. ✅ Custom positions can be added alongside predefined ones
5. ✅ System maintains consistency between code and database
6. ✅ Admin position is now available for all companies
7. ✅ The Edit Employee dialog will work correctly for admin users

## Safety Features

- **Idempotent**: Safe to run multiple times - won't create duplicates
- **Non-destructive**: Existing positions are never modified or deleted
- **Rollback-friendly**: Positions are soft-deleted (isDeleted flag)
- **Audit trail**: Tracks who created positions and when
- **Error handling**: Shows detailed error messages if something fails

## Troubleshooting

### Migration fails with permission error
- Ensure you're logged in as an admin user
- Check Firebase security rules allow writing to `positions` collection

### Some positions show as "skipped"
- This is normal - positions that already exist won't be duplicated
- The migration only adds positions that don't exist

### Admin position still not showing in dropdown
1. Run the migration from Position Management page
2. Wait for success message
3. Refresh the page
4. Try editing an admin user again

### Need to re-run migration
- The migration button is always available
- Click "Refresh Status" to check current state
- Click "Sync Positions to Database" to run again

## Next Steps

After successful migration:
1. Navigate to Position Management page
2. Select different companies to view their positions
3. Edit or add custom positions as needed
4. Test editing admin users to confirm positions load correctly

## Notes

- Migration runs client-side (no server required)
- Process typically takes 2-5 seconds
- Network connectivity required
- Migration is logged to browser console for debugging
- Position hierarchy levels:
  - -1: System Administrator (cross-company)
  - 0: Top Management
  - 1: Managers/Department Heads
  - 2: Seniors/Supervisors
  - 3: Staff/Executives

## Support

If you encounter issues:
1. Check browser console for detailed error logs
2. Verify Firebase connection is working
3. Ensure user has admin permissions
4. Check that `positions` collection exists in Firestore
5. Review Firebase security rules for `positions` collection
