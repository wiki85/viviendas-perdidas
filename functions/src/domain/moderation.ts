import {
  FLAG_REPORT_THRESHOLD,
  REMOVE_REPORT_THRESHOLD,
  REPORT_TO_CONFIRMATION_RATIO,
} from '../config.js';
import type { ListingStatus } from '../types.js';

export function moderationStatus(confirmations: number, reports: number): ListingStatus {
  if (reports >= REMOVE_REPORT_THRESHOLD) return 'removed';
  if (reports >= FLAG_REPORT_THRESHOLD && reports > confirmations * REPORT_TO_CONFIRMATION_RATIO) {
    return 'flagged';
  }
  return 'active';
}
