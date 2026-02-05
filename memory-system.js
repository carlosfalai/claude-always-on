require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Memory System for Claude Always-On
 *
 * Stores:
 * - Semantic memories (facts, preferences, goals)
 * - Conversation history
 * - Check-in logs (to prevent spam)
 * - Goals and their progress
 */

class MemorySystem {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize database tables if they don't exist
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🧠 Initializing memory system...');

    // Create tables using Supabase SQL
    // Note: Run this SQL in Supabase dashboard first:
    /*
    CREATE TABLE IF NOT EXISTS semantic_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id BIGINT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id BIGINT NOT NULL,
      goal TEXT NOT NULL,
      progress TEXT DEFAULT 'not_started',
      deadline TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS check_in_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id BIGINT NOT NULL,
      check_type TEXT NOT NULL,
      message TEXT,
      action_taken TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id BIGINT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      platform TEXT DEFAULT 'telegram',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_semantic_memory_user ON semantic_memory(user_id);
    CREATE INDEX idx_goals_user ON goals(user_id);
    CREATE INDEX idx_check_in_logs_user ON check_in_logs(user_id, created_at DESC);
    CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);
    */

    this.initialized = true;
    console.log('✅ Memory system ready');
  }

  /**
   * Store a semantic memory (fact, preference, goal)
   */
  async storeMemory(userId, content, category = 'general', tags = []) {
    await this.initialize();

    const { data, error } = await supabase
      .from('semantic_memory')
      .insert({
        user_id: userId,
        content,
        category,
        tags
      })
      .select();

    if (error) {
      console.error('Error storing memory:', error);
      return null;
    }

    console.log(`💾 Stored memory: ${content.substring(0, 50)}...`);
    return data[0];
  }

  /**
   * Retrieve relevant memories for context
   */
  async getRelevantMemories(userId, query, limit = 10) {
    await this.initialize();

    // Simple keyword search for now (can upgrade to pgvector semantic search)
    const { data, error } = await supabase
      .from('semantic_memory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error retrieving memories:', error);
      return [];
    }

    return data;
  }

  /**
   * Store a goal
   */
  async storeGoal(userId, goal, deadline = null) {
    await this.initialize();

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        goal,
        deadline
      })
      .select();

    if (error) {
      console.error('Error storing goal:', error);
      return null;
    }

    console.log(`🎯 Stored goal: ${goal}`);
    return data[0];
  }

  /**
   * Get active goals
   */
  async getGoals(userId) {
    await this.initialize();

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error retrieving goals:', error);
      return [];
    }

    return data;
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(goalId, progress) {
    await this.initialize();

    const { data, error } = await supabase
      .from('goals')
      .update({ progress, updated_at: new Date().toISOString() })
      .eq('id', goalId)
      .select();

    if (error) {
      console.error('Error updating goal:', error);
      return null;
    }

    return data[0];
  }

  /**
   * Log a check-in
   */
  async logCheckIn(userId, checkType, message, actionTaken) {
    await this.initialize();

    const { data, error } = await supabase
      .from('check_in_logs')
      .insert({
        user_id: userId,
        check_type: checkType,
        message,
        action_taken: actionTaken
      })
      .select();

    if (error) {
      console.error('Error logging check-in:', error);
      return null;
    }

    return data[0];
  }

  /**
   * Get last check-in time
   */
  async getLastCheckIn(userId) {
    await this.initialize();

    const { data, error } = await supabase
      .from('check_in_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error getting last check-in:', error);
      return null;
    }

    return data[0];
  }

  /**
   * Store conversation message
   */
  async storeConversation(userId, role, content, platform = 'telegram') {
    await this.initialize();

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        role,
        content,
        platform
      })
      .select();

    if (error) {
      console.error('Error storing conversation:', error);
      return null;
    }

    return data[0];
  }

  /**
   * Get recent conversation history
   */
  async getRecentConversations(userId, limit = 20) {
    await this.initialize();

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error retrieving conversations:', error);
      return [];
    }

    // Return in chronological order (oldest first)
    return data.reverse();
  }

  /**
   * Build context for Claude from memory
   */
  async buildContext(userId, currentMessage = '') {
    await this.initialize();

    const [memories, goals, recentConversations] = await Promise.all([
      this.getRelevantMemories(userId, currentMessage, 5),
      this.getGoals(userId),
      this.getRecentConversations(userId, 10)
    ]);

    let context = '';

    if (memories.length > 0) {
      context += '**Things I remember about you:**\n';
      memories.forEach(m => {
        context += `- ${m.content}\n`;
      });
      context += '\n';
    }

    if (goals.length > 0) {
      context += '**Your current goals:**\n';
      goals.forEach(g => {
        context += `- ${g.goal} (${g.progress})\n`;
      });
      context += '\n';
    }

    if (recentConversations.length > 0) {
      context += '**Recent conversation:**\n';
      recentConversations.forEach(c => {
        context += `${c.role}: ${c.content.substring(0, 100)}...\n`;
      });
    }

    return context;
  }
}

module.exports = new MemorySystem();
