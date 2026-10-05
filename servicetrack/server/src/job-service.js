import mongoose from 'mongoose';
import { Job, User, Part, Customer, Vehicle, StockEvent, PaymentOrder } from './models.js';
import {
  check,
  ensureAssigned,
  latestEstimate,
  currentUsage,
  record,
  transition,
} from './domain.js';
import { actionInputs, versionInput } from './validation.js';

const advisorActions = new Set([
  'assign',
  'estimate',
  'decision',
  'invoice',
  'payment',
  'deliver',
  'cancel',
  'reopen',
]);
export async function performAction(jobId, action, body, user) {
  check(actionInputs[action], 'Unknown action.', 404);
  if (advisorActions.has(action))
    check(user.role === 'advisor', 'Only the service advisor can perform this action.', 403);
  const { version } = versionInput.parse(body);
  const input = actionInputs[action].parse(body);
  await mongoose.connection.transaction(async (session) => {
    const job = await Job.findById(jobId).session(session);
    check(job, 'Job not found.', 404);
    ensureAssigned(job, user);
    check(job.__v === version, 'This job changed. Refresh it before trying again.', 409);
    check(!['Delivered', 'Cancelled'].includes(job.status), 'This job is closed.', 409);
    const estimate = latestEstimate(job);
    if (action === 'inspect') {
      check(!job.invoice?.number, 'Inspection is locked after invoicing.');
      job.inspection = input.inspection;
      job.aiAssisted = input.aiAssisted;
      record(
        job,
        user,
        'Inspection saved',
        input.aiAssisted ? 'Staff reviewed AI-assisted notes' : 'Manual inspection notes',
      );
    }
    if (action === 'assign') {
      check(
        await User.exists({ _id: input.technician, role: 'technician' }).session(session),
        'Choose a valid technician.',
      );
      job.technician = input.technician;
      record(job, user, 'Technician assigned');
    }
    if (action === 'estimate') {
      check(
        !job.invoice?.number && !['Quality Check', 'Ready'].includes(job.status),
        'Return the job to servicing before revising an estimate.',
      );
      check(job.inspection.trim(), 'Record inspection findings before preparing an estimate.');
      const lines = [],
        seen = new Set();
      for (const line of input.lines) {
        if (line.kind === 'part') {
          check(!seen.has(line.part), 'Combine duplicate part lines.');
          seen.add(line.part);
          const part = await Part.findById(line.part).session(session);
          check(part, 'Part not found.');
          lines.push({
            kind: 'part',
            part: part._id,
            description: part.name,
            quantity: line.quantity,
            unitPricePaise: part.pricePaise,
            amountPaise: part.pricePaise * line.quantity,
          });
        } else
          lines.push({ ...line, amountPaise: Math.round(line.quantity * line.unitPricePaise) });
      }
      for (const movement of job.partMovements) {
        const issued = currentUsage(job, movement.part),
          proposed = lines.find((l) => String(l.part) === String(movement.part))?.quantity || 0;
        check(proposed >= issued, 'Return unused parts before removing them from the estimate.');
      }
      job.estimates.push({
        version: job.estimates.length + 1,
        lines,
        totalPaise: lines.reduce((n, l) => n + l.amountPaise, 0),
        status: 'Pending',
        createdAt: new Date(),
      });
      job.status = 'Awaiting Approval';
      record(job, user, 'Estimate prepared', `Revision ${job.estimates.length}`);
    }
    if (action === 'decision') {
      check(
        job.status === 'Awaiting Approval' && estimate?.status === 'Pending',
        'No estimate is awaiting a decision.',
      );
      estimate.status = input.approved ? 'Approved' : 'Rejected';
      estimate.decision = {
        method: input.method,
        note: input.note,
        recordedBy: user._id,
        at: new Date(),
      };
      job.status = input.approved ? 'Approved' : 'Under Inspection';
      record(
        job,
        user,
        input.approved ? 'Customer approval recorded' : 'Customer rejection recorded',
        `Revision ${estimate.version} · ${input.method} · ${input.note}`,
      );
    }
    if (action === 'status') transition(job, input.status, user);
    if (action === 'parts') {
      check(!job.invoice?.number, 'Parts are locked after invoicing.');
      const issued = currentUsage(job, input.part);
      if (input.kind === 'issue') {
        check(
          ['In Service', 'Awaiting Parts'].includes(job.status) && estimate?.status === 'Approved',
          'Parts can only be issued during approved service.',
        );
        const approved =
          estimate.lines.find((l) => l.kind === 'part' && String(l.part) === input.part)
            ?.quantity || 0;
        check(issued + input.quantity <= approved, 'Quantity exceeds the approved estimate.');
        const part = await Part.findOneAndUpdate(
          { _id: input.part, stock: { $gte: input.quantity } },
          { $inc: { stock: -input.quantity } },
          { session, new: true },
        );
        check(part, 'Insufficient stock. Restock the part or place the job on hold.', 409);
      } else {
        check(
          !['Quality Check', 'Ready'].includes(job.status),
          'Return the job to servicing before returning parts.',
        );
        check(issued >= input.quantity, 'Return quantity exceeds the parts issued to this job.');
        await Part.updateOne({ _id: input.part }, { $inc: { stock: input.quantity } }, { session });
      }
      job.partMovements.push({ ...input, by: user._id, at: new Date() });
      await StockEvent.create(
        [
          {
            part: input.part,
            change: input.kind === 'issue' ? -input.quantity : input.quantity,
            type: input.kind === 'issue' ? 'Issue' : 'Return',
            by: user._id,
            job: job._id,
            note: job.number,
          },
        ],
        { session },
      );
      record(
        job,
        user,
        input.kind === 'issue' ? 'Parts issued' : 'Parts returned',
        `${input.quantity} unit(s)`,
      );
    }
    if (action === 'qc') {
      check(job.status === 'Quality Check', 'Move the job to quality check first.');
      const passed = Object.values(input.checks).every(Boolean);
      job.qc.push({ ...input, passed, by: user._id, at: new Date() });
      job.status = passed ? 'Ready' : 'In Service';
      record(job, user, passed ? 'Quality check passed' : 'Quality check failed', input.note);
    }
    if (action === 'invoice') {
      check(
        job.status === 'Ready' && job.qc.at(-1)?.passed && estimate?.status === 'Approved',
        'Complete approved work and pass quality check first.',
      );
      check(!job.invoice?.number, 'An invoice already exists.', 409);
      const customer = await Customer.findById(job.customer).session(session),
        vehicle = await Vehicle.findById(job.vehicle).session(session);
      job.invoice = {
        number: `INV-${job.number.slice(3)}`,
        lines: estimate.lines.map((l) => l.toObject()),
        totalPaise: estimate.totalPaise,
        issuedAt: new Date(),
        customerName: customer.name,
        registration: vehicle.registration,
      };
      record(job, user, 'Invoice issued', job.invoice.number);
    }
    if (action === 'payment') {
      check(
        !(await PaymentOrder.exists({ job: job._id }).session(session)),
        'This invoice has a Razorpay test order. Use checkout or Check payment status to finish it.',
        409,
      );
      check(job.invoice?.number, 'Issue an invoice first.');
      check(!job.invoice.payment?.at, 'Payment is already recorded.', 409);
      check(input.method === 'Cash' || input.reference, 'Enter the payment reference.');
      job.invoice.payment = {
        ...input,
        amountPaise: job.invoice.totalPaise,
        at: new Date(),
        recordedBy: user._id,
      };
      record(job, user, 'Full payment recorded', input.method);
    }
    if (action === 'deliver') {
      check(
        job.status === 'Ready' && job.qc.at(-1)?.passed && job.invoice?.payment?.at,
        'Delivery requires passed QC and full payment.',
      );
      job.status = 'Delivered';
      record(job, user, 'Vehicle delivered');
    }
    if (action === 'cancel') {
      check(
        ['Under Inspection', 'Awaiting Approval', 'Approved'].includes(job.status) &&
          !job.invoice?.number &&
          !job.partMovements.length &&
          !job.history.some((h) => h.action === 'Status updated' && h.detail === 'In Service'),
        'Only jobs with no repair work or parts movements can be cancelled.',
      );
      job.status = 'Cancelled';
      record(job, user, 'Job cancelled', input.reason);
    }
    if (action === 'reopen') {
      check(
        job.status === 'Ready' && !job.invoice?.number,
        'Only a Ready job without an invoice can be reopened.',
      );
      job.status = 'In Service';
      record(job, user, 'Reopened for correction', input.reason);
    }
    await job.save({ session });
  });
}
