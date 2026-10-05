import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { post, money, when } from './api';
import { useData, Heading, Panel, Notice, Loading, Form, Field, Badge } from './components';
function NewPurchase({ parts, onSave }) {
  const [lines, setLines] = useState([{ part: '', quantity: 1, cost: 0 }]);
  const update = (i, key, value) =>
    setLines(lines.map((l, n) => (i === n ? { ...l, [key]: value } : l)));
  return (
    <Form
      submit="Record purchase order"
      onSubmit={(v) =>
        onSave({
          ...v,
          lines: lines.map((l) => ({
            part: l.part,
            quantity: Number(l.quantity),
            unitCostPaise: Math.round(Number(l.cost) * 100),
          })),
        })
      }
    >
      <div className="three-cols">
        <Field label="Supplier name">
          <input name="supplier" required maxLength={120} />
        </Field>
        <Field label="Supplier contact / reference">
          <input name="supplierContact" maxLength={100} />
        </Field>
        <Field label="Expected delivery">
          <input name="expectedDate" type="date" />
        </Field>
      </div>
      {lines.map((l, i) => (
        <div className="purchase-line" key={i}>
          <Field label="Part">
            <select value={l.part} onChange={(e) => update(i, 'part', e.target.value)} required>
              <option value="">Choose catalogue item</option>
              {parts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} · stock {p.stock}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order quantity">
            <input
              type="number"
              min="1"
              max="10000"
              step="1"
              value={l.quantity}
              onChange={(e) => update(i, 'quantity', e.target.value)}
              required
            />
          </Field>
          <Field label="Supplier cost per unit (₹)">
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              value={l.cost}
              onChange={(e) => update(i, 'cost', e.target.value)}
              required
            />
          </Field>
          <button
            type="button"
            aria-label={`Remove purchase line ${i + 1}`}
            className="icon-button danger"
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
          onClick={() => setLines([...lines, { part: '', quantity: 1, cost: 0 }])}
        >
          <Plus size={16} />
          Add item
        </button>
        <strong>
          Order value{' '}
          {money(
            lines.reduce((n, l) => n + Math.round(Number(l.quantity) * Number(l.cost) * 100), 0),
          )}
        </strong>
      </div>
      <Field label="Order notes">
        <textarea name="notes" rows={2} maxLength={1000} />
      </Field>
      <p className="fine">
        Records your order locally; it does not contact the supplier or spend money. Supplier cost
        is separate from the selling price.
      </p>
    </Form>
  );
}
function Receipt({ order, onSave }) {
  const [quantities, setQuantities] = useState({}),
    [requestId] = useState(() => crypto.randomUUID());
  return (
    <Form
      submit="Confirm goods received"
      onSubmit={(v) =>
        onSave({
          version: order.__v,
          requestId,
          note: v.note,
          lines: order.lines
            .map((l) => ({ part: l.part, quantity: Number(quantities[l.part] || 0) }))
            .filter((l) => l.quantity > 0),
        })
      }
    >
      <p className="muted">
        Enter only the quantities physically received now. Leave other lines at zero.
      </p>
      <div className="receipt-grid">
        {order.lines
          .filter((l) => l.received < l.quantity)
          .map((l) => (
            <Field key={l.part} label={`${l.name} · ${l.quantity - l.received} remaining`}>
              <input
                type="number"
                min="0"
                max={l.quantity - l.received}
                step="1"
                value={quantities[l.part] || 0}
                onChange={(e) => setQuantities({ ...quantities, [l.part]: e.target.value })}
              />
            </Field>
          ))}
      </div>
      <Field label="Delivery note / supplier bill reference">
        <input name="note" maxLength={500} required />
      </Field>
    </Form>
  );
}
export function Purchases() {
  const orders = useData('/purchases'),
    parts = useData('/parts');
  const [month, setMonth] = useState(new Date(Date.now() + 19800000).toISOString().slice(0, 7)),
    [show, setShow] = useState(false),
    [selected, setSelected] = useState(''),
    [all, setAll] = useState(false),
    [message, setMessage] = useState('');
  const summary = useData(`/purchases/summary?month=${month}`);
  if (orders.error || parts.error) return <Notice error>{orders.error || parts.error}</Notice>;
  if (!orders.data || !parts.data) return <Loading />;
  const current = orders.data.find((p) => p._id === selected),
    rows = orders.data.filter(
      (p) =>
        all ||
        new Date(new Date(p.createdAt).getTime() + 19800000).toISOString().slice(0, 7) === month,
    );
  async function refresh() {
    await orders.reload();
    await parts.reload();
    await summary.reload();
  }
  return (
    <>
      <Heading
        title="Purchasing"
        description="Track supplier orders, receive stock, and review procurement costs."
      >
        <button className="button primary" onClick={() => setShow(!show)}>
          <Plus size={18} />
          New purchase order
        </button>
      </Heading>
      {message && <Notice>{message}</Notice>}
      <div className="period-picker">
        <Field label="Reporting month">
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </Field>
        <span className="fine">
          Order value uses order date. Received cost uses the actual receipt date.
        </span>
      </div>
      {summary.error && <Notice error>{summary.error}</Notice>}
      {summary.data && (
        <div className="metrics">
          <div className="metric">
            <div>Orders this month</div>
            <strong>{summary.data.orderCount}</strong>
            <small>Excludes cancelled orders</small>
          </div>
          <div className="metric">
            <div>Ordered value</div>
            <strong>{money(summary.data.orderedPaise)}</strong>
            <small>Supplier purchase cost</small>
          </div>
          <div className="metric">
            <div>Goods received cost</div>
            <strong>{money(summary.data.receivedPaise)}</strong>
            <small>Not supplier payments or profit</small>
          </div>
          <div className="metric">
            <div>Open orders</div>
            <strong>{summary.data.openOrders}</strong>
            <small>Across all months</small>
          </div>
        </div>
      )}
      {show && (
        <Panel
          title="New purchase order"
          extra={
            <button className="text-button" onClick={() => setShow(false)}>
              Close
            </button>
          }
        >
          <NewPurchase
            parts={parts.data}
            onSave={async (v) => {
              const p = await post('/purchases', v);
              await refresh();
              setSelected(p._id);
              setShow(false);
              setMessage(`${p.number} recorded. Stock changes only when you receive goods.`);
            }}
          />
        </Panel>
      )}
      <Panel
        title="Order history"
        extra={
          <label className="check-field no-margin">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            All months
          </label>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Supplier</th>
                <th>Expected</th>
                <th>Status</th>
                <th>Value</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.number}</strong>
                    <small>{when(p.createdAt)}</small>
                  </td>
                  <td>{p.supplier}</td>
                  <td>{p.expectedDate || 'Not specified'}</td>
                  <td>
                    <Badge value={p.status} />
                  </td>
                  <td>{money(p.totalPaise)}</td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() => setSelected(selected === p._id ? '' : p._id)}
                    >
                      View / receive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty">No purchase orders for this period.</div>}
      </Panel>
      {current && (
        <Panel
          title={`${current.number} · ${current.supplier}`}
          extra={
            <button className="text-button" onClick={() => setSelected('')}>
              Close
            </button>
          }
        >
          <p className="muted">
            {current.supplierContact} {current.notes}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((l) => (
                  <tr key={l._id}>
                    <td>
                      {l.name}
                      <small>{l.sku}</small>
                    </td>
                    <td>{l.quantity}</td>
                    <td>{l.received}</td>
                    <td>{money(l.unitCostPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {['Ordered', 'Partially Received'].includes(current.status) && (
            <Receipt
              key={`${current._id}-${current.__v}`}
              order={current}
              onSave={async (v) => {
                if (!v.lines.length) throw new Error('Enter at least one received quantity.');
                try {
                  await post(`/purchases/${current._id}/receive`, v);
                  setMessage('Receipt saved and inventory updated.');
                } finally {
                  await refresh();
                }
              }}
            />
          )}
          {!!current.receipts.length && (
            <details open>
              <summary>Receipt history</summary>
              {current.receipts.map((r) => (
                <p key={r._id}>
                  {when(r.at)} · {money(r.totalPaise)} · {r.note}
                </p>
              ))}
            </details>
          )}
          {current.status === 'Ordered' && !current.receipts.length && (
            <details>
              <summary>Cancel unreceived order</summary>
              <Form
                submit="Confirm cancellation"
                onSubmit={async (v) => {
                  await post(`/purchases/${current._id}/cancel`, {
                    version: current.__v,
                    reason: v.reason,
                  });
                  await refresh();
                  setMessage('Purchase order cancelled.');
                }}
              >
                <Field label="Cancellation reason">
                  <input name="reason" required maxLength={500} />
                </Field>
              </Form>
            </details>
          )}
        </Panel>
      )}
      {summary.data?.topParts.length > 0 && (
        <Panel title="Largest received costs this month">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Units received</th>
                  <th>Purchase cost</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.topParts.map((p) => (
                  <tr key={p.part}>
                    <td>{p.name}</td>
                    <td>{p.quantity}</td>
                    <td>{money(p.costPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
