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

const HERO_GRADIENT =
  'linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)';

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

  const statCardStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: '#fff',
    border: '1px solid #e8e8e8',
    borderRadius: 12,
    padding: 20,
  };

  const statLabelStyle: CSSProperties = {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
    marginBottom: 8,
  };

  const statValueStyle: CSSProperties = {
    fontSize: 32,
    fontWeight: 700,
    color: '#111',
    lineHeight: 1.15,
  };

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
              width: '100%',
              background: HERO_GRADIENT,
              borderRadius: 16,
              padding: '24px 24px 28px',
              marginBottom: 24,
              boxSizing: 'border-box',
            }}
          >
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
              <ArrowLeft size={22} color="#ffffff" strokeWidth={2} />
            </button>
            <h1
              style={{
                margin: '0 0 10px',
                fontSize: 28,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.2,
              }}
            >
              {eventRow.name}
            </h1>
            {subtitleLine ? (
              <p style={{ margin: '0 0 8px', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                {subtitleLine}
              </p>
            ) : null}
            {eventRow.location ? (
              <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                {eventRow.location}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Contacts</div>
              <div style={statValueStyle}>{contactCount}</div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Avg Score</div>
              <div style={statValueStyle}>{avgLabel}</div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Event Type</div>
              <div style={{ ...statValueStyle, wordBreak: 'break-word' }}>{eventRow.type ?? '—'}</div>
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
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
              left: 0,
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
            <button type="button" style={secondaryBtn} onClick={() => router.push('/contacts')}>
              View Contacts
            </button>
          </div>
        </>
      )}
    </div>
  );
}
