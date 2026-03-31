import axios from 'axios';

export const holidayService = {
  // Get Malaysia public holidays for a specific year
  async getMalaysiaHolidays(year = new Date().getFullYear()) {
    try {
      const response = await axios.get(`https://date.nager.at/Api/v3/PublicHolidays/${year}/MY`);
      
      const holidays = response.data.map(holiday => ({
        date: new Date(holiday.date),
        name: holiday.name,
        localName: holiday.localName,
        countryCode: holiday.countryCode,
        fixed: holiday.fixed,
        global: holiday.global,
        counties: holiday.counties,
        types: holiday.types
      }));

      return { success: true, data: holidays };
    } catch (error) {
      console.error('Get Malaysia holidays error:', error);
      
      // Fallback to common Malaysia holidays if API fails
      const fallbackHolidays = this.getFallbackHolidays(year);
      return { success: true, data: fallbackHolidays, fallback: true };
    }
  },

  // Get holidays for current year
  async getCurrentYearHolidays() {
    return await this.getMalaysiaHolidays(new Date().getFullYear());
  },

  // Check if a date is a public holiday
  async isPublicHoliday(date) {
    try {
      const year = date.getFullYear();
      const holidaysResult = await this.getMalaysiaHolidays(year);
      
      if (holidaysResult.success) {
        return holidaysResult.data.some(holiday => {
          return holiday.date.toDateString() === date.toDateString();
        });
      }
      
      return false;
    } catch (error) {
      console.error('Check holiday error:', error);
      return false;
    }
  },

  // Get upcoming holidays (next 30 days)
  async getUpcomingHolidays(days = 30) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const currentYearHolidays = await this.getMalaysiaHolidays(today.getFullYear());
      let holidays = currentYearHolidays.success ? currentYearHolidays.data : [];

      // If the range spans into next year, get next year's holidays too
      if (futureDate.getFullYear() > today.getFullYear()) {
        const nextYearHolidays = await this.getMalaysiaHolidays(futureDate.getFullYear());
        if (nextYearHolidays.success) {
          holidays = [...holidays, ...nextYearHolidays.data];
        }
      }

      // Filter holidays within the date range
      const upcomingHolidays = holidays.filter(holiday => {
        return holiday.date >= today && holiday.date <= futureDate;
      }).sort((a, b) => a.date - b.date);

      return { success: true, data: upcomingHolidays };
    } catch (error) {
      console.error('Get upcoming holidays error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get holidays for a specific month
  async getHolidaysForMonth(year, month) {
    try {
      const holidaysResult = await this.getMalaysiaHolidays(year);
      
      if (holidaysResult.success) {
        const monthHolidays = holidaysResult.data.filter(holiday => {
          return holiday.date.getFullYear() === year && 
                 holiday.date.getMonth() === month - 1; // JavaScript months are 0-indexed
        });

        return { success: true, data: monthHolidays };
      }

      return { success: false, error: 'Failed to fetch holidays' };
    } catch (error) {
      console.error('Get holidays for month error:', error);
      return { success: false, error: error.message };
    }
  },

  // Fallback holidays if API fails
  getFallbackHolidays(year) {
    // Common Malaysia public holidays (dates may vary by year)
    const commonHolidays = [
      { name: "New Year's Day", month: 0, day: 1 },
      { name: "Federal Territory Day", month: 1, day: 1 },
      { name: "Labour Day", month: 4, day: 1 },
      { name: "Malaysia Day", month: 8, day: 16 },
      { name: "Christmas Day", month: 11, day: 25 }
    ];

    return commonHolidays.map(holiday => ({
      date: new Date(year, holiday.month, holiday.day),
      name: holiday.name,
      localName: holiday.name,
      countryCode: 'MY',
      fixed: true,
      global: true,
      counties: null,
      types: ['Public']
    }));
  },

  // Get working days between two dates (excluding weekends and holidays)
  async getWorkingDaysBetween(startDate, endDate) {
    try {
      const holidays = await this.getMalaysiaHolidays(startDate.getFullYear());
      const holidayDates = holidays.success ? 
        holidays.data.map(h => h.date.toDateString()) : [];

      let workingDays = 0;
      const current = new Date(startDate);

      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        const isHoliday = holidayDates.includes(current.toDateString());

        if (!isWeekend && !isHoliday) {
          workingDays++;
        }

        current.setDate(current.getDate() + 1);
      }

      return { success: true, data: workingDays };
    } catch (error) {
      console.error('Get working days error:', error);
      return { success: false, error: error.message };
    }
  },

  // Format holiday for display
  formatHoliday(holiday) {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    return {
      ...holiday,
      formattedDate: holiday.date.toLocaleDateString('en-MY', options),
      dayOfWeek: holiday.date.toLocaleDateString('en-MY', { weekday: 'long' }),
      isWeekend: holiday.date.getDay() === 0 || holiday.date.getDay() === 6
    };
  },

  // Get holiday calendar data for a year (for calendar components)
  async getHolidayCalendar(year = new Date().getFullYear()) {
    try {
      const holidaysResult = await this.getMalaysiaHolidays(year);
      
      if (holidaysResult.success) {
        const calendar = {};
        
        holidaysResult.data.forEach(holiday => {
          const dateKey = holiday.date.toISOString().split('T')[0]; // YYYY-MM-DD format
          calendar[dateKey] = {
            name: holiday.name,
            localName: holiday.localName,
            type: 'holiday'
          };
        });

        return { success: true, data: calendar };
      }

      return { success: false, error: 'Failed to fetch holidays' };
    } catch (error) {
      console.error('Get holiday calendar error:', error);
      return { success: false, error: error.message };
    }
  }
};