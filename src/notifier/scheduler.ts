import * as schedule from 'node-schedule';
import { MemoryStore } from '../memory/store.js';
import { Learner } from '../agent/learner.js';

export interface ReminderConfig {
  userId: string;
  time: string; // HH:MM format
  message: string;
}

export class Scheduler {
  private store: MemoryStore;
  private learner: Learner;
  private jobs: Map<string, schedule.Job> = new Map();

  constructor(store: MemoryStore, learner: Learner) {
    this.store = store;
    this.learner = learner;
  }

  scheduleReminder(userId: string, time: string): void {
    // Cancel existing job for user
    this.cancelReminder(userId);

    const [hour, minute] = time.split(':').map(Number);
    const rule = new schedule.RecurrenceRule();
    rule.hour = hour;
    rule.minute = minute;

    const jobName = `reminder-${userId}`;

    const job = schedule.scheduleJob(rule, async () => {
      const nextLecture = await this.learner.getNextLecture(userId);
      if (nextLecture) {
        console.log(`\n🔔 Reminder: Time to learn! Next: ${nextLecture}\n`);
        // In a real implementation, this would send a notification
        // through the user's preferred channel (CLI, webhook, etc.)
      }
    });

    if (job) {
      this.jobs.set(jobName, job);
    }
  }

  cancelReminder(userId: string): void {
    const jobName = `reminder-${userId}`;
    const job = this.jobs.get(jobName);
    if (job) {
      job.cancel();
      this.jobs.delete(jobName);
    }
  }

  updateReminderTime(userId: string, time: string): void {
    this.scheduleReminder(userId, time);
    const plan = this.store.getPlanByUser(userId);
    if (plan) {
      this.store.updatePlan(plan.id, { reminderTime: time });
    }
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) {
      job.cancel();
    }
    this.jobs.clear();
  }
}