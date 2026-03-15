/**
 * Centralized F1 data service.
 * All @f1api/sdk usage is isolated here so the rest of the bot
 * never touches the SDK directly.
 */

import { F1Api } from '@f1api/sdk';
import { cache, CACHE_TTL } from '../utils/cache';
import { logger } from '../utils/logger';
import {
  Race,
  RaceResult,
  QualyResult,
  FpResult,
  SprintRaceResult,
  SprintQualyResult,
  DriverStanding,
  ConstructorStanding,
  SessionType,
} from '../types/f1';

const f1 = new F1Api();

// ─── Race info ────────────────────────────────────────────────

export async function getNextRace(): Promise<Race | null> {
  const cached = cache.get<Race>('next-race');
  if (cached) return cached;

  try {
    const res = await f1.getNextRace();
    const race = res.race?.[0] ?? null;
    if (race) cache.set('next-race', race, CACHE_TTL.NEXT_RACE);
    return race as Race | null;
  } catch (err) {
    logger.error('Failed to fetch next race', { error: String(err) });
    return null;
  }
}

export async function getLastRace(): Promise<Race | null> {
  const cached = cache.get<Race>('last-race');
  if (cached) return cached;

  try {
    const res = await f1.getLastRace();
    const race = res.race?.[0] ?? null;
    if (race) cache.set('last-race', race, CACHE_TTL.LAST_RACE);
    return race as Race | null;
  } catch (err) {
    logger.error('Failed to fetch last race', { error: String(err) });
    return null;
  }
}

export async function getCurrentRaces(): Promise<Race[]> {
  const cached = cache.get<Race[]>('current-races');
  if (cached) return cached;

  try {
    const res = await f1.getCurrentRaces({ limit: 30 });
    const races = (res.races ?? []) as Race[];
    cache.set('current-races', races, CACHE_TTL.ALL_RACES);
    return races;
  } catch (err) {
    logger.error('Failed to fetch current races', { error: String(err) });
    return [];
  }
}

export async function getRaceInfo(year: number, round: number): Promise<Race | null> {
  try {
    const res = await f1.getRaceInfo({ year, round });
    return (res.race?.[0] ?? null) as Race | null;
  } catch (err) {
    logger.error('Failed to fetch race info', { error: String(err), year, round });
    return null;
  }
}

// ─── Race results ─────────────────────────────────────────────

export async function getLastRaceResults(): Promise<{ raceName: string; results: RaceResult[] } | null> {
  const cached = cache.get<{ raceName: string; results: RaceResult[] }>('last-race-results');
  if (cached) return cached;

  try {
    const res = await f1.getLastRaceResults({ limit: 25 });
    const data = {
      raceName: res.races?.raceName ?? 'Unknown',
      results: (res.races?.results ?? []) as RaceResult[],
    };
    cache.set('last-race-results', data, CACHE_TTL.RACE_RESULTS);
    return data;
  } catch (err) {
    logger.error('Failed to fetch last race results', { error: String(err) });
    return null;
  }
}

export async function getRaceResults(year: number, round: number): Promise<RaceResult[]> {
  try {
    const res = await f1.getRaceResults({ year, round, limit: 25 });
    return (res.races?.results ?? []) as RaceResult[];
  } catch (err) {
    logger.error('Failed to fetch race results', { error: String(err), year, round });
    return [];
  }
}

// ─── Session results (for scheduler posting) ─────────────────

export async function getSessionResults(
  sessionType: SessionType,
  year: number,
  round: number,
): Promise<{ lines: string[]; available: boolean }> {
  const {
    formatRaceResultLines,
    formatQualyResultLines,
    formatFpResultLines,
    formatSprintRaceResultLines,
    formatSprintQualyResultLines,
  } = await import('../utils/format');

  try {
    switch (sessionType) {
      case SessionType.FP1: {
        const res = await f1.getFp1Results({ year, round, limit: 25 });
        const results = (res.races?.fp1Results ?? []) as FpResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatFpResultLines(results), available: true };
      }
      case SessionType.FP2: {
        const res = await f1.getFp2Results({ year, round, limit: 25 });
        const results = (res.races?.fp2Results ?? []) as FpResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatFpResultLines(results), available: true };
      }
      case SessionType.FP3: {
        const res = await f1.getFp3Results({ year, round, limit: 25 });
        const results = (res.races?.fp3Results ?? []) as FpResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatFpResultLines(results), available: true };
      }
      case SessionType.Qualifying: {
        const res = await f1.getQualyResults({ year, round, limit: 25 });
        const results = (res.races?.qualyResults ?? []) as QualyResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatQualyResultLines(results), available: true };
      }
      case SessionType.SprintQualifying: {
        const res = await f1.getSprintQualyResults({ year, round, limit: 25 });
        const results = (res.races?.sprintQualyResults ?? []) as SprintQualyResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatSprintQualyResultLines(results), available: true };
      }
      case SessionType.SprintRace: {
        const res = await f1.getSprintRaceResults({ year, round, limit: 25 });
        const results = (res.races?.sprintRaceResults ?? []) as SprintRaceResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatSprintRaceResultLines(results), available: true };
      }
      case SessionType.Race: {
        const res = await f1.getRaceResults({ year, round, limit: 25 });
        const results = (res.races?.results ?? []) as RaceResult[];
        if (results.length === 0) return { lines: [], available: false };
        return { lines: formatRaceResultLines(results), available: true };
      }
      default:
        return { lines: [], available: false };
    }
  } catch (err) {
    logger.error('Failed to fetch session results', {
      error: String(err),
      sessionType,
      year,
      round,
    });
    return { lines: [], available: false };
  }
}

