/**
 * Lightweight i18n (internationalization) utility for Attendance Management System
 * Supports English (en) and Bahasa Malaysia (ms)
 * No external libraries required
 */

const STORAGE_KEY = 'ams_language';

export const LANGUAGES = {
  EN: 'en',
  BM: 'ms',
};

export const LANGUAGE_LABELS = {
  en: 'English',
  ms: 'Bahasa Malaysia',
};

// ─── Translation dictionary ────────────────────────────────────────────────────
const translations = {

  // ── Navigation & Layout ────────────────────────────────────────────────────
  'nav.dashboard':              { en: 'Dashboard',                ms: 'Papan Pemuka' },
  'nav.attendance':             { en: 'Attendance',               ms: 'Kehadiran' },
  'nav.leaves':                 { en: 'Leaves',                   ms: 'Cuti' },
  'nav.claims':                 { en: 'Claims',                   ms: 'Tuntutan' },
  'nav.settings':               { en: 'Settings',                 ms: 'Tetapan' },
  'nav.employees':              { en: 'Employees',                ms: 'Pekerja' },
  'nav.reports':                { en: 'Reports',                  ms: 'Laporan' },
  'nav.announcements':          { en: 'Announcements',            ms: 'Pengumuman' },
  'nav.profile':                { en: 'Profile',                  ms: 'Profil' },
  'nav.notifications':          { en: 'Notifications',            ms: 'Pemberitahuan' },
  'nav.payslips':               { en: 'Payslips',                 ms: 'Slip Gaji' },
  'nav.feedback':               { en: 'Feedback',                 ms: 'Maklum Balas' },
  'nav.logout':                 { en: 'Logout',                   ms: 'Log Keluar' },
  'nav.login':                  { en: 'Login',                    ms: 'Log Masuk' },

  // ── Layout Sections ────────────────────────────────────────────────────────
  'layout.adminPortal':         { en: 'Admin Portal',             ms: 'Portal Pentadbir' },
  'layout.employeePortal':      { en: 'Employee Portal',          ms: 'Portal Pekerja' },
  'layout.adminPanel':          { en: 'Admin Panel',              ms: 'Panel Pentadbir' },
  'layout.userManagement':      { en: 'User Management',          ms: 'Pengurusan Pengguna' },
  'layout.requestsApprovals':   { en: 'Requests & Approvals',     ms: 'Permohonan & Kelulusan' },
  'layout.communications':      { en: 'Communications',           ms: 'Komunikasi' },
  'layout.companyManagement':   { en: 'Company Management',       ms: 'Pengurusan Syarikat' },
  'layout.analyticsReports':    { en: 'Analytics & Reports',      ms: 'Analitik & Laporan' },
  'layout.timeManagement':      { en: 'Time Management',          ms: 'Pengurusan Masa' },
  'layout.requests':            { en: 'Requests',                 ms: 'Permohonan' },
  'layout.information':         { en: 'Information',              ms: 'Maklumat' },
  'layout.teamApprovals':       { en: 'Team Approvals',           ms: 'Kelulusan Pasukan' },

  // ── Admin Menu Items ───────────────────────────────────────────────────────
  'admin.adminCompany':         { en: 'Admin Company',            ms: 'Syarikat Pentadbir' },
  'admin.positionManagement':   { en: 'Position Management',      ms: 'Pengurusan Jawatan' },
  'admin.leaveManagement':      { en: 'Leave Management',         ms: 'Pengurusan Cuti' },
  'admin.claimsManagement':     { en: 'Claims Management',        ms: 'Pengurusan Tuntutan' },
  'admin.forgottenCheckouts':   { en: 'Forgotten Check-outs',     ms: 'Daftar Keluar Terlupa' },
  'admin.companyProfile':       { en: 'Company Profile',          ms: 'Profil Syarikat' },
  'admin.companySettings':      { en: 'Company Settings',         ms: 'Tetapan Syarikat' },
  'admin.employeePerformance':  { en: 'Employee Performance',     ms: 'Prestasi Pekerja' },
  'admin.companyPerformance':   { en: 'Company Performance',      ms: 'Prestasi Syarikat' },
  'admin.adminProfile':         { en: 'Admin Profile',            ms: 'Profil Pentadbir' },

  // ── Attendance ─────────────────────────────────────────────────────────────
  'attendance.checkIn':              { en: 'Check In',                  ms: 'Daftar Masuk' },
  'attendance.checkOut':             { en: 'Check Out',                 ms: 'Daftar Keluar' },
  'attendance.checkingOut':          { en: 'Checking Out...',           ms: 'Mendaftar Keluar...' },
  'attendance.processing':           { en: 'Processing...',             ms: 'Memproses...' },
  'attendance.workingHours':         { en: 'Working Hours',             ms: 'Waktu Bekerja' },
  'attendance.workingTime':          { en: 'Working time',              ms: 'Masa bekerja' },
  'attendance.late':                 { en: 'Late',                      ms: 'Lewat' },
  'attendance.onTime':               { en: 'On Time',                   ms: 'Tepat Masa' },
  'attendance.earlyCheckIn':         { en: 'Early Check-In',            ms: 'Daftar Masuk Awal' },
  'attendance.lateCheckIn':          { en: 'Late Check-In',             ms: 'Daftar Masuk Lewat' },
  'attendance.earlyCheckOut':        { en: 'Early Check-Out',           ms: 'Daftar Keluar Awal' },
  'attendance.notCheckedIn':         { en: 'Not Checked In',            ms: 'Belum Daftar Masuk' },
  'attendance.recording':            { en: 'Attendance Recording',      ms: 'Rekod Kehadiran' },
  'attendance.currentStatus':        { en: 'Current Status',            ms: 'Status Semasa' },
  'attendance.locationInfo':         { en: 'Location & Info',           ms: 'Lokasi & Maklumat' },
  'attendance.locationVerified':     { en: 'Location verified',         ms: 'Lokasi disahkan' },
  'attendance.locationCaptured':     { en: 'Location Captured at Check-in', ms: 'Lokasi Direkod Semasa Daftar Masuk' },
  'attendance.locationStatus':       { en: 'Location Status',           ms: 'Status Lokasi' },
  'attendance.locationWillCapture':  { en: 'Location will be captured when you check in', ms: 'Lokasi akan direkod semasa anda daftar masuk' },
  'attendance.gettingLocation':      { en: 'Getting location...',       ms: 'Mendapatkan lokasi...' },
  'attendance.officeLocationMap':    { en: 'Office Location Map',       ms: 'Peta Lokasi Pejabat' },
  'attendance.checkInLocationMap':   { en: 'Check-in Location Map',     ms: 'Peta Lokasi Daftar Masuk' },
  'attendance.recentHistory':        { en: 'Recent Attendance History',  ms: 'Sejarah Kehadiran Terkini' },
  'attendance.noRecords':            { en: 'No attendance records found', ms: 'Tiada rekod kehadiran ditemui' },
  'attendance.historyAppearHere':    { en: 'Your attendance history will appear here once you start checking in', ms: 'Sejarah kehadiran anda akan dipaparkan di sini selepas anda mula mendaftar masuk' },
  'attendance.checkedInAt':          { en: 'Checked in at',             ms: 'Daftar masuk pada' },
  'attendance.checkOutReason':       { en: 'Check-out reason (optional)', ms: 'Sebab daftar keluar (pilihan)' },
  'attendance.aboutToCheckOut':      { en: "You're about to check out for the day", ms: 'Anda akan mendaftar keluar untuk hari ini' },
  'attendance.workSchedule':         { en: 'Work Schedule',             ms: 'Jadual Kerja' },
  'attendance.distanceFromOffice':   { en: 'Distance from office',      ms: 'Jarak dari pejabat' },
  'attendance.locationQuality':      { en: 'Location Quality',          ms: 'Kualiti Lokasi' },
  'attendance.accuracy':             { en: 'Accuracy',                  ms: 'Ketepatan' },
  'attendance.office':               { en: 'Office',                    ms: 'Pejabat' },
  'attendance.yourLocation':         { en: 'Your Location',             ms: 'Lokasi Anda' },
  'attendance.inProgress':           { en: 'In Progress',               ms: 'Sedang Berjalan' },

  // ── Leave ──────────────────────────────────────────────────────────────────
  'leave.annualLeave':          { en: 'Annual Leave',             ms: 'Cuti Tahunan' },
  'leave.sickLeave':            { en: 'Sick Leave',               ms: 'Cuti Sakit' },
  'leave.emergencyLeave':       { en: 'Emergency Leave',          ms: 'Cuti Kecemasan' },
  'leave.maternityLeave':       { en: 'Maternity Leave',          ms: 'Cuti Bersalin' },
  'leave.paternityLeave':       { en: 'Paternity Leave',          ms: 'Cuti Paterniti' },
  'leave.unpaidLeave':          { en: 'Unpaid Leave',             ms: 'Cuti Tanpa Gaji' },
  'leave.replacementLeave':     { en: 'Replacement Leave',        ms: 'Cuti Ganti' },
  'leave.compassionateLeave':   { en: 'Compassionate Leave',      ms: 'Cuti Ihsan' },
  'leave.studyLeave':           { en: 'Study Leave',              ms: 'Cuti Belajar' },
  'leave.approved':             { en: 'Approved',                 ms: 'Diluluskan' },
  'leave.rejected':             { en: 'Rejected',                 ms: 'Ditolak' },
  'leave.pending':              { en: 'Pending',                  ms: 'Menunggu Kelulusan' },
  'leave.cancelled':            { en: 'Cancelled',                ms: 'Dibatalkan' },
  'leave.apply':                { en: 'Apply Leave',              ms: 'Mohon Cuti' },
  'leave.balance':              { en: 'Leave Balance',            ms: 'Baki Cuti' },
  'leave.history':              { en: 'Leave History',            ms: 'Sejarah Cuti' },
  'leave.leaveType':            { en: 'Leave Type',               ms: 'Jenis Cuti' },
  'leave.startDate':            { en: 'Start Date',               ms: 'Tarikh Mula' },
  'leave.endDate':              { en: 'End Date',                 ms: 'Tarikh Tamat' },
  'leave.totalDays':            { en: 'Total Days',               ms: 'Jumlah Hari' },
  'leave.reason':               { en: 'Reason',                   ms: 'Sebab' },
  'leave.noLeaveRecords':       { en: 'No leave records found',   ms: 'Tiada rekod cuti ditemui' },
  'leave.leaveRequests':        { en: 'Leave Requests',           ms: 'Permohonan Cuti' },
  'leave.daysRemaining':        { en: 'days remaining',           ms: 'hari berbaki' },
  'leave.daysUsed':             { en: 'days used',                ms: 'hari digunakan' },

  // ── Claims ─────────────────────────────────────────────────────────────────
  'claims.submitClaim':         { en: 'Submit Claim',             ms: 'Hantar Tuntutan' },
  'claims.newClaim':            { en: 'New Claim',                ms: 'Tuntutan Baru' },
  'claims.claimType':           { en: 'Claim Type',               ms: 'Jenis Tuntutan' },
  'claims.category':            { en: 'Category',                 ms: 'Kategori' },
  'claims.amount':              { en: 'Amount',                   ms: 'Jumlah' },
  'claims.description':         { en: 'Description',              ms: 'Penerangan' },
  'claims.receipt':             { en: 'Receipt',                  ms: 'Resit' },
  'claims.uploadReceipt':       { en: 'Upload Receipt',           ms: 'Muat Naik Resit' },
  'claims.claimDate':           { en: 'Claim Date',               ms: 'Tarikh Tuntutan' },
  'claims.claimHistory':        { en: 'Claim History',            ms: 'Sejarah Tuntutan' },
  'claims.noClaimsFound':       { en: 'No claims found',          ms: 'Tiada tuntutan ditemui' },
  'claims.totalClaimed':        { en: 'Total Claimed',            ms: 'Jumlah Dituntut' },
  'claims.pendingApproval':     { en: 'Pending Approval',         ms: 'Menunggu Kelulusan' },
  'claims.travel':              { en: 'Travel & Transportation',  ms: 'Perjalanan & Pengangkutan' },
  'claims.meals':               { en: 'Meals & Entertainment',    ms: 'Makan & Hiburan' },
  'claims.accommodation':       { en: 'Accommodation',            ms: 'Penginapan' },
  'claims.office':              { en: 'Office Supplies',          ms: 'Bekalan Pejabat' },
  'claims.medical':             { en: 'Medical',                  ms: 'Perubatan' },
  'claims.others':              { en: 'Others',                   ms: 'Lain-lain' },
  'claims.claimExpenses':       { en: 'Claim Expenses',           ms: 'Tuntutan Perbelanjaan' },

  // ── Common Actions ─────────────────────────────────────────────────────────
  'common.submit':              { en: 'Submit',                   ms: 'Hantar' },
  'common.cancel':              { en: 'Cancel',                   ms: 'Batal' },
  'common.save':                { en: 'Save',                     ms: 'Simpan' },
  'common.delete':              { en: 'Delete',                   ms: 'Padam' },
  'common.edit':                { en: 'Edit',                     ms: 'Sunting' },
  'common.search':              { en: 'Search',                   ms: 'Cari' },
  'common.filter':              { en: 'Filter',                   ms: 'Tapis' },
  'common.export':              { en: 'Export',                   ms: 'Eksport' },
  'common.import':              { en: 'Import',                   ms: 'Import' },
  'common.download':            { en: 'Download',                 ms: 'Muat Turun' },
  'common.upload':              { en: 'Upload',                   ms: 'Muat Naik' },
  'common.close':               { en: 'Close',                    ms: 'Tutup' },
  'common.confirm':             { en: 'Confirm',                  ms: 'Sahkan' },
  'common.back':                { en: 'Back',                     ms: 'Kembali' },
  'common.next':                { en: 'Next',                     ms: 'Seterusnya' },
  'common.previous':            { en: 'Previous',                 ms: 'Sebelumnya' },
  'common.refresh':             { en: 'Refresh',                  ms: 'Muat Semula' },
  'common.loading':             { en: 'Loading...',               ms: 'Memuatkan...' },
  'common.noDataFound':         { en: 'No data found',            ms: 'Tiada data ditemui' },
  'common.actions':             { en: 'Actions',                  ms: 'Tindakan' },
  'common.details':             { en: 'Details',                  ms: 'Butiran' },
  'common.viewAll':             { en: 'View All',                 ms: 'Lihat Semua' },
  'common.viewDetails':         { en: 'View Details',             ms: 'Lihat Butiran' },
  'common.add':                 { en: 'Add',                      ms: 'Tambah' },
  'common.update':              { en: 'Update',                   ms: 'Kemaskini' },
  'common.approve':             { en: 'Approve',                  ms: 'Luluskan' },
  'common.reject':              { en: 'Reject',                   ms: 'Tolak' },
  'common.yes':                 { en: 'Yes',                      ms: 'Ya' },
  'common.no':                  { en: 'No',                       ms: 'Tidak' },
  'common.all':                 { en: 'All',                      ms: 'Semua' },
  'common.total':               { en: 'Total',                    ms: 'Jumlah' },
  'common.selectAll':           { en: 'Select All',               ms: 'Pilih Semua' },
  'common.clearAll':            { en: 'Clear All',                ms: 'Kosongkan Semua' },
  'common.reset':               { en: 'Reset',                    ms: 'Set Semula' },
  'common.print':               { en: 'Print',                    ms: 'Cetak' },
  'common.welcome':             { en: 'Welcome',                  ms: 'Selamat Datang' },

  // ── Status ─────────────────────────────────────────────────────────────────
  'status.present':             { en: 'Present',                  ms: 'Hadir' },
  'status.absent':              { en: 'Absent',                   ms: 'Tidak Hadir' },
  'status.late':                { en: 'Late',                     ms: 'Lewat' },
  'status.early':               { en: 'Early',                    ms: 'Awal' },
  'status.completed':           { en: 'Completed',                ms: 'Selesai' },
  'status.active':              { en: 'Active',                   ms: 'Aktif' },
  'status.inactive':            { en: 'Inactive',                 ms: 'Tidak Aktif' },
  'status.approved':            { en: 'Approved',                 ms: 'Diluluskan' },
  'status.rejected':            { en: 'Rejected',                 ms: 'Ditolak' },
  'status.pending':             { en: 'Pending',                  ms: 'Menunggu' },
  'status.cancelled':           { en: 'Cancelled',                ms: 'Dibatalkan' },
  'status.new':                 { en: 'NEW',                      ms: 'BARU' },
  'status.inProgress':          { en: 'In Progress',              ms: 'Sedang Berjalan' },
  'status.onLeave':             { en: 'On Leave',                 ms: 'Sedang Cuti' },
  'status.corruptedData':       { en: 'Corrupted Data',           ms: 'Data Rosak' },
  'status.pendingApproval':     { en: 'Pending Approval',         ms: 'Menunggu Kelulusan' },

  // ── Time & Date ────────────────────────────────────────────────────────────
  'time.today':                 { en: 'Today',                    ms: 'Hari Ini' },
  'time.yesterday':             { en: 'Yesterday',                ms: 'Semalam' },
  'time.thisWeek':              { en: 'This Week',                ms: 'Minggu Ini' },
  'time.lastWeek':              { en: 'Last Week',                ms: 'Minggu Lepas' },
  'time.thisMonth':             { en: 'This Month',               ms: 'Bulan Ini' },
  'time.lastMonth':             { en: 'Last Month',               ms: 'Bulan Lepas' },
  'time.thisYear':              { en: 'This Year',                ms: 'Tahun Ini' },
  'time.lastYear':              { en: 'Last Year',                ms: 'Tahun Lepas' },
  'time.hours':                 { en: 'Hours',                    ms: 'Jam' },
  'time.minutes':               { en: 'Minutes',                  ms: 'Minit' },
  'time.days':                  { en: 'Days',                     ms: 'Hari' },
  'time.months':                { en: 'Months',                   ms: 'Bulan' },
  'time.date':                  { en: 'Date',                     ms: 'Tarikh' },
  'time.time':                  { en: 'Time',                     ms: 'Masa' },
  'time.startTime':             { en: 'Start Time',               ms: 'Masa Mula' },
  'time.endTime':               { en: 'End Time',                 ms: 'Masa Tamat' },
  'time.duration':              { en: 'Duration',                 ms: 'Tempoh' },
  'time.unknownDate':           { en: 'Unknown date',             ms: 'Tarikh tidak diketahui' },
  'time.invalidDate':           { en: 'Invalid date',             ms: 'Tarikh tidak sah' },

  // ── Auth / Login ───────────────────────────────────────────────────────────
  'auth.email':                 { en: 'Email',                    ms: 'E-mel' },
  'auth.password':              { en: 'Password',                 ms: 'Kata Laluan' },
  'auth.signIn':                { en: 'Sign In',                  ms: 'Log Masuk' },
  'auth.signOut':               { en: 'Sign Out',                 ms: 'Log Keluar' },
  'auth.forgotPassword':        { en: 'Forgot Password?',         ms: 'Lupa Kata Laluan?' },
  'auth.register':              { en: 'Register',                 ms: 'Daftar' },
  'auth.noAccount':             { en: "Don't have an account?",   ms: 'Belum mempunyai akaun?' },
  'auth.hasAccount':            { en: 'Already have an account?', ms: 'Sudah mempunyai akaun?' },
  'auth.resetPassword':         { en: 'Reset Password',           ms: 'Set Semula Kata Laluan' },
  'auth.accountDeactivated':    { en: 'Your account has been deactivated. Please contact your administrator.', ms: 'Akaun anda telah dinyahaktifkan. Sila hubungi pentadbir anda.' },

  // ── Notifications ──────────────────────────────────────────────────────────
  'notification.adminNotifications':  { en: 'Admin Notifications',       ms: 'Pemberitahuan Pentadbir' },
  'notification.noNotifications':     { en: 'No notifications found',    ms: 'Tiada pemberitahuan ditemui' },
  'notification.noNotificationsYet':  { en: 'No notifications yet',      ms: 'Belum ada pemberitahuan' },
  'notification.unreadNotifications': { en: 'unread notifications',      ms: 'pemberitahuan belum dibaca' },
  'notification.noNotificationDesc':  { en: "You'll see notifications here when admins approve or reject your requests", ms: 'Anda akan melihat pemberitahuan di sini apabila pentadbir meluluskan atau menolak permohonan anda' },
  'notification.employee':            { en: 'Employee',                  ms: 'Pekerja' },
  'notification.actionBy':            { en: 'Action by',                 ms: 'Tindakan oleh' },

  // ── Greetings ──────────────────────────────────────────────────────────────
  'greeting.goodMorning':       { en: 'Good morning',             ms: 'Selamat pagi' },
  'greeting.goodAfternoon':     { en: 'Good afternoon',           ms: 'Selamat tengah hari' },
  'greeting.goodEvening':       { en: 'Good evening',             ms: 'Selamat petang' },

  // ── Company / Organisation ─────────────────────────────────────────────────
  'company.company':            { en: 'Company',                  ms: 'Syarikat' },
  'company.branch':             { en: 'Branch',                   ms: 'Cawangan' },
  'company.department':         { en: 'Department',               ms: 'Jabatan' },
  'company.position':           { en: 'Position',                 ms: 'Jawatan' },
  'company.officeAddress':      { en: 'Office Address',           ms: 'Alamat Pejabat' },
  'company.lunchBreak':         { en: 'Lunch Break',              ms: 'Rehat Tengah Hari' },
  'company.flexibleHours':      { en: 'Flexible Hours',           ms: 'Waktu Fleksibel' },

  // ── Employee / Profile ─────────────────────────────────────────────────────
  'employee.firstName':         { en: 'First Name',               ms: 'Nama Pertama' },
  'employee.lastName':          { en: 'Last Name',                ms: 'Nama Akhir' },
  'employee.fullName':          { en: 'Full Name',                ms: 'Nama Penuh' },
  'employee.phoneNumber':       { en: 'Phone Number',             ms: 'Nombor Telefon' },
  'employee.address':           { en: 'Address',                  ms: 'Alamat' },
  'employee.role':              { en: 'Role',                     ms: 'Peranan' },
  'employee.joinDate':          { en: 'Join Date',                ms: 'Tarikh Mula Bekerja' },
  'employee.status':            { en: 'Status',                   ms: 'Status' },

  // ── Map ────────────────────────────────────────────────────────────────────
  'map.road':                   { en: 'Road',                     ms: 'Jalan' },
  'map.satellite':              { en: 'Satellite',                ms: 'Satelit' },
  'map.hybrid':                 { en: 'Hybrid',                   ms: 'Hibrid' },
  'map.loadingMap':             { en: 'Loading map...',            ms: 'Memuatkan peta...' },

  // ── EA Form ────────────────────────────────────────────────────────────────
  'eaForm.title':               { en: 'EA Form',                  ms: 'Borang EA' },
  'eaForm.description':         { en: 'Malaysian Tax Document',   ms: 'Dokumen Cukai Malaysia' },

  // ── Salary / Payroll ───────────────────────────────────────────────────────
  'salary.basicSalary':         { en: 'Basic Salary',             ms: 'Gaji Asas' },
  'salary.allowance':           { en: 'Allowance',                ms: 'Elaun' },
  'salary.deduction':           { en: 'Deduction',                ms: 'Potongan' },
  'salary.netSalary':           { en: 'Net Salary',               ms: 'Gaji Bersih' },
  'salary.grossSalary':         { en: 'Gross Salary',             ms: 'Gaji Kasar' },
  'salary.overtime':            { en: 'Overtime',                 ms: 'Kerja Lebih Masa' },

  // ── Language ───────────────────────────────────────────────────────────────
  'language.title':             { en: 'Language',                 ms: 'Bahasa' },
  'language.english':           { en: 'English',                  ms: 'Bahasa Inggeris' },
  'language.malay':             { en: 'Bahasa Malaysia',          ms: 'Bahasa Malaysia' },
  'language.changeLanguage':    { en: 'Change Language',          ms: 'Tukar Bahasa' },

  // ── Messages / Feedback ────────────────────────────────────────────────────
  'message.successCheckIn':     { en: 'Successfully checked in!',   ms: 'Berjaya daftar masuk!' },
  'message.successCheckOut':    { en: 'Successfully checked out!',  ms: 'Berjaya daftar keluar!' },
  'message.errorCheckIn':       { en: 'Failed to record check-in',  ms: 'Gagal merekod daftar masuk' },
  'message.errorCheckOut':      { en: 'Failed to record check-out', ms: 'Gagal merekod daftar keluar' },
  'message.locationRequired':   { en: 'Location access required for attendance recording', ms: 'Akses lokasi diperlukan untuk merekod kehadiran' },
  'message.savedSuccessfully':  { en: 'Saved successfully',        ms: 'Berjaya disimpan' },
  'message.deletedSuccessfully': { en: 'Deleted successfully',     ms: 'Berjaya dipadam' },
  'message.areYouSure':         { en: 'Are you sure?',             ms: 'Adakah anda pasti?' },
  'message.cannotUndo':         { en: 'This action cannot be undone', ms: 'Tindakan ini tidak boleh dibatalkan' },
  'message.submittedSuccessfully': { en: 'Submitted successfully', ms: 'Berjaya dihantar' },
  'message.alreadyCheckedIn':   { en: 'You are already checked in today', ms: 'Anda sudah mendaftar masuk hari ini' },
  'message.noActiveCheckIn':    { en: 'No active check-in found for today', ms: 'Tiada daftar masuk aktif ditemui untuk hari ini' },
  'message.loadingSettings':    { en: 'Loading settings...',       ms: 'Memuatkan tetapan...' },
};


