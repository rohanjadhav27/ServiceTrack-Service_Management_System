import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { post, money, when } from './api';
import {
  useData,
  useSession,
  Heading,
  Panel,
  Notice,
  Loading,
  Form,
  Field,
  ActionButton,
} from './components';
function History() {
  const h = useData('/stock-history');
  return (
    <Panel title="Recent stock movements">
      {h.error ? (
        <Notice error>{h.error}</Notice>
      ) : !h.data ? (
        <Loading />
      ) : (
        <>
          <p className="fine">
            Latest 200 movements. Detailed tracking begins with this update; old opening balances
            are retained.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Part</th>
                  <th>Movement</th>
                  <th>Change</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {h.data.map((e) => (
                  <tr key={e._id}>
                    <td>{when(e.createdAt)}</td>
                    <td>{e.part?.name}</td>
                    <td>{e.type}</td>
                    <td className="numeric">
                      {e.change > 0 ? '+' : ''}
                      {e.change}
                    </td>
                    <td>
                      {e.note}
                      <small>{e.by?.name}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!h.data.length && <div className="empty">No new stock movements recorded yet.</div>}
        </>
      )}
    </Panel>
  );
}
export function Parts() {
  const { user } = useSession(),
    parts = useData('/parts'),
    [show, setShow] = useState(false),
    [restock, setRestock] = useState(''),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All'),
    [low, setLow] = useState(false),
    [history, setHistory] = useState(false),
    [message, setMessage] = useState('');
  if (parts.error) return <Notice error>{parts.error}</Notice>;
  if (!parts.data) return <Loading />;
  const filtered = parts.data.filter(
    (p) =>
      `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === 'All' || (p.category || 'General') === category) &&
      (!low || p.stock <= p.minimum),
  );
  return (
    <>
      <Heading
        title="Parts inventory"
        description="Catalogue, available stock and traceable stock movements."
      >
        {user.role === 'advisor' && (
          <>
            <Link className="button secondary" to="/purchases">
              Purchase orders
            </Link>
            <button className="button primary" onClick={() => setShow(!show)}>
              <Plus size={18} />
              Add part
            </button>
          </>
        )}
      </Heading>
      {message && <Notice>{message}</Notice>}
      {user.role === 'advisor' && (
        <div className="inventory-toolbar">
          <ActionButton
            secondary
            onClick={async () => {
              const r = await post('/catalogue/import');
              setMessage(r.message);
              await parts.reload();
            }}
          >
            Add sample catalogue
          </ActionButton>
          <button className="button secondary" onClick={() => setHistory(!history)}>
            {history ? 'Hide movements' : 'Stock movement history'}
          </button>
          <span className="fine">
            Sample prices are editable when creating your own SKUs. Imported items start at zero
            stock; confirm vehicle fitment.
          </span>
        </div>
      )}
      {show && (
        <Panel
          title="Add a stock item"
          extra={
            <button className="text-button" onClick={() => setShow(false)}>
              Close
            </button>
          }
        >
          <Form
            submit="Add stock item"
            onSubmit={async (v) => {
              const { price, stock, minimum, ...rest } = v;
              await post('/parts', {
                ...rest,
                pricePaise: Math.round(Number(price) * 100),
                stock: Number(stock),
                minimum: Number(minimum),
              });
              await parts.reload();
              setShow(false);
              setMessage('Part added.');
            }}
          >
            <div className="two-cols">
              <Field label="SKU">
                <input name="sku" required maxLength={40} />
              </Field>
              <Field label="Part name">
                <input name="name" required maxLength={100} />
              </Field>
            </div>
            <div className="three-cols">
              <Field label="Category">
                <input name="category" list="part-categories" defaultValue="General" required />
                <datalist id="part-categories">
                  {[
                    'Fluids',
                    'Filters',
                    'Brakes',
                    'Tyres',
                    'Electrical',
                    'Drivetrain',
                    'Body & cabin',
                    'Suspension',
                    'Consumables',
                    'EV accessories',
                  ].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Stock unit">
                <select name="unit">
                  {['unit', 'bottle', 'litre', 'set', 'pair', 'pack', 'can', 'tub'].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Selling price per unit (₹)">
                <input name="price" type="number" min="0" max="1000000" step="0.01" required />
              </Field>
            </div>
            <div className="three-cols">
              <Field label="Opening stock">
                <input
                  name="stock"
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  defaultValue="0"
                  required
                />
              </Field>
              <Field label="Low-stock threshold">
                <input
                  name="minimum"
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  defaultValue="3"
                  required
                />
              </Field>
              <Field label="Fitment / specification">
                <input
                  name="compatibility"
                  defaultValue="Confirm fitment"
                  maxLength={150}
                  required
                />
              </Field>
            </div>
          </Form>
        </Panel>
      )}
      {restock && (
        <Panel
          title={`Manual stock receipt · ${parts.data.find((p) => p._id === restock)?.name}`}
          extra={
            <button className="text-button" onClick={() => setRestock('')}>
              Close
            </button>
          }
        >
          <p className="fine">
            If these items belong to a purchase order, receive them on that order instead to keep
            cost history accurate.
          </p>
          <Form
            submit="Record stock received"
            onSubmit={async (v) => {
              await post(`/parts/${restock}/restock`, {
                quantity: Number(v.quantity),
                note: v.note,
              });
              await parts.reload();
              setRestock('');
              setMessage('Stock receipt recorded.');
            }}
          >
            <div className="two-cols">
              <Field label="Quantity received">
                <input name="quantity" type="number" min="1" max="10000" step="1" required />
              </Field>
              <Field label="Reference / reason">
                <input name="note" maxLength={500} required placeholder="e.g. Supplier bill 041" />
              </Field>
            </div>
          </Form>
        </Panel>
      )}
      {history && user.role === 'advisor' && (
        <History key={parts.data.map((p) => p.stock).join(',')} />
      )}
      <Panel title="Stock register" extra={<span className="muted">{filtered.length} items</span>}>
        <div className="table-tools">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Search inventory"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part or SKU"
            />
          </div>
          <select
            aria-label="Part category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {['All', ...new Set(parts.data.map((p) => p.category || 'General'))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="check-field no-margin">
            <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />
            Low stock only
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Part / SKU</th>
                <th>Price / unit</th>
                <th>Available</th>
                <th>Stock level</th>
                {user.role === 'advisor' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.category || 'General'}
                    </small>
                    <small>{p.compatibility || 'Confirm fitment'}</small>
                  </td>
                  <td>
                    {money(p.pricePaise)}
                    <small>per {p.unit || 'unit'}</small>
                  </td>
                  <td>
                    {p.stock}
                    <small>Minimum {p.minimum}</small>
                  </td>
                  <td>
                    <span className={`badge ${p.stock <= p.minimum ? 'amber' : 'green'}`}>
                      {!p.stock ? 'Out of stock' : p.stock <= p.minimum ? 'Low stock' : 'Available'}
                    </span>
                  </td>
                  {user.role === 'advisor' && (
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() => {
                          setRestock(p._id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Record receipt
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty">No matching items. Adjust filters or add a part.</div>
        )}
      </Panel>
    </>
  );
}
