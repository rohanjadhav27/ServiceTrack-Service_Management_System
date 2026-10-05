import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { Booking, Job, Communication } from './models.js';
import { config } from './config.js';
import { advisor } from './auth.js';
import { id } from './validation.js';
import { check, AppError } from './domain.js';
import { invoicePdf } from './invoice-pdf.js';
export const emailEnabled = () => !!(config.smtpHost && config.mailFrom);
export const mailTransport = {
  send: async (message) => {
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    return transport.sendMail(message);
  },
};
async function draft(kind, recordId) {
  if (kind === 'booking') {
    const booking = await Booking.findById(recordId).populate('customer vehicle');
    check(booking, 'Booking not found.', 404);
    check(
      booking.status !== 'Cancelled',
      'This booking is cancelled. Do not send a confirmation.',
      409,
    );
    return {
      to: booking.customer.email || '',
      phone: booking.customer.phone,
      subject: `Booking confirmation - ${booking.vehicle.registration}`,
      text: `Hello ${booking.customer.name},\n\nYour ${booking.serviceType.toLowerCase()} appointment at ${config.workshopName} is confirmed.\nVehicle: ${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.registration})\nDate: ${booking.slot.slice(0, 10)}\nArrival: ${booking.slot.slice(11)} IST\nConcern: ${booking.complaint}\n\nPlease contact the service advisor if your plans change.\n${config.workshopName}`,
    };
  }
  const job = await Job.findById(recordId).populate('customer');
  check(job?.invoice?.number, 'Issue an invoice first.', 404);
  const inv = job.invoice;
  return {
    to: job.customer.email || '',
    phone: job.customer.phone,
    subject: `${inv.payment?.at ? 'Payment receipt' : 'Invoice and payment due'} - ${inv.number}`,
    text: `Hello ${inv.customerName},\n\n${inv.payment?.at ? 'Your payment record and invoice are attached.' : 'Your service invoice is attached. Please contact the advisor to arrange payment.'}\nVehicle: ${inv.registration}\nInvoice: ${inv.number}\nAmount: INR ${(inv.totalPaise / 100).toFixed(2)}\nStatus: ${inv.payment?.testMode ? 'TEST PAID - simulated transaction; no real money' : inv.payment?.at ? 'PAID' : 'UNPAID'}${inv.payment?.reference ? `\nReference: ${inv.payment.reference}` : ''}\n\n${config.workshopName}`,
    attachment: {
      filename: `${inv.number}.pdf`,
      content: await invoicePdf(job),
      contentType: 'application/pdf',
    },
  };
}
const router = Router();
router.use('/communications', advisor);
router.get('/communications/:kind/:id/preview', async (req, res) => {
  id.parse(req.params.id);
  const kind = z.enum(['booking', 'invoice']).parse(req.params.kind);
  const message = await draft(kind, req.params.id);
  res.json({
    to: message.to,
    phone: message.phone,
    subject: message.subject,
    text: message.text,
    attachment: message.attachment?.filename || null,
    canSend: emailEnabled(),
  });
});
router.get('/communications/:kind/:id/history', async (req, res) => {
  id.parse(req.params.id);
  const kind = z.enum(['booking', 'invoice']).parse(req.params.kind);
  res.json(
    await Communication.find({ kind, recordId: req.params.id }).sort({ createdAt: -1 }).limit(20),
  );
});
router.post(
  '/communications/:kind/:id/email',
  rateLimit({ windowMs: 60000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false }),
  async (req, res) => {
    id.parse(req.params.id);
    const kind = z.enum(['booking', 'invoice']).parse(req.params.kind);
    const input = z.object({ to: z.email(), confirmed: z.literal(true) }).parse(req.body);
    check(
      emailEnabled(),
      'Email is not configured. Use Copy message or an email draft, or add SMTP settings.',
      503,
    );
    const message = await draft(kind, req.params.id);
    check(
      input.to === message.to,
      'The recipient has changed. Review the customer email and preview again.',
      409,
    );
    let submitted = false;
    try {
      const result = await mailTransport.send({
        from: config.mailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        attachments: message.attachment ? [message.attachment] : [],
      });
      check(
        result.accepted?.length && !result.rejected?.length,
        'The mail server did not accept the recipient.',
        502,
      );
      submitted = true;
      await Communication.create({
        kind,
        recordId: req.params.id,
        to: message.to,
        subject: message.subject,
        status: 'Submitted',
        messageId: result.messageId,
        by: req.user._id,
      });
      res.json({
        message: 'Email submitted to your mail server. Delivery to the inbox is not yet confirmed.',
      });
    } catch (error) {
      if (submitted)
        return res.json({
          message:
            'The mail server accepted the email, but its history could not be saved. Do not resend without checking your mailbox.',
        });
      await Communication.create({
        kind,
        recordId: req.params.id,
        to: message.to,
        subject: message.subject,
        status: 'Failed',
        error: 'SMTP submission failed',
        by: req.user._id,
      });
      throw new AppError(
        'Email could not be submitted. Check SMTP settings and the recipient address; no delivery is confirmed.',
        502,
      );
    }
  },
);
export default router;
