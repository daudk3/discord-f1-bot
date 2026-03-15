/**
 * Persistent state types for tracking what the bot has already posted.
 */

export interface BotState {
  /** Race IDs for which a pre-weekend schedule embed has been posted */
  announcedWeekends: string[];
  /** Session keys (e.g. "race-2025-round3-fp1") for which results have been posted */
  postedResults: string[];
  /** ISO timestamp of last scheduler check */
  lastCheck: string | null;
}

export const DEFAULT_STATE: BotState = {
  announcedWeekends: [],
  postedResults: [],
  lastCheck: null,
};
