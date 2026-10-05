import { useState } from 'react';
import { useData, Panel, Loading, Notice, ActionButton } from './components';
import { post, when } from './api';
export function CommunicationPanel({ kind, recordId, onClose }) {
  const draft = useData(`/communications/${kind}/${recordId}/preview`),
    history = useData(`/communications/${kind}/${recordId}/history`);
  const [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState('');
  if (draft.error) return <Notice error>{draft.error}</Notice>;
  if (!draft.data) return <Loading />;
  const d = draft.data;
  let phone = (d.phone || '').replace(/\D/g, '');
  if (phone.length === 10) phone = `91${phone}`;
  return (
    <Panel
      title={kind === 'booking' ? 'Booking confirmation' : 'Invoice & payment email'}
      extra={
        <button className="text-button" onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className="message-meta">
        <div>
          <dt>Recipient</dt>
          <dd>{d.to || 'No email saved — edit the customer first'}</dd>
        </div>
        <div>
          <dt>Subject</dt>
          <dd>{d.subject}</dd>
        </div>
        {d.attachment && (
          <div>
            <dt>Attachment</dt>
            <dd>{d.attachment}</dd>
          </div>
        )}
      </dl>
      <label className="field">
        <span>Message preview</span>
        <textarea readOnly rows={9} value={d.text} />
      </label>
      <div className="inline-actions">
        <ActionButton
          secondary
          onClick={async () => {
            await navigator.clipboard.writeText(d.text);
            setMessage('Message copied. No message has been sent.');
          }}
        >
          Copy message
        </ActionButton>
        {d.to && (
          <a
            className="button secondary"
            href={`mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.text)}`}
          >
            Open email draft
          </a>
        )}
        {phone.length >= 10 && phone.length <= 15 && (
          <a
            className="button secondary"
            href={`https://wa.me/${phone}?text=${encodeURIComponent(d.text)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open WhatsApp draft
          </a>
        )}
      </div>
      <p className="fine">
        Draft buttons do not send automatically.
        {d.attachment
          ? ' For an email or WhatsApp draft, download the PDF and attach it yourself. SMTP email includes the PDF automatically.'
          : ''}
      </p>
      {d.canSend && d.to ? (
        <>
          <label className="check-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the recipient and want to send this email.
          </label>
          <ActionButton
            disabled={!confirmed}
            onClick={async () => {
              const result = await post(`/communications/${kind}/${recordId}/email`, {
                to: d.to,
                confirmed: true,
              });
              setMessage(result.message);
              setConfirmed(false);
              await history.reload();
            }}
          >
            Send email
          </ActionButton>
        </>
      ) : (
        <p className="muted">
          Direct email is available when SMTP is configured and the customer has an email address.
        </p>
      )}
      {message && <Notice>{message}</Notice>}
      {history.data?.length > 0 && (
        <details>
          <summary>Email submission history</summary>
          {history.data.map((h) => (
            <p key={h._id}>
              {h.status} · {h.to} · {when(h.createdAt)}
            </p>
          ))}
        </details>
      )}
    </Panel>
  );
}
