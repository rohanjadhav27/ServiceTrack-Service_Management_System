# Optional email and online payment

The core application, PDF downloads, manual payments and procurement work without either integration. Do not paste account secrets into chat or React code. Enter them only in the project-root `.env` and restart the backend. Existing users can copy the new blank settings from `.env.example`; do not replace their whole `.env`.

## Email

Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and MAIL_FROM to values supplied by your mail provider. Common configurations are port 587 with SMTP_SECURE=false (STARTTLS) or 465 with true. Use a provider-issued SMTP/app password where required.

1. Add the customer's correct email under Customers & vehicles; existing details can be edited.
2. After booking, review the confirmation panel. For an invoice, use Email invoice / payment receipt.
3. Verify recipient and content, tick the confirmation, then choose Send email. Invoice emails attach the PDF.
4. Submitted means accepted by the SMTP server, not confirmed inbox delivery. Failed means submission was not confirmed; check provider logs before resending after a timeout.

Without SMTP, Copy message, Open email draft and WhatsApp draft work. Drafts do not send automatically. Download and attach the PDF yourself when using an external email/WhatsApp app; a mailto URL cannot attach files. There is no SMS integration or automatic payment link in an email. The advisor launches checkout from the job invoice while the customer is present. No separate app OTP is needed; provider authentication belongs in the official checkout.

## Razorpay official TEST checkout

1. Create/access your Razorpay account and obtain **Test Mode** API keys from its dashboard.
2. Set RAZORPAY_KEY_ID to your `rzp_test_...` key and RAZORPAY_KEY_SECRET to its matching secret. Live keys are deliberately rejected.
3. Ensure test payment capture settings allow capture. This app marks paid only after Razorpay reports captured status.
4. Restart the backend. Use a Ready job with an issued unpaid invoice. Select Online UPI — Razorpay test checkout and open checkout.
5. Razorpay's official hosted checkout handles its own screens/animation. The app does not imitate them or guarantee a specific animation. UPI options depend on the provider's current test environment. Where a test VPA field is available, Razorpay documents `success@razorpay` and `failure@razorpay` for success/failure simulation.
6. After a successful captured payment the server checks the signature and fetches the actual payment to confirm order, amount, currency and UPI method. The invoice says TEST PAID and the receipt explains that no real funds were received. Test amounts are excluded from dashboard revenue, but allow a complete demo handover.
7. If checkout closes or a callback is interrupted, use Check payment status. Retrying checkout reuses the same order. A started online order blocks manual payment entry so one invoice cannot be paid twice through separate flows.

Internet and valid test credentials are required. Gateway calls were tested with controlled provider responses; an actual account-backed checkout still needs rehearsal on your laptop. No webhook is configured for this localhost demo. Reconciliation is an explicit advisor action.

If creating an order times out, its outcome may be unknown. The app conservatively blocks retries/manual entry to avoid duplicating it. Review the provider dashboard and reconcile with a developer; do not delete PaymentOrder records blindly. Use a separate demonstration job for a manual payment if necessary. A production version would need automated order recovery, webhooks and refund reconciliation.

## Inventory and purchases

Existing users: choose Import sample catalogue in Inventory once. It inserts missing SKUs with **zero stock** and preserves existing prices/quantities. New installations receive this catalogue during seed. Prices, vehicle model suggestions and compatibility notes are illustrative; confirm fitment and your actual workshop prices. Add your own SKU and selling price when appropriate.

Record a purchase order with supplier, quantity and supplier cost. Stock changes only when goods are physically received. Receive partial quantities as needed. Monthly received cost and ordered value are different metrics; neither means paid invoices or profit. Cancelling is allowed only before any receipt. No supplier is contacted and no money is spent by creating a purchase order.

## Official references

- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/
- https://nodemailer.com/smtp
