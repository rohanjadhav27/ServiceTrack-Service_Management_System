import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api, post } from './api';
import { useData, Heading, Panel, Notice, Loading, Form, Field, JobTable } from './components';
import { VehicleFields } from './vehicle-fields';
export function Customers() {
  const customers = useData('/customers'),
    vehicles = useData('/vehicles'),
    jobs = useData('/jobs');
  const [mode, setMode] = useState(''),
    [selected, setSelected] = useState(''),
    [edit, setEdit] = useState(null),
    [search, setSearch] = useState(''),
    [message, setMessage] = useState(''),
    [owner, setOwner] = useState('');
  if (customers.error || vehicles.error)
    return <Notice error>{customers.error || vehicles.error}</Notice>;
  if (!customers.data || !vehicles.data) return <Loading />;
  const filtered = vehicles.data.filter((v) =>
    `${v.registration} ${v.make} ${v.model} ${v.customer?.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Customers & vehicles"
        description="Keep customer details, vehicles and service history together."
      >
        <button
          className="button secondary"
          onClick={() => {
            setMode('vehicle');
            setEdit(null);
          }}
        >
          Register vehicle
        </button>
        <button
          className="button primary"
          onClick={() => {
            setMode('customer');
            setEdit(null);
          }}
        >
          <Plus size={18} />
          Add customer
        </button>
      </Heading>
      {message && <Notice>{message}</Notice>}
      {(mode === 'customer' || edit) && (
        <Panel
          title={edit ? 'Edit customer details' : 'Add customer'}
          extra={
            <button
              className="text-button"
              onClick={() => {
                setMode('');
                setEdit(null);
              }}
            >
              Close
            </button>
          }
        >
          <Form
            key={edit?._id || 'new'}
            submit={edit ? 'Save customer' : 'Save customer & register vehicle'}
            onSubmit={async (v) => {
              if (edit) {
                await api(`/customers/${edit._id}`, { method: 'PUT', body: v });
                setEdit(null);
                setMode('');
                setMessage('Customer details updated.');
              } else {
                const c = await post('/customers', v);
                setOwner(c._id);
                setMode('vehicle');
                setMessage('Customer saved. Register their vehicle next.');
              }
              await customers.reload();
              await vehicles.reload();
            }}
          >
            <div className="three-cols">
              <Field label="Full name">
                <input name="name" defaultValue={edit?.name || ''} required maxLength={100} />
              </Field>
              <Field label="Contact number">
                <input name="phone" type="tel" defaultValue={edit?.phone || ''} required />
              </Field>
              <Field label="Email — for confirmations and invoices">
                <input name="email" type="email" defaultValue={edit?.email || ''} />
              </Field>
            </div>
          </Form>
        </Panel>
      )}
      {mode === 'vehicle' && !edit && (
        <Panel
          title="Register a vehicle"
          extra={
            <button className="text-button" onClick={() => setMode('')}>
              Close
            </button>
          }
        >
          <Form
            submit="Save vehicle"
            onSubmit={async (v) => {
              const { batteryPercent, ...rest } = v;
              await post('/vehicles', {
                ...rest,
                ...(batteryPercent !== undefined && batteryPercent !== ''
                  ? { batteryPercent: Number(batteryPercent) }
                  : {}),
              });
              await vehicles.reload();
              setMode('');
              setMessage('Vehicle registered. You can now book its first service.');
            }}
          >
            <div className="two-cols">
              <Field label="Owner">
                <select
                  name="customer"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  required
                >
                  <option value="">Select customer</option>
                  {customers.data.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Registration number">
                <input name="registration" required maxLength={20} placeholder="MH11AB1234" />
              </Field>
            </div>
            <VehicleFields />
          </Form>
        </Panel>
      )}
      <Panel
        title="Registered vehicles"
        extra={<span className="muted">{vehicles.data.length} vehicles</span>}
      >
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Search vehicles"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search owner, make, model or registration"
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Owner / contact</th>
                <th>Powertrain & colour</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v._id}>
                  <td>
                    <strong>{v.registration}</strong>
                    <small>
                      {v.make} {v.model}
                    </small>
                  </td>
                  <td>
                    {v.customer?.name}
                    <small>{v.customer?.phone}</small>
                  </td>
                  <td>
                    <span className={`badge ${v.fuelType === 'Electric' ? 'green' : 'gray'}`}>
                      {v.fuelType || 'Not recorded'}
                    </span>
                    <small>
                      {v.color || 'Colour not recorded'}
                      {v.batteryPercent !== undefined
                        ? ` · Intake charge ${v.batteryPercent}%`
                        : ''}
                    </small>
                  </td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() => setSelected(selected === v._id ? '' : v._id)}
                    >
                      Service history
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty">No vehicles match. Register a vehicle to get started.</div>
        )}
      </Panel>
      {selected && (
        <Panel
          title={`Service history · ${vehicles.data.find((v) => v._id === selected)?.registration}`}
          extra={
            <button className="text-button" onClick={() => setSelected('')}>
              Close
            </button>
          }
        >
          <JobTable
            jobs={(jobs.data || []).filter((j) => j.vehicle?._id === selected)}
            search={false}
          />
        </Panel>
      )}
      <Panel title="Customer directory">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.data.map((c) => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.email || 'Not recorded'}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEdit(c);
                        setMode('');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
