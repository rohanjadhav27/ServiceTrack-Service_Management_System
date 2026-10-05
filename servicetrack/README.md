# ServiceTrack · Final polish edition

A local MERN application for a vehicle workshop: booking → check-in → inspection → estimate → approval → service → quality check → invoice → payment → delivery.

Built for Sarvesh's Thinqloud campus application-development demonstration. The data supplied by the seed script is fictional. This is a demonstration application, not a production deployment.

## Start here on Windows

Install Node.js 22.12 or newer (Node 24 is suitable), extract this folder, and open the **servicetrack** folder in VS Code. Use the VS Code **Command Prompt** terminal if PowerShell blocks `npm.ps1`.

In the project root:

```bash
npm ci
npm run setup
npm run db
```

Wait for `MongoDB ready`. Keep this terminal running. The first installation/start needs internet to download packages and the MongoDB binary. The database helper runs a real local MongoDB replica set and stores records in `.data/mongodb`; it does not require Docker or an Atlas account.

Open a second terminal in the same folder:

```bash
npm run seed
npm run dev
```

Open **http://localhost:5173**. Both terminals must stay open. The configured port accepts both `localhost` and `127.0.0.1`; use one address consistently after signing in.

| Role | Email | Password |
| --- | --- | --- |
| Service advisor | advisor@servicetrack.local | Demo@12345 |
| Technician, Rohan | technician@servicetrack.local | Demo@12345 |
| Technician, Neha | neha@servicetrack.local | Demo@12345 |

These are intentional local demonstration accounts. Do not expose the development server or database to a public network using these credentials. The database and production API bind to loopback by default.

The seed script preserves an existing database; it does not reset your work. Do not delete `.data` unless you deliberately want to remove local data. Keep `.env`, `.data`, and `node_modules` out of Git.

## Run for the interview

Complete the initial setup and model downloads before interview day. Build the frontend once:

```bash
npm run build
```

Then keep `npm run db` open in one terminal and run this in another:

```bash
npm start
```

Open **http://localhost:4000**. Express serves the built React app and API together. No Vite server is needed in this mode. Browser refresh on a job URL is supported. Once packages and MongoDB are cached, the core app uses no external APIs or fonts.

## What works in this version

- Advisor and technician sign-in with role checks and assigned-job access.
- Customer registration, linked make/model suggestions, colours, fuel types, EV intake charge and service history.
- Visual arrival slots in India time: available/full/past, capacity, cancellation, check-in and confirmation drafts.
- Inspection notes, technician assignment and activity history.
- Versioned itemised estimates and advisor-recorded customer approval/rejection.
- Clear approved/issued/remaining parts, labour-only explanations, stock movements and a 36-item sample catalogue.
- Supplier purchase orders, partial goods receipts, purchase history and monthly procurement summaries.
- QC pass/fail; failed checks return the vehicle to servicing.
- Invoice snapshot, PDF download, print view, optional SMTP invoice/receipt email and gated delivery.
- Full manual payments plus official Razorpay TEST checkout for online UPI, verified on the server.
- Optional AI intake drafts with manual review and graceful failure handling.

## Understand the code

| File | Responsibility |
| --- | --- |
| `server/src/models.js` | Mongoose schemas and relationships |
| `server/src/validation.js` | Validate request fields and AI response structure |
| `server/src/app.js` | API routes, authentication endpoints, booking operations and AI request |
| `server/src/auth.js` | Session cookie verification and advisor permission middleware |
| `server/src/job-service.js` | Transactional job actions and business rules |
| `server/src/domain.js` | Status transitions, assignment checks and parts usage calculation |
| `client/src/pages.jsx` | Dashboard and job list |
| `client/src/*-page.jsx` | Customers, booking, inventory and purchasing screens |
| `server/src/purchases.js` | Orders, transactional receipts and procurement analytics |
| `server/src/payments.js` | Server-created orders, HMAC verification and captured-payment reconciliation |
| `server/src/communications.js` | Message previews, confirmed SMTP submission and history |
| `server/src/invoice-pdf.js` | Downloadable invoice PDF |
| `client/src/job-detail.jsx` | Inspection, estimate, service, QC, invoice and activity tabs |
| `client/src/components.jsx` | Shared UI components, form handling and data loading |
| `client/src/api.js` | Browser requests and display formatting |
| `server/test/workflow.test.js` | Integration tests against a disposable real MongoDB replica set |

Start by reading `domain.js`, then follow one action such as `decision` in `job-service.js`, its route in `app.js`, and its form in `job-detail.jsx`.

