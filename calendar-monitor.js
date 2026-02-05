require('dotenv').config();
const { google } = require('googleapis');

/**
 * Google Calendar Monitor
 * Checks upcoming events and deadlines
 */

class CalendarMonitor {
  constructor() {
    // Will use OAuth later, for now use API key if available
    this.calendar = null;
  }

  async getUpcomingEvents(hoursAhead = 24) {
    try {
      // TODO: Implement OAuth authentication
      // For now, return placeholder
      const now = new Date();
      const later = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

      console.log(`📅 Checking calendar from ${now.toLocaleString()} to ${later.toLocaleString()}`);

      // Placeholder - will implement OAuth later
      return {
        events: [],
        upcomingSoon: [], // Events in next 30 minutes
        summary: 'Calendar integration pending OAuth setup'
      };

    } catch (error) {
      console.error('Error checking calendar:', error.message);
      return null;
    }
  }

  async getEventsSummary() {
    const data = await this.getUpcomingEvents();
    if (!data || data.events.length === 0) {
      return null;
    }

    const summary = data.events
      .slice(0, 5)
      .map(e => `• ${e.title} at ${e.time}`)
      .join('\n');

    return `📅 Próximos eventos:\n${summary}`;
  }
}

// Export singleton
const monitor = new CalendarMonitor();
module.exports = monitor;

// Test if run directly
if (require.main === module) {
  (async () => {
    console.log('🔍 Testing Calendar monitor...\n');
    const summary = await monitor.getEventsSummary();
    console.log('\n📊 Result:');
    console.log(summary || 'No upcoming events');
  })();
}
