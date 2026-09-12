export type LatLng = { lat: number; lng: number };

export type Window = { start: Date; end: Date };

export type Rule = { weekday: number; startTime: string; endTime: string };

export type ExceptionType = "UNAVAILABLE" | "EXTRA";
export type Exception = {
  date: string; // yyyy-MM-dd in trainer tz
  type: ExceptionType;
  startTime?: string | null;
  endTime?: string | null;
};

export type Commute = { seconds: number; meters: number; estimated: boolean };
export type CommuteFn = (from: LatLng, to: LatLng) => Promise<Commute>;

export type SchedulingSettings = {
  timezone: string;
  home: LatLng | null;
  bufferMinutes: number;
  slotStepMinutes: number;
  minNoticeHours: number;
  maxRadiusMiles: number;
};

export type ExistingBooking = {
  id: string;
  start: Date;
  end: Date;
  loc: LatLng;
  status: string;
};

export type Candidate = { start: Date; end: Date; loc: LatLng };

export type Leg = {
  /** What we're travelling from/to: the home base or another booking. */
  anchor: "home" | "booking";
  bookingId?: string;
  travelMin: number;
  requiredMin: number; // travel + buffer
  /** Minutes actually available between the two sessions. Undefined for home legs. */
  gapMin?: number;
  shortfallMin: number; // max(0, required - gap); 0 for home legs
  estimated: boolean;
};

export type SlotEvaluation = {
  ok: boolean; // bookable at all: no overlap, inside availability
  warning: boolean; // bookable but commute is tight
  overlaps: boolean;
  overlapWith?: string;
  outsideAvailability: boolean;
  before?: Leg;
  after?: Leg;
};

export const DURATIONS = [30, 60, 90, 120] as const;
export type Duration = (typeof DURATIONS)[number];
