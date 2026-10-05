# AI-assisted development record

This is a truthful summary of the assistance used in this conversation. It is not evidence that the candidate independently wrote or reviewed every line. Add your own learning and modifications as you work through the project.

## Requirements supplied by the candidate

- Thinqloud assessment: one complete business application, live laptop demonstration, business-process understanding and explainable AI-assisted development.
- Selected Vehicle Service Management after considering another topic.
- Chose MERN based on prior MERN project experience.
- Supplied research covering bookings, job cards, inventory, labour, estimates, approvals, invoicing, QC and delivery.
- Agreed to an optional AI intake assistant after the core workflow.

## Assistance provided

The assistant helped reduce scope, separate booking from job check-in, define workflow transitions, choose backend validation and concurrency controls, generate source code, and write integration tests and setup documentation.

Key choices: approval per estimate revision; parts deducted at issue time; failed QC returns the job to service; full payment required before delivery; invoice prices retained as a snapshot; AI output is a reviewed draft.

## Verification performed during development

- Production React build completed.
- Fourteen backend integration tests passed against a disposable real MongoDB replica set.
- Tested the complete service lifecycle, permissions, slot capacity, stale updates, rejected revisions, competing stock requests, money validation and AI response/failure handling.
- The AI test used a controlled mock endpoint. It does not establish the quality or speed of a real local model.
- Browser verification results are recorded separately in `VERIFICATION.md`.

## Candidate learning log — fill this in yourself

| Date | File / feature reviewed | What I learned | My change and how I tested it |
| --- | --- | --- | --- |
| | | | |

When presenting: describe what the AI helped generate, which business rules you supplied or changed, what you tested, and what you personally understand. Do not claim that you manually wrote all generated code.

## Final polish requested by the candidate

Added linked vehicle suggestions and EV fields; arrival slot grid and confirmation previews; a larger sample parts catalogue; supplier orders, partial receipts and monthly cost summaries; downloadable PDFs and optional SMTP email; official Razorpay TEST UPI checkout with server verification. Separate app OTP was omitted because provider checkout owns authentication. External account credentials were not supplied; payment and email integration tests use controlled mocks.
