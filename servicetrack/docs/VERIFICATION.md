# Verification record — final polish edition

## Passed in the development environment

- Dependency installation and locked React production build.
- Fourteen backend integration tests against a disposable real MongoDB replica set. They cover origin aliases and unrelated-origin rejection; staff permissions and technician job boundaries; slot capacity/cancellation/ownership; duplicate check-in and stale versions; approval-to-delivery lifecycle; revised estimates and parts returns; concurrent stock issuance with rollback; numerical/price validation; AI failure handling; EV charge validation and catalogue import preservation; partial/idempotent goods receipts and monthly totals; reopening with new QC and PDF permissions; payment signature/amount/capture checks and duplicate prevention; confirmed email recipient checks, PDF attachments and failure history.
- Persistent database helper was previously stopped/restarted and a stored record was retained; no database-helper changes were made in this edition.
- Automated Chromium walkthrough passed: advisor sign-in, estimate viewing, both approved parts issued, QC, invoice, manual payment and delivery; new customer and EV registration with model-to-make inference; available-slot booking and confirmation preview; purchase order and partial goods receipt. No browser JavaScript errors were recorded. A 390-pixel mobile dashboard had no page-level horizontal overflow after fixing a table accessibility-label positioning issue. Desktop/mobile screenshots were visually inspected.
- PDF invoice generated through the actual endpoint, rendered to PNG and visually checked for readable content and intact amounts/table layout.
- The source updater was run on a disposable copy of the original release. Existing .env and .data markers were preserved; a repeat update was a no-op; a conflicting local edit was rejected before writing.

## Integration boundaries

Razorpay and SMTP were exercised using controlled mocks. No real email was sent, no payment was made, and no account-backed checkout is claimed. The core app remains usable with both integrations disabled. Real credentials and internet are needed to rehearse the official provider checkout and SMTP delivery. Live-mode keys are intentionally rejected. The email log records submission, not inbox delivery.

AI tests use a controlled model endpoint, not actual Ollama inference. A real model must still be downloaded and tested on the candidate's laptop.

## Candidate laptop checks

- Windows-specific first install, local MongoDB download and restart.
- Your configured SMTP provider and Razorpay TEST account; see INTEGRATIONS.md.
- Physical printing / browser print-dialog behaviour; downloadable PDF rendering was checked here.
- The complete offline core demo after first-time downloads. Online checkout and SMTP require internet.
- Review your own preserved data after applying the updater and practise the story in DEMO_GUIDE.md.
