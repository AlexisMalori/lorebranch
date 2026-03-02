import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

// Initialize database connection and create table if it doesn't exist
export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'app.db')
  db = new Database(dbPath)
  db.exec('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, content TEXT)')
  db.pragma('journal_mode = WAL') // Enable Write-Ahead Logging for better concurrency

  console.log("Database initialized at", dbPath)
}

// Getter
export function getAllItems() {
    if (!db) throw new Error('Database not initialized')
    return db.prepare('SELECT * FROM items').all()
}

// Setter
export function addItem(name: string, content: any) {
    if (!db) throw new Error('Database not initialized')
    const stmt = db.prepare('INSERT OR REPLACE INTO items (name, content) VALUES (?, ?)')
    const info = stmt.run(name, typeof content === 'string' ? content : JSON.stringify(content))
    return { id: info.lastInsertRowid, name, content }
}

// Batch insert -- makes one disk commit instead of x commits for x items.
export function addManyItems(items: {name: string, content: any}[]) {
    if (!db) throw new Error('Database not initialized')
    const insert = db.prepare('INSERT INTO items (name, content) VALUES (?, ?)')
    db.transaction(() => {
        for (const item of items) {
            insert.run(item.name, item.content)
        }
    })()
}

export function deleteItem(name: string) {
    if (!db) throw new Error('Database not initialized')
    const stmt = db.prepare('DELETE FROM items WHERE name = ?')
    const info = stmt.run(name)
    return { deleted: info.changes > 0, name }
}

// Close function for when the app is quitting to safely deload data.
export function closeDatabase() {
    if (db) {
        db.close()
        db = null
        console.log("Database connection closed")
    }
}