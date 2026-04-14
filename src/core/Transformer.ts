import { CONNREFUSED } from 'dns';
import { ParserState, MeterReading } from '../types/nem12.types';

export class Transformer {
  /**
   * Converts a 300 record line into an array of MeterReading objects
   * with strict date and consumption validation.
   */
  static transform300(cells: string[], state: ParserState): MeterReading[] {
    const { currentNmi, intervalLength, readingCount } = state as Required<ParserState>;

    // Date Validation: Check format and physical existence
    const dateStr = cells[1]; 
    if (!/^\d{8}$/.test(dateStr)) {
      throw new Error(`[Date Error] Invalid format for date: "${dateStr}". Expected YYYYMMDD.`);
    }

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-indexed
    const day = parseInt(dateStr.substring(6, 8));

    const dateObj = new Date(Date.UTC(year, month, day));
    
    // Check if the date is actually valid (e.g., prevents Feb 31st)
    if (
      dateObj.getUTCFullYear() !== year ||
      dateObj.getUTCMonth() !== month ||
      dateObj.getUTCDate() !== day
    ) {
      throw new Error(`[Date Error] The date "${dateStr}" is not a valid calendar date.`);
    }

    // Column Count Validation
    const endOffset = readingCount + 2;
    if (cells.length < endOffset) {
      throw new Error(
        `[Structure Error] 300 record has insufficient columns. ` +
        `Expected ${endOffset} columns for a ${intervalLength}m interval, but found ${cells.length}.`
      );
    }

    const readings: MeterReading[] = [];
    const consumptionValues = cells.slice(2, endOffset);

    consumptionValues.forEach((val, index) => {
      //Consumption Validation
      const consumption = parseFloat(val);

      if (isNaN(consumption)) {
        throw new Error(`[Data Error] Non-numeric value "${val}" at interval index ${index}.`);
      }

      if (consumption < 0) {
        throw new Error(`[Validation Error] Negative consumption: ${consumption}. Must be >= 0.`);
      }

      // Time Calculation
      // NEM12 standard: Intervals represent the period ENDING at the timestamp.
      const timestamp = new Date(dateObj.getTime());
      timestamp.setUTCMinutes(timestamp.getUTCMinutes() + (index + 1) * intervalLength);

      readings.push({
        nmi: currentNmi,
        timestamp: timestamp.toISOString().replace('T', ' ').substring(0, 19),
        consumption
      });
    });

    return readings;
  }
}