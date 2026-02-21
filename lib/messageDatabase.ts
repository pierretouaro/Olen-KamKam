import AsyncStorage from '@react-native-async-storage/async-storage';

// Try to import expo-sqlite, but don't fail if it's not available
let SQLite: any = null;
try {
  SQLite = require('expo-sqlite');
} catch (e) {
  console.log('expo-sqlite not available, using AsyncStorage fallback');
}

const CACHE_KEY_PREFIX = 'messages_cache_';
const CONVERSATION_META_PREFIX = 'conversation_meta_';

export interface LocalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  metadata: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  read_by: string;
  sender_username: string;
  sender_full_name: string;
  sender_avatar: string;
  synced: number;
}

class MessageDatabase {
  private db: any = null;
  private initialized = false;
  private useSQLite = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Try to use SQLite if available
    if (SQLite) {
      try {
        this.db = await SQLite.openDatabaseAsync('messages.db');
        
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            content TEXT,
            type TEXT DEFAULT 'text',
            metadata TEXT,
            reply_to TEXT,
            edited_at TEXT,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            read_by TEXT,
            sender_username TEXT,
            sender_full_name TEXT,
            sender_avatar TEXT,
            synced INTEGER DEFAULT 1
          );
          
          CREATE INDEX IF NOT EXISTS idx_messages_conversation 
          ON messages(conversation_id, created_at DESC);
          
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            last_message_at TEXT,
            last_synced TEXT
          );
        `);

        this.useSQLite = true;
        console.log('Using SQLite for message storage');
      } catch (error) {
        console.log('SQLite init failed, using AsyncStorage fallback');
        this.useSQLite = false;
      }
    } else {
      console.log('SQLite not available, using AsyncStorage fallback');
      this.useSQLite = false;
    }

    this.initialized = true;
  }

  async saveMessages(messages: any[], conversationId: string): Promise<void> {
    // Validate inputs
    if (!conversationId || typeof conversationId !== 'string') return;
    if (!Array.isArray(messages) || messages.length === 0) return;
    
    await this.init();

    if (this.useSQLite && this.db) {
      try {
        // Ensure db is still valid
        if (!this.db) {
          throw new Error('SQLite not available');
        }
        
        // Check if db is still valid by trying a simple operation
        let stmt;
        try {
          stmt = await this.db.prepareAsync(`
            INSERT OR REPLACE INTO messages (
              id, conversation_id, sender_id, content, type, metadata,
              reply_to, edited_at, deleted_at, created_at, read_by,
              sender_username, sender_full_name, sender_avatar, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `);
        } catch (prepareError) {
          // Database connection lost, fallback to AsyncStorage
          this.useSQLite = false;
          this.db = null;
          this.initialized = false;
          throw new Error('SQLite not available');
        }

        for (const msg of messages) {
          if (!msg || !msg.id) continue; // Skip invalid messages
          
          await stmt.executeAsync([
            msg.id,
            conversationId,
            msg.sender_id || '',
            msg.content || '',
            msg.type || 'text',
            JSON.stringify(msg.metadata || {}),
            msg.reply_to || null,
            msg.edited_at || null,
            msg.deleted_at || null,
            msg.created_at || new Date().toISOString(),
            JSON.stringify(msg.read_by || []),
            msg.sender?.username || msg.sender_username || '',
            msg.sender?.full_name || msg.sender_full_name || '',
            msg.sender?.avatar_url || msg.sender_avatar || '',
          ]);
        }
        await stmt.finalizeAsync();

        await this.db.runAsync(
          `INSERT OR REPLACE INTO conversations (id, last_synced) VALUES (?, ?)`,
          [conversationId, new Date().toISOString()]
        );
      } catch (error: any) {
        if (error.message === 'SQLite not available') {
          // Continue to AsyncStorage fallback
        } else {
          // Silently fall back to AsyncStorage
        }
      }
    }
    
    if (!this.useSQLite || !this.db) {
      // AsyncStorage fallback - store last 100 messages
      try {
        const existing = await this.getAsyncStorageMessages(conversationId);
        const merged = [...messages, ...existing].reduce((acc, msg) => {
          acc[msg.id] = msg;
          return acc;
        }, {} as any);
        const unique = Object.values(merged).slice(0, 100);
        
        await AsyncStorage.setItem(
          CACHE_KEY_PREFIX + conversationId,
          JSON.stringify(unique)
        );
        await AsyncStorage.setItem(
          CONVERSATION_META_PREFIX + conversationId,
          JSON.stringify({ last_synced: new Date().toISOString() })
        );
      } catch (error) {
        console.error('AsyncStorage save error:', error);
      }
    }
  }

  private async getAsyncStorageMessages(conversationId: string): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEY_PREFIX + conversationId);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async getMessages(
    conversationId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<LocalMessage[]> {
    await this.init();

    // Validate inputs to prevent null pointer exceptions
    if (!conversationId || typeof conversationId !== 'string') {
      return [];
    }

    if (this.useSQLite && this.db) {
      try {
        // Ensure db connection is still valid
        if (!this.db) {
          throw new Error('Database connection lost');
        }
        
        const result = await this.db.getAllAsync(`
          SELECT * FROM messages 
          WHERE conversation_id = ? AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [conversationId, limit, offset]);
        return result || [];
      } catch (error) {
        // Silently fall back to AsyncStorage on SQLite errors
        this.useSQLite = false;
        this.db = null;
      }
    }
    
    if (!this.useSQLite || !this.db) {
      // AsyncStorage fallback
      const messages = await this.getAsyncStorageMessages(conversationId);
      return messages
        .filter((m: any) => !m.deleted_at)
        .slice(offset, offset + limit)
        .map((m: any) => ({
          ...m,
          metadata: JSON.stringify(m.metadata || {}),
          read_by: JSON.stringify(m.read_by || []),
          synced: 1,
        }));
    }
    
    return []; // Fallback if somehow neither branch returns
  }

  async savePendingMessage(message: any): Promise<void> {
    await this.init();

    if (this.useSQLite && this.db) {
      try {
        await this.db.runAsync(`
          INSERT INTO messages (
            id, conversation_id, sender_id, content, type, metadata,
            reply_to, edited_at, deleted_at, created_at, read_by,
            sender_username, sender_full_name, sender_avatar, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          message.id,
          message.conversation_id,
          message.sender_id,
          message.content || '',
          message.type || 'text',
          JSON.stringify(message.metadata || {}),
          message.reply_to || null,
          null,
          null,
          message.created_at,
          JSON.stringify([]),
          message.sender_username || '',
          message.sender_full_name || '',
          message.sender_avatar || '',
        ]);
      } catch (error) {
        console.error('SQLite savePending error:', error);
      }
    }
    // AsyncStorage fallback doesn't need special handling for pending
  }

  async updateMessageId(tempId: string, realId: string): Promise<void> {
    await this.init();

    if (this.useSQLite && this.db) {
      try {
        await this.db.runAsync(`
          UPDATE messages SET id = ?, synced = 1 WHERE id = ?
        `, [realId, tempId]);
      } catch (error) {
        console.error('SQLite updateId error:', error);
      }
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.init();

    if (this.useSQLite && this.db) {
      try {
        await this.db.runAsync(
          `UPDATE messages SET deleted_at = ? WHERE id = ?`,
          [new Date().toISOString(), messageId]
        );
      } catch (error) {
        console.error('SQLite delete error:', error);
      }
    }
  }

  async getLastSyncTime(conversationId: string): Promise<string | null> {
    await this.init();

    if (this.useSQLite && this.db) {
      try {
        const result = await this.db.getFirstAsync(`
          SELECT last_synced FROM conversations WHERE id = ?
        `, [conversationId]);
        return result?.last_synced || null;
      } catch {
        return null;
      }
    } else {
      try {
        const data = await AsyncStorage.getItem(CONVERSATION_META_PREFIX + conversationId);
        return data ? JSON.parse(data).last_synced : null;
      } catch {
        return null;
      }
    }
  }

  async clearConversation(conversationId: string): Promise<void> {
    await this.init();

    if (this.useSQLite && this.db) {
      try {
        await this.db.runAsync(
          `DELETE FROM messages WHERE conversation_id = ?`,
          [conversationId]
        );
        await this.db.runAsync(
          `DELETE FROM conversations WHERE id = ?`,
          [conversationId]
        );
      } catch (error) {
        console.error('SQLite clear error:', error);
      }
    } else {
      await AsyncStorage.removeItem(CACHE_KEY_PREFIX + conversationId);
      await AsyncStorage.removeItem(CONVERSATION_META_PREFIX + conversationId);
    }
  }
}

export const messageDb = new MessageDatabase();