// ─── Standings ────────────────────────────────────────────────

export async function getCurrentDriverStandings(): Promise<{
  season: string | number;
  standings: DriverStanding[];
} | null> {
  const cached = cache.get<{ season: string | number; standings: DriverStanding[] }>('driver-standings');
  if (cached) return cached;

  try {
    const res = await f1.getCurrentDriverStandings({ limit: 25 });
    const data = {
      season: res.season ?? 'Current',
      standings: (res.drivers_championship ?? []) as DriverStanding[],
    };
    cache.set('driver-standings', data, CACHE_TTL.STANDINGS);
    return data;
  } catch (err) {
    logger.error('Failed to fetch driver standings', { error: String(err) });
    return null;
  }
}

export async function getCurrentConstructorStandings(): Promise<{
  season: string | number;
  standings: ConstructorStanding[];
} | null> {
  const cached = cache.get<{ season: string | number; standings: ConstructorStanding[] }>('constructor-standings');
  if (cached) return cached;

  try {
    const res = await f1.getCurrentConstructorStandings({ limit: 15 });
    const data = {
      season: res.season ?? 'Current',
      standings: (res.constructors_championship ?? []) as ConstructorStanding[],
    };
    cache.set('constructor-standings', data, CACHE_TTL.STANDINGS);
    return data;
  } catch (err) {
    logger.error('Failed to fetch constructor standings', { error: String(err) });
    return null;
  }
}

export async function getDriverStandingsByYear(year: number): Promise<{
  season: string | number;
  standings: DriverStanding[];
} | null> {
  try {
    const res = await f1.getDriverStandings({ year, limit: 30 });
    return {
      season: res.season ?? year,
      standings: (res.drivers_championship ?? []) as DriverStanding[],
    };
  } catch (err) {
    logger.error('Failed to fetch driver standings by year', { error: String(err), year });
    return null;
  }
}

export async function getConstructorStandingsByYear(year: number): Promise<{
  season: string | number;
  standings: ConstructorStanding[];
} | null> {
  try {
    const res = await f1.getConstructorStandings({ year, limit: 15 });
    return {
      season: res.season ?? year,
      standings: (res.constructors_championship ?? []) as ConstructorStanding[],
    };
  } catch (err) {
    logger.error('Failed to fetch constructor standings by year', { error: String(err), year });
    return null;
  }
}

// ─── Prediction-specific data accessors ──────────────────────

/**
 * Get current season drivers for prediction autocomplete.
 * Returns simplified list: { driverId, shortName, name, surname, teamName }.
 */
export async function getCurrentDriversList(): Promise<
  { driverId: string; shortName: string; name: string; surname: string; nationality: string; teamName: string }[]
> {
  const cached = cache.get<{ driverId: string; shortName: string; name: string; surname: string; nationality: string; teamName: string }[]>('current-drivers-list');
  if (cached) return cached;

  try {
    const standings = await getCurrentDriverStandings();
    if (!standings) return [];
    const list = standings.standings.map((s) => ({
      driverId: s.driverId,
      shortName: s.driver?.shortName ?? '',
      name: s.driver?.name ?? '',
      surname: s.driver?.surname ?? '',
      nationality: s.driver?.nationality ?? '',
      teamName: s.team?.teamName ?? '',
    }));
    cache.set('current-drivers-list', list, CACHE_TTL.STANDINGS);
    return list;
  } catch (err) {
    logger.error('Failed to fetch current drivers list', { error: String(err) });
    return [];
  }
}

/**
 * Get qualifying results for a specific round (used for pole position scoring).
 */
export async function getQualyResults(year: number, round: number): Promise<QualyResult[]> {
  try {
    const res = await f1.getQualyResults({ year, round, limit: 25 });
    return (res.races?.qualyResults ?? []) as QualyResult[];
  } catch (err) {
    logger.error('Failed to fetch qualy results', { error: String(err), year, round });
    return [];
  }
}

/**
 * Get sprint qualifying results for a specific round.
 */
export async function getSprintQualyResults(year: number, round: number): Promise<SprintQualyResult[]> {
  try {
    const res = await f1.getSprintQualyResults({ year, round, limit: 25 });
    return (res.races?.sprintQualyResults ?? []) as SprintQualyResult[];
  } catch (err) {
    logger.error('Failed to fetch sprint qualy results', { error: String(err), year, round });
    return [];
  }
}

/**
 * Get sprint race results for a specific round.
 */
export async function getSprintRaceResults(year: number, round: number): Promise<SprintRaceResult[]> {
  try {
    const res = await f1.getSprintRaceResults({ year, round, limit: 25 });
    return (res.races?.sprintRaceResults ?? []) as SprintRaceResult[];
  } catch (err) {
    logger.error('Failed to fetch sprint race results', { error: String(err), year, round });
    return [];
  }
}
