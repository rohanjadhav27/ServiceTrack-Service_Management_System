import {
  createContext,
  useContext,
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
} from 'react';
import { X, LoaderCircle, ArrowUpRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, money } from './api';
export const Session = createContext(null);
export const useSession = () => useContext(Session);
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  async function reload() {
    try {
      setError('');
      const value = await api(path);
      setData(value);
      return value;
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error, reload, setData };
}
export function Notice({ error, children }) {
  return (
    <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" /> Loading workshop records…
    </div>
  );
}
export function Badge({ value }) {
  const tone = ['Delivered', 'Ready', 'Approved', 'Paid', 'Received', 'Test paid'].includes(value)
    ? 'green'
    : [
          'Awaiting Approval',
          'Awaiting Parts',
          'Quality Check',
          'Unpaid',
          'Ordered',
          'Partially Received',
        ].includes(value)
      ? 'amber'
      : ['Cancelled', 'Rejected'].includes(value)
        ? 'gray'
        : 'blue';
  return <span className={`badge ${tone}`}>{value}</span>;
}
export function Heading({ eyebrow, title, children, description }) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow || 'WORKSHOP MANAGEMENT'}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </header>
  );
}
export function Field({ label, children }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {isValidElement(children) ? cloneElement(children, { 'aria-labelledby': id }) : children}
    </label>
  );
}
export function Panel({ title, children, extra, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
export function Form({ onSubmit, children, submit = 'Save', className = '' }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError('');
        try {
          await onSubmit(Object.fromEntries(new FormData(form)), form);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {children}
        {error && <Notice error>{error}</Notice>}
        <button className="button primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : submit}
        </button>
      </fieldset>
    </form>
  );
}
export function ActionButton({ onClick, children, secondary = false, disabled = false }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="action-wrap">
      <button
        type="button"
        className={`button ${secondary ? 'secondary' : 'primary'}`}
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await onClick();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Working…' : children}
      </button>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
export function JobTable({ jobs, search = true }) {
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('All statuses');
  const rows = jobs.filter(
    (j) =>
      `${j.number} ${j.customer?.name} ${j.vehicle?.registration}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === 'All statuses' || j.status === status),
  );
  return (
    <>
      {search && (
        <div className="table-tools">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Search jobs"
              placeholder="Search job, customer or registration…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['All statuses', ...new Set(jobs.map((j) => j.status))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Job / vehicle</th>
              <th>Customer</th>
              <th>Technician</th>
              <th>Status</th>
              <th>Estimate</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j._id}>
                <td>
                  <Link className="strong" to={`/jobs/${j._id}`}>
                    {j.number}
                  </Link>
                  <small>
                    {j.vehicle?.registration} · {j.vehicle?.make} {j.vehicle?.model}
                  </small>
                </td>
                <td>{j.customer?.name}</td>
                <td>{j.technician?.name}</td>
                <td>
                  <Badge value={j.status} />
                </td>
                <td className="numeric">
                  {j.estimates.length ? money(j.estimates.at(-1).totalPaise) : 'Not prepared'}
                </td>
                <td>
                  <Link
                    className="icon-button"
                    aria-label={`Open ${j.number}`}
                    to={`/jobs/${j._id}`}
                  >
                    <ArrowUpRight size={20} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">No jobs match this view.</div>}
    </>
  );
}
