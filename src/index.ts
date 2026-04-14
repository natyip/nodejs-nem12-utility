import { processFile } from './utils/streamProcessor';
import path from 'path';

const inputFile = process.argv[2];
// Capture the third argument as the batch size
const batchSizeArg = process.argv[3];

if (!inputFile) {
  console.error('Please provide a path to the NEM12 file.');
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), inputFile);
const outputDir = './output/sql_batches';

// Parse the batch size or default to 1000
const maxRows = batchSizeArg ? parseInt(batchSizeArg, 10) : 1000;
if (isNaN(maxRows) || maxRows <= 0) {
  console.error('Error: Batch size must be a positive number.');
  process.exit(1);
}

console.log(`Processing file with batch size: ${maxRows}`);

processFile(fullPath, outputDir, maxRows)
  .then(() => console.log("SQL Generation Complete"))
  .catch(console.error);