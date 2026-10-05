import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Plus,
  ClipboardList,
  Clock3,
  CircleCheck,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { post, money } from './api';
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
  JobTable,
} from './components';

export function Dashboard() {
  const { user } = useSession(),
    { data: jobs, error } = useData('/jobs'),
    parts = useData('/parts');
  if (error) return <Notice error>{error}</Notice>;
  if (!jobs) return <Loading />;
  const active = jobs.filter((j) => !['Delivered', 'Cancelled'].includes(j.status));
  const pending = jobs.filter((j) => j.status === 'Awaiting Approval'),
    ready = jobs.filter((j) => j.status === 'Ready');
  const revenue = jobs.reduce(
    (n, j) => n + (j.invoice?.payment?.testMode ? 0 : j.invoice?.payment?.amountPaise || 0),
    0,
  );
  const metrics = [
    ['Active jobs', active.length, ClipboardList, 'In the workshop'],
    ['Awaiting approval', pending.length, Clock3, 'Customer decision needed'],
    ['Ready for delivery', ready.length, CircleCheck, 'Quality checks passed'],
    ['Payments collected', money(revenue), Wallet, 'Excludes simulated test payments'],
  ];
  const low = parts.data?.filter((p) => p.stock <= p.minimum) || [];
  return (
    <>
      <Heading
        eyebrow="WORKSHOP OVERVIEW"
        title={`Good to see you, ${user.name.split(' ')[0]}`}
        description="Here’s where your workshop stands."
      >
        {user.role === 'advisor' && (
          <Link className="button primary" to="/bookings">
            <Plus size={18} />
            New booking
          </Link>
        )}
      </Heading>
      <div className="metrics">
        {metrics.map(([label, value, Icon, note]) => (
          <div className="metric" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <Panel
          title="Workshop flow"
          extra={<span className="muted">{active.length} active jobs</span>}
        >
          <div className="flow-counts">
            {[
              'Under Inspection',
              'Awaiting Approval',
              'In Service',
              'Awaiting Parts',
              'Quality Check',
              'Ready',
            ].map((s) => (
              <div key={s}>
                <span>{s}</span>
                <strong>{jobs.filter((j) => j.status === s).length}</strong>
                <div className="flow-track">
                  <i
                    style={{
                      width: `${active.length ? Math.max(4, (jobs.filter((j) => j.status === s).length / active.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Needs attention" className="attention">
          <div className="attention-item">
            <Clock3 size={20} />
            <div>
              <strong>
                {pending.length} pending approval{pending.length !== 1 ? 's' : ''}
              </strong>
              <p>Follow up before repair work begins.</p>
            </div>
          </div>
          <div className="attention-item">
            <AlertTriangle size={20} />
            <div>
              <strong>
                {low.length} part{low.length !== 1 ? 's' : ''} at low stock
              </strong>
              <p>
                {low
                  .slice(0, 2)
                  .map((p) => p.name)
                  .join(', ') || 'Stock levels are healthy.'}
              </p>
            </div>
          </div>
          <Link className="text-link" to="/parts">
            Review inventory <ArrowRight size={16} />
          </Link>
        </Panel>
      </div>
      <Panel
        title="Active service jobs"
        extra={
          <Link className="text-link" to="/jobs">
            View all jobs <ArrowRight size={16} />
          </Link>
        }
      >
        <JobTable jobs={active} search={false} />
      </Panel>
    </>
  );
}
export function Jobs() {
  const { data, error } = useData('/jobs');
  return (
    <>
      <Heading title="Service jobs" description="Follow every vehicle from check-in to handover." />
      {error ? (
        <Notice error>{error}</Notice>
      ) : !data ? (
        <Loading />
      ) : (
        <Panel title="All job cards" extra={<span className="muted">{data.length} records</span>}>
          <JobTable jobs={data} />
        </Panel>
      )}
    </>
  );
}
