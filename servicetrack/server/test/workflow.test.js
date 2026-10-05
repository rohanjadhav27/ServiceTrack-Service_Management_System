import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createHmac, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { paymentProvider } from '../src/payments.js';
import { mailTransport } from '../src/communications.js';
import { createServer } from 'node:http';
import app from '../src/app.js';
import { config } from '../src/config.js';
import {
  User,
  Customer,
  Vehicle,
  Booking,
  Slot,
  Job,
  Part,
  Purchase,
  StockEvent,
  PaymentOrder,
  Communication,
} from '../src/models.js';

let db,
  advisor,
  technician,
  other,
  customer,
  vehicle,
  part,
  agent,
  techAgent,
  otherAgent,
  seq = 0;
const tomorrow = new Date(Date.now() + 86400000 + 19800000).toISOString().slice(0, 10);
before(async () => {
  config.secret = 'integration-test-secret-that-is-long-enough';
  db = await MongoMemoryReplSet.create({
    instanceOpts: [{ args: process.platform === 'win32' ? [] : ['--nounixsocket'] }],
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(db.getUri('servicetrack_test'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const passwordHash = await bcrypt.hash('Test@12345', 4);
  [advisor, technician, other] = await User.create([
    { name: 'Advisor', email: 'advisor@test.local', passwordHash, role: 'advisor' },
    { name: 'Technician', email: 'tech@test.local', passwordHash, role: 'technician' },
    { name: 'Other', email: 'other@test.local', passwordHash, role: 'technician' },
  ]);
  customer = await Customer.create({ name: 'Test Owner', phone: '9000000000' });
  vehicle = await Vehicle.create({
    customer: customer._id,
    registration: 'TEST001',
    make: 'Honda',
    model: 'Shine',
  });
  part = await Part.create({
    sku: 'OIL',
    name: 'Engine oil',
    pricePaise: 45000,
    stock: 20,
    minimum: 2,
  });
  [agent, techAgent, otherAgent] = [request.agent(app), request.agent(app), request.agent(app)];
  for (const [client, email] of [
    [agent, advisor.email],
    [techAgent, technician.email],
    [otherAgent, other.email],
  ])
    await client.post('/api/auth/login').send({ email, password: 'Test@12345' }).expect(200);
});
after(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
async function newJob() {
  const booking = await Booking.create({
    customer: customer._id,
    vehicle: vehicle._id,
    slot: `${tomorrow}T09:00`,
    serviceType: 'Repair',
    complaint: 'Customer reports starting difficulty.',
  });
  const result = await agent
    .post(`/api/bookings/${booking._id}/check-in`)
    .send({ technician: String(technician._id), mileage: 12000 })
    .expect(201);
  return result.body;
}
async function action(job, name, body = {}, expected = 200, client = agent) {
  return client
    .post(`/api/jobs/${job._id}/actions/${name}`)
    .send({ ...body, version: job.__v })
    .expect(expected);
}
async function approved(job, selectedPart = part, quantity = 1) {
  job = (await action(job, 'inspect', { inspection: 'Check battery and replace oil if approved.' }))
    .body;
  job = (
    await action(job, 'estimate', {
      lines: [
        { kind: 'part', part: String(selectedPart._id), quantity },
        { kind: 'labour', description: 'Service labour', quantity: 0.5, unitPricePaise: 50000 },
      ],
    })
  ).body;
  job = (
    await action(job, 'decision', {
      approved: true,
      method: 'Phone',
      note: 'Owner approved this estimate.',
    })
  ).body;
  return job;
}
test('login accepts configured loopback aliases but rejects unrelated origins and ports', async () => {
  const original = config.origin;
  try {
    config.origin = 'http://localhost:5173/';
    for (const origin of [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ]) {
      await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: advisor.email, password: 'Test@12345' })
        .expect(200);
    }
    for (const origin of [
      'http://localhost:5174',
      'http://localhost.evil.example:5173',
      'https://untrusted.example',
    ]) {
      await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: advisor.email, password: 'Test@12345' })
        .expect(403);
    }
    config.origin = 'http://127.0.0.1:8080';
    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:8080')
      .send({ email: advisor.email, password: 'Test@12345' })
      .expect(200);
  } finally {
    config.origin = original;
  }
});
test('authentication, role boundaries, and cross-origin protection', async () => {
  await request(app).get('/api/jobs').expect(401);
  await techAgent.post('/api/customers').send({ name: 'No', phone: '9000000000' }).expect(403);
  await agent
    .post('/api/customers')
    .set('Origin', 'https://untrusted.example')
    .send({ name: 'No', phone: '9000000000' })
    .expect(403);
  const job = await newJob();
  await otherAgent.get(`/api/jobs/${job._id}`).expect(404);
  await action(job, 'inspect', { inspection: 'Not my job' }, 403, otherAgent);
  await action(job, 'estimate', { lines: [] }, 403, techAgent);
});
test('booking capacity is enforced, cancellation releases a slot, and vehicle ownership is checked', async () => {
  const input = {
    customer: String(customer._id),
    vehicle: String(vehicle._id),
    slot: `${tomorrow}T17:30`,
    serviceType: 'Inspection',
    complaint: 'Routine check',
  };
  const created = [];
  for (let i = 0; i < config.capacity; i++)
    created.push((await agent.post('/api/bookings').send(input).expect(201)).body);
  await agent.post('/api/bookings').send(input).expect(409);
  await agent.post(`/api/bookings/${created[0]._id}/cancel`).send({}).expect(200);
  await agent.post('/api/bookings').send(input).expect(201);
  await agent.post(`/api/bookings/${created[0]._id}/cancel`).send({}).expect(409);
  assert.equal((await Slot.findOne({ key: input.slot })).count, config.capacity);
  const wrongOwner = await Customer.create({ name: 'Other customer', phone: '9000000001' });
  await agent
    .post('/api/bookings')
    .send({ ...input, customer: String(wrongOwner._id) })
    .expect(400);
  await agent
    .post('/api/bookings')
    .send({ ...input, slot: '2020-01-01T10:00' })
    .expect(400);
});
test('booking check-in is idempotent by rejection; stale job updates are blocked', async () => {
  let job = await newJob();
  await agent
    .post(`/api/bookings/${job.booking}/check-in`)
    .send({ technician: String(technician._id), mileage: 12000 })
    .expect(409);
  await action(job, 'inspect', { inspection: 'First saved findings' });
  await action(job, 'inspect', { inspection: 'Stale overwrite' }, 409);
  assert.equal((await Job.findById(job._id)).inspection, 'First saved findings');
});
test('complete service workflow preserves invoice totals and blocks delivery before payment', async () => {
  let job = await newJob();
  await action(job, 'status', { status: 'In Service' }, 400);
  job = await approved(job);
  const stockBefore = (await Part.findById(part._id)).stock;
  job = (await action(job, 'status', { status: 'In Service' })).body;
  await action(job, 'status', { status: 'Quality Check' }, 400);
  job = (await action(job, 'parts', { part: String(part._id), quantity: 1, kind: 'issue' })).body;
  assert.equal((await Part.findById(part._id)).stock, stockBefore - 1);
  await action(job, 'parts', { part: String(part._id), quantity: 1, kind: 'issue' }, 400);
  job = (await action(job, 'status', { status: 'Quality Check' })).body;
  job = (
    await action(job, 'qc', {
      checks: { work: true, fluids: false, cleanliness: true },
      note: 'Fluid check needs rework',
    })
  ).body;
  assert.equal(job.status, 'In Service');
  job = (await action(job, 'status', { status: 'Quality Check' })).body;
  job = (
    await action(job, 'qc', {
      checks: { work: true, fluids: true, cleanliness: true },
      note: 'All checks passed',
    })
  ).body;
  await action(job, 'deliver', {}, 400);
  job = (await action(job, 'invoice')).body;
  assert.equal(job.invoice.totalPaise, 70000);
  await Part.updateOne({ _id: part._id }, { $set: { pricePaise: 99000 } });
  assert.equal((await Job.findById(job._id)).invoice.totalPaise, 70000);
  await action(job, 'invoice', {}, 409);
  await action(job, 'payment', { method: 'UPI', reference: '' }, 400);
  job = (await action(job, 'payment', { method: 'UPI', reference: 'TEST-REF-01' })).body;
  await action(job, 'payment', { method: 'Cash' }, 409);
  job = (await action(job, 'deliver')).body;
  assert.equal(job.status, 'Delivered');
  assert.equal(job.qc.length, 2);
  await action(job, 'inspect', { inspection: 'Cannot change a closed job' }, 409);
});
test('revised estimates pause work and preserve earlier approval; issued parts cannot be removed silently', async () => {
  let job = await approved(await newJob());
  job = (await action(job, 'status', { status: 'In Service' })).body;
  job = (await action(job, 'parts', { part: String(part._id), quantity: 1, kind: 'issue' })).body;
  const labour = {
    kind: 'labour',
    description: 'Additional approved work',
    quantity: 1,
    unitPricePaise: 30000,
  };
  await action(job, 'estimate', { lines: [labour] }, 400);
  job = (
    await action(job, 'estimate', {
      lines: [{ kind: 'part', part: String(part._id), quantity: 1 }, labour],
    })
  ).body;
  assert.equal(job.status, 'Awaiting Approval');
  assert.equal(job.estimates[0].status, 'Approved');
  await action(job, 'status', { status: 'In Service' }, 400);
  job = (
    await action(job, 'decision', {
      approved: false,
      method: 'In person',
      note: 'Customer declined additional work',
    })
  ).body;
  await action(job, 'cancel', { reason: 'Cannot cancel work already started' }, 400);
  job = (await action(job, 'parts', { part: String(part._id), quantity: 1, kind: 'return' })).body;
  await action(job, 'parts', { part: String(part._id), quantity: 1, kind: 'return' }, 400);
});
test('concurrent jobs cannot oversell the final unit and failed issue does not leave a ledger entry', async () => {
  const rare = await Part.create({
    sku: `RARE-${seq++}`,
    name: 'Rare part',
    pricePaise: 10000,
    stock: 1,
    minimum: 1,
  });
  let a = await approved(await newJob(), rare),
    b = await approved(await newJob(), rare);
  a = (await action(a, 'status', { status: 'In Service' })).body;
  b = (await action(b, 'status', { status: 'In Service' })).body;
  const payload = { part: String(rare._id), quantity: 1, kind: 'issue' };
  const results = await Promise.all(
    [a, b].map((j) =>
      agent.post(`/api/jobs/${j._id}/actions/parts`).send({ ...payload, version: j.__v }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await Part.findById(rare._id)).stock, 0);
  const saved = await Job.find({ _id: { $in: [a._id, b._id] } });
  assert.equal(
    saved.reduce((n, j) => n + j.partMovements.length, 0),
    1,
  );
});
test('numeric validation prevents negative stock or manipulated prices', async () => {
  await agent
    .post('/api/parts')
    .send({ sku: 'INVALID', name: 'Part', pricePaise: -1, stock: 2, minimum: 0 })
    .expect(400);
  await agent.post(`/api/parts/${part._id}/restock`).send({ quantity: -3 }).expect(400);
  let job = await newJob();
  job = (await action(job, 'inspect', { inspection: 'Inspection completed' })).body;
  await action(
    job,
    'estimate',
    { lines: [{ kind: 'labour', description: 'Invalid', quantity: -1, unitPricePaise: 100 }] },
    400,
  );
  job = (
    await action(job, 'estimate', {
      lines: [{ kind: 'part', part: String(part._id), quantity: 1, unitPricePaise: 1 }],
    })
  ).body;
  assert.equal(
    job.estimates[0].lines[0].unitPricePaise,
    (await Part.findById(part._id)).pricePaise,
  );
});
test('AI drafts are validated and unavailable AI leaves the manual workflow intact', async () => {
  let valid = true;
  const mock = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message: {
          content: valid
            ? JSON.stringify({
                summary: 'Starting concern',
                category: 'Electrical',
                checklist: ['Inspect battery'],
                questions: ['When did it begin?'],
              })
            : 'invalid json',
        },
      }),
    );
  });
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
  const original = config.ollamaUrl;
  config.ollamaUrl = `http://127.0.0.1:${mock.address().port}`;
  try {
    await agent
      .post('/api/ai/intake')
      .send({ complaint: 'Hard to start', make: 'Honda', model: 'Shine' })
      .expect(200);
    valid = false;
    await agent
      .post('/api/ai/intake')
      .send({ complaint: 'Hard to start', make: 'Honda', model: 'Shine' })
      .expect(503);
    await action(await newJob(), 'inspect', { inspection: 'Manual notes still work' });
  } finally {
    config.ollamaUrl = original;
    await new Promise((resolve) => mock.close(resolve));
  }
});

test('vehicle EV fields validate charge and catalogue imports preserve existing stock and prices', async () => {
  await agent
    .post('/api/vehicles')
    .send({
      customer: String(customer._id),
      registration: 'EV12345',
      make: 'Tata',
      model: 'Nexon EV',
      fuelType: 'Electric',
      color: 'White',
      batteryPercent: 70,
    })
    .expect(201);
  await agent
    .post('/api/vehicles')
    .send({
      customer: String(customer._id),
      registration: 'EV12346',
      make: 'Tata',
      model: 'Nexon EV',
      fuelType: 'Electric',
      batteryPercent: 101,
    })
    .expect(400);
  await agent.post('/api/catalogue/import').send({}).expect(200);
  const before = await Part.findOne({ sku: 'EV-COOLANT' });
  const first = (await agent.get('/api/parts')).body;
  const selected = first.find((p) => p.sku !== 'OIL');
  await Part.updateOne({ _id: selected._id }, { $set: { stock: 17, pricePaise: 12345 } });
  assert.equal((await agent.post('/api/catalogue/import').send({}).expect(200)).body.added, 0);
  const after = await Part.findById(selected._id);
  assert.equal(after.stock, 17);
  assert.equal(after.pricePaise, 12345);
  await techAgent.get('/api/purchases').expect(403);
  await techAgent.get('/api/jobs').expect(200);
});
test('purchase receipts are partial, transactional, idempotent, and visible in monthly analytics', async () => {
  const start = (await Part.findById(part._id)).stock;
  let order = (
    await agent
      .post('/api/purchases')
      .send({
        supplier: 'QA supplier',
        lines: [{ part: String(part._id), quantity: 5, unitCostPaise: 20000 }],
      })
      .expect(201)
  ).body;
  assert.equal((await Part.findById(part._id)).stock, start);
  const payload = {
    version: order.__v,
    requestId: randomUUID(),
    lines: [{ part: String(part._id), quantity: 2 }],
  };
  const results = await Promise.all(
    [1, 2].map(() => agent.post(`/api/purchases/${order._id}/receive`).send(payload)),
  );
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  order = results[0].body;
  assert.equal(order.status, 'Partially Received');
  assert.equal((await Part.findById(part._id)).stock, start + 2);
  assert.equal(await StockEvent.countDocuments({ purchase: order._id }), 1);
  await agent
    .post(`/api/purchases/${order._id}/receive`)
    .send({
      ...payload,
      version: order.__v,
      requestId: randomUUID(),
      lines: [{ part: String(part._id), quantity: 4 }],
    })
    .expect(400);
  assert.equal((await Part.findById(part._id)).stock, start + 2);
  await agent
    .post(`/api/purchases/${order._id}/cancel`)
    .send({ version: order.__v, reason: 'Cannot cancel received stock' })
    .expect(409);
  order = (
    await agent
      .post(`/api/purchases/${order._id}/receive`)
      .send({
        ...payload,
        version: order.__v,
        requestId: randomUUID(),
        lines: [{ part: String(part._id), quantity: 3 }],
      })
      .expect(200)
  ).body;
  assert.equal(order.status, 'Received');
  const month = new Date(Date.now() + 19800000).toISOString().slice(0, 7);
  const summary = (await agent.get(`/api/purchases/summary?month=${month}`).expect(200)).body;
  assert.equal(summary.receivedPaise, 100000);
  assert.equal(summary.orderCount, 1);
});
async function readyJob() {
  let job = await approved(await newJob());
  job = (await action(job, 'status', { status: 'In Service' })).body;
  job = (await action(job, 'parts', { part: String(part._id), quantity: 1, kind: 'issue' })).body;
  job = (await action(job, 'status', { status: 'Quality Check' })).body;
  return (
    await action(job, 'qc', {
      checks: { work: true, fluids: true, cleanliness: true },
      note: 'Passed',
    })
  ).body;
}
test('reopening Ready work requires a new QC and cannot alter an issued invoice', async () => {
  let job = await readyJob();
  job = (await action(job, 'reopen', { reason: 'Additional concern before invoicing' })).body;
  assert.equal(job.status, 'In Service');
  await action(job, 'invoice', {}, 400);
  job = (await action(job, 'status', { status: 'Quality Check' })).body;
  job = (
    await action(job, 'qc', {
      checks: { work: true, fluids: true, cleanliness: true },
      note: 'Recheck passed',
    })
  ).body;
  job = (await action(job, 'invoice')).body;
  await action(job, 'reopen', { reason: 'Too late after invoice' }, 400);
  const pdf = await agent
    .get(`/api/jobs/${job._id}/invoice.pdf`)
    .expect(200)
    .expect('Content-Type', /pdf/);
  assert.ok(Buffer.isBuffer(pdf.body));
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  if (process.env.QA_INVOICE_PATH) writeFileSync(process.env.QA_INVOICE_PATH, pdf.body);
  await otherAgent.get(`/api/jobs/${job._id}/invoice.pdf`).expect(404);
});
test('Razorpay test payments require valid signature, matching captured UPI, and cannot double pay', async () => {
  let job = (await action(await readyJob(), 'invoice')).body;
  const original = { key: config.razorpayKey, secret: config.razorpaySecret, ...paymentProvider };
  config.razorpayKey = 'rzp_test_QA';
  config.razorpaySecret = 'qa-test-secret';
  let calls = 0;
  let payment = {
    id: 'pay_QA123',
    order_id: 'order_QA123',
    amount: job.invoice.totalPaise,
    currency: 'INR',
    method: 'upi',
    status: 'authorized',
    captured: false,
  };
  paymentProvider.createOrder = async (body) => {
    calls++;
    return { id: 'order_QA123', amount: body.amount, currency: body.currency };
  };
  paymentProvider.getPayment = async () => payment;
  paymentProvider.getOrderPayments = async () => ({ items: [payment] });
  try {
    const a = (
      await agent.post(`/api/jobs/${job._id}/payment-order`).send({ amount: 1 }).expect(200)
    ).body;
    await agent.post(`/api/jobs/${job._id}/payment-order`).send({}).expect(200);
    assert.equal(calls, 1);
    assert.equal(a.amount, job.invoice.totalPaise);
    job = (await agent.get(`/api/jobs/${job._id}`)).body;
    await action(job, 'payment', { method: 'Cash' }, 409);
    const payload = {
      razorpay_order_id: a.orderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: '0'.repeat(64),
    };
    await agent.post(`/api/jobs/${job._id}/payment-verify`).send(payload).expect(400);
    payload.razorpay_signature = createHmac('sha256', config.razorpaySecret)
      .update(`${a.orderId}|${payment.id}`)
      .digest('hex');
    await agent.post(`/api/jobs/${job._id}/payment-verify`).send(payload).expect(409);
    assert.ok(!(await Job.findById(job._id)).invoice.payment?.at);
    payment = { ...payment, status: 'captured', captured: true, amount: 1 };
    await agent.post(`/api/jobs/${job._id}/payment-verify`).send(payload).expect(400);
    payment.amount = job.invoice.totalPaise;
    await agent.post(`/api/jobs/${job._id}/payment-verify`).send(payload).expect(200);
    await agent.post(`/api/jobs/${job._id}/payment-verify`).send(payload).expect(200);
    await agent.post(`/api/jobs/${job._id}/payment-reconcile`).send({}).expect(200);
    const saved = await Job.findById(job._id);
    assert.equal(saved.invoice.payment.testMode, true);
    assert.equal(
      saved.history.filter((h) => h.action === 'Razorpay test payment verified').length,
      1,
    );
    await techAgent.post(`/api/jobs/${job._id}/payment-reconcile`).send({}).expect(403);
  } finally {
    config.razorpayKey = original.key;
    config.razorpaySecret = original.secret;
    for (const key of ['createOrder', 'getPayment', 'getOrderPayments'])
      paymentProvider[key] = original[key];
  }
});
test('communication previews do not send, and confirmed email uses current recipient plus invoice PDF', async () => {
  let job = (await action(await readyJob(), 'invoice')).body;
  await Customer.updateOne({ _id: customer._id }, { $set: { email: 'owner@example.test' } });
  const original = { host: config.smtpHost, from: config.mailFrom, send: mailTransport.send };
  let sent = [];
  config.smtpHost = 'mock-only';
  config.mailFrom = 'workshop@example.test';
  mailTransport.send = async (message) => {
    sent.push(message);
    return { accepted: [message.to], rejected: [], messageId: 'qa-only' };
  };
  try {
    const preview = (await agent.get(`/api/communications/invoice/${job._id}/preview`).expect(200))
      .body;
    assert.equal(preview.to, 'owner@example.test');
    assert.equal(sent.length, 0);
    assert.ok(preview.attachment.endsWith('.pdf'));
    const url = `/api/communications/invoice/${job._id}/email`;
    await agent.post(url).send({ to: preview.to, confirmed: false }).expect(400);
    await agent.post(url).send({ to: 'wrong@example.test', confirmed: true }).expect(409);
    assert.equal(sent.length, 0);
    await agent.post(url).send({ to: preview.to, confirmed: true }).expect(200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].attachments[0].content.subarray(0, 4).toString(), '%PDF');
    mailTransport.send = async () => {
      throw new Error('mock rejection');
    };
    await agent.post(url).send({ to: preview.to, confirmed: true }).expect(502);
    const logs = await Communication.find({ recordId: job._id });
    assert.deepEqual(logs.map((x) => x.status).sort(), ['Failed', 'Submitted']);
  } finally {
    config.smtpHost = original.host;
    config.mailFrom = original.from;
    mailTransport.send = original.send;
  }
});
