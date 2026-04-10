import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const database_name = "DetoxMove.db";

export interface AppSetting {
  key: string;
  value: string;
}

export interface UserStats {
  date: string;
  coins: number;
  distance: number;
  pushups: number;
  squats: number;
  jumps: number;
  usage_mins: number;
}

class DatabaseService {
  private db: any = null;
  private initPromise: Promise<any> | null = null;

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log("Opening Database...");
        this.db = await SQLite.openDatabase({ name: database_name, location: 'default' });

        // Create Tables in a transaction for better performance and safety
        await new Promise<void>((resolve, reject) => {
          this.db.transaction((tx: any) => {
            tx.executeSql(`
              CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
              );
            `);

            tx.executeSql(`
              CREATE TABLE IF NOT EXISTS daily_stats (
                date TEXT PRIMARY KEY,
                coins INTEGER DEFAULT 0,
                distance REAL DEFAULT 0,
                pushups INTEGER DEFAULT 0,
                usage_mins INTEGER DEFAULT 0,
                squats INTEGER DEFAULT 0,
                jumps INTEGER DEFAULT 0
              );
            `);
          }, (err: any) => {
            console.error("Transaction Error:", err);
            reject(err);
          }, () => {
            resolve();
          });
        });

        // MIGRATION: Tambahkan kolom baru jika diupdate dari versi lama
        try { await this.db.executeSql('ALTER TABLE daily_stats ADD COLUMN usage_mins INTEGER DEFAULT 0'); } catch (e) {}
        try { await this.db.executeSql('ALTER TABLE daily_stats ADD COLUMN squats INTEGER DEFAULT 0'); } catch (e) {}
        try { await this.db.executeSql('ALTER TABLE daily_stats ADD COLUMN jumps INTEGER DEFAULT 0'); } catch (e) {}

        console.log("Database Initialized 🚀");
        return this.db;
      } catch (error) {
        console.error("Database Init Error:", error);
        this.initPromise = null; // Allow retry
        throw error;
      }
    })();

    return this.initPromise;
  }

  // --- SETTINGS (e.g., Restricted Apps) ---
  async setSetting(key: string, value: string) {
    const db = await this.init();
    await db.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  async getSetting(key: string): Promise<string | null> {
    const db = await this.init();
    const [results]: any = await db.executeSql('SELECT value FROM settings WHERE key = ?', [key]);
    if (results.rows.length > 0) {
      return results.rows.item(0).value;
    }
    return null;
  }

  // --- COINS & STATS ---
  private getDateKey() {
    return new Date().toISOString().split('T')[0];
  }

  async updateDailyStats(coins: number, distance: number, pushups: number) {
    try {
      const db = await this.init();
      const date = this.getDateKey();

      await db.executeSql('INSERT OR IGNORE INTO daily_stats (date, coins, distance, pushups, usage_mins) VALUES (?, 0, 0, 0, 0)', [date]);
      await db.executeSql(
        'UPDATE daily_stats SET coins = coins + ?, distance = distance + ?, pushups = pushups + ? WHERE date = ?',
        [coins, distance, pushups, date]
      );
    } catch (error) {
      console.error("Database update error:", error);
      throw error;
    }
  }

  async addRep(mode: string, coins: number) {
    try {
      const db = await this.init();
      const date = this.getDateKey();

      await db.executeSql('INSERT OR IGNORE INTO daily_stats (date, coins, distance, pushups, usage_mins, squats, jumps) VALUES (?, 0, 0, 0, 0, 0, 0)', [date]);
      
      let column = 'pushups';
      if (mode === 'SQUAT') column = 'squats';
      if (mode === 'JUMPINGJACK') column = 'jumps';

      await db.executeSql(
        `UPDATE daily_stats SET coins = coins + ?, ${column} = ${column} + 1 WHERE date = ?`,
        [coins, date]
      );
    } catch (error) {
      console.error("Database addRep error:", error);
      throw error;
    }
  }

  async updateDailyUsage(mins: number) {
    try {
      const db = await this.init();
      const date = this.getDateKey();
      await db.executeSql('INSERT OR IGNORE INTO daily_stats (date, coins, distance, pushups, usage_mins) VALUES (?, 0, 0, 0, 0)', [date]);
      // Set absolute value for usage (since we fetch it as total current today)
      await db.executeSql('UPDATE daily_stats SET usage_mins = ? WHERE date = ?', [mins, date]);
    } catch (error) {
      console.error("Database usage update error:", error);
    }
  }

  async spendCoins(amount: number) {
    try {
      const db = await this.init();
      const date = this.getDateKey();
      // Atomic coin deduction with floor at 0
      await db.executeSql(
        'UPDATE daily_stats SET coins = MAX(0, coins - ?) WHERE date = ?',
        [amount, date]
      );
    } catch (error) {
      console.error("Database spend error:", error);
    }
  }

  async getTodayStats(): Promise<UserStats> {
    const db = await this.init();
    const date = this.getDateKey();
    const [results]: any = await db.executeSql('SELECT * FROM daily_stats WHERE date = ?', [date]);

    if (results && results.rows && results.rows.length > 0) {
      return results.rows.item(0);
    }
    return { date, coins: 0, distance: 0, pushups: 0, squats: 0, jumps: 0, usage_mins: 0 };
  }

  async getLast7DaysStats(): Promise<UserStats[]> {
    const db = await this.init();
    const [results]: any = await db.executeSql(
      'SELECT * FROM daily_stats ORDER BY date DESC LIMIT 14'
    );
    const data: UserStats[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      data.push(results.rows.item(i));
    }
    return data.reverse();
  }

  async getTotalCoins(): Promise<number> {
    const db = await this.init();
    const [results]: any = await db.executeSql('SELECT SUM(coins) as total FROM daily_stats');
    return (results && results.rows && results.rows.length > 0) ? (results.rows.item(0).total || 0) : 0;
  }
}

export default new DatabaseService();