// ─── Current language state ─────────────────────────────────────────────────
let currentLanguage = LANGUAGES.EN;

/**
 * Initialise the language from localStorage (called once at module load).
 */
function initLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === LANGUAGES.EN || stored === LANGUAGES.BM)) {
      currentLanguage = stored;
    }
  } catch {
    // localStorage may be unavailable (SSR, private browsing, etc.)
    currentLanguage = LANGUAGES.EN;
  }
}

// Run on module load
initLanguage();


// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the translated string for the given key in the current language.
 * Falls back to English if the key or language is missing.
 * Returns the key itself if no translation exists at all.
 *
 * @param {string} key  - The translation key, e.g. 'nav.dashboard'
 * @returns {string}
 */
export function t(key) {
  const entry = translations[key];
  if (!entry) return key;
  return entry[currentLanguage] || entry[LANGUAGES.EN] || key;
}

/**
 * Sets the active language and persists the choice to localStorage.
 *
 * @param {'en' | 'ms'} lang
 */
export function setLanguage(lang) {
  if (lang !== LANGUAGES.EN && lang !== LANGUAGES.BM) {
    console.warn(`[i18n] Unknown language "${lang}". Falling back to English.`);
    lang = LANGUAGES.EN;
  }
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Returns the currently active language code.
 *
 * @returns {'en' | 'ms'}
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Returns the full translations object (useful for debugging or bulk operations).
 *
 * @returns {object}
 */
export function getTranslations() {
  return translations;
}

/**
 * Returns all available translation keys.
 *
 * @returns {string[]}
 */
export function getTranslationKeys() {
  return Object.keys(translations);
}
