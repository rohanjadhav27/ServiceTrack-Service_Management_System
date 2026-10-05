import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { post } from './api';
import {
  useData,
  Heading,
  Panel,
  Notice,
  Loading,
  Form,
  Field,
  Badge,
  ActionButton,
} from './components';
import { CommunicationPanel } from './communication-panel';
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
export function Bookings() {
  const bookings = useData('/bookings'),
    vehicles = useData('/vehicles'),
    techs = useData('/technicians');
  const [show, setShow] = useState(false),
    [checkIn, setCheckIn] = useState(''),
    [cancel, setCancel] = useState(''),
    [notify, setNotify] = useState(''),
    [day, setDay] = useState(today()),
    [slot, setSlot] = useState(''),
    [filter, setFilter] = useState('Scheduled');
  const slots = useData(`/slots?day=${day}`),
    navigate = useNavigate();
  useEffect(() => {
    const refresh = () => {
      slots.reload();
      bookings.reload();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [day]);
  if (bookings.error || vehicles.error || techs.error)
    return <Notice error>{bookings.error || vehicles.error || techs.error}</Notice>;
  if (!bookings.data || !vehicles.data || !techs.data) return <Loading />;
  return (
    <>
      <Heading
        title="Bookings"
        description="Reserve an arrival slot, then check the vehicle in when it arrives."
      >
        <button className="button primary" onClick={() => setShow(!show)}>
          <Plus size={18} />
          New booking
        </button>
      </Heading>
      {show && (
        <Panel
          title="Schedule an appointment"
          extra={
            <button className="text-button" onClick={() => setShow(false)}>
              Close
            </button>
          }
        >
          <Form
            submit="Confirm booking"
            onSubmit={async (v) => {
              const vehicle = vehicles.data.find((x) => x._id === v.vehicle);
              if (!slot) throw new Error('Choose an available arrival slot.');
              try {
                const booking = await post('/bookings', {
                  vehicle: v.vehicle,
                  customer: vehicle.customer._id,
                  slot,
                  serviceType: v.serviceType,
                  complaint: v.complaint,
                });
                await bookings.reload();
                setShow(false);
                setSlot('');
                setNotify(booking._id);
              } finally {
                await slots.reload();
              }
            }}
          >
            {!vehicles.data.length && (
              <Notice>
                <Link to="/customers">Register a customer and vehicle</Link> before booking.
              </Notice>
            )}
            <div className="two-cols">
              <Field label="Vehicle and customer">
                <select name="vehicle" required>
                  <option value="">Choose a registered vehicle</option>
                  {vehicles.data.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.registration} · {v.customer?.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Service type">
                <select name="serviceType">
                  {['Routine Maintenance', 'Repair', 'Inspection'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Arrival date (India time)">
              <input
                type="date"
                value={day}
                onChange={(e) => {
                  if (e.target.value) {
                    setDay(e.target.value);
                    setSlot('');
                  }
                }}
                min={today()}
                required
              />
            </Field>
            <div className="slot-legend">
              <span>Available · arrival places remain</span>
              <span>Full · all places reserved</span>
              <span>Past · time has passed</span>
            </div>
            {slots.error ? (
              <Notice error>{slots.error}</Notice>
            ) : !slots.data ? (
              <Loading />
            ) : (
              <div className="slot-grid" role="group" aria-label="Arrival slots">
                {Array.from(
                  { length: 18 },
                  (_, i) =>
                    `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
                ).map((time) => {
                  const key = `${day}T${time}`,
                    booked = slots.data.counts[key] || 0,
                    left = Math.max(0, slots.data.capacity - booked),
                    past = new Date(key + ':00+05:30') <= new Date();
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`slot ${slot === key ? 'selected' : ''}`}
                      disabled={past || !left}
                      aria-pressed={slot === key}
                      onClick={() => setSlot(key)}
                    >
                      <strong>{time}</strong>
                      <span>{past ? 'Past' : !left ? 'Full' : `${left} available`}</span>
                      <small>
                        {booked}/{slots.data.capacity} booked
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="fine">
              {slot ? `Selected: ${slot.replace('T', ' · ')} IST` : 'Choose one available slot.'}{' '}
              Availability refreshes every 30 seconds and is checked again when you save. Slots
              limit arrivals, not repair duration.
            </p>
            <Field label="Customer’s reported concern">
              <textarea name="complaint" rows={3} maxLength={2000} required />
            </Field>
          </Form>
        </Panel>
      )}
      {notify && (
        <CommunicationPanel
          key={notify}
          kind="booking"
          recordId={notify}
          onClose={() => setNotify('')}
        />
      )}
      <Panel
        title="Appointment register"
        extra={
          <select
            className="compact-select"
            aria-label="Booking status filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {['Scheduled', 'Checked In', 'Cancelled', 'All'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Arrival · IST</th>
                <th>Vehicle / customer</th>
                <th>Service</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.data
                .filter((b) => filter === 'All' || b.status === filter)
                .map((b) => (
                  <tr key={b._id}>
                    <td>
                      <strong>{b.slot.slice(11)}</strong>
                      <small>{b.slot.slice(0, 10)}</small>
                    </td>
                    <td>
                      <strong>{b.vehicle?.registration}</strong>
                      <small>{b.customer?.name}</small>
                    </td>
                    <td>{b.serviceType}</td>
                    <td>
                      <Badge value={b.status} />
                    </td>
                    <td>
                      <div className="inline-actions">
                        {b.status === 'Scheduled' ? (
                          <>
                            <button
                              className="button secondary small"
                              onClick={() => {
                                setCheckIn(b._id);
                                setCancel('');
                              }}
                            >
                              Check in
                            </button>
                            <button
                              className="text-button"
                              onClick={() => {
                                setCancel(b._id);
                                setCheckIn('');
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : b.job ? (
                          <Link className="text-link" to={`/jobs/${b.job}`}>
                            Open job
                            <ArrowRight size={16} />
                          </Link>
                        ) : null}
                        {b.status !== 'Cancelled' && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setNotify(b._id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            Confirmation
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!bookings.data.some((b) => filter === 'All' || b.status === filter) && (
          <div className="empty">No bookings in this view.</div>
        )}
      </Panel>
      {checkIn && (
        <Panel
          title={`Check in · ${bookings.data.find((b) => b._id === checkIn)?.vehicle?.registration}`}
          extra={
            <button className="text-button" onClick={() => setCheckIn('')}>
              Close
            </button>
          }
        >
          <Form
            submit="Confirm check-in"
            onSubmit={async (v) => {
              const j = await post(`/bookings/${checkIn}/check-in`, {
                technician: v.technician,
                mileage: Number(v.mileage),
              });
              navigate(`/jobs/${j._id}`);
            }}
          >
            <div className="two-cols">
              <Field label="Assign technician">
                <select name="technician" required>
                  <option value="">Choose technician</option>
                  {techs.data.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Odometer reading (km)">
                <input name="mileage" type="number" min="0" max="2000000" step="1" required />
              </Field>
            </div>
          </Form>
        </Panel>
      )}
      {cancel && (
        <Panel
          title="Cancel this appointment?"
          extra={
            <button className="text-button" onClick={() => setCancel('')}>
              Keep booking
            </button>
          }
        >
          <p>The reserved arrival place will become available again.</p>
          <ActionButton
            onClick={async () => {
              await post(`/bookings/${cancel}/cancel`);
              setCancel('');
              await bookings.reload();
              await slots.reload();
            }}
          >
            Confirm cancellation
          </ActionButton>
        </Panel>
      )}
    </>
  );
}
