import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Trash2, Printer, CheckCircle2 } from 'lucide-react';
import { post, money, when } from './api';
import { PaymentControls } from './payment-controls';
import { CommunicationPanel } from './communication-panel';
import { ServiceWorkspace } from './service-workspace';
import { labourSuggestions } from './vehicle-fields';
import {
  useData,
  useSession,
  Heading,
  Panel,
  Badge,
  Loading,
  Notice,
  Field,
  Form,
  ActionButton,
} from './components';

function Lines({ lines }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Type</th>
            <th>Qty / hours</th>
            <th>Unit rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{l.description}</td>
              <td>{l.kind === 'part' ? 'Part' : 'Labour'}</td>
              <td>{l.quantity}</td>
              <td>{money(l.unitPricePaise)}</td>
              <td>{money(l.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function EstimateBuilder({ parts, current, onSave }) {
  const [lines, setLines] = useState(
    current?.lines.map((l) => ({
      kind: l.kind,
      part: l.part,
      description: l.description,
      quantity: l.quantity,
      rate: l.unitPricePaise / 100,
    })) || [{ kind: 'labour', description: '', quantity: 1, rate: 0 }],
  );
  const update = (i, key, value) =>
    setLines(lines.map((line, n) => (n === i ? { ...line, [key]: value } : line)));
  const total = lines.reduce(
    (sum, l) =>
      sum +
      Math.round(
        Number(l.quantity) *
          (l.kind === 'part'
            ? parts.find((p) => p._id === l.part)?.pricePaise || 0
            : Number(l.rate) * 100),
      ),
    0,
  );
  return (
    <Form
      submit="Save estimate & request approval"
      onSubmit={async () => {
        await onSave({
          lines: lines.map((l) =>
            l.kind === 'part'
              ? { kind: l.kind, part: l.part, quantity: Number(l.quantity) }
              : {
                  kind: l.kind,
                  description: l.description,
                  quantity: Number(l.quantity),
                  unitPricePaise: Math.round(Number(l.rate) * 100),
                },
          ),
        });
      }}
    >
      <p className="muted">
        Add a Part line for every physical item, and a Labour line for the work. Writing “replace
        tyre” in a Labour description does not add a tyre to inventory usage. Labour quantity is
        hours. Revisions require new approval.
      </p>
      <datalist id="labour-suggestions">
        {labourSuggestions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {lines.map((line, i) => (
        <div className="estimate-row" key={i}>
          <Field label="Type">
            <select
              value={line.kind}
              onChange={(e) =>
                setLines(
                  lines.map((l, n) =>
                    n === i
                      ? { kind: e.target.value, part: '', description: '', quantity: 1, rate: 0 }
                      : l,
                  ),
                )
              }
            >
              <option value="labour">Labour</option>
              <option value="part">Part</option>
            </select>
          </Field>
          <Field label={line.kind === 'part' ? 'Part' : 'Work description'}>
            {line.kind === 'part' ? (
              <select
                value={line.part || ''}
                required
                onChange={(e) => update(i, 'part', e.target.value)}
              >
                <option value="">Select part</option>
                {parts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} · {money(p.pricePaise)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={line.description}
                list="labour-suggestions"
                placeholder="e.g. Tyre replacement labour"
                required
                maxLength={150}
                onChange={(e) => update(i, 'description', e.target.value)}
              />
            )}
          </Field>
          <Field label={line.kind === 'part' ? 'Quantity' : 'Hours'}>
            <input
              type="number"
              min={line.kind === 'part' ? 1 : 0.25}
              step={line.kind === 'part' ? 1 : 0.25}
              value={line.quantity}
              required
              onChange={(e) => update(i, 'quantity', e.target.value)}
            />
          </Field>
          <Field label="Rate (₹)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                line.kind === 'part'
                  ? (parts.find((p) => p._id === line.part)?.pricePaise || 0) / 100
                  : line.rate
              }
              readOnly={line.kind === 'part'}
              required
              onChange={(e) => update(i, 'rate', e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="icon-button danger"
            aria-label={`Remove line ${i + 1}`}
            disabled={lines.length === 1}
            onClick={() => setLines(lines.filter((_, n) => n !== i))}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
      <div className="estimate-footer">
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setLines([...lines, { kind: 'labour', description: '', quantity: 1, rate: 0 }])
          }
        >
          <Plus size={16} />
          Add labour
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setLines([...lines, { kind: 'part', part: '', quantity: 1, rate: 0 }])}
        >
          <Plus size={16} />
          Add part
        </button>
        <strong>Total {money(total)}</strong>
      </div>
    </Form>
  );
}
function Inspection({ job, act }) {
  const [notes, setNotes] = useState(job.inspection || ''),
    [draft, setDraft] = useState(null),
    [assisted, setAssisted] = useState(job.aiAssisted),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  return (
    <Panel title="Inspection & intake" extra={<span className="muted">Technician review</span>}>
      <div className="complaint">
        <span className="eyebrow">CUSTOMER CONCERN</span>
        <p>{job.complaint}</p>
      </div>
      <Form
        submit="Save reviewed inspection"
        onSubmit={() => act('inspect', { inspection: notes, aiAssisted: assisted })}
      >
        <Field label="Inspection findings and checklist">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="5"
            required
            maxLength={4000}
            readOnly={!!job.invoice?.number}
          />
        </Field>
        {!job.invoice?.number && (
          <div className="ai-tools">
            <button
              type="button"
              className="button secondary"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  setDraft(
                    await post('/ai/intake', {
                      complaint: job.complaint,
                      make: job.vehicle.make,
                      model: job.vehicle.model,
                    }),
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Sparkles size={16} />
              {loading ? 'Preparing draft…' : 'AI intake suggestions'}
            </button>
            <span className="fine">Optional · local Ollama model</span>
          </div>
        )}
        {error && <Notice error>{error}</Notice>}
        {draft && (
          <div className="ai-draft">
            <strong>Draft — review before saving</strong>
            <p>{draft.summary}</p>
            <Badge value={draft.category} />
            <ul>
              {draft.checklist.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
            <strong>Questions to ask</strong>
            <ul>
              {draft.questions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
            <p className="fine">Inspection suggestions, not a confirmed diagnosis.</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setNotes(
                  `${draft.summary}\n\nSuggested checks:\n${draft.checklist.map((x) => `- ${x}`).join('\n')}\n\nQuestions:\n${draft.questions.map((x) => `- ${x}`).join('\n')}`,
                );
                setAssisted(true);
                setDraft(null);
              }}
            >
              Use draft in editable notes
            </button>
          </div>
        )}
      </Form>
    </Panel>
  );
}
function Invoice({ job, act, advisor, onRefresh }) {
  const [share, setShare] = useState(false);
  const invoice = job.invoice;
  if (!invoice?.number)
    return (
      <Panel title="Invoice">
        <p className="muted">An invoice can be issued after the vehicle passes quality check.</p>
        {advisor && job.status === 'Ready' && (
          <ActionButton onClick={() => act('invoice')}>Issue invoice</ActionButton>
        )}
      </Panel>
    );
  return (
    <Panel
      title="Invoice & payment"
      className="invoice-panel"
      extra={
        <div className="inline-actions no-print">
          <a className="button secondary small" href={`/api/jobs/${job._id}/invoice.pdf`}>
            Download PDF
          </a>
          <button className="button secondary small" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </button>
        </div>
      }
    >
      <div className="invoice-paper">
        <div className="invoice-head">
          <div>
            <h2>ServiceTrack</h2>
            <p>Vehicle service invoice</p>
            <small>Demonstration invoice · tax not configured</small>
          </div>
          <div>
            <strong>{invoice.number}</strong>
            <p>{when(invoice.issuedAt)}</p>
            <Badge
              value={
                invoice.payment?.testMode ? 'Test paid' : invoice.payment?.at ? 'Paid' : 'Unpaid'
              }
            />
          </div>
        </div>
        <div className="invoice-recipient">
          <strong>{invoice.customerName}</strong>
          <span>
            {invoice.registration} · Job {job.number}
          </span>
        </div>
        <Lines lines={invoice.lines} />
        <div className="invoice-total">
          <span>Total</span>
          <strong>{money(invoice.totalPaise)}</strong>
        </div>
        {invoice.payment?.at && (
          <div className="paid-line">
            <CheckCircle2 size={18} />
            {invoice.payment.testMode ? 'Simulated payment — no real money. ' : 'Paid by '}
            {invoice.payment.method} · {when(invoice.payment.at)}
            {invoice.payment.reference && ` · Ref: ${invoice.payment.reference}`}
          </div>
        )}
      </div>
      <div className="no-print">
        {advisor && !invoice.payment?.at && (
          <PaymentControls job={job} act={act} onRefresh={onRefresh} />
        )}
        {advisor && (
          <>
            <button className="button secondary" onClick={() => setShare(!share)}>
              {invoice.payment?.at
                ? 'Email payment receipt & invoice'
                : 'Email invoice / payment due'}
            </button>
            {share && (
              <CommunicationPanel
                key={String(invoice.payment?.at || 'unpaid')}
                kind="invoice"
                recordId={job._id}
                onClose={() => setShare(false)}
              />
            )}
          </>
        )}
        {advisor && invoice.payment?.at && job.status === 'Ready' && (
          <div className="delivery-action">
            <p>QC passed and full payment recorded. Confirm the vehicle has been handed over.</p>
            <ActionButton onClick={() => act('deliver')}>Confirm vehicle delivery</ActionButton>
          </div>
        )}
      </div>
    </Panel>
  );
}
export function JobDetail() {
  const { id } = useParams(),
    resource = useData(`/jobs/${id}`),
    parts = useData('/parts'),
    techs = useData('/technicians'),
    { user } = useSession();
  const [tab, setTab] = useState('Inspection'),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState('');
  const job = resource.data,
    advisor = user.role === 'advisor';
  if (resource.error) return <Notice error>{resource.error}</Notice>;
  if (!job || !parts.data || !techs.data)
    return parts.error || techs.error ? (
      <Notice error>{parts.error || techs.error}</Notice>
    ) : (
      <Loading />
    );
  const estimate = job.estimates.at(-1),
    closed = ['Delivered', 'Cancelled'].includes(job.status);
  async function act(action, body = {}) {
    setNotice('');
    try {
      const updated = await post(`/jobs/${id}/actions/${action}`, { ...body, version: job.__v });
      resource.setData(updated);
      await parts.reload();
      setNotice('Changes saved.');
      return updated;
    } catch (e) {
      await resource.reload();
      throw e;
    }
  }
  const tabs = ['Inspection', 'Estimate', 'Service & QC', 'Invoice', 'Activity'];
  return (
    <>
      <Link className="back-link no-print" to="/jobs">
        <ArrowLeft size={16} />
        All service jobs
      </Link>
      <Heading
        eyebrow="DIGITAL JOB CARD"
        title={job.number}
        description={`${job.vehicle.make} ${job.vehicle.model} · ${job.vehicle.registration}`}
      >
        <Badge value={job.status} />
      </Heading>
      <div className="job-summary no-print">
        <div>
          <span>Customer</span>
          <strong>{job.customer.name}</strong>
          <small>{job.customer.phone}</small>
        </div>
        <div>
          <span>Technician</span>
          <strong>{job.technician.name}</strong>
        </div>
        <div>
          <span>Odometer</span>
          <strong>{job.mileage.toLocaleString('en-IN')} km</strong>
        </div>
        <div>
          <span>Latest estimate</span>
          <strong>{estimate ? money(estimate.totalPaise) : 'Not prepared'}</strong>
        </div>
      </div>
      {notice && (
        <div className="no-print">
          <Notice>{notice}</Notice>
        </div>
      )}
      <div className="tabs no-print" role="tablist" aria-label="Job sections">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setNotice('');
            }}
            className={tab === t ? 'active' : ''}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="job-content">
        {tab === 'Inspection' &&
          (closed || job.invoice?.number ? (
            <Panel title="Inspection findings">
              <p className="pre-line">{job.inspection || 'No inspection notes recorded.'}</p>
            </Panel>
          ) : (
            <>
              <Inspection job={job} act={act} />
              {advisor && (
                <Panel title="Assignment">
                  <Form submit="Update assignment" onSubmit={(v) => act('assign', v)}>
                    <Field label="Technician">
                      <select name="technician" defaultValue={job.technician._id}>
                        {techs.data.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </Form>
                </Panel>
              )}
            </>
          ))}
        {tab === 'Estimate' && (
          <>
            <Panel
              title={estimate ? `Estimate · revision ${estimate.version}` : 'Service estimate'}
              extra={estimate && <Badge value={estimate.status} />}
            >
              {estimate ? (
                <>
                  <Lines lines={estimate.lines} />
                  <div className="invoice-total">
                    <span>Estimate total</span>
                    <strong>{money(estimate.totalPaise)}</strong>
                  </div>
                  {estimate.decision?.at && (
                    <p className="fine">
                      Advisor-recorded decision · {estimate.decision.method} ·{' '}
                      {when(estimate.decision.at)}
                      <br />
                      {estimate.decision.note}
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">
                  Save inspection findings, then prepare an itemised estimate.
                </p>
              )}
              {advisor &&
                !closed &&
                !job.invoice?.number &&
                !['Quality Check', 'Ready'].includes(job.status) && (
                  <button className="button secondary" onClick={() => setEditing(!editing)}>
                    {editing
                      ? 'Close editor'
                      : estimate
                        ? 'Prepare revised estimate'
                        : 'Prepare estimate'}
                  </button>
                )}
              {editing && (
                <EstimateBuilder
                  key={estimate?.version || 0}
                  parts={parts.data}
                  current={estimate}
                  onSave={async (v) => {
                    await act('estimate', v);
                    setEditing(false);
                  }}
                />
              )}
              {advisor &&
                !closed &&
                job.status === 'Awaiting Approval' &&
                estimate?.status === 'Pending' && (
                  <div className="decision">
                    <h3>Record the customer’s decision</h3>
                    <p className="fine">
                      Record approval only after speaking to the customer or receiving their
                      response.
                    </p>
                    <Form
                      submit="Record decision"
                      onSubmit={(v) =>
                        act('decision', {
                          approved: v.decision === 'approved',
                          method: v.method,
                          note: v.note,
                        })
                      }
                    >
                      <div className="two-cols">
                        <Field label="Decision">
                          <select name="decision">
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </Field>
                        <Field label="Contact method">
                          <select name="method">
                            <option>In person</option>
                            <option>Phone</option>
                            <option>Email</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Confirmation note">
                        <textarea
                          name="note"
                          required
                          maxLength={500}
                          rows="2"
                          placeholder="Who confirmed the decision, and what did they agree to?"
                        />
                      </Field>
                    </Form>
                  </div>
                )}
            </Panel>
            {job.estimates.length > 1 && (
              <Panel title="Previous estimate revisions">
                {job.estimates
                  .slice(0, -1)
                  .reverse()
                  .map((e) => (
                    <details key={e.version}>
                      <summary>
                        Revision {e.version} · {money(e.totalPaise)} · {e.status}
                      </summary>
                      <Lines lines={e.lines} />
                      <p className="fine">{e.decision?.note || 'No decision recorded'}</p>
                    </details>
                  ))}
              </Panel>
            )}
            {advisor &&
              !closed &&
              ['Under Inspection', 'Awaiting Approval', 'Approved'].includes(job.status) &&
              !job.partMovements.length &&
              !job.history.some(
                (h) => h.action === 'Status updated' && h.detail === 'In Service',
              ) && (
                <Panel title="Cancel unstarted work">
                  <Form submit="Cancel job" onSubmit={(v) => act('cancel', v)}>
                    <Field label="Reason for cancellation">
                      <input name="reason" required maxLength={500} />
                    </Field>
                  </Form>
                </Panel>
              )}
          </>
        )}
        {tab === 'Service & QC' && (
          <ServiceWorkspace job={job} parts={parts.data} act={act} advisor={advisor} />
        )}
        {tab === 'Invoice' && (
          <Invoice job={job} act={act} advisor={advisor} onRefresh={resource.reload} />
        )}
        {tab === 'Activity' && (
          <Panel title="Activity history">
            <ol className="timeline">
              {[...job.history].reverse().map((h, i) => (
                <li key={i}>
                  <span className="timeline-point" />
                  <div>
                    <strong>{h.action}</strong>
                    {h.detail && <p>{h.detail}</p>}
                    <small>
                      {h.by?.name || 'Workshop staff'} · {when(h.at)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>
    </>
  );
}
