# my-project

A high-performance NEM12 (Interval Metering Data) parser that transforms energy consumption CSV files into batched SQL insert statements. Designed for efficiency, it can process large datasets with minimal memory overhead.

## Technical Decisions

  - **Node.js Streams:** Utilized `readline` and `fs.createReadStream` to maintain O(1) memory consumption, allowing the processing of files larger than the available RAM.
  - **State Machine:** Implemented a context-aware parser to handle the hierarchical relationship between NMI headers (200) and interval data (300).
      - The `ParserState` uses optional properties to track metadata across lines, ensuring that each 300 record is strictly linked to the most recent 200 record's NMI and interval settings.
      - This architecture prevents orphaned data and allows the parser to validate that the number of intervals in a row matches the metadata declared in the header.
  - **TypeScript:** Strict typing ensures data integrity during the CSV-to-SQL transformation and provides a self-documenting codebase.
  - **ESLint & Prettier:** Integrated for automated code quality and formatting. This ensures consistent coding standards and catches common logical errors before execution.
  - **Transactional SQL Output:** The utility generates SQL files wrapped in `BEGIN TRANSACTION;` and `COMMIT;` blocks for several critical reasons:
      - **Atomicity:** Ensures "All or Nothing" ingestion. If a single batch fails, the database rolls back, preventing partial data imports that are difficult to clean up.
      - **Data Integrity:** NEM12 files are stateful; importing half a file could lead to incorrect billing calculations. Transactions ensure the entire meter read period is captured as a single unit.
      - **Performance:** Writing to a database inside a transaction is significantly faster than individual inserts because it reduces disk I/O overhead and avoids the cost of per-insert transaction logging.
  - **Batched Transactions:** Wraps SQL outputs in BEGIN/COMMIT blocks with configurable batch sizes to optimize database ingestion speed and ensure atomicity.

## Prerequisites

  - Node.js (v18.0.0 or higher recommended)
  - npm (comes with Node.js)
  - Docker (optional, for local database testing)

## Installation

1.  Clone the repository:
    git clone [https://github.com/natyip/nodejs-nem12-utility.git](https://github.com/natyip/nodejs-nem12-utility.git)
    cd nodejs-nem12-utility

2.  Install dependencies:
    npm install

## Usage

### Parameters
| Parameter | Required | Description |
| :--- | :--- | :--- |
| `path-to-file` | **Yes** | Relative or absolute path to the `.csv` NEM12 file. |
| `batch-size` | No | Number of rows per `INSERT` statement. **Defaults to 1000**. |

### Development
Run the utility directly from source using `ts-node`:
```bash
npm run dev <path-to-nem12-file> [batch-size]
```

### Production
Compile to JavaScript first for maximum performance, then execute:
```bash
npm run build
npm start <path-to-nem12-file> [batch-size]
```

### Examples

**Using defaults:**
```bash
npm start ./data/meter_reads.csv
```
*Processes the file and generates SQL batches with **1000** rows per insert.*

**Custom batch size:**
```bash
npm start ./data/meter_reads.csv 500
```
*Generates SQL batches with **500** rows per insert, useful for environments with lower memory or strict SQL packet size limits.*

---

### 💡 Why 1000 by default?
A batch size of 1000 is an industry-standard "sweet spot." It is large enough to significantly reduce database overhead (I/O and transaction logging) but small enough to stay well within the default `max_allowed_packet` or memory limits of most PostgreSQL and MySQL configurations.

## Database Integration (Postgres & Docker)

1.  Create a local Postgres instance:
    docker run --name my-postgres-db -e POSTGRES\_PASSWORD=mysecretpassword -p 5432:5432 -d postgres

2.  Initialize the schema:
    docker exec -i my-postgres-db psql -U postgres -c "CREATE TABLE meter\_readings (id SERIAL PRIMARY KEY, nmi VARCHAR(10), timestamp TIMESTAMP, consumption DECIMAL(18, 4));"

3.  Import the generated SQL:
    cat ./output/sql\_batches/data.sql | docker exec -i my-postgres-db psql -U postgres

## Project Structure

├── output/sql_batches/ # Generated .sql files
├── src/
│   ├── core/           # Business logic
│   │   ├── StateMachine.ts  # Handles NEM12 record sequencing
│   │   └── Transformer.ts   # Validates and converts data to SQL objects
│   ├── types/          # TypeScript definitions
│   │   └── nem12.types.ts   # Interfaces for NMI, Readings, and State
│   ├── utils/          # Infrastructure logic
│   │   └── streamProcessor.ts # Handles file streaming and batching
│   └── index.ts        # CLI Entry point and argument parsing
├── .editorconfig       # Consistent IDE spacing/formatting
├── .eslintrc.js        # Linting rules for code quality
├── .gitignore          # Excludes node_modules, output, and CSVs from Git
├── package.json        # Dependencies and scripts
├── README.md           # Documentation
└── tsconfig.json       # TypeScript compiler configuration

## License

This project is licensed under the MIT License.