'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type EventRow = {
  id: string;
  user_id: string;
  name: string;
  date: string | null;
  type: string | null;
  location: string | null;
};

type ContactPreviewRow = {
  name: string | null;
  company: string | null;
  lead_score: number | null;
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const raw = params.eventId;
  const eventId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';

  const [user, setUser] = useState<User | null>(null);
  const [eventRow, setEventRow] = useState<EventRow | null>(null);
  const [contactCount, setContactCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [previewContacts, setPreviewContacts] = useState<ContactPreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBarLeft, setActionBarLeft] = useState(208);

  useEffect(() => {
    const readSidebarOffset = () => {
      try {
        const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        setActionBarLeft(collapsed ? 64 : 208);
      } catch {
        setActionBarLeft(208);
      }
    };
    readSidebarOffset();
    window.addEventListener('sidebarToggle', readSidebarOffset);
    return () => window.removeEventListener('sidebarToggle', readSidebarOffset);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        if (!cancelled) {
          setUser(null);
          setEventRow(null);
          setContactCount(0);
          setAvgScore(null);
          setPreviewContacts([]);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setUser(session.user as User);

      if (!eventId) {
        if (!cancelled) {
          setEventRow(null);
          setContactCount(0);
          setAvgScore(null);
          setPreviewContacts([]);
          setLoading(false);
        }
        return;
      }

      const { data: ev, error } = await supabase
        .from('events')
        .select('id, user_id, name, date, type, location')
        .eq('id', eventId)
        .eq('user_id', uid)
        .maybeSingle();

      if (cancelled) return;

      if (error || !ev) {
        setEventRow(null);
        setContactCount(0);
        setAvgScore(null);
        setPreviewContacts([]);
        setLoading(false);
        return;
      }

      const row = ev as EventRow;
      setEventRow(row);

      const eventName = row.name ?? '';
      const { data: contactRowsByName } = await supabase
        .from('contacts')
        .select('name, company, lead_score')
        .eq('user_id', uid)
        .ilike('event', eventName);

      let rows = (contactRowsByName ?? []) as ContactPreviewRow[];

      if (rows.length === 0) {
        const { data: contactRowsById } = await supabase
          .from('contacts')
          .select('name, company, lead_score')
          .eq('user_id', uid)
          .eq('event', eventId);
        if (cancelled) return;
        rows = (contactRowsById ?? []) as ContactPreviewRow[];
      }

      if (cancelled) return;
      console.log('[event detail] event.name:', row.name);
      console.log('[event detail] contacts query result:', rows);

      setContactCount(rows.length);
      setPreviewContacts(rows.slice(0, 5));
      const scores = rows
        .map((r) => (r.lead_score == null ? null : Number(r.lead_score)))
        .filter((n): n is number => n != null && !Number.isNaN(n));
      if (scores.length === 0) {
        setAvgScore(null);
      } else {
        setAvgScore(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!eventId) {
    return null;
  }

  if (!user && !loading) {
    return <div className="min-h-screen bg-[#f0f2f0]" />;
  }

  const dateValid = eventRow?.date && !Number.isNaN(new Date(eventRow.date).getTime());
  const dateLabel =
    dateValid && eventRow?.date
      ? new Date(eventRow.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  const subtitleParts: string[] = [];
  if (dateLabel) subtitleParts.push(dateLabel);
  if (eventRow?.type) subtitleParts.push(eventRow.type);
  const subtitleLine = subtitleParts.join(' · ');

  const avgLabel = avgScore == null ? '—' : avgScore.toFixed(1);

  const primaryBtn: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 10,
    border: 'none',
    background: '#1a3a2a',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const secondaryBtn: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 10,
    border: '1px solid #e8e8e8',
    background: '#fff',
    color: '#111',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const tableHeaderCell: CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '10px 12px 8px 0',
    borderBottom: '1px solid #e8e8e8',
  };

  const tableCell: CSSProperties = {
    fontSize: 14,
    color: '#111',
    padding: '12px 12px 12px 0',
    borderBottom: '1px solid #f0f0f0',
  };

  return (
    <div
      className="max-w-2xl mx-auto min-h-screen"
      style={{
        background: '#f0f2f0',
        padding: 24,
        overflowX: 'hidden',
        maxWidth: '100vw',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      {loading ? (
        <>
          <button
            type="button"
            onClick={() => router.push('/events')}
            aria-label="Back to events"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ArrowLeft size={22} color="#999" strokeWidth={2} />
          </button>
          <div style={{ color: '#666', fontSize: 14 }}>Loading…</div>
        </>
      ) : !eventRow ? (
        <>
          <button
            type="button"
            onClick={() => router.push('/events')}
            aria-label="Back to events"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ArrowLeft size={22} color="#999" strokeWidth={2} />
          </button>
          <div style={{ color: '#666', fontSize: 14 }}>Event not found.</div>
        </>
      ) : (
        <>
          <div style={{ paddingBottom: 100 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 24,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              className="event-hero-back-bg-ink-exempt"
              onClick={() => router.push('/events')}
              aria-label="Back to events"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <ArrowLeft size={22} color="#999" strokeWidth={2} />
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 500,
                  color: '#111',
                  lineHeight: 1.25,
                }}
              >
                {eventRow.name}
              </h1>
              {subtitleLine ? (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#999', lineHeight: 1.4 }}>
                  {subtitleLine}
                </p>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              width: '100%',
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 14,
              padding: '16px 0',
              marginBottom: 24,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '0 12px',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Contacts
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>{contactCount}</div>
            </div>
            <div
              style={{
                width: 1,
                alignSelf: 'stretch',
                flexShrink: 0,
                background: 'rgba(0,0,0,0.08)',
              }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '0 12px',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Avg score
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>{avgLabel}</div>
            </div>
            <div
              style={{
                width: 1,
                alignSelf: 'stretch',
                flexShrink: 0,
                background: 'rgba(0,0,0,0.08)',
              }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '0 12px',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Event type
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#111', wordBreak: 'break-word' }}>
                {eventRow.type ? eventRow.type.charAt(0).toUpperCase() + eventRow.type.slice(1) : '—'}
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 14,
              padding: 20,
              marginBottom: 24,
              boxSizing: 'border-box',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderCell}>Name</th>
                  <th style={tableHeaderCell}>Company</th>
                  <th style={{ ...tableHeaderCell, width: 72 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {previewContacts.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ ...tableCell, color: '#999', padding: '20px 0' }}>
                      No contacts for this event yet.
                    </td>
                  </tr>
                ) : (
                  previewContacts.map((c, i) => (
                    <tr key={i}>
                      <td style={tableCell}>{c.name || '—'}</td>
                      <td style={tableCell}>{c.company || '—'}</td>
                      <td style={tableCell}>{c.lead_score == null ? '—' : String(c.lead_score)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Link
                href="/contacts"
                style={{ fontSize: 14, fontWeight: 600, color: '#1a3a2a', textDecoration: 'none' }}
              >
                View all contacts
              </Link>
            </div>
          </div>
          </div>

          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: actionBarLeft,
              right: 0,
              background: 'rgba(240,242,240,0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(0,0,0,0.07)',
              padding: '12px 24px 24px',
              zIndex: 50,
              display: 'flex',
              gap: 12,
            }}
          >
            <button type="button" style={primaryBtn} onClick={() => router.push(`/dashboard/${eventId}`)}>
              View Dashboard
            </button>
            <button type="button" style={secondaryBtn} onClick={() => router.push('/sequences')}>
              Generate Sequences
            </button>
            <button
              type="button"
              style={secondaryBtn}
              onClick={() => router.push(`/contacts?event=${encodeURIComponent(eventRow.name)}`)}
            >
              View Contacts
            </button>
          </div>
        </>
      )}
    </div>
  );
}