## Optional AI setup

Install [Ollama](https://ollama.com/download) and download the configured model:

```bash
ollama pull llama3.2:3b
```

Ensure Ollama is running locally. The defaults in `.env` are:

```dotenv
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
```

In an open job's Inspection tab, choose **AI intake suggestions**. Review the generated summary, category, checklist and questions. Choose **Use draft in editable notes**, edit as needed, then save the inspection.

The request includes complaint text, make and model. It does not explicitly include customer/contact/registration fields; avoid typing personal information into the complaint. Output is schema-validated and never directly changes pricing, stock, approval, diagnosis or job status. The endpoint times out after 30 seconds; a cold or slow model can time out, so warm the model before demonstrating it.

AI failure handling and structured output are covered using a mock model endpoint in tests. A real Ollama model still needs to be exercised on your laptop; no model weights are included.

## Verify

```bash
npm test
npm run build
```

Tests use their own temporary database, not your demonstration database. They verify the complete service lifecycle, permissions, slot capacity, approval revisions, stale update rejection, price validation, concurrent stock issuance and AI failure handling.

## Important scope choices

- Slots limit **arrivals**, not bay occupancy or technician duration. Assignment is manual.
- Labour is billed using approved hours × rate; there is no technician timer.
- The advisor records approval method, note and time. This is not a customer digital signature.
- Only full payments are supported. Razorpay TEST mode simulates UPI; live keys, refunds and partial payments are not supported. Test payments are labelled and excluded from dashboard revenue.
- Invoice amounts are stored in paise and prices are frozen when the invoice is issued. Taxes are not configured; invoices are clearly labelled demonstration invoices.
- Work that has already started cannot be cancelled through the initial cancellation flow. If an additional estimate is declined, the advisor must resolve the scope with the customer and prepare an acceptable revision; there is no debt/write-off workflow.
- Estimates, parts movements, QC records and job history are embedded in the job. This is convenient for a small demo; larger workloads would need pagination, additional indexing and archive policies.
- No customer portal, SMS provider, supplier account management, insurance or warranty claims. Email uses your optional SMTP provider. WhatsApp/email draft links require the advisor to review and send. Purchase orders record procurement locally and do not contact suppliers.
- No staff account administration or password-reset flow. Add these before any real deployment, along with HTTPS, database authentication, backups, security review and operational monitoring.
- Records refresh after actions/navigation; booking slots also refresh every 30 seconds and on focus. The server rejects overbooking. No WebSocket push updates.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `npm` is not recognised | Install Node.js and reopen VS Code. |
| PowerShell blocks `npm.ps1` | Switch the terminal profile to Command Prompt, or run `npm.cmd`. |
| MongoDB download fails | Complete the first download on a working internet connection before the demo. |
| `ECONNREFUSED` / no database | Start `npm run db` first and leave that terminal open. |
| MongoDB port already in use | Stop the conflicting local MongoDB service, or configure an existing **replica set** in `MONGODB_URI`. Do not point transactional operations at a standalone server. |
| Replica-set error | Use the included database helper, which configures a one-member replica set. |
| Blank page at port 4000 | Run `npm run build` before `npm start`. During development use port 5173. |
| Sign-in fails | Run the seed once and use the exact demonstration credentials above. |
| Unrecognised request origin | Set `CLIENT_ORIGIN` in the project-root `.env` to your browser's scheme, host and port (for example `http://127.0.0.1:5173`), without a page path. Restart `npm run dev`. Localhost/127.0.0.1 aliases work on the configured port; other ports must be configured explicitly. |
| Slot cannot be booked | Select a future arrival slot in India time that has remaining capacity. |
| Stale-update message | Reload the job and repeat the intended action after reviewing its latest state. |
| AI unavailable | Start Ollama, check the model name, and warm the model. Manual notes still work. |

## References used for implementation

- [Vite setup requirements](https://vite.dev/guide/)
- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
- [Mongoose optimistic concurrency](https://mongoosejs.com/docs/guide.html#optimisticConcurrency)
- [MongoDB replica sets](https://www.mongodb.com/docs/manual/replication/)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)

For existing installations, use the updater instructions in the ZIP root. Do not overwrite `.env` or `.data`. See `docs/INTEGRATIONS.md` for email and payment setup.

See `docs/DEMO_GUIDE.md`, `docs/ARCHITECTURE.md` and `docs/AI_DEVELOPMENT_LOG.md` for interview preparation.
