import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const options = { timestamps: true, optimisticConcurrency: true };

export const User = model(
  'User',
  new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ['advisor', 'technician'], required: true },
    },
    options,
  ),
);
export const Customer = model(
  'Customer',
  new Schema(
    {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
    },
    options,
  ),
);
export const Vehicle = model(
  'Vehicle',
  new Schema(
    {
      customer: ref('Customer'),
      registration: { type: String, unique: true, required: true },
      make: String,
      model: String,
      color: { type: String, default: '' },
      fuelType: {
        type: String,
        enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Other'],
        default: 'Petrol',
      },
      batteryPercent: { type: Number, min: 0, max: 100 },
    },
    options,
  ),
);
export const Slot = model(
  'Slot',
  new Schema(
    { key: { type: String, unique: true }, count: { type: Number, default: 0, min: 0 } },
    options,
  ),
);
export const Booking = model(
  'Booking',
  new Schema(
    {
      customer: ref('Customer'),
      vehicle: ref('Vehicle'),
      slot: { type: String, required: true },
      serviceType: { type: String, enum: ['Routine Maintenance', 'Repair', 'Inspection'] },
      complaint: String,
      status: {
        type: String,
        enum: ['Scheduled', 'Checked In', 'Cancelled'],
        default: 'Scheduled',
      },
      job: ref('Job', false),
    },
    options,
  ),
);
export const Part = model(
  'Part',
  new Schema(
    {
      sku: { type: String, unique: true, required: true },
      name: String,
      pricePaise: { type: Number, min: 0 },
      stock: { type: Number, min: 0 },
      minimum: { type: Number, min: 0 },
      category: { type: String, default: 'General' },
      unit: { type: String, default: 'unit' },
      compatibility: { type: String, default: 'Confirm fitment' },
    },
    options,
  ),
);

const line = new Schema(
  {
    kind: { type: String, enum: ['part', 'labour'] },
    part: ref('Part', false),
    description: String,
    quantity: Number,
    unitPricePaise: Number,
    amountPaise: Number,
  },
  { _id: false },
);
const estimate = new Schema(
  {
    version: Number,
    lines: [line],
    totalPaise: Number,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'] },
    createdAt: Date,
    decision: { method: String, note: String, recordedBy: ref('User', false), at: Date },
  },
  { _id: false },
);
export const Job = model(
  'Job',
  new Schema(
    {
      number: { type: String, unique: true },
      booking: { ...ref('Booking'), unique: true },
      customer: ref('Customer'),
      vehicle: ref('Vehicle'),
      technician: ref('User'),
      mileage: { type: Number, min: 0 },
      complaint: String,
      inspection: { type: String, default: '' },
      aiAssisted: { type: Boolean, default: false },
      status: {
        type: String,
        enum: [
          'Under Inspection',
          'Awaiting Approval',
          'Approved',
          'In Service',
          'Awaiting Parts',
          'Quality Check',
          'Ready',
          'Delivered',
          'Cancelled',
        ],
        default: 'Under Inspection',
      },
      estimates: [estimate],
      partMovements: [
        {
          part: ref('Part'),
          quantity: Number,
          kind: { type: String, enum: ['issue', 'return'] },
          by: ref('User'),
          at: Date,
        },
      ],
      qc: [
        {
          checks: { work: Boolean, fluids: Boolean, cleanliness: Boolean },
          passed: Boolean,
          note: String,
          by: ref('User'),
          at: Date,
        },
      ],
      invoice: {
        number: String,
        lines: [line],
        totalPaise: Number,
        issuedAt: Date,
        customerName: String,
        registration: String,
        payment: {
          method: String,
          reference: String,
          amountPaise: Number,
          at: Date,
          recordedBy: ref('User', false),
          testMode: { type: Boolean, default: false },
          provider: String,
        },
      },
      history: [{ action: String, detail: String, by: ref('User'), at: Date }],
    },
    options,
  ),
);

export const Purchase = model(
  'Purchase',
  new Schema(
    {
      number: { type: String, required: true, unique: true },
      supplier: { type: String, required: true },
      supplierContact: String,
      expectedDate: String,
      notes: String,
      status: {
        type: String,
        enum: ['Ordered', 'Partially Received', 'Received', 'Cancelled'],
        default: 'Ordered',
      },
      createdBy: ref('User'),
      totalPaise: Number,
      lines: [
        {
          part: ref('Part'),
          name: String,
          sku: String,
          quantity: Number,
          unitCostPaise: Number,
          received: { type: Number, default: 0 },
        },
      ],
      receipts: [
        {
          requestId: String,
          at: Date,
          by: ref('User'),
          note: String,
          totalPaise: Number,
          lines: [{ part: ref('Part'), quantity: Number, unitCostPaise: Number }],
        },
      ],
      cancelledAt: Date,
      cancelledBy: ref('User', false),
      cancellationReason: String,
    },
    options,
  ),
);
export const StockEvent = model(
  'StockEvent',
  new Schema(
    {
      part: ref('Part'),
      change: Number,
      type: { type: String, enum: ['Opening', 'Restock', 'Purchase receipt', 'Issue', 'Return'] },
      note: String,
      by: ref('User', false),
      job: ref('Job', false),
      purchase: ref('Purchase', false),
    },
    { timestamps: true },
  ),
);
export const Communication = model(
  'Communication',
  new Schema(
    {
      kind: { type: String, enum: ['booking', 'invoice'] },
      recordId: Schema.Types.ObjectId,
      to: String,
      subject: String,
      status: { type: String, enum: ['Submitted', 'Failed'] },
      messageId: String,
      by: ref('User'),
      error: String,
    },
    { timestamps: true },
  ),
);
export const PaymentOrder = model(
  'PaymentOrder',
  new Schema(
    {
      job: { ...ref('Job'), unique: true },
      orderId: String,
      amountPaise: Number,
      currency: { type: String, default: 'INR' },
      state: {
        type: String,
        enum: ['Creating', 'Created', 'Unknown', 'Paid'],
        default: 'Creating',
      },
      paymentId: String,
      createdBy: ref('User'),
    },
    options,
  ),
);
