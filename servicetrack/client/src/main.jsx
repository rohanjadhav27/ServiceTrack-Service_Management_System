import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
  Link,
} from 'react-router-dom';
import {
  Wrench,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  UsersRound,
  Package,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { api, post } from './api';
import { Session, Loading, Notice, Form, Field, useSession } from './components';
import { Dashboard, Jobs } from './pages';
import { Bookings } from './booking-page';
import { Customers } from './customer-page';
import { Parts } from './inventory-page';
import { Purchases } from './purchasing-page';
import { JobDetail } from './job-detail';
import './styles.css';

function Login() {
  const { setUser } = useSession();
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Wrench />
          </span>
          ServiceTrack<span className="brand-period">.</span>
        </div>
        <div>
          <p className="eyebrow">FROM ARRIVAL TO HANDOVER</p>
          <h1>
            Every vehicle.
            <br />
            Every detail.
            <br />
            <span>Under control.</span>
          </h1>
          <p>
            Keep your workshop moving with clear job cards, approved estimates and a complete
            service history.
          </p>
        </div>
        <p className="login-foot">
          <ShieldCheck size={20} /> One workspace for your service team
        </p>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">WORKSHOP ACCESS</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your service workspace.</p>
          <Form
            submit="Sign in"
            onSubmit={async (values) => {
              const result = await post('/auth/login', values);
              setUser(result.user);
            }}
          >
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@workshop.com"
              />
            </Field>
            <Field label="Password">
              <input name="password" type="password" autoComplete="current-password" required />
            </Field>
          </Form>
          <p className="fine">Your access is based on your workshop role.</p>
        </div>
      </section>
    </main>
  );
}
function Shell() {
  const { user, setUser } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const links = [
    ['/', LayoutDashboard, 'Overview'],
    ['/jobs', ClipboardList, 'Service jobs'],
    ...(user.role === 'advisor'
      ? [
          ['/bookings', CalendarDays, 'Bookings'],
          ['/customers', UsersRound, 'Customers & vehicles'],
        ]
      : []),
    ['/parts', Package, 'Parts inventory'],
    ...(user.role === 'advisor' ? [['/purchases', ClipboardList, 'Purchasing']] : []),
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Wrench size={21} />
          </span>
          ServiceTrack<span className="brand-period">.</span>
        </Link>
        <div className="workspace-label">WORKSHOP WORKSPACE</div>
        <nav>
          {links.map(([to, Icon, title]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={19} />
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role === 'advisor' ? 'Service advisor' : 'Technician'}</small>
          </div>
          <button
            className="logout"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await post('/auth/logout');
                setUser(null);
                navigate('/');
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <span>
            Workshop / <strong>Service operations</strong>
          </span>
          <span>
            {new Date().toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Kolkata',
            })}{' '}
            <span className="timezone">IST</span>
          </span>
        </div>
        {error && <Notice error>{error}</Notice>}
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/parts" element={<Parts />} />
            {user.role === 'advisor' && (
              <>
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/customers" element={<Customers />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return (
    <Session.Provider value={{ user, setUser }}>
      {loading ? <Loading /> : user ? <Shell /> : <Login />}
    </Session.Provider>
  );
}
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
