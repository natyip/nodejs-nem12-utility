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
```
├── output/sql_batches/ # Generated .sql files
├── src/
│   ├── core/                  # Business logic
│   │   ├── StateMachine.ts    # Handles NEM12 record sequencing
│   │   └── Transformer.ts     # Validates and converts data to SQL objects
│   ├── types/                 # TypeScript definitions
│   │   └── nem12.types.ts     # Interfaces for NMI, Readings, and State
│   ├── utils/                 # Infrastructure logic
│   │   └── streamProcessor.ts # Handles file streaming and batching
│   └── index.ts               # CLI Entry point and argument parsing
├── .editorconfig              # Consistent IDE spacing/formatting
├── .eslintrc.js               # Linting rules for code quality
├── .gitignore                 # Excludes node_modules, output, and CSVs from Git
├── package.json               # Dependencies and scripts
├── README.md                  # Documentation
└── tsconfig.json              # TypeScript compiler configuration
```
---
## Assessment Write Up

### Q1. What is the rationale for the technologies you have decided to use?

* **Node.js & TypeScript:** Chosen for the balance of development speed and type safety. TypeScript’s static analysis is critical for handling NEM12 files, where a single misaligned index in a CSV row could result in massive data corruption. Strict typing ensures that data flows through the pipeline in a predictable shape.
* **Node.js Streams (`fs` & `readline`):** Standard file reading (`fs.readFile`) loads the entire file into RAM, which is a "ticking time bomb" for large datasets. Using native Streams ensures a constant, low-memory footprint (O(1) complexity), allowing the utility to process multi-gigabyte files on a standard machine.
* **ESLint & Prettier:** Integrated to enforce industry-standard "Clean Code" principles. They automate code quality, ensuring the codebase is professional, maintainable, and free of common logical pitfalls like unused variables or inconsistent formatting.
* **Ts-Node:** Used in development to provide a seamless "JIT" (Just-In-Time) execution environment. This removes the friction of a manual build step during the iterative coding process while maintaining full TypeScript support.

### Q2. What would you have done differently if you had more time?

1.  **High-Performance Concurrency & Parallelism:** While the current stream-based approach is memory-efficient, it is CPU-bound on a single thread. I would implement a **Worker Thread pool** or a **Producer-Consumer pattern**. The main thread would stream and chunk the CSV data, while multiple worker threads would handle the CPU-intensive transformation and validation logic in parallel.
2.  **Streamed Database Integration & True Atomicity:** Currently, the utility outputs a `.sql` file. I would implement a direct **Database Sink** (e.g., `pg-promise`) to achieve end-to-end atomicity, wrapping the entire file process in a single global transaction to prevent partial imports and eliminate intermediate disk I/O.
3.  **Resilience & Parsing Continuation:** To handle potential crashes during massive imports, I would implement **Checkpointing**. By tracking the "bytes read" or "line number" in a lightweight state store (like Redis), the parser could resume exactly where it left off after a failure.
4.  **Advanced Error Correction & Schema Validation:**
    * **Zonal Error Handling:** Implement a **Dead Letter Queue (DLQ)**. Valid records would proceed to the DB, while malformed records would be shunted to an `errors.log` for manual review rather than failing the entire process.
    * **Runtime Schema Validation:** Use a library like **Zod** or **Joi** to validate the incoming CSV data against the expected database schema types at the edge of the application.
5.  **Cloud-Native Deployment:** Architect the utility to run as an **Azure Function** or **AWS Lambda** with trigger-based workflows (e.g., an upload to a Blob Storage bucket triggers the processing) and Infrastructure as Code (Terraform) for deployment.
6.  **Further Decoupling & Extensibility:** Abstract the "Sink" layer to implement different **Output Adapters**, allowing the same NEM12 parser to send data to a SQL database, a NoSQL store, or an API endpoint simultaneously.
7.  **Comprehensive Unit & Integration Testing:** Expand the suite to include **Fuzz Testing** (randomized malformed data) and full **Integration Tests** using a Dockerized Postgres instance in the CI/CD pipeline.

### Q3. What is the rationale for the design choices that you have made?

* **State Machine Architecture:** NEM12 files are inherently stateful (a "300" record only makes sense in the context of the preceding "200" record). A State Machine was designed to track the "Active NMI" and "Interval Length." This prevents "orphaned data" and allows the parser to validate records based on their parent metadata before any SQL is generated.
* **Transactional Batching Strategy:** To handle the "High-Velocity" nature of energy data, the system implements a batched SQL injection design:
    * **Reduced Network & I/O Overhead:** Groups multiple records into single multi-row `INSERT` statements to minimize "round-trip" latency.
    * **Atomic BEGIN/COMMIT Blocks:** Ensures "all-or-nothing" ingestion, preventing partial imports from corrupting the database state.
    * **Tunable Throughput:** Exposes `batch-size` as a CLI parameter to optimize the utility for different environments.
* **Separation of Concerns (SoC):** The project structure strictly separates **Core Logic** (State Machine/Transformer) from **Infrastructure** (Stream Processing/IO). This makes the code highly testable in isolation.
* **Strategy for Final Flushes:** Includes a "Final Flush" mechanism to ensure that if the file ends on a partial batch (e.g., 13 records when the batch size is 1000), those records are still captured and committed correctly.

---

## License

This project is licensed under the MIT License.