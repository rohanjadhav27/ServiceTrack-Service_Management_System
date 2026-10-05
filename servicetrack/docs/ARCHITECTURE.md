# Architecture and business decisions

## Request flow

React form → Express route → authentication/role checks → Zod validation → job service → Mongoose transaction → MongoDB → updated job returned to React.

The backend is authoritative. Disabling buttons is helpful UI feedback, not a substitute for permission or business-rule checks.

## Collections

| Collection | Purpose | Main relationships |
| --- | --- | --- |
| User | Staff identity, password hash, role | Technician assigned to Job |
| Customer | Contact details | Owns Vehicle; referenced by Booking and Job |
| Vehicle | Registration, make, model | Belongs to Customer |
| Slot | Arrival reservation count | Key is date and half-hour slot in IST |
| Booking | Planned arrival and reported concern | Customer, Vehicle, optional Job |
| Part | SKU, unit price in paise, available stock, minimum | Referenced by estimate lines and parts movements |
| Job | Actual service process | Booking, Customer, Vehicle, Technician |
| Purchase | Supplier order, cost snapshots, partial receipts | Part, User |
| StockEvent | Opening/restock/receipt/issue/return movements | Part, Job or Purchase, User |
| Communication | SMTP submission history; not an inbox delivery receipt | Booking or Job, User |
| PaymentOrder | One online test order per invoice | Job, User; unique order reference |

Each Job embeds estimate revisions, approval decisions, parts movements, QC results, invoice snapshot and activity events. This keeps the history of one service visit together. The booking reference is unique so check-in cannot create two jobs for one booking.

## State transitions

| Action | Required state | Result |
| --- | --- | --- |
| Check in | Scheduled booking | Checked-in booking; Under Inspection job |
| Save estimate | Open, pre-QC job with inspection notes | Awaiting Approval; new estimate revision |
| Record approval | Awaiting Approval and pending latest revision | Approved |
| Record rejection | Awaiting Approval and pending latest revision | Under Inspection |
| Start/resume service | Approved / Awaiting Parts | In Service |
| Hold for parts | In Service | Awaiting Parts |
| Submit QC | In Service; approved parts issued | Quality Check |
| Fail QC | Quality Check | In Service |
| Pass QC | Quality Check; every check true | Ready |
| Issue invoice | Ready; QC passed; latest estimate approved | Invoice snapshot created |
| Record payment | Existing unpaid invoice | Full payment recorded |
| Deliver | Ready; QC passed; full payment recorded | Delivered |
| Cancel | Unstarted job with no parts movements or invoice | Cancelled |

Closed jobs reject all further mutations in this version. Revising an estimate always requires another customer decision. Additional work is not authorised by a previous revision's approval.

## Transactions and concurrency

- Slot reservation and booking creation are one transaction. Cancellation reverses the reservation in one transaction.
- Check-in creates one job and updates the booking in one transaction.
- Job actions check the client-provided version against `__v`, with Mongoose optimistic concurrency enabled.
- Issuing a part requires an approved quantity and a conditional stock update with `stock >= requested`.
- That stock change, its movement record and the job version update commit together. A failed operation rolls back all three.
- Mongoose transaction retry handles transient write conflicts. After another user commits, the version check prevents an old request from overwriting it.

## Financial assumptions

Part prices are read from the server catalogue. Clients cannot submit a replacement price for a part. Labour descriptions, hours and rates are advisor inputs, validated on the server. Line amounts are rounded to integer paise. No tax, discount, partial payment or refund is implemented. The full manual payment record cannot be duplicated. Online UPI uses Razorpay TEST orders with server-side HMAC validation and an API check of captured status, amount, currency and method. A payment order reserves the invoice to prevent recording a second manual payment. Reconciliation checks the same provider order after a browser interruption. Test receipts are excluded from dashboard revenue.

## Security boundaries

Passwords are hashed with bcrypt. The session JWT uses an environment secret and lives in an HTTP-only same-site cookie. Staff roles are read from the database on each request. Mutating browser requests reject unrecognised origins. Login and AI endpoints are rate-limited. The AI endpoint accepts only complaint, make and model fields; the structured response is validated before display. Its URL is server configuration, not user input.

This local demonstration does not claim production security. Staff management, revocation, external database authentication, audit-retention policy, backup/restore and full deployment hardening are future work.

## API map

| Method / route | Use |
| --- | --- |
| POST `/api/auth/login` | Sign in |
| GET `/api/auth/me` | Current staff session |
| POST `/api/auth/logout` | Clear session |
| GET/POST `/api/customers` | List/create customer |
| GET/POST `/api/vehicles` | List/register vehicle |
| GET `/api/technicians` | Assignment options |
| GET `/api/slots?day=YYYY-MM-DD` | Capacity and reservation counts |
| GET/POST `/api/bookings` | List/create booking |
| POST `/api/bookings/:id/cancel` | Cancel reservation |
| POST `/api/bookings/:id/check-in` | Create job at arrival |
| GET `/api/jobs` | Advisor jobs or technician's assigned jobs |
| GET `/api/jobs/:id` | Full job card |
| POST `/api/jobs/:id/actions/:action` | Validated job mutation with expected version |
| GET/POST `/api/parts` | List/create parts |
| POST `/api/parts/:id/restock` | Record additional stock |
| POST `/api/ai/intake` | Generate editable intake suggestions |

Actions: `inspect`, `assign`, `estimate`, `decision`, `status`, `parts`, `qc`, `invoice`, `payment`, `deliver`, `cancel`, `reopen`. Reopening a Ready job is allowed only before invoicing and requires a fresh QC before another invoice attempt.

## Added API routes

- PUT `/api/customers/:id`: correct customer contact details.
- GET `/api/integrations`: enabled flags; never exposes secrets.
- GET `/api/jobs/:id/invoice.pdf`: advisor or assigned technician.
- POST `/api/catalogue/import`: add missing sample SKUs without changing existing stock/prices.
- GET `/api/stock-history`: latest 200 movements. Legacy stock does not gain invented opening events.
- GET/POST `/api/purchases`: order history/create; GET `/api/purchases/summary?month=YYYY-MM`.
- POST `/api/purchases/:id/receive`: UUID-idempotent, versioned transaction updating stock and history.
- POST `/api/purchases/:id/cancel`: unchanged order with no receipts only.
- GET/POST `/api/jobs/:id/payment-order`; POST `payment-verify` and `payment-reconcile` under the same job path.
- GET `/api/communications/:kind/:id/preview` and `/history`; POST `/email` requires explicit confirmation and the current customer email. Kind is booking or invoice.

All added write/administration endpoints require advisor role. Neither catalogue descriptions nor AI text can authorise a parts issue; an approved part line is required. Procurement summaries report ordered and received cost, not profit or supplier payments.
