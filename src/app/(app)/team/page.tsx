"use client";

export default function TeamPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f2f0",
        padding: "20px 24px 40px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <div
        className="w-full rounded-2xl p-8"
        style={{
          background:
            "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
          marginBottom: 24,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Team
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            marginTop: 4,
            marginBottom: 0,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Manage your team members.
        </p>
      </div>
    </div>
  );
}
