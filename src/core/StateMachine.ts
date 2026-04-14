import { ParserState, RecordType, MeterReading, INTERVAL_TO_COUNT, AllowedInterval } from '../types/nem12.types';
import { Transformer } from './Transformer';

export class StateMachine {
  private state: ParserState = {};

  public handleLine(line: string): MeterReading[] {
    const cells = line.split(',').map(c => c.trim());
    const type = cells[0];

    switch (type) {
      case RecordType.Header:
        // 100 must be the first line and only appear once
        if (this.state.lastRecordType !== undefined) {
          throw new Error(`Invalid NEM12: 100 record must be the first line. Found at line: "${line}"`);
        }
        this.state.headerData = cells[0];
        this.state.lastRecordType = RecordType.Header;
        return [];

      case RecordType.NmiDetails:
        // 200 must follow a 100, another 300/400/500 block, or a 200 (if empty)
        if (!this.state.headerData) {
          throw new Error(`Invalid NEM12: 200 record found before 100 record.`);
        }
        this.state.currentNmi = cells[1];

        const rawInterval = parseInt(cells[8]) as AllowedInterval;
        if (isNaN(rawInterval) || !(rawInterval in INTERVAL_TO_COUNT)) {
          throw new Error(`Invalid NEM12: Unsupported interval length '${cells[8]}' at line: "${line}"`);
        }

        this.state.intervalLength = rawInterval;
        this.state.readingCount = INTERVAL_TO_COUNT[rawInterval];
        this.state.lastRecordType = RecordType.NmiDetails;
        return [];

      case RecordType.IntervalData:
        // 300 MUST follow a 200 or another 300
        if (this.state.lastRecordType !== RecordType.NmiDetails &&
          this.state.lastRecordType !== RecordType.IntervalData) {
          throw new Error(`Invalid NEM12: 300 record must follow a 200 or 300 record. Found after ${this.state.lastRecordType}`);
        }

        this.state.lastRecordType = RecordType.IntervalData;
        return Transformer.transform300(cells, this.state);

      case RecordType.IntervalEvent: // 400
      case RecordType.Memo:          // 500
        // 400 and 500 must follow a 300 (or each other)
        if (this.state.lastRecordType !== RecordType.IntervalData &&
          this.state.lastRecordType !== RecordType.IntervalEvent &&
          this.state.lastRecordType !== RecordType.Memo) {
          throw new Error(`Invalid NEM12: ${type} record must follow interval data (300).`);
        }
        this.state.lastRecordType = type;
        return [];

      case RecordType.Footer:
        // 900 should be the last record
        if (!this.state.headerData) {
          throw new Error(`Invalid NEM12: 900 record found in empty file.`);
        }
        this.state.lastRecordType = RecordType.Footer;
        return [];

      default:
        throw new Error(`Invalid NEM12: Unknown Record Indicator '${type}' on line: "${line}"`);
    }
  }
}