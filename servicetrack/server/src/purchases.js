import { Router } from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Purchase, Part, StockEvent } from './models.js';
import { advisor } from './auth.js';
import { id } from './validation.js';
import { check } from './domain.js';
import { catalogue } from './catalogue.js';
const router = Router();
router.use(['/catalogue', '/stock-history', '/purchases'], advisor);
router.post('/catalogue/import', async (req, res) => {
  const result = await Part.bulkWrite(
    catalogue.map((item) => ({
      updateOne: { filter: { sku: item.sku }, update: { $setOnInsert: item }, upsert: true },
    })),
  );
  res.json({
    added: result.upsertedCount,
    message: `${result.upsertedCount} sample items added with zero stock. Existing items preserved.`,
  });
});
router.get('/stock-history', async (req, res) =>
  res.json(
    await StockEvent.find()
      .populate('part', 'name sku unit')
      .populate('by', 'name')
      .sort({ createdAt: -1 })
      .limit(200),
  ),
);
router.get('/purchases', async (req, res) =>
  res.json(await Purchase.find().populate('createdBy', 'name').sort({ createdAt: -1 })),
);
router.get('/purchases/summary', async (req, res) => {
  const month = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .parse(req.query.month);
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const [year, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, m, 1) - 19800000);
  const orders = await Purchase.find();
  const period = orders.filter(
    (p) => p.createdAt >= start && p.createdAt < end && p.status !== 'Cancelled',
  );
  const receipts = orders.flatMap((p) => p.receipts).filter((r) => r.at >= start && r.at < end);
  const top = new Map();
  for (const r of receipts)
    for (const line of r.lines) {
      const key = String(line.part);
      const current = top.get(key) || { part: key, quantity: 0, costPaise: 0 };
      current.quantity += line.quantity;
      current.costPaise += line.quantity * line.unitCostPaise;
      top.set(key, current);
    }
  const names = await Part.find({ _id: { $in: [...top.keys()] } }).select('name unit');
  res.json({
    month,
    orderCount: period.length,
    orderedPaise: period.reduce((n, p) => n + p.totalPaise, 0),
    receivedPaise: receipts.reduce((n, r) => n + r.totalPaise, 0),
    openOrders: orders.filter((p) => ['Ordered', 'Partially Received'].includes(p.status)).length,
    topParts: [...top.values()]
      .sort((a, b) => b.costPaise - a.costPaise)
      .slice(0, 5)
      .map((p) => ({ ...p, name: names.find((n) => String(n._id) === p.part)?.name || 'Part' })),
  });
});
router.post('/purchases', async (req, res) => {
  const input = z
    .object({
      supplier: z.string().trim().min(1).max(120),
      supplierContact: z.string().trim().max(100).default(''),
      expectedDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(''),
      notes: z.string().trim().max(1000).default(''),
      lines: z
        .array(
          z.object({
            part: id,
            quantity: z.number().int().min(1).max(10000),
            unitCostPaise: z.number().int().min(0).max(100000000),
          }),
        )
        .min(1)
        .max(30),
    })
    .parse(req.body);
  check(
    new Set(input.lines.map((l) => l.part)).size === input.lines.length,
    'Combine duplicate part lines.',
  );
  const parts = await Part.find({ _id: { $in: input.lines.map((l) => l.part) } });
  check(parts.length === input.lines.length, 'One or more parts were not found.');
  const lines = input.lines.map((l) => {
    const p = parts.find((p) => String(p._id) === l.part);
    return { ...l, name: p.name, sku: p.sku, received: 0 };
  });
  res.status(201).json(
    await Purchase.create({
      ...input,
      lines,
      number: `PO-${randomUUID().slice(0, 8).toUpperCase()}`,
      createdBy: req.user._id,
      totalPaise: lines.reduce((n, l) => n + l.quantity * l.unitCostPaise, 0),
    }),
  );
});
router.post('/purchases/:id/receive', async (req, res) => {
  id.parse(req.params.id);
  const input = z
    .object({
      version: z.number().int().min(0),
      requestId: z.uuid(),
      note: z.string().trim().max(500).default(''),
      lines: z
        .array(z.object({ part: id, quantity: z.number().int().min(1).max(10000) }))
        .min(1)
        .max(30),
    })
    .parse(req.body);
  check(
    new Set(input.lines.map((l) => l.part)).size === input.lines.length,
    'Combine duplicate receipt lines.',
  );
  await mongoose.connection.transaction(async (session) => {
    const order = await Purchase.findById(req.params.id).session(session);
    check(order, 'Purchase order not found.', 404);
    if (order.receipts.some((r) => r.requestId === input.requestId)) return;
    check(order.__v === input.version, 'Purchase order changed. Refresh before receiving.', 409);
    check(
      ['Ordered', 'Partially Received'].includes(order.status),
      'This order cannot receive more stock.',
      409,
    );
    const received = [];
    for (const line of input.lines) {
      const ordered = order.lines.find((l) => String(l.part) === line.part);
      check(
        ordered && ordered.received + line.quantity <= ordered.quantity,
        'Received quantity exceeds the remaining order quantity.',
      );
      ordered.received += line.quantity;
      received.push({ ...line, unitCostPaise: ordered.unitCostPaise });
      const result = await Part.updateOne(
        { _id: line.part },
        { $inc: { stock: line.quantity } },
        { session },
      );
      check(result.matchedCount === 1, 'Part no longer exists.');
      await StockEvent.create(
        [
          {
            part: line.part,
            change: line.quantity,
            type: 'Purchase receipt',
            by: req.user._id,
            purchase: order._id,
            note: `${order.number} · ${input.note}`,
          },
        ],
        { session },
      );
    }
    order.receipts.push({
      requestId: input.requestId,
      at: new Date(),
      by: req.user._id,
      note: input.note,
      lines: received,
      totalPaise: received.reduce((n, l) => n + l.quantity * l.unitCostPaise, 0),
    });
    order.status = order.lines.every((l) => l.received === l.quantity)
      ? 'Received'
      : 'Partially Received';
    await order.save({ session });
  });
  res.json(await Purchase.findById(req.params.id));
});
router.post('/purchases/:id/cancel', async (req, res) => {
  id.parse(req.params.id);
  const input = z
    .object({ version: z.number().int().min(0), reason: z.string().trim().min(1).max(500) })
    .parse(req.body);
  const result = await Purchase.findOneAndUpdate(
    { _id: req.params.id, __v: input.version, status: 'Ordered', 'receipts.0': { $exists: false } },
    {
      $set: {
        status: 'Cancelled',
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledBy: req.user._id,
      },
      $inc: { __v: 1 },
    },
    { new: true },
  );
  check(result, 'Only an unchanged order with no receipts can be cancelled.', 409);
  res.json(result);
});
export default router;
