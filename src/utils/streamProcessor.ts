import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { StateMachine } from '../core/StateMachine';
import { MeterReading } from '../types/nem12.types';

export async function processFile(inputPath: string, outputFolder: string, maxRows: number): Promise<void> {
  // Ensure the output directory exists
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  // Generate output filename based on input (e.g., data.csv -> data.sql)
  const fileName = path.basename(inputPath, path.extname(inputPath)) + '.sql';
  const outputPath = path.join(outputFolder, fileName);
  
  const fileStream = fs.createReadStream(inputPath);
  // Create a Writable Stream for the SQL file
  const sqlStream = fs.createWriteStream(outputPath, { flags: 'w' });
  sqlStream.write("BEGIN TRANSACTION;\n\n");
  const rl = readline.createInterface({
    input: fileStream,
    // new line Compatibility Fix
    crlfDelay: Infinity
  });

  const engine = new StateMachine();
  const maxInsertRows = maxRows //1000 rows is the advised for efficient SQL insert
  let readingBuffer: MeterReading[] = []; // This holds our "pending" rows
  for await (const line of rl) {
    if (!line.trim()) continue;

    // Get readings from the current line 
    const readings = engine.handleLine(line);

    if (readings.length > 0) {
      // Add them to the buffer
      readingBuffer.push(...readings);
    }

    // If buffer hits the limit, flush maxInsertRows from readingBuffer
    if (readingBuffer.length >= maxInsertRows) {
      flushBufferExact(maxInsertRows);
      // flushBufferAll(); //used when wanting to flush in rounds of 300 records
    }
  }

  // Final flush for any leftover readings after the loop ends
  if (readingBuffer.length > 0) {
    flushBufferAll();
  }
  sqlStream.write("\nCOMMIT;");
  sqlStream.end();

  function writeToSqlFile(readings: MeterReading[]) {
    const valueRows = readings.map(r =>
      `('${r.nmi}', '${r.timestamp}', ${r.consumption})`
    );

    const sql = `INSERT INTO meter_readings (nmi, timestamp, consumption) VALUES ${valueRows.join(', ')};\n`;

    sqlStream.write(sql);
  }

  function flushBufferExact(maxInsertRows: number) {
    while (maxInsertRows < readingBuffer.length) {
      writeToSqlFile(readingBuffer.slice(0, maxInsertRows));
      readingBuffer = readingBuffer.slice(maxInsertRows);
    }
  }

  function flushBufferAll() {
    writeToSqlFile(readingBuffer)
    // Clear the buffer for the next batch
    readingBuffer = [];
  }
  // Return a promise that resolves when the file is actually finished writing
  return new Promise((resolve, reject) => {
    sqlStream.on('finish', resolve);
    sqlStream.on('error', reject);
  });
}