export const INTERVAL_TO_COUNT = {
  5: 288,
  15: 96,
  30: 48
} as const;

export type AllowedInterval = keyof typeof INTERVAL_TO_COUNT;
export type AllowedIntervalCount = typeof INTERVAL_TO_COUNT[keyof typeof INTERVAL_TO_COUNT];

export interface ParserState {
  headerData?: string
  lastRecordType?: string
  currentNmi?: string;
  intervalLength?: AllowedInterval;
  readingCount?: AllowedIntervalCount;
}

export interface MeterReading {
  nmi: string;
  timestamp: string; // ISO format or SQL-ready string
  consumption: number;
}

export enum RecordType {
  Header = '100',
  NmiDetails = '200',
  IntervalData = '300',
  IntervalEvent = '400',
  Memo = '500',
  Footer = '900'
}
