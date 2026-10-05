import { useState, useEffect } from 'react';
import { Panel, Form, Field, Badge, ActionButton, Notice } from './components';
import { when } from './api';
const netUsed = (job, id) =>
  job.partMovements
    .filter((m) => (m.part?._id || m.part) === id)
    .reduce((n, m) => n + (m.kind === 'issue' ? m.quantity : -m.quantity), 0);
export function ServiceWorkspace({ job, parts, act, advisor }) {
  const [mode, setMode] = useState('issue'),
    [partId, setPartId] = useState(''),
    [quantity, setQuantity] = useState(1);
  const estimate = job.estimates.at(-1),
    lines = estimate?.lines.filter((l) => l.kind === 'part') || [],
    closed = ['Delivered', 'Cancelled'].includes(job.status);
  const options = parts
    .map((p) => {
      const net = netUsed(job, p._id),
        approved = lines.find((l) => l.part === p._id)?.quantity || 0;
      return {
        ...p,
        available: mode === 'return' ? net : Math.min(Math.max(0, approved - net), p.stock),
      };
    })
    .filter((p) => p.available > 0);
  useEffect(() => {
    setPartId('');
    setQuantity(1);
  }, [mode, job.__v]);
  const selected = options.find((p) => p._id === partId);
  const remaining = lines.some((l) => netUsed(job, l.part) !== l.quantity);
  const guidance = {
    'Under Inspection': 'Save inspection findings and prepare an estimate.',
    'Awaiting Approval': 'Repairs are paused until the customer approves the latest estimate.',
    Approved: 'Approval recorded. Start service before issuing parts.',
    'In Service': remaining
      ? 'Issue the remaining approved parts before quality check.'
      : 'Required parts are accounted for. Submit for QC when work is complete.',
    'Awaiting Parts':
      'Service is on hold. Receive stock or revise the estimate with customer approval.',
    'Quality Check': 'Record the checks below. Any failed check returns the job to servicing.',
    Ready: 'Quality check passed. The advisor can issue the invoice and record payment.',
    Delivered: 'Vehicle handed over. This service record is closed.',
    Cancelled: 'This job is cancelled.',
  };
  const canMove =
    !closed && !job.invoice?.number && !['Quality Check', 'Ready'].includes(job.status);
  const canIssue =
    ['In Service', 'Awaiting Parts'].includes(job.status) && estimate?.status === 'Approved';
  useEffect(() => {
    if (!canIssue) setMode('return');
  }, [canIssue]);
  return (
    <>
      <Panel title="Service progress">
        <div className="inline-actions">
          <Badge value={job.status} />
          {job.status === 'Approved' && (
            <ActionButton onClick={() => act('status', { status: 'In Service' })}>
              Start service
            </ActionButton>
          )}
          {job.status === 'In Service' && (
            <>
              <ActionButton secondary onClick={() => act('status', { status: 'Awaiting Parts' })}>
                Hold: awaiting parts
              </ActionButton>
              <ActionButton
                disabled={remaining}
                onClick={() => act('status', { status: 'Quality Check' })}
              >
                Submit for quality check
              </ActionButton>
            </>
          )}
          {job.status === 'Awaiting Parts' && (
            <ActionButton onClick={() => act('status', { status: 'In Service' })}>
              Resume service
            </ActionButton>
          )}
          {job.status === 'Quality Check' && (
            <ActionButton secondary onClick={() => act('status', { status: 'In Service' })}>
              Return to servicing
            </ActionButton>
          )}
        </div>
        <p className="status-guidance">{guidance[job.status]}</p>
        {advisor && job.status === 'Ready' && !job.invoice?.number && (
          <details>
            <summary>Reopen to correct work or the estimate</summary>
            <Form submit="Reopen job for correction" onSubmit={(v) => act('reopen', v)}>
              <Field label="Reason for reopening">
                <input name="reason" required maxLength={500} />
              </Field>
              <p className="fine">
                The job returns to servicing. It must pass a new quality check before invoicing;
                changed estimates require new approval.
              </p>
            </Form>
          </details>
        )}
      </Panel>
      <Panel title="Parts required for this job">
        {!lines.length ? (
          <Notice>
            This estimate contains labour only. No catalogue parts are required or deducted. If a
            repair uses a new part, ask the advisor to add a Part line and obtain approval.
          </Notice>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>In estimate</th>
                  <th>Net issued</th>
                  <th>Remaining</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const net = netUsed(job, l.part);
                  return (
                    <tr key={l.part}>
                      <td>{l.description}</td>
                      <td>{l.quantity}</td>
                      <td>{net}</td>
                      <td>{Math.max(0, l.quantity - net)}</td>
                      <td>{parts.find((p) => p._id === l.part)?.stock || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {canMove &&
          (canIssue || job.partMovements.some((m) => netUsed(job, m.part?._id || m.part) > 0)) && (
            <Form
              submit={mode === 'issue' ? 'Issue approved parts' : 'Return unused parts'}
              onSubmit={() => {
                if (!selected) throw new Error('Select an eligible part.');
                return act('parts', { part: partId, quantity: Number(quantity), kind: mode });
              }}
            >
              <div className="three-cols">
                <Field label="Movement">
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="issue" disabled={!canIssue}>
                      Issue approved part
                    </option>
                    <option value="return">Return unused part</option>
                  </select>
                </Field>
                <Field label="Eligible part">
                  <select
                    value={partId}
                    onChange={(e) => {
                      setPartId(e.target.value);
                      setQuantity(1);
                    }}
                    required
                  >
                    <option value="">
                      {options.length ? 'Choose a part' : 'No eligible quantities available'}
                    </option>
                    {options.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · up to {p.available}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    type="number"
                    min="1"
                    max={selected?.available || 1}
                    step="1"
                    required
                  />
                </Field>
              </div>
              <p className="fine">
                Only approved quantities in stock can be issued. Returned parts must already be
                issued to this job.
              </p>
            </Form>
          )}
        {!!job.partMovements.length && (
          <details>
            <summary>Movement history ({job.partMovements.length})</summary>
            {job.partMovements.map((m, i) => (
              <p key={i}>
                {m.kind === 'issue' ? 'Issued' : 'Returned'} {m.quantity} × {m.part?.name} ·{' '}
                {when(m.at)}
              </p>
            ))}
          </details>
        )}
      </Panel>
      {job.status === 'Quality Check' && (
        <Panel title="Quality control">
          <Form
            submit="Save quality check"
            onSubmit={(v) =>
              act('qc', {
                checks: {
                  work: v.work === 'on',
                  fluids: v.fluids === 'on',
                  cleanliness: v.cleanliness === 'on',
                },
                note: v.note,
              })
            }
          >
            <p className="muted">
              Check items only after verification. Any unchecked item returns the job to servicing.
            </p>
            <label className="check-field">
              <input name="work" type="checkbox" />
              Approved work verified; functional checks passed
            </label>
            <label className="check-field">
              <input name="fluids" type="checkbox" />
              Fluid levels and leaks checked where applicable
            </label>
            <label className="check-field">
              <input name="cleanliness" type="checkbox" />
              Vehicle condition and cleanliness checked
            </label>
            <Field label="QC findings">
              <textarea
                name="note"
                required
                maxLength={1000}
                rows={2}
                placeholder="Record what was checked and any findings."
              />
            </Field>
          </Form>
        </Panel>
      )}
      {!!job.qc.length && (
        <Panel title="Quality check history">
          {job.qc.map((qc, i) => (
            <div className="qc-result" key={i}>
              <span className={`badge ${qc.passed ? 'green' : 'amber'}`}>
                {qc.passed ? 'Passed' : 'Needs rework'}
              </span>
              <div>
                <strong>{qc.passed ? 'QC passed' : 'QC failed — returned to service'}</strong>
                <p>{qc.note}</p>
                <small>
                  {when(qc.at)}
                  {job.history.some(
                    (h) =>
                      h.action === 'Reopened for correction' && new Date(h.at) > new Date(qc.at),
                  )
                    ? ' · Job reopened after this check'
                    : ''}
                </small>
              </div>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
