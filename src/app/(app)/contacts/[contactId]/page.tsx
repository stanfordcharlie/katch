'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ContactRow = {
  id: string;
  user_id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  event: string | null;
  image: string | null;
  free_note: string | null;
  lead_score: number | null;
  source: string | null;
  synced_to_hubspot: boolean | null;
  ai_enrichment: Record<string, unknown> | null;
};

function scoreBadgeStyles(score: number | null | undefined): { bg: string; color: string } {
  const s = score == null || Number.isNaN(Number(score)) ? 0 : Number(score);
  if (s >= 7) return { bg: '#f0f7eb', color: '#2d6a1f' };
  if (s >= 4) return { bg: '#fff3eb', color: '#b07020' };
  return { bg: '#fde8e8', color: '#e55a5a' };
}

function formatSourceLabel(src: string | null): string {
  if (src === 'scan' || src == null) return 'Badge Scan';
  if (src === 'lead_list') return 'Lead List';
  return src || '—';
}

function talkingPointsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const raw = params.contactId;
  const contactId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';

  const [user, setUser] = useState<User | null>(null);
  const [contact, setContact] = useState<ContactRow | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const loadContact = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid || !contactId) {
      setUser(session?.user ? (session.user as User) : null);
      setContact(null);
      setLoading(false);
      return;
    }
    setUser(session.user as User);

    const { data, error } = await supabase
      .from('contacts')
      .select(
        'id, user_id, name, title, company, email, phone, linkedin, event, image, free_note, lead_score, source, synced_to_hubspot, ai_enrichment'
      )
      .eq('id', contactId)
      .eq('user_id', uid)
      .maybeSingle();

    if (error || !data) {
      setContact(null);
      setLoading(false);
      return;
    }

    const row = data as ContactRow;
    setContact(row);
    setNoteDraft(row.free_note ?? '');
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    void loadContact();
  }, [loadContact]);

  const handleNoteBlur = async () => {
    if (!contact || !user?.id) return;
    const next = noteDraft.trim();
    const prev = (contact.free_note ?? '').trim();
    if (next === prev) {
      setNoteSaveStatus('idle');
      return;
    }
    setNoteSaveStatus('saving');
    const { error } = await supabase
      .from('contacts')
      .update({ free_note: next || null })
      .eq('id', contact.id)
      .eq('user_id', user.id);
    if (error) {
      setNoteSaveStatus('error');
      return;
    }
    setContact((c) => (c ? { ...c, free_note: next || null } : null));
    setNoteSaveStatus('saved');
    setTimeout(() => setNoteSaveStatus('idle'), 1500);
  };

  const handleSyncHubSpot = async () => {
    if (!contact?.id) return;
    setIsSyncing(true);
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: [contact.id], userId: u?.id }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.alert('HubSpot not connected. Go to Settings → Integrations.');
        return;
      }
      if (data.succeeded > 0) {
        setContact((c) => (c ? { ...c, synced_to_hubspot: true } : null));
      } else {
        window.alert(`Sync failed: ${data.results?.[0]?.error || 'Unknown error'}`);
      }
    } catch {
      window.alert('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!contact || !user?.id) return;
    if (!window.confirm('Delete this contact? This cannot be undone.')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', contact.id).eq('user_id', user.id);
    if (error) {
      window.alert('Could not delete contact.');
      return;
    }
    router.push('/contacts');
  };

  if (!contactId) {
    return null;
  }

  const initials = (() => {
    const n = (contact?.name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return n.charAt(0).toUpperCase();
  })();

  const rawScore = contact?.lead_score ?? null;
  const scoreNum = rawScore == null || Number.isNaN(Number(rawScore)) ? null : Number(rawScore);
  const badge = scoreBadgeStyles(scoreNum);

  const ai = (contact?.ai_enrichment ?? null) as Record<string, unknown> | null;
  const summary = ai && typeof ai.summary === 'string' ? ai.summary : '';
  const icpReason = ai && typeof ai.icp_fit_reason === 'string' ? ai.icp_fit_reason : '';
  const bullets = talkingPointsList(ai?.talking_points);

  const subtitle = [contact?.title, contact?.company].filter(Boolean).join(' · ') || '—';

  const fieldGrid: { label: string; value: ReactNode }[] = contact
    ? [
        { label: 'Email', value: contact.email || '—' },
        { label: 'Phone', value: contact.phone || '—' },
        { label: 'Company', value: contact.company || '—' },
        { label: 'Title', value: contact.title || '—' },
        { label: 'Event', value: contact.event || '—' },
        { label: 'Source', value: formatSourceLabel(contact.source) },
        {
          label: 'LinkedIn',
          value: contact.linkedin ? (
            /^(https?:)?\/\//i.test(contact.linkedin.trim()) ? (
              <a
                href={
                  contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin.trim()}`
                }
                target='_blank'
                rel='noopener noreferrer'
                style={{ color: '#1a3a2a', fontWeight: 600 }}
              >
                {contact.linkedin}
              </a>
            ) : (
              contact.linkedin
            )
          ) : (
            '—'
          ),
        },
      ]
    : [];

  const fieldLabelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#999',
    marginBottom: 6,
  };

  const fieldValueStyle: CSSProperties = {
    fontSize: 15,
    color: '#111',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  };

  const primaryBtn: CSSProperties = {
    flex: 1,
    minWidth: 140,
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
    minWidth: 140,
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

  const hubspotBtn: CSSProperties = {
    flex: 1,
    minWidth: 140,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 999,
    border: '1px solid #ffd4c2',
    background: '#fff3ee',
    color: '#ff7a59',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const dangerBtn: CSSProperties = {
    flex: 1,
    minWidth: 140,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 10,
    border: '1px solid #f0caca',
    background: '#fff',
    color: '#e55a5a',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div
      className='max-w-2xl mx-auto min-h-screen'
      style={{
        background: '#f0f2f0',
        padding: 24,
        overflowX: 'hidden',
        maxWidth: '100vw',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <button
        type='button'
        onClick={() => router.push('/contacts')}
        aria-label='Back to contacts'
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
        <ArrowLeft size={22} color='#999' strokeWidth={2} />
      </button>

      {loading ? (
        <div style={{ color: '#666', fontSize: 14 }}>Loading…</div>
      ) : !contact ? (
        <div style={{ color: '#666', fontSize: 14 }}>Contact not found.</div>
      ) : (
        <>
          <div
            style={{
              position: 'relative',
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ position: 'absolute', top: 20, right: 20 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: badge.bg,
                  color: badge.color,
                }}
              >
                {scoreNum == null ? '—' : scoreNum}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 80 }}>
              {contact.image ? (
                <img
                  src={contact.image}
                  alt=''
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#f0f7eb',
                    color: '#2d6a1f',
                    fontSize: 22,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{contact.name || 'Unknown'}</h1>
                <p style={{ margin: 0, fontSize: 15, color: '#666', lineHeight: 1.4 }}>{subtitle}</p>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px 24px',
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            {fieldGrid.map((f) => (
              <div key={f.label} style={{ minWidth: 0 }}>
                <div style={fieldLabelStyle}>{f.label}</div>
                <div style={fieldValueStyle}>{f.value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111' }}>AI Insights</h2>
            {!summary && bullets.length === 0 && !icpReason ? (
              <p style={{ margin: 0, fontSize: 14, color: '#999' }}>No AI insights for this contact.</p>
            ) : (
              <>
                {summary ? (
                  <p style={{ margin: '0 0 14px', fontSize: 15, color: '#444', lineHeight: 1.55 }}>{summary}</p>
                ) : null}
                {bullets.length > 0 ? (
                  <ul style={{ margin: '0 0 14px', paddingLeft: 20, color: '#444', fontSize: 15, lineHeight: 1.5 }}>
                    {bullets.map((t, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {icpReason ? (
                  <p style={{ margin: 0, fontSize: 14, color: '#666', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: '#111' }}>ICP fit: </span>
                    {icpReason}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={fieldLabelStyle} htmlFor='free-note'>
              Free note
            </label>
            <textarea
              id='free-note'
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => void handleNoteBlur()}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                padding: 12,
                fontSize: 15,
                fontFamily: 'inherit',
                border: '1px solid #e8e8e8',
                borderRadius: 10,
                resize: 'vertical',
                color: '#111',
              }}
              placeholder='Notes…'
            />
            {noteSaveStatus === 'saving' ? (
              <span style={{ fontSize: 12, color: '#888', marginTop: 6, display: 'block' }}>Saving…</span>
            ) : noteSaveStatus === 'saved' ? (
              <span style={{ fontSize: 12, color: '#2d6a1f', marginTop: 6, display: 'block' }}>Saved</span>
            ) : noteSaveStatus === 'error' ? (
              <span style={{ fontSize: 12, color: '#e55a5a', marginTop: 6, display: 'block' }}>Could not save</span>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type='button' style={primaryBtn} onClick={() => router.push('/sequences')}>
              Generate Sequence
            </button>
            <button
              type='button'
              style={{ ...hubspotBtn, opacity: isSyncing ? 0.65 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
              onClick={() => void handleSyncHubSpot()}
              disabled={isSyncing}
            >
              <span style={{ fontWeight: 800, fontSize: 12 }}>H</span>
              {isSyncing ? 'Syncing…' : contact.synced_to_hubspot ? 'Re-sync to HubSpot' : 'Sync to HubSpot'}
            </button>
            <button type='button' style={secondaryBtn} onClick={() => router.push('/contacts')}>
              Edit
            </button>
            <button type='button' style={dangerBtn} onClick={() => void handleDelete()}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
