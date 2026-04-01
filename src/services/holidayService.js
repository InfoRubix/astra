import axios from 'axios';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const API_KEY = process.env.REACT_APP_CALENDARIFIC_API_KEY;
const BASE_URL = 'https://calendarific.com/api/v2/holidays';
const FIRESTORE_COLLECTION = 'publicHolidays';

// In-memory cache to avoid repeated Firestore reads within same session
const memoryCache = {};

export const holidayService = {

  // ─── MAIN FUNCTION ────────────────────────────────────────────────
  // Priority: Memory cache → Firestore → Calendarific API → Fallback
  async getMalaysiaHolidays(year = new Date().getFullYear(), state = null) {
    const cacheKey = `${year}_${state || 'national'}`;

    // 1. Check memory cache
    if (memoryCache[cacheKey]) {
      return { success: true, data: memoryCache[cacheKey], source: 'memory' };
    }

    // 2. Check Firestore
    try {
      const firestoreData = await this._loadFromFirestore(year, state);
      if (firestoreData && firestoreData.length > 0) {
        const holidays = firestoreData.map(h => ({ ...h, date: new Date(h.date) }));
        memoryCache[cacheKey] = holidays;
        return { success: true, data: holidays, source: 'firestore' };
      }
    } catch (err) {
      console.warn('Firestore holiday read failed, trying API:', err);
    }

    // 3. Fetch from Calendarific API and save to Firestore
    try {
      const holidays = await this._fetchFromAPI(year, state);
      if (holidays.length > 0) {
        await this._saveToFirestore(year, state, holidays);
        memoryCache[cacheKey] = holidays;
        return { success: true, data: holidays, source: 'api' };
      }
    } catch (err) {
      console.warn('Calendarific API failed:', err);
    }

    // 4. Fallback (fixed-date holidays only)
    const fallback = this.getFallbackHolidays(year);
    memoryCache[cacheKey] = fallback;
    return { success: true, data: fallback, source: 'fallback' };
  },

  // ─── FIRESTORE READ ───────────────────────────────────────────────
  async _loadFromFirestore(year, state) {
    const docId = state ? `MY_${year}_${state}` : `MY_${year}`;
    const docRef = doc(db, FIRESTORE_COLLECTION, docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data().holidays || [];
    }
    return null;
  },

  // ─── FIRESTORE WRITE ──────────────────────────────────────────────
  async _saveToFirestore(year, state, holidays) {
    const docId = state ? `MY_${year}_${state}` : `MY_${year}`;
    const docRef = doc(db, FIRESTORE_COLLECTION, docId);

    // Convert Date objects to ISO strings for Firestore storage
    const serialized = holidays.map(h => ({
      date: h.date instanceof Date ? h.date.toISOString() : h.date,
      name: h.name,
      localName: h.localName || h.name,
      description: h.description || '',
      type: h.type || [],
      primary: h.primary || 'National holiday',
      global: h.global !== false,
      locations: h.locations || 'All',
    }));

    await setDoc(docRef, {
      country: 'MY',
      year,
      state: state || null,
      holidays: serialized,
      fetchedAt: new Date().toISOString(),
      source: 'calendarific',
    });
  },

  // ─── CALENDARIFIC API ─────────────────────────────────────────────
  async _fetchFromAPI(year, state) {
    if (!API_KEY) {
      throw new Error('REACT_APP_CALENDARIFIC_API_KEY is not set. Please add it to .env and restart the app.');
    }

    const params = {
      api_key: API_KEY,
      country: 'MY',
      year,
    };
    if (state) {
      params.location = `MY-${state}`;
    }

    console.log('Fetching holidays from Calendarific:', { year, state, hasKey: !!API_KEY });
    const response = await axios.get(BASE_URL, { params });
    const raw = response.data.response.holidays;
    console.log('Calendarific response:', raw.length, 'holidays found');

    // Filter: keep National + Common local holidays only
    // Exclude: Observance (Valentine's etc), Season (Ramadan start etc), Local holiday (1 state only)
    const filtered = raw.filter(h =>
      h.type.includes('National holiday') || h.type.includes('Common local holiday')
    );
    console.log('After filtering:', filtered.length, 'actual holidays (excluded observances, seasons, local-only)');

    return filtered.map(h => {
      const isNational = h.type.includes('National holiday');
      return {
        date: new Date(h.date.iso),
        name: h.name,
        localName: h.name,
        description: h.description || '',
        type: h.type || [],
        primary: h.primary_type || 'Holiday',
        global: isNational,
        locations: h.locations || 'All',
      };
    });
  },

  // ─── FORCE REFRESH (admin use) ────────────────────────────────────
  // Call this from admin page to re-fetch from API and overwrite Firestore
  async refreshHolidays(year = new Date().getFullYear(), state = null) {
    const cacheKey = `${year}_${state || 'national'}`;
    delete memoryCache[cacheKey];

    const holidays = await this._fetchFromAPI(year, state);
    if (holidays.length > 0) {
      await this._saveToFirestore(year, state, holidays);
      memoryCache[cacheKey] = holidays;
    }
    return { success: true, data: holidays, source: 'api-refresh' };
  },

  // ─── HELPER FUNCTIONS ─────────────────────────────────────────────

  async getCurrentYearHolidays() {
    return await this.getMalaysiaHolidays(new Date().getFullYear());
  },

  async isPublicHoliday(date) {
    try {
      const result = await this.getMalaysiaHolidays(date.getFullYear());
      if (result.success) {
        return result.data.some(h => h.date.toDateString() === date.toDateString());
      }
      return false;
    } catch (error) {
      console.error('Check holiday error:', error);
      return false;
    }
  },

  async getUpcomingHolidays(days = 30) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const result = await this.getMalaysiaHolidays(today.getFullYear());
      let holidays = result.success ? result.data : [];

      if (futureDate.getFullYear() > today.getFullYear()) {
        const nextYear = await this.getMalaysiaHolidays(futureDate.getFullYear());
        if (nextYear.success) holidays = [...holidays, ...nextYear.data];
      }

      const upcoming = holidays
        .filter(h => h.date >= today && h.date <= futureDate)
        .sort((a, b) => a.date - b.date);

      return { success: true, data: upcoming };
    } catch (error) {
      console.error('Get upcoming holidays error:', error);
      return { success: false, error: error.message };
    }
  },

  async getHolidaysForMonth(year, month) {
    try {
      const result = await this.getMalaysiaHolidays(year);
      if (result.success) {
        const monthHolidays = result.data.filter(h =>
          h.date.getFullYear() === year && h.date.getMonth() === month - 1
        );
        return { success: true, data: monthHolidays };
      }
      return { success: false, error: 'Failed to fetch holidays' };
    } catch (error) {
      console.error('Get holidays for month error:', error);
      return { success: false, error: error.message };
    }
  },

  getFallbackHolidays(year) {
    const holidays = [
      { name: "New Year's Day", month: 0, day: 1 },
      { name: 'Federal Territory Day', month: 1, day: 1 },
      { name: 'Labour Day', month: 4, day: 1 },
      { name: 'Merdeka Day', month: 7, day: 31 },
      { name: 'Malaysia Day', month: 8, day: 16 },
      { name: 'Christmas Day', month: 11, day: 25 },
    ];

    return holidays.map(h => ({
      date: new Date(year, h.month, h.day),
      name: h.name,
      localName: h.name,
      description: '',
      type: ['National holiday'],
      primary: 'National holiday',
      global: true,
    }));
  },

  async getWorkingDaysBetween(startDate, endDate) {
    try {
      const result = await this.getMalaysiaHolidays(startDate.getFullYear());
      const holidayDates = result.success
        ? result.data.map(h => h.date.toDateString())
        : [];

      let workingDays = 0;
      const current = new Date(startDate);

      while (current <= endDate) {
        const day = current.getDay();
        const isWeekend = day === 0 || day === 6;
        const isHoliday = holidayDates.includes(current.toDateString());
        if (!isWeekend && !isHoliday) workingDays++;
        current.setDate(current.getDate() + 1);
      }

      return { success: true, data: workingDays };
    } catch (error) {
      console.error('Get working days error:', error);
      return { success: false, error: error.message };
    }
  },

  formatHoliday(holiday) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return {
      ...holiday,
      formattedDate: holiday.date.toLocaleDateString('en-MY', options),
      dayOfWeek: holiday.date.toLocaleDateString('en-MY', { weekday: 'long' }),
      isWeekend: holiday.date.getDay() === 0 || holiday.date.getDay() === 6,
    };
  },

  async getHolidayCalendar(year = new Date().getFullYear()) {
    try {
      const result = await this.getMalaysiaHolidays(year);
      if (result.success) {
        const calendar = {};
        result.data.forEach(h => {
          const key = h.date.toISOString().split('T')[0];
          calendar[key] = { name: h.name, localName: h.localName, type: 'holiday' };
        });
        return { success: true, data: calendar };
      }
      return { success: false, error: 'Failed to fetch holidays' };
    } catch (error) {
      console.error('Get holiday calendar error:', error);
      return { success: false, error: error.message };
    }
  },

  async getStateHolidays(year, stateCode) {
    return await this.getMalaysiaHolidays(year, stateCode);
  },
};
