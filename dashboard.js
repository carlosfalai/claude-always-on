require('dotenv').config();
const express = require('express');
const memorySystem = require('./memory-system');

/**
 * Observability Dashboard
 *
 * Simple web dashboard to monitor:
 * - Bot status (online/offline)
 * - Uptime
 * - Memory stats
 * - Recent check-ins
 * - Active goals
 * - System health
 */

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// Track bot status
let botStatus = {
  online: false,
  startTime: null,
  lastCheckIn: null,
  totalMessages: 0,
  totalCheckIns: 0
};

// Update bot status
function updateStatus(status) {
  Object.assign(botStatus, status);
}

// Dashboard HTML
app.get('/', async (req, res) => {
  const userId = parseInt(process.env.TELEGRAM_USER_ID);

  const [memories, goals, recentConversations, lastCheckIn] = await Promise.all([
    memorySystem.getRelevantMemories(userId, '', 100),
    memorySystem.getGoals(userId),
    memorySystem.getRecentConversations(userId, 20),
    memorySystem.getLastCheckIn(userId)
  ]);

  const uptime = botStatus.startTime
    ? Math.floor((Date.now() - botStatus.startTime) / 1000)
    : 0;

  const lastCheckInTime = lastCheckIn
    ? new Date(lastCheckIn.created_at).toLocaleString()
    : 'Never';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Claude Always-On Dashboard</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f0f;
      color: #fff;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${botStatus.online ? '#00ff00' : '#ff0000'};
      box-shadow: 0 0 10px ${botStatus.online ? '#00ff00' : '#ff0000'};
    }
    .subtitle {
      color: #888;
      margin-bottom: 30px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }
    .card h2 {
      font-size: 14px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .card .value {
      font-size: 36px;
      font-weight: bold;
      color: #fff;
    }
    .card .label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .section {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .section h2 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #fff;
    }
    .goal-item, .memory-item {
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .goal-item .goal-text {
      font-size: 14px;
      margin-bottom: 5px;
    }
    .goal-item .goal-meta {
      font-size: 12px;
      color: #666;
    }
    .memory-item {
      font-size: 14px;
      line-height: 1.5;
    }
    .memory-item .memory-meta {
      font-size: 11px;
      color: #666;
      margin-top: 5px;
    }
    .refresh-btn {
      background: #333;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .refresh-btn:hover {
      background: #444;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <span class="status-indicator"></span>
      Claude Always-On
    </h1>
    <div class="subtitle">24/7 AI Assistant Dashboard</div>

    <div class="grid">
      <div class="card">
        <h2>Status</h2>
        <div class="value">${botStatus.online ? '🟢 Online' : '🔴 Offline'}</div>
        <div class="label">System Status</div>
      </div>

      <div class="card">
        <h2>Uptime</h2>
        <div class="value">${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m</div>
        <div class="label">Running Time</div>
      </div>

      <div class="card">
        <h2>Memories</h2>
        <div class="value">${memories.length}</div>
        <div class="label">Stored Facts</div>
      </div>

      <div class="card">
        <h2>Goals</h2>
        <div class="value">${goals.length}</div>
        <div class="label">Active Goals</div>
      </div>

      <div class="card">
        <h2>Conversations</h2>
        <div class="value">${recentConversations.length}</div>
        <div class="label">Recent Messages</div>
      </div>

      <div class="card">
        <h2>Last Check-in</h2>
        <div class="value" style="font-size: 14px;">${lastCheckInTime}</div>
        <div class="label">Proactive Check</div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 Active Goals</h2>
      ${goals.length === 0 ? '<div style="color: #666;">No active goals</div>' : ''}
      ${goals.map(g => `
        <div class="goal-item">
          <div class="goal-text">${g.goal}</div>
          <div class="goal-meta">
            Status: ${g.progress}
            ${g.deadline ? ` • Deadline: ${new Date(g.deadline).toLocaleDateString()}` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>🧠 Recent Memories</h2>
      ${memories.length === 0 ? '<div style="color: #666;">No memories stored</div>' : ''}
      ${memories.slice(0, 10).map(m => `
        <div class="memory-item">
          ${m.content}
          <div class="memory-meta">
            ${m.category} • ${new Date(m.created_at).toLocaleDateString()}
          </div>
        </div>
      `).join('')}
    </div>

    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
  </div>

  <script>
    // Auto-refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>
  `;

  res.send(html);
});

// API endpoint for status
app.get('/api/status', async (req, res) => {
  const userId = parseInt(process.env.TELEGRAM_USER_ID);

  const [memories, goals, lastCheckIn] = await Promise.all([
    memorySystem.getRelevantMemories(userId, '', 100),
    memorySystem.getGoals(userId),
    memorySystem.getLastCheckIn(userId)
  ]);

  res.json({
    ...botStatus,
    stats: {
      memories: memories.length,
      goals: goals.length,
      lastCheckIn: lastCheckIn ? lastCheckIn.created_at : null
    }
  });
});

// Start dashboard server
function startDashboard() {
  app.listen(PORT, () => {
    console.log(`📊 Dashboard running at http://localhost:${PORT}`);
    updateStatus({ online: true, startTime: Date.now() });
  });
}

module.exports = {
  startDashboard,
  updateStatus
};
