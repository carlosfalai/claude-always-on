require('dotenv').config();
const { Client } = require('@notionhq/client');

/**
 * Notion Task Monitor
 * Tracks tasks and deadlines
 */

class NotionMonitor {
  constructor() {
    const notionToken = process.env.NOTION_API_TOKEN;

    if (!notionToken) {
      console.warn('⚠️  NOTION_API_TOKEN not found in .env');
      this.notion = null;
      return;
    }

    this.notion = new Client({ auth: notionToken });
    this.databaseId = process.env.NOTION_DATABASE_ID;
  }

  async getTasks() {
    if (!this.notion || !this.databaseId) {
      return {
        tasks: [],
        overdue: [],
        dueSoon: [],
        summary: 'Notion integration pending setup'
      };
    }

    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          and: [
            {
              property: 'Status',
              status: {
                does_not_equal: 'Done'
              }
            }
          ]
        },
        sorts: [
          {
            property: 'Due Date',
            direction: 'ascending'
          }
        ]
      });

      const now = new Date();
      const tasks = response.results.map(page => ({
        id: page.id,
        title: page.properties.Name?.title[0]?.plain_text || 'Untitled',
        status: page.properties.Status?.status?.name || 'Unknown',
        dueDate: page.properties['Due Date']?.date?.start || null
      }));

      const overdue = tasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < now
      );

      const dueSoon = tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return due >= now && due <= tomorrow;
      });

      return {
        tasks,
        overdue,
        dueSoon,
        summary: this.buildSummary(tasks, overdue, dueSoon)
      };

    } catch (error) {
      console.error('Error fetching Notion tasks:', error.message);
      return null;
    }
  }

  buildSummary(tasks, overdue, dueSoon) {
    const parts = [];

    if (overdue.length > 0) {
      parts.push(`⚠️ ${overdue.length} tareas vencidas`);
    }

    if (dueSoon.length > 0) {
      parts.push(`📌 ${dueSoon.length} tareas para mañana`);
    }

    if (parts.length === 0 && tasks.length > 0) {
      parts.push(`✅ ${tasks.length} tareas pendientes`);
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  async getTasksSummary() {
    const data = await this.getTasks();
    if (!data) return null;

    return data.summary;
  }
}

// Export singleton
const monitor = new NotionMonitor();
module.exports = monitor;

// Test if run directly
if (require.main === module) {
  (async () => {
    console.log('🔍 Testing Notion monitor...\n');
    const summary = await monitor.getTasksSummary();
    console.log('\n📊 Result:');
    console.log(summary || 'No tasks');
  })();
}
