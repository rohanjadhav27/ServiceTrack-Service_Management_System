# ServiceTrack demonstration

## Five-minute route

1. **Explain the problem (30 seconds).** A small workshop needs to preserve the customer's complaint, approval, parts usage and charges as the vehicle moves through the service process.
2. **Overview (30 seconds).** Sign in as advisor. Point out active jobs, approvals waiting, ready vehicles and low stock.
3. **Booking and check-in (45 seconds).** Open Bookings. A seeded scheduled vehicle is available. Check it in with mileage and a technician. Explain why scheduling and the actual workshop job are separate.
4. **Inspection and approval (60 seconds).** Save inspection findings. Prepare an estimate with a labour line. Record approval only as a demonstration of an already received customer decision. Explain revisions and the approval history.
5. **Service and QC (45 seconds).** Start service, submit for QC, check every item and record findings. If your estimate includes parts, issue exactly those quantities first.
6. **Invoice and delivery (45 seconds).** Issue the invoice. Show that delivery is blocked until payment is recorded. Record a cash payment and confirm delivery.
7. **Explain one exception (30 seconds).** Show a low-stock part or explain how failed QC returns a job to servicing. If asked, demonstrate a rejected estimate with another job.
8. **Optional AI (30 seconds).** Use another open job. Generate an intake draft, explain review and edit before save, and make clear it does not make the repair decision.

Do not depend on AI for the core demo. Run the model once before the interview if you intend to show it.

## Seeded records

- `ST-DEMO001`: approved oil-change job already in service. Issue one engine oil and one oil filter, then complete QC, billing, payment and delivery.
- `ST-DEMO002`: brake-service estimate awaiting customer approval.
- A third vehicle has a scheduled booking ready for check-in.
- The air filter has zero stock; the brake pad set is below its minimum level.
- Rohan's technician account sees the first job; Neha's account sees the second.

## Questions to practise

| Interview question | Points to explain in your own words |
| --- | --- |
| Why did you choose this topic? | Clear business stages, responsibilities, approvals and financial consequences. |
| Why MERN? | Existing familiarity, React forms/components, Express rules, and MongoDB documents holding a job's related history. |
| Why separate booking from job? | A reservation may be cancelled or missed; the job begins at physical check-in. |
| Why not one status field? | Booking, job progress, estimate approval and invoice payment describe different facts. |
| What prevents unauthorised changes? | Verified HTTP-only session cookie; user role loaded server-side; technicians restricted to assigned jobs. |
| What if two technicians issue the last part? | Conditional stock update and job ledger save share a MongoDB transaction; only one can succeed. |
| What if someone clicks twice? | Expected job version blocks stale repeated actions; business rules also reject duplicate invoice/payment/check-in. |
| Why a replica set on a laptop? | The parts-and-job update spans documents and uses MongoDB transactions. A single-member set is sufficient for this demonstration. |
| What if part prices change? | Estimates snapshot unit prices; issued invoices retain their own immutable price snapshot. |
| Why store money in paise? | Use integer minor units for financial totals; labour amounts are rounded to the nearest paise. |
| What if a customer rejects additional work? | Pause; preserve the older approval; revise the proposal after discussion. Do not silently continue or erase issued parts. |
| How does AI help? | It turns a complaint into an editable intake draft and inspection questions. It cannot approve work, charge money, issue parts or confirm diagnosis. |
| What did you test? | Workflow, role restrictions, double actions, capacity, stale updates, negative quantities, invoice totals, competing stock requests and AI failure. |
| What would you improve next? | Customer-confirmed approval, account management, pagination, automated backups and scheduling by job duration. |

## Before leaving for the interview

- Run the app from the extracted folder on your own laptop.
- Keep the laptop plugged in and have the project, terminals and browser ready.
- Rehearse with a fresh booking so you understand each field.
- Verify the app still works when internet access is disconnected after setup.
- Keep screenshots as a fallback, but demonstrate the working application first.
- Read the source for every action you plan to show. Explain the AI assistance honestly.
- Practise aloud at a steady, audible pace. Pause after each important action to explain the business consequence.

## Final polish: extra two-minute demonstration

1. Register Arjun's vehicle. Show make/model suggestions and fuel type. If electric, capture reported battery charge; explain that it is not a diagnostic result.
2. Book tomorrow's available arrival slot and show the confirmation preview. Explain that opening a draft does not mean a message was sent.
3. In the estimate, add a tyre as a **Part**, then add tyre replacement as **Labour**. A description saying “replace tyre” does not reserve or issue a tyre.
4. On Service & QC, point to approved, issued and remaining quantities. Issue parts, then submit for QC. For a labour-only estimate, no parts issue is required.
5. Download the PDF and preview the invoice email. Use manual cash for a reliable offline demonstration; demonstrate Razorpay TEST UPI separately only after rehearsing with your own test keys.
6. In Purchasing, record five filters from a supplier. Receive two: stock rises by two and three remain outstanding. Receive the final three. Show the order history and selected month's received cost. Explain that procurement cost is not revenue/profit.

A simple explanation: “Arjun brings his vehicle to the workshop. Aditi records his concern and books his arrival. Rohan inspects it. Aditi prepares the parts and labour estimate and records Arjun's approval. Rohan completes only the approved work, records parts used and passes quality checks. Aditi downloads the invoice, records or verifies payment and hands the vehicle back. The inventory and purchase history help the workshop know what was used and what to reorder.”
