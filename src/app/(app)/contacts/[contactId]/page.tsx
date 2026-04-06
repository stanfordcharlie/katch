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
  checks?: string[] | null;
};

type DetailEditForm = {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
};

type SeqTone = 'professional' | 'friendly' | 'direct';
type SeqCadenceStep = { day: number; tone: SeqTone };

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
  const [eventDisplayLabel, setEventDisplayLabel] = useState('—');
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showEditModal, setShowEditModal] = useState(false);
  const [detailEditForm, setDetailEditForm] = useState<DetailEditForm | null>(null);
  const [sequenceDrawerContact, setSequenceDrawerContact] = useState<ContactRow | null>(null);
  const [sequenceCadence, setSequenceCadence] = useState<SeqCadenceStep[]>([
    { day: 1, tone: 'professional' },
    { day: 4, tone: 'professional' },
    { day: 14, tone: 'professional' },
  ]);
  const [sequenceContext, setSequenceContext] = useState('');
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceEmails, setSequenceEmails] = useState<{ day: number; subject: string; body: string }[] | null>(null);
  const [sequenceSaving, setSequenceSaving] = useState(false);
  const [sequenceDrawerExpanded, setSequenceDrawerExpanded] = useState<Record<number, boolean>>({});
  const [sequenceDrawerEditIdx, setSequenceDrawerEditIdx] = useState<number | null>(null);

  const loadContact = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid || !contactId) {
      setUser(session?.user ? (session.user as User) : null);
      setContact(null);
      setEventDisplayLabel('—');
      setLoading(false);
      return;
    }
    setUser(session.user as User);

    const { data, error } = await supabase
      .from('contacts')
      .select(
        'id, user_id, name, title, company, email, phone, linkedin, event, image, free_note, lead_score, source, synced_to_hubspot, ai_enrichment, checks'
      )
      .eq('id', contactId)
      .eq('user_id', uid)
      .maybeSingle();

    if (error || !data) {
      setContact(null);
      setEventDisplayLabel('—');
      setLoading(false);
      return;
    }

    const row = data as ContactRow;
    let eventLabel = '—';
    if (row.event) {
      const { data: evRow } = await supabase.from('events').select('name').eq('id', row.event).maybeSingle();
      eventLabel = evRow?.name ? String(evRow.name) : '—';
    }
    setEventDisplayLabel(eventLabel);
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

  const openDetailEditModal = () => {
    if (!contact) return;
    setDetailEditForm({
      name: contact.name ?? '',
      title: contact.title ?? '',
      company: contact.company ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      linkedin: contact.linkedin ?? '',
    });
    setShowEditModal(true);
  };

  const cancelDetailEditModal = () => {
    setShowEditModal(false);
    setDetailEditForm(null);
  };

  const saveDetailEditModal = async () => {
    if (!contact || !user?.id || !detailEditForm) return;
    const payload = {
      name: detailEditForm.name || null,
      title: detailEditForm.title || null,
      company: detailEditForm.company || null,
      email: detailEditForm.email || null,
      phone: detailEditForm.phone || null,
      linkedin: detailEditForm.linkedin || null,
    };
    const { error } = await supabase.from('contacts').update(payload).eq('id', contact.id).eq('user_id', user.id);
    if (error) {
      console.error('Update contact error:', error);
      window.alert('Could not save changes.');
      return;
    }
    cancelDetailEditModal();
    await loadContact();
  };

  const openSequenceDrawer = () => {
    if (!contact) return;
    setSequenceDrawerContact(contact);
    setSequenceEmails(null);
    setSequenceContext('');
    setSequenceCadence([
      { day: 1, tone: 'professional' },
      { day: 4, tone: 'professional' },
      { day: 14, tone: 'professional' },
    ]);
    setSequenceDrawerExpanded({});
    setSequenceDrawerEditIdx(null);
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
        { label: 'Event', value: eventDisplayLabel },
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

  return (
    <div
      className='max-w-2xl mx-auto w-full'
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: '#f0f2f0',
        overflowX: 'hidden',
        maxWidth: '100vw',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0', paddingBottom: 80 }}>
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
          </>
        )}
      </div>

      {!loading && contact ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            background: 'rgba(20,30,20,0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 100,
            padding: '8px',
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <button
            type='button'
            onClick={openSequenceDrawer}
            style={{
              background: '#7dde3c',
              color: '#1a3a2a',
              borderRadius: 100,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Generate Sequence
          </button>
          <button
            type='button'
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: 100,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: isSyncing ? 0.65 : 1,
            }}
            onClick={() => void handleSyncHubSpot()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              'Syncing…'
            ) : contact.synced_to_hubspot ? (
              '✓ Synced to HubSpot'
            ) : (
              <>
                <span style={{ fontWeight: 800, fontSize: 12 }}>H</span>
                Sync to HubSpot
              </>
            )}
          </button>
          <button
            type='button'
            onClick={openDetailEditModal}
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: 100,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Edit
          </button>
          <button
            type='button'
            onClick={() => void handleDelete()}
            style={{
              background: 'rgba(229,90,90,0.18)',
              color: '#ff6b6b',
              borderRadius: 100,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      {showEditModal && detailEditForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 2600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            boxSizing: 'border-box',
          }}
          onClick={cancelDetailEditModal}
          role='presentation'
        >
          <div
            className='space-y-4 rounded-2xl border border-[#dce8d0] bg-[#f0f0ec] p-4'
            style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#999',
                margin: 0,
              }}
            >
              Edit contact
            </p>
            <div className='grid grid-cols-2 gap-3'>
              {(
                [
                  { key: 'name' as const, label: 'Name' },
                  { key: 'title' as const, label: 'Title' },
                  { key: 'company' as const, label: 'Company' },
                  { key: 'email' as const, label: 'Email' },
                  { key: 'phone' as const, label: 'Phone' },
                  { key: 'linkedin' as const, label: 'LinkedIn' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label
                    className='mb-0.5 block'
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#999',
                    }}
                  >
                    {label}
                  </label>
                  <input
                    type='text'
                    value={detailEditForm[key]}
                    onChange={(e) =>
                      setDetailEditForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                    }
                    className='w-full rounded-lg border border-[#dce8d0] bg-white px-3 py-2 outline-none focus:border-[#7ab648]'
                    style={{
                      color: '#1a2e1a',
                      fontSize: '13px',
                      fontWeight: 400,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className='flex gap-2 pt-2'>
              <button
                type='button'
                onClick={() => void saveDetailEditModal()}
                className='flex-1 px-3 py-2 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] transition-colors hover:bg-[#f7faf4] hover:text-[#1a2e1a]'
                style={{
                  color: '#1a2e1a',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                }}
              >
                Save changes
              </button>
              <button
                type='button'
                onClick={cancelDetailEditModal}
                className='px-3 py-2 rounded-full border border-[#dce8d0] bg-white hover:bg-[#f7faf4] transition-colors'
                style={{
                  color: '#666',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {sequenceDrawerContact && (
        <div
          role='presentation'
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 2400,
          }}
          onClick={() => setSequenceDrawerContact(null)}
        />
      )}
      {sequenceDrawerContact && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(480px, 100vw)',
            background: '#fff',
            zIndex: 2401,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #ebebeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#111',
                margin: 0,
                paddingRight: 12,
              }}
            >
              Generate Sequence for {sequenceDrawerContact.name ?? 'Contact'}
            </h2>
            <button
              type='button'
              onClick={() => setSequenceDrawerContact(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                color: '#999',
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
              aria-label='Close'
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>
              Cadence
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {sequenceCadence.map((step, index) => (
                <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input
                    type='number'
                    min={0}
                    value={step.day}
                    onChange={(e) =>
                      setSequenceCadence((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, day: parseInt(e.target.value, 10) || 0 } : s))
                      )
                    }
                    style={{
                      width: 72,
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  />
                  <select
                    value={step.tone}
                    onChange={(e) =>
                      setSequenceCadence((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, tone: e.target.value as SeqTone } : s))
                      )
                    }
                    style={{
                      flex: 1,
                      minWidth: 140,
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  >
                    <option value='professional'>Professional</option>
                    <option value='friendly'>Friendly</option>
                    <option value='direct'>Direct</option>
                  </select>
                  {sequenceCadence.length > 1 && (
                    <button
                      type='button'
                      onClick={() =>
                        setSequenceCadence((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
                      }
                      style={{ background: 'none', border: 'none', color: '#e55a5a', cursor: 'pointer', fontSize: 13 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type='button'
              onClick={() =>
                setSequenceCadence((prev) => [
                  ...prev,
                  { day: (prev[prev.length - 1]?.day ?? 1) + 3, tone: 'professional' },
                ])
              }
              style={{
                background: 'none',
                border: 'none',
                color: '#2d6a1f',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                marginBottom: 16,
                padding: 0,
              }}
            >
              + Add another email
            </button>
            <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>Context</label>
            <textarea
              value={sequenceContext}
              onChange={(e) => setSequenceContext(e.target.value)}
              placeholder='Notes about your conversation…'
              style={{
                width: '100%',
                minHeight: 88,
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                marginBottom: 16,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type='button'
              disabled={sequenceLoading}
              onClick={async () => {
                if (!sequenceDrawerContact || !user?.id) return;
                setSequenceLoading(true);
                setSequenceEmails(null);
                try {
                  const contactPayload = {
                    ...sequenceDrawerContact,
                    leadScore: sequenceDrawerContact.lead_score,
                    freeNote: sequenceDrawerContact.free_note,
                  };
                  const res = await fetch('/api/sequence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contacts: [contactPayload],
                      cadence: sequenceCadence.map((c) => ({ day: c.day, tone: c.tone })),
                      context: sequenceContext.trim() || undefined,
                    }),
                  });
                  const data = await res.json();
                  const row = (
                    data.results as { contactId: string; emails: { day: number; subject: string; body: string }[] }[]
                  )?.find((r) => r.contactId === sequenceDrawerContact.id);
                  setSequenceEmails(row?.emails ?? []);
                } catch (err) {
                  console.error(err);
                  window.alert('Generation failed');
                } finally {
                  setSequenceLoading(false);
                }
              }}
              style={{
                width: '100%',
                background: sequenceLoading ? '#ccc' : '#1a3a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: sequenceLoading ? 'not-allowed' : 'pointer',
                marginBottom: 20,
              }}
            >
              {sequenceLoading ? 'Generating…' : 'Generate'}
            </button>

            {sequenceEmails && sequenceEmails.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', margin: '0 0 10px' }}>
                  Generated emails
                </p>
                {sequenceEmails.map((em, i) => {
                  const exp = sequenceDrawerExpanded[i] ?? false;
                  const preview = em.body.length > 140 ? `${em.body.slice(0, 140)}…` : em.body;
                  const editing = sequenceDrawerEditIdx === i;
                  return (
                    <div
                      key={i}
                      style={{
                        border: '1px solid #ebebeb',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2d6a1f' }}>Day {em.day}</div>
                      {!editing ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, margin: '6px 0' }}>{em.subject}</div>
                          <pre
                            style={{
                              fontSize: 13,
                              color: '#444',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'inherit',
                              margin: 0,
                            }}
                          >
                            {exp ? em.body : preview}
                          </pre>
                          {em.body.length > 140 && (
                            <button
                              type='button'
                              onClick={() => setSequenceDrawerExpanded((p) => ({ ...p, [i]: !exp }))}
                              style={{
                                marginTop: 6,
                                background: 'none',
                                border: 'none',
                                color: '#2d6a1f',
                                cursor: 'pointer',
                                fontSize: 12,
                              }}
                            >
                              {exp ? 'Show less' : 'Show full body'}
                            </button>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              type='button'
                              onClick={() => void navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`)}
                              style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                background: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              Copy
                            </button>
                            <button
                              type='button'
                              onClick={() => setSequenceDrawerEditIdx(i)}
                              style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                background: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <input
                            value={em.subject}
                            onChange={(e) =>
                              setSequenceEmails((prev) =>
                                prev ? prev.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)) : prev
                              )
                            }
                            style={{
                              width: '100%',
                              marginBottom: 8,
                              border: '1px solid #e8e8e8',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 14,
                              boxSizing: 'border-box',
                            }}
                          />
                          <textarea
                            value={em.body}
                            onChange={(e) =>
                              setSequenceEmails((prev) =>
                                prev ? prev.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) : prev
                              )
                            }
                            style={{
                              width: '100%',
                              minHeight: 120,
                              border: '1px solid #e8e8e8',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 14,
                              boxSizing: 'border-box',
                            }}
                          />
                          <button
                            type='button'
                            onClick={() => setSequenceDrawerEditIdx(null)}
                            style={{
                              marginTop: 8,
                              background: '#1a3a2a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              padding: '8px 14px',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type='button'
                  disabled={sequenceSaving}
                  onClick={async () => {
                    if (!sequenceDrawerContact || !user?.id || !sequenceEmails?.length) return;
                    setSequenceSaving(true);
                    try {
                      const payload = {
                        generatedAt: new Date().toISOString(),
                        cadence: sequenceCadence.map((c) => ({ day: c.day, tone: c.tone })),
                        emails: sequenceEmails,
                        context: sequenceContext.trim() || undefined,
                      };
                      const { error } = await supabase
                        .from('contacts')
                        .update({ sequences: payload })
                        .eq('id', sequenceDrawerContact.id)
                        .eq('user_id', user.id);
                      if (error) {
                        console.error(error);
                        window.alert('Could not save sequence');
                        return;
                      }
                      window.alert('Sequence saved to contact');
                      await loadContact();
                      setSequenceDrawerContact(null);
                    } finally {
                      setSequenceSaving(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    background: sequenceSaving ? '#ccc' : '#7dde3c',
                    color: '#0a1a0a',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: sequenceSaving ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                  }}
                >
                  {sequenceSaving ? 'Saving…' : 'Save to contact'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
