import { z } from 'zod';
const text = (max) => z.string().trim().min(1).max(max);
export const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID');
const integer = (max) => z.number().int().min(0).max(max);
export const loginInput = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});
export const customerInput = z.object({
  name: text(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d ()-]{7,20}$/, 'Enter a valid contact number'),
  email: z.union([z.email().max(200), z.literal('')]).default(''),
});
export const vehicleInput = z.object({
  customer: id,
  registration: text(20).transform((s) => s.toUpperCase().replace(/[ -]/g, '')),
  make: text(50),
  model: text(60),
  color: z.string().trim().max(40).default(''),
  fuelType: z.enum(['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Other']).default('Petrol'),
  batteryPercent: z.number().min(0).max(100).optional(),
});
export const bookingInput = z.object({
  customer: id,
  vehicle: id,
  slot: z.string().regex(/^\d{4}-\d{2}-\d{2}T(09|1[0-7]):(00|30)$/),
  serviceType: z.enum(['Routine Maintenance', 'Repair', 'Inspection']),
  complaint: text(2000),
});
export const partInput = z.object({
  sku: text(40).transform((s) => s.toUpperCase()),
  name: text(100),
  pricePaise: integer(100000000),
  stock: integer(100000),
  minimum: integer(10000),
  category: text(50).default('General'),
  unit: text(20).default('unit'),
  compatibility: text(150).default('Confirm fitment'),
});
export const actionInputs = {
  inspect: z.object({ inspection: text(4000), aiAssisted: z.boolean().default(false) }),
  assign: z.object({ technician: id }),
  estimate: z.object({
    lines: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('part'),
            part: id,
            quantity: z.number().int().min(1).max(10000),
          }),
          z.object({
            kind: z.literal('labour'),
            description: text(150),
            quantity: z.number().min(0.25).max(1000).multipleOf(0.25),
            unitPricePaise: integer(10000000),
          }),
        ]),
      )
      .min(1)
      .max(30),
  }),
  decision: z.object({
    approved: z.boolean(),
    method: z.enum(['Phone', 'In person', 'Email']),
    note: text(500),
  }),
  status: z.object({ status: z.enum(['In Service', 'Awaiting Parts', 'Quality Check']) }),
  parts: z.object({
    part: id,
    quantity: z.number().int().min(1).max(10000),
    kind: z.enum(['issue', 'return']),
  }),
  qc: z.object({
    checks: z.object({ work: z.boolean(), fluids: z.boolean(), cleanliness: z.boolean() }),
    note: text(1000),
  }),
  invoice: z.object({}),
  payment: z.object({
    method: z.enum(['Cash', 'UPI', 'Card']),
    reference: z.string().trim().max(100).default(''),
  }),
  deliver: z.object({}),
  cancel: z.object({ reason: text(500) }),
  reopen: z.object({ reason: text(500) }),
};
export const versionInput = z.object({ version: z.number().int().min(0) });
export const aiInput = z.object({ complaint: text(2000), make: text(50), model: text(60) });
export const aiOutput = z.object({
  summary: text(1000),
  category: text(100),
  checklist: z.array(text(250)).min(1).max(8),
  questions: z.array(text(250)).max(5),
});
