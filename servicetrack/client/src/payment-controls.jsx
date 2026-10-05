import { useState } from 'react';
import { post, money } from './api';
import { useData, Field, Form, Notice, ActionButton } from './components';
let scriptPromise;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      scriptPromise = null;
      reject(new Error('Checkout did not load. Check your internet connection.'));
    }, 20000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error('Unable to load Razorpay checkout.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}
export function PaymentControls({ job, act, onRefresh }) {
  const integrations = useData('/integrations'),
    order = useData(`/jobs/${job._id}/payment-order`),
    [method, setMethod] = useState('Cash'),
    [message, setMessage] = useState('');
  const online = method === 'online' || !!order.data;
  async function checkout() {
    setMessage('');
    await loadCheckout();
    const config = await post(`/jobs/${job._id}/payment-order`);
    await order.reload();
    await onRefresh();
    return new Promise((resolve, reject) => {
      let verifying = false,
        settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const checkout = new window.Razorpay({
        key: config.key,
        order_id: config.orderId,
        amount: config.amount,
        currency: config.currency,
        name: config.name,
        description: config.description,
        prefill: config.customer,
        config: {
          display: {
            blocks: { upi: { name: 'UPI · test mode', instruments: [{ method: 'upi' }] } },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false },
          },
        },
        theme: { color: '#255be7' },
        handler: async (response) => {
          verifying = true;
          try {
            const r = await post(`/jobs/${job._id}/payment-verify`, response);
            setMessage(r.message);
            await onRefresh();
            settled = true;
            resolve();
          } catch (error) {
            fail(error);
          }
        },
        modal: {
          ondismiss: () => {
            if (!verifying)
              fail(
                new Error(
                  'Checkout closed. The invoice remains unpaid unless the server verifies a captured payment.',
                ),
              );
          },
        },
      });
      checkout.on('payment.failed', (response) => {
        checkout.close();
        fail(
          new Error(
            response.error?.description || 'Test payment failed. You can retry the same order.',
          ),
        );
      });
      checkout.open();
    });
  }
  return (
    <div className="payment-controls">
      <Field label="Payment method">
        <select
          value={order.data ? 'online' : method}
          onChange={(e) => setMethod(e.target.value)}
          disabled={!!order.data}
        >
          <option value="Cash">Cash already received</option>
          <option value="UPI">UPI already received — manual record</option>
          <option value="Card">Card already received — manual record</option>
          <option value="online">Online UPI — Razorpay test checkout</option>
        </select>
      </Field>
      {integrations.error && <Notice error>{integrations.error}</Notice>}
      {order.error && <Notice error>{order.error}</Notice>}
      {online ? (
        <>
          <Notice>
            Razorpay TEST mode. No real money is charged. The official checkout opens after you
            click below.
          </Notice>
          {!integrations.data?.razorpay && (
            <p className="muted">
              Online checkout is not configured. The advisor can enable it with test credentials.
            </p>
          )}
          <div className="inline-actions">
            <ActionButton
              disabled={
                !integrations.data?.razorpay ||
                order.data?.state === 'Unknown' ||
                order.data?.state === 'Creating'
              }
              onClick={checkout}
            >
              Open UPI test checkout · {money(job.invoice.totalPaise)}
            </ActionButton>
            {order.data?.orderId && (
              <ActionButton
                secondary
                onClick={async () => {
                  const r = await post(`/jobs/${job._id}/payment-reconcile`);
                  setMessage(r.message);
                  await onRefresh();
                  await order.reload();
                }}
              >
                Check payment status
              </ActionButton>
            )}
          </div>
          {order.data && (
            <p className="fine">
              Order: {order.data.orderId || 'Outcome unknown — check the Razorpay test dashboard'} ·{' '}
              {order.data.state}. Once an online order starts, finish or reconcile it here to avoid
              a second payment record.
            </p>
          )}
        </>
      ) : (
        <Form
          submit={`Record full payment · ${money(job.invoice.totalPaise)}`}
          onSubmit={(v) => act('payment', { method, reference: v.reference || '' })}
        >
          {method !== 'Cash' && (
            <Field label="Payment reference">
              <input name="reference" required maxLength={100} />
            </Field>
          )}
          <p className="fine">
            Confirm the money has already been received. This action does not charge the customer.
          </p>
        </Form>
      )}
      {message && <Notice>{message}</Notice>}
    </div>
  );
}
