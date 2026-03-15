/**
 * Local types extracted from the @f1api/sdk response shapes.
 * The SDK exports response-level types but not the inner data types,
 * so we define our own to use throughout the bot.
 */

export interface SessionSchedule {
  date: string;
  time: string;
}

export interface RaceSchedule {
  race: SessionSchedule;
  qualy: SessionSchedule;
  fp1: SessionSchedule;
  fp2: SessionSchedule | null;
  fp3: SessionSchedule | null;
  sprintQualy: SessionSchedule | null;
  sprintRace: SessionSchedule | null;
}

export interface RaceCircuit {
  circuitId: string;
  circuitName: string;
  country: string;
  city: string;
  circuitLength: string;
  lapRecord: string;
  firstParticipationYear: number;
  corners: number;
  fastestLapDriverId: string;
  fastestLapTeamId: string;
  fastestLapYear: number;
  url: string;
}

export interface RaceWinner {
  driverId: string;
  name: string;
  surname: string;
  country: string;
  birthday: string;
  number: number | null;
  shortName: string | null;
  url: string;
}

export interface RaceTeamWinner {
  teamId: string;
  teamName: string;
  country: string;
  firstAppeareance: number;
  constructorsChampionships: number | null;
  driversChampionships: number | null;
  url: string;
}

export interface Race {
  raceId: string;
  championshipId: string;
  raceName: string;
  schedule: RaceSchedule;
  laps: number;
  round: number;
  url: string;
  fast_lap: {
    fast_lap: string;
    fast_lap_driver_id: string;
    fast_lap_team_id: string;
  };
  circuit: RaceCircuit;
  winner: RaceWinner | null;
  teamWinner: RaceTeamWinner;
}

export interface ResultDriver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  number: number;
  shortName: string;
  birthday: string;
  url: string;
}

export interface ResultTeam {
  teamId: string;
  teamName: string;
  firstAppareance: number;
  constructorsChampionships: number | null;
  driversChampionships: number | null;
  url: string;
}

export interface RaceResult {
  position: number;
  points: number;
  grid: number;
  time: string;
  fastLap: string | null;
  retired: boolean | null;
  driver: ResultDriver;
  team: ResultTeam;
}

export interface QualyResult {
  classificationId: number;
  driverId: string;
  teamId: string;
  q1: string;
  q2: string;
  q3: string;
  gridPosition: number;
  driver: ResultDriver;
  team: ResultTeam;
}

export interface FpResult {
  driverId: string;
  teamId: string;
  time: string;
  driver: ResultDriver;
  team: ResultTeam;
}

export interface SprintQualyResult {
  sprintQualyId: number;
  driverId: string;
  teamId: string;
  sq1: string;
  sq2: string;
  sq3: string;
  gridPosition: number;
  driver: ResultDriver;
  team: ResultTeam;
}

export interface SprintRaceResult {
  sprintRaceId: number;
  driverId: string;
  teamId: string;
  position: number;
  points: number;
  gridPosition: number;
  driver: ResultDriver;
  team: ResultTeam;
}

export interface DriverStanding {
  classificationId: number;
  driverId: string;
  teamId: string;
  points: number;
  position: number;
  wins: number | null;
  driver: {
    name: string;
    surname: string;
    nationality: string;
    birthday: string;
    number: number | null;
    shortName: string | null;
    url: string;
  };
  team: {
    teamId: string;
    teamName: string;
    country: string;
    firstAppareance: number | null;
    constructorsChampionships: number | null;
    driversChampionships: number | null;
    url: string;
  };
}

export interface ConstructorStanding {
  classificationId: number;
  teamId: string;
  points: number;
  position: number;
  wins: number | null;
  team: {
    teamName: string;
    country: string;
    firstAppareance: number | null;
    constructorsChampionships: number | null;
    driversChampionships: number | null;
    url: string;
  };
}

/** Enum for session types used throughout the bot */
export enum SessionType {
  FP1 = 'fp1',
  FP2 = 'fp2',
  FP3 = 'fp3',
  Qualifying = 'qualy',
  SprintQualifying = 'sprintQualy',
  SprintRace = 'sprintRace',
  Race = 'race',
}

/** Human-readable labels for session types */
export const SESSION_LABELS: Record<SessionType, string> = {
  [SessionType.FP1]: 'Free Practice 1',
  [SessionType.FP2]: 'Free Practice 2',
  [SessionType.FP3]: 'Free Practice 3',
  [SessionType.Qualifying]: 'Qualifying',
  [SessionType.SprintQualifying]: 'Sprint Qualifying',
  [SessionType.SprintRace]: 'Sprint Race',
  [SessionType.Race]: 'Race',
};
