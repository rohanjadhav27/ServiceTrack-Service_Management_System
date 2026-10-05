export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const check = (condition, message, status = 400) => {
  if (!condition) throw new AppError(message, status);
};
export const latestEstimate = (job) => job.estimates.at(-1);
export const currentUsage = (job, id) =>
  job.partMovements
    .filter((m) => String(m.part) === String(id))
    .reduce((sum, m) => sum + (m.kind === 'issue' ? m.quantity : -m.quantity), 0);
export function ensureAssigned(job, user) {
  check(
    user.role === 'advisor' || String(job.technician) === String(user._id),
    'This job is assigned to another technician.',
    403,
  );
}
export function record(job, user, action, detail = '') {
  job.history.push({ action, detail, by: user._id, at: new Date() });
}
export function transition(job, next, user) {
  const allowed = {
    Approved: ['In Service'],
    'In Service': ['Awaiting Parts', 'Quality Check'],
    'Awaiting Parts': ['In Service'],
    'Quality Check': ['In Service'],
  };
  check(allowed[job.status]?.includes(next), `Cannot move from ${job.status} to ${next}.`);
  check(latestEstimate(job)?.status === 'Approved', 'Customer approval is required.');
  if (next === 'Quality Check') {
    for (const line of latestEstimate(job).lines.filter((l) => l.kind === 'part'))
      check(
        currentUsage(job, line.part) === line.quantity,
        'Issue all approved parts before quality check.',
      );
  }
  job.status = next;
  record(job, user, 'Status updated', next);
}
