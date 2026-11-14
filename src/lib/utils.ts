import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import { z } from 'zod';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

const emailSchema = z.string().trim().email('Please enter a valid email address.');
const promptSchema = z.string().trim().min(5, 'Describe your site in at least 5 characters.');

export function validateEmail(email: string): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = emailSchema.safeParse(email);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid email address.' };
}

export function validatePrompt(prompt: string): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = promptSchema.safeParse(prompt);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'Prompt is too short.' };
}

export function calculateUsagePercent(used: number, max: number): number {
  if (max <= 0) return 0;
  const pct = Math.round((used / max) * 100);
  return Math.max(0, Math.min(100, pct));
}
