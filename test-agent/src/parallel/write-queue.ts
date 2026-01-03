/**
 * Batch Write Queue for Parallel Test Execution
 * Queues database writes and flushes them in batches to reduce SQLite contention
 */

import { EventEmitter } from 'events';

export interface QueuedWrite {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'upsert';
  data: Record<string, any>;
  timestamp: number;
}

export interface WriteQueueOptions {
  flushIntervalMs?: number;  // Default: 500ms
  maxBatchSize?: number;     // Default: 100
  onFlush?: (writes: QueuedWrite[]) => Promise<void>;
}

export interface WriteQueueStats {
  totalQueued: number;
  totalFlushed: number;
  totalBatches: number;
  averageBatchSize: number;
  pendingWrites: number;
  lastFlushAt: Date | null;
  lastFlushDurationMs: number;
}

export class WriteQueue extends EventEmitter {
  private queue: QueuedWrite[] = [];
  private flushIntervalMs: number;
  private maxBatchSize: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing: boolean = false;
  private onFlush: (writes: QueuedWrite[]) => Promise<void>;

  // Stats
  private stats: WriteQueueStats = {
    totalQueued: 0,
    totalFlushed: 0,
    totalBatches: 0,
    averageBatchSize: 0,
    pendingWrites: 0,
    lastFlushAt: null,
    lastFlushDurationMs: 0
  };

  constructor(options: WriteQueueOptions) {
    super();
    this.flushIntervalMs = options.flushIntervalMs ?? 500;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.onFlush = options.onFlush ?? (async () => {});

    this.startFlushTimer();
  }

  /**
   * Queue a write operation
   */
  enqueue(table: string, operation: 'insert' | 'update' | 'upsert', data: Record<string, any>): string {
    const write: QueuedWrite = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      table,
      operation,
      data,
      timestamp: Date.now()
    };

    this.queue.push(write);
    this.stats.totalQueued++;
    this.stats.pendingWrites = this.queue.length;

    // Trigger immediate flush if batch size reached
    if (this.queue.length >= this.maxBatchSize) {
      this.flush().catch(err => this.emit('error', err));
    }

    return write.id;
  }

  /**
   * Queue an insert operation
   */
  insert(table: string, data: Record<string, any>): string {
    return this.enqueue(table, 'insert', data);
  }

  /**
   * Queue an update operation
   */
  update(table: string, data: Record<string, any>): string {
    return this.enqueue(table, 'update', data);
  }

  /**
   * Queue an upsert operation
   */
  upsert(table: string, data: Record<string, any>): string {
    return this.enqueue(table, 'upsert', data);
  }

  /**
   * Flush all queued writes to the database
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const startTime = Date.now();

    // Take all current writes
    const writes = [...this.queue];
    this.queue = [];

    try {
      await this.onFlush(writes);

      // Update stats
      this.stats.totalFlushed += writes.length;
      this.stats.totalBatches++;
      this.stats.averageBatchSize = this.stats.totalFlushed / this.stats.totalBatches;
      this.stats.lastFlushAt = new Date();
      this.stats.lastFlushDurationMs = Date.now() - startTime;
      this.stats.pendingWrites = this.queue.length;

      this.emit('flushed', {
        count: writes.length,
        durationMs: this.stats.lastFlushDurationMs
      });

    } catch (error) {
      // Put writes back in queue on failure
      this.queue = [...writes, ...this.queue];
      this.stats.pendingWrites = this.queue.length;
      this.emit('error', error);
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(err => this.emit('error', err));
    }, this.flushIntervalMs);
  }

  /**
   * Get current queue statistics
   */
  getStats(): WriteQueueStats {
    return { ...this.stats, pendingWrites: this.queue.length };
  }

  /**
   * Get the number of pending writes
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is currently flushing
   */
  get flushing(): boolean {
    return this.isFlushing;
  }

  /**
   * Stop the flush timer and flush remaining writes
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Clear the queue without flushing
   */
  clear(): void {
    this.queue = [];
    this.stats.pendingWrites = 0;
  }
}

/**
 * Create a write queue integrated with the Database class
 */
export function createDatabaseWriteQueue(
  db: any, // Database instance
  options?: Partial<WriteQueueOptions>
): WriteQueue {
  const queue = new WriteQueue({
    flushIntervalMs: options?.flushIntervalMs ?? 500,
    maxBatchSize: options?.maxBatchSize ?? 100,
    onFlush: async (writes: QueuedWrite[]) => {
      if (writes.length === 0) return;

      // Group writes by table for efficient batch processing
      const grouped = new Map<string, QueuedWrite[]>();
      for (const write of writes) {
        const key = `${write.table}:${write.operation}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(write);
      }

      // Execute each group in a transaction
      const transaction = db.getDb?.().transaction?.(() => {
        for (const [key, groupedWrites] of grouped) {
          const [table, operation] = key.split(':');

          for (const write of groupedWrites) {
            switch (operation) {
              case 'insert':
                executeInsert(db, table, write.data);
                break;
              case 'update':
                executeUpdate(db, table, write.data);
                break;
              case 'upsert':
                executeUpsert(db, table, write.data);
                break;
            }
          }
        }
      });

      if (transaction) {
        transaction();
      } else {
        // Fallback: execute without transaction
        for (const write of writes) {
          switch (write.operation) {
            case 'insert':
              executeInsert(db, write.table, write.data);
              break;
            case 'update':
              executeUpdate(db, write.table, write.data);
              break;
            case 'upsert':
              executeUpsert(db, write.table, write.data);
              break;
          }
        }
      }
    }
  });

  return queue;
}

function executeInsert(db: any, table: string, data: Record<string, any>): void {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  db.getDb?.().prepare?.(sql)?.run?.(...values);
}

function executeUpdate(db: any, table: string, data: Record<string, any>): void {
  const { id, ...rest } = data;
  if (!id) return;

  const columns = Object.keys(rest);
  const values = Object.values(rest);
  const setClause = columns.map(col => `${col} = ?`).join(', ');

  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  db.getDb?.().prepare?.(sql)?.run?.(...values, id);
}

function executeUpsert(db: any, table: string, data: Record<string, any>): void {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  const updateClause = columns.map(col => `${col} = excluded.${col}`).join(', ');

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
               ON CONFLICT DO UPDATE SET ${updateClause}`;
  db.getDb?.().prepare?.(sql)?.run?.(...values);
}

// Export singleton instance
let defaultQueue: WriteQueue | null = null;

export function getWriteQueue(): WriteQueue | null {
  return defaultQueue;
}

export function setWriteQueue(queue: WriteQueue): void {
  defaultQueue = queue;
}
