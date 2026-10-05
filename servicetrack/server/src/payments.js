import { Router } from 'express';
import mongoose from 'mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Job, PaymentOrder, Customer } from './models.js';
import { config } from './config.js';
import { advisor } from './auth.js';
import { id } from './validation.js';
import { check, record, AppError } from './domain.js';
export const razorpayEnabled = () =>
  config.razorpayKey.startsWith('rzp_test_') && !!config.razorpaySecret;
async function provider(path, body) {
  check(
    razorpayEnabled(),
    'Configure Razorpay TEST keys on the server to enable checkout. Live keys are not accepted by this demo.',
    503,
  );
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.razorpayKey}:${config.razorpaySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      'Razorpay could not be reached. Payment has not been marked as received.',
      503,
    );
  }
  const result = await response.json();
  check(
    response.ok,
    'Razorpay rejected the request. Check your test keys and payment settings.',
    502,
  );
  return result;
}
// Dependency boundary used by tests. Production always calls Razorpay's official API.
export const paymentProvider = {
  createOrder: (body) => provider('/orders', body),
  getPayment: (paymentId) => provider(`/payments/${paymentId}`),
  getOrderPayments: (orderId) => provider(`/orders/${orderId}/payments`),
};
async function recordCaptured(order, payment, user) {
  check(
    payment.order_id === order.orderId &&
      payment.amount === order.amountPaise &&
      payment.currency === 'INR',
    'Payment does not match this invoice.',
    400,
  );
  check(payment.method === 'upi', 'This checkout supports UPI test payments only.', 400);
  check(
    payment.status === 'captured' && payment.captured === true,
    'Payment is not captured yet. Use Check payment status after capture; the invoice remains unpaid.',
    409,
  );
  await mongoose.connection.transaction(async (session) => {
    const job = await Job.findById(order.job).session(session);
    check(job?.invoice?.number, 'Invoice not found.', 404);
    if (job.invoice.payment?.at) {
      check(
        job.invoice.payment.reference === payment.id,
        'Invoice has a different recorded payment.',
        409,
      );
      return;
    }
    check(
      job.status === 'Ready' && job.invoice.totalPaise === payment.amount,
      'Invoice is not ready for this payment.',
      409,
    );
    job.invoice.payment = {
      method: 'UPI (Razorpay test)',
      provider: 'Razorpay',
      testMode: true,
      reference: payment.id,
      amountPaise: payment.amount,
      at: new Date(),
      recordedBy: user._id,
    };
    record(
      job,
      user,
      'Razorpay test payment verified',
      `${payment.id} · Simulated payment; no real money`,
    );
    await job.save({ session });
    await PaymentOrder.updateOne(
      { _id: order._id },
      { $set: { state: 'Paid', paymentId: payment.id } },
      { session },
    );
  });
}
const router = Router();
router.use(
  ['/jobs/:id/payment-order', '/jobs/:id/payment-verify', '/jobs/:id/payment-reconcile'],
  advisor,
);
router.get('/jobs/:id/payment-order', async (req, res) => {
  id.parse(req.params.id);
  const order = await PaymentOrder.findOne({ job: req.params.id });
  res.json(order ? { orderId: order.orderId, state: order.state } : null);
});
router.post('/jobs/:id/payment-order', async (req, res) => {
  id.parse(req.params.id);
  check(
    razorpayEnabled(),
    'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET test credentials in .env, then restart the backend.',
    503,
  );
  let order = await PaymentOrder.findOne({ job: req.params.id });
  const job = await Job.findById(req.params.id);
  check(job?.invoice?.number, 'Issue the invoice first.');
  check(
    !job.invoice.payment?.at && job.status === 'Ready',
    'This invoice is not awaiting payment.',
    409,
  );
  check(job.invoice.totalPaise > 0, 'A zero-value invoice does not need gateway checkout.');
  if (!order) {
    await mongoose.connection.transaction(async (session) => {
      const current = await Job.findById(job._id).session(session);
      check(!current.invoice.payment?.at, 'Payment already recorded.', 409);
      [order] = await PaymentOrder.create(
        [{ job: job._id, amountPaise: current.invoice.totalPaise, createdBy: req.user._id }],
        { session },
      );
      record(
        current,
        req.user,
        'Razorpay test checkout started',
        'Invoice reserved for online test payment',
      );
      await current.save({ session });
    });
    try {
      const created = await paymentProvider.createOrder({
        amount: order.amountPaise,
        currency: 'INR',
        receipt: String(order._id),
        partial_payment: false,
        notes: { invoice: job.invoice.number },
      });
      check(
        /^order_[a-zA-Z0-9]+$/.test(created.id) &&
          created.amount === order.amountPaise &&
          created.currency === 'INR',
        'Invalid order response.',
        502,
      );
      order.orderId = created.id;
      order.state = 'Created';
      await order.save();
    } catch (error) {
      await PaymentOrder.updateOne({ _id: order._id }, { $set: { state: 'Unknown' } });
      throw error;
    }
  }
  check(
    order.state === 'Created' && order.orderId,
    'A payment order is still being created or its outcome is uncertain. Check the Razorpay test dashboard before retrying; no payment has been recorded.',
    409,
  );
  const customer = await Customer.findById(job.customer);
  res.json({
    key: config.razorpayKey,
    orderId: order.orderId,
    amount: order.amountPaise,
    currency: 'INR',
    name: config.workshopName,
    description: `TEST ${job.invoice.number}`,
    customer: { name: customer.name, email: customer.email || '', contact: customer.phone },
  });
});
router.post('/jobs/:id/payment-verify', async (req, res) => {
  id.parse(req.params.id);
  check(razorpayEnabled(), 'Razorpay test checkout is not configured.', 503);
  const input = z
    .object({
      razorpay_order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
      razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
      razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
    })
    .parse(req.body);
  const order = await PaymentOrder.findOne({ job: req.params.id });
  check(
    order?.orderId === input.razorpay_order_id,
    'Payment order does not belong to this job.',
    400,
  );
  const expected = createHmac('sha256', config.razorpaySecret)
    .update(`${order.orderId}|${input.razorpay_payment_id}`)
    .digest();
  check(
    timingSafeEqual(expected, Buffer.from(input.razorpay_signature, 'hex')),
    'Payment signature verification failed.',
    400,
  );
  await recordCaptured(
    order,
    await paymentProvider.getPayment(input.razorpay_payment_id),
    req.user,
  );
  res.json({ message: 'Razorpay test payment verified. No real money was charged.' });
});
router.post('/jobs/:id/payment-reconcile', async (req, res) => {
  id.parse(req.params.id);
  check(razorpayEnabled(), 'Razorpay test checkout is not configured.', 503);
  const order = await PaymentOrder.findOne({ job: req.params.id });
  check(order?.orderId, 'No known Razorpay order to check.', 409);
  const result = await paymentProvider.getOrderPayments(order.orderId);
  const payment = result.items?.find((p) => p.status === 'captured');
  check(payment, 'No captured payment found. The invoice remains unpaid.', 409);
  await recordCaptured(order, payment, req.user);
  res.json({ message: 'Captured test payment verified.' });
});
export default router;
