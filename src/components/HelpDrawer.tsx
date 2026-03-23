"use client";

import { useState } from "react";

const HELP_SECTIONS = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I scan a badge?",
        a: "Go to Scan in the sidebar, then drag and drop a photo of a badge or business card, or use your camera. Katch will extract the contact info automatically.",
      },
      {
        q: "How do I add contacts to an event?",
        a: "When scanning, you will be asked which event the contacts are from. You can also create a new event inline.",
      },
      {
        q: "What is a lead score?",
        a: "Lead scores range from 1-10 and indicate how hot a lead is. 7-10 is Fire, 4-6 is Warm, 1-3 is Cold. You set the score during the review step after scanning.",
      },
    ],
  },
  {
    title: "Scanning",
    items: [
      {
        q: "What types of badges can Katch scan?",
        a: "Katch can scan conference badges, business cards, name tags, and any image with visible contact information.",
      },
      {
        q: "What if a scan fails?",
        a: "Katch automatically retries up to 3 times with increasingly aggressive prompts. If it still fails, the photo will be marked as Could not scan.",
      },
      {
        q: "Can I scan multiple photos at once?",
        a: "Yes — drop multiple photos into the scan zone and Katch will process them all in bulk, then let you review and score each one.",
      },
    ],
  },
  {
    title: "HubSpot integration",
    items: [
      {
        q: "How do I connect HubSpot?",
        a: "Go to Settings -> Integrations and click Connect HubSpot. You will be redirected to authorize the connection.",
      },
      {
        q: "How do I sync contacts to HubSpot?",
        a: "On the Contacts page, select the contacts you want to sync using the checkboxes, then click Sync to HubSpot in the bulk action bar.",
      },
      {
        q: "How do I know which contacts have been synced?",
        a: "Synced contacts show an orange H Synced badge on their contact card.",
      },
    ],
  },
  {
    title: "AI sequences",
    items: [
      {
        q: "How do I generate a follow-up sequence?",
        a: "Select a contact on the Contacts page and click Generate Sequence, or go to the Sequences page to create sequences by event.",
      },
      {
        q: "Can I customize the email tone?",
        a: "Yes — go to Settings -> Email Tone to set your preferred writing style.",
      },
    ],
  },
];

export default function HelpDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 998,
            background: "rgba(0,0,0,0.2)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "380px",
          background: "#ffffff",
          zIndex: 999,
          boxShadow: "-4px 0 32px rgba(0,0,0,0.10)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "24px 24px 16px",
            borderBottom: "1px solid #ebebeb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.01em", color: "#111" }}>
              Help & Support
            </div>
            <div style={{ fontSize: "13px", color: "#999", marginTop: "2px" }}>
              Everything you need to get started
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f5f5f5",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#555",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #ebebeb",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {["Getting started", "Scanning", "HubSpot", "AI sequences"].map((label) => (
            <button
              key={label}
              style={{
                background: "#f5f5f5",
                border: "none",
                borderRadius: "999px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 500,
                color: "#555",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px 24px", flex: 1 }}>
          {HELP_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: "24px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#999",
                  marginBottom: "12px",
                }}
              >
                {section.title}
              </div>
              {section.items.map((item, ii) => {
                const key = `${si}-${ii}`;
                const isItemOpen = openItem === key;
                return (
                  <div key={ii} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <button
                      onClick={() => setOpenItem(isItemOpen ? null : key)}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: "12px 0",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "#111" }}>{item.q}</span>
                      <span
                        style={{
                          color: "#999",
                          fontSize: "16px",
                          flexShrink: 0,
                          transform: isItemOpen ? "rotate(45deg)" : "none",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        +
                      </span>
                    </button>
                    {isItemOpen && (
                      <div style={{ fontSize: "13px", color: "#666", lineHeight: 1.6, paddingBottom: "14px" }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #ebebeb", background: "#fafafa" }}>
          <div style={{ fontSize: "13px", color: "#999", textAlign: "center" }}>
            Need more help? Email us at{" "}
            <a href="mailto:support@katch.app" style={{ color: "#7dde3c", fontWeight: 500, textDecoration: "none" }}>
              support@katch.app
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
