"use client";

import { useState } from "react";

type HubspotField =
  | "First Name"
  | "Last Name"
  | "First Name + Last Name"
  | "Email Address"
  | "Phone Number"
  | "Company Name"
  | "Job Title"
  | "LinkedIn Bio"
  | "Website URL"
  | "Street Address"
  | "City"
  | "State/Region"
  | "Postal Code"
  | "Country/Region"
  | "Skip";

const HUBSPOT_FIELDS: HubspotField[] = [
  "First Name",
  "Last Name",
  "First Name + Last Name",
  "Email Address",
  "Phone Number",
  "Company Name",
  "Job Title",
  "LinkedIn Bio",
  "Website URL",
  "Street Address",
  "City",
  "State/Region",
  "Postal Code",
  "Country/Region",
  "Skip",
];

const autoMap = (header: string): HubspotField => {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["firstname", "fname", "first"].includes(h)) return "First Name";
  if (["lastname", "lname", "last"].includes(h)) return "Last Name";
  if (["fullname", "name", "contactname", "attendeename"].includes(h))
    return "First Name + Last Name";
  if (["email", "emailaddress", "mail"].includes(h)) return "Email Address";
  if (["phone", "mobile", "tel", "phonenumber"].includes(h)) return "Phone Number";
  if (["company", "organization", "org", "companyname"].includes(h)) return "Company Name";
  if (["title", "role", "position", "jobtitle", "job"].includes(h)) return "Job Title";
  if (["linkedin", "linkedinbio", "linkedinurl"].includes(h)) return "LinkedIn Bio";
  if (["website", "url", "web"].includes(h)) return "Website URL";
  if (["address", "street", "streetaddress"].includes(h)) return "Street Address";
  if (["city", "town"].includes(h)) return "City";
  if (["state", "region", "province"].includes(h)) return "State/Region";
  if (["zip", "postal", "postalcode", "zipcode"].includes(h)) return "Postal Code";
  if (["country", "countryregion"].includes(h)) return "Country/Region";
  return "Skip";
};

const parseCSV = (text: string) => {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [] as string[], rows: [] as any[] };
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((obj: any, header, i) => {
      obj[header] = (values[i] || "").replace(/"/g, "").trim();
      return obj;
    }, {});
  });
  return { headers, rows };
};

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, HubspotField>>({});
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a .csv file");
      return;
    }
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || "";
      const { headers, rows } = parseCSV(text);
      setHeaders(headers);
      setRows(rows);
      const autoMappings: Record<string, HubspotField> = {};
      headers.forEach((h) => {
        autoMappings[h] = autoMap(h);
      });
      setMappings(autoMappings);
    };
    reader.readAsText(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDownload = () => {
    if (!rows.length) return;

    const hubspotHeaders = [
      "First Name",
      "Last Name",
      "Email Address",
      "Phone Number",
      "Company Name",
      "Job Title",
      "LinkedIn Bio",
      "Website URL",
      "Street Address",
      "City",
      "State/Region",
      "Postal Code",
      "Country/Region",
      "HubSpot Owner",
      "Lifecycle Stage",
      "Lead Status",
      "Marketing Contact Status",
    ];

    const mapped = rows.map((row) => {
      const out: any = {
        "Lifecycle Stage": "Lead",
        "Lead Status": "New",
        "Marketing Contact Status": "Marketing contact",
        "HubSpot Owner": "",
      };
      Object.entries(mappings).forEach(([original, hubspot]) => {
        if (hubspot === "Skip") return;
        if (hubspot === "First Name + Last Name") {
          const parts = String(row[original] || "").split(" ");
          out["First Name"] = parts[0] || "";
          out["Last Name"] = parts.slice(1).join(" ") || "";
        } else {
          out[hubspot] = row[original] || "";
        }
      });
      return out;
    });

    const csv = [
      hubspotHeaders.join(","),
      ...mapped.map((row) =>
        hubspotHeaders.map((h) => JSON.stringify(row[h] || "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "katch-hubspot-import.csv";
    a.click();
  };

  const ink = "#1a2e1a";
  const inkFaint = "#7a9a7a";
  const border = "#dce8d0";
  const accent = "#7ab648";
  const bg = "#f0f0ec";

  return (
    <div
      style={{
        padding: "40px 24px",
        backgroundColor: bg,
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "28px",
            color: ink,
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          Import CSV
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: inkFaint,
            maxWidth: 520,
          }}
        >
          Upload any conference attendee CSV and download it formatted for HubSpot.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("csv-input")?.click()}
        style={{
          background: dragging ? "#e8eef8" : "#ffffff",
          border: dragging ? `2px dashed ${accent}` : `2px dashed ${border}`,
          borderRadius: "16px",
          padding: "56px 24px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "28px",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>📂</div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: ink,
            marginBottom: "6px",
          }}
        >
          {filename || "Drop your CSV here or click to upload"}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: inkFaint,
          }}
        >
          {rows.length > 0
            ? `${rows.length} rows detected`
            : "Accepts .csv files only"}
        </div>
        <input
          id="csv-input"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>

      {headers.length > 0 && (
        <>
          <div
            style={{
              background: "#ffffff",
              border: `1px solid ${border}`,
              borderRadius: "14px",
              padding: "28px",
              marginBottom: "24px",
            }}
          >
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "20px",
                color: ink,
                marginBottom: "6px",
              }}
            >
              Map Columns to HubSpot Fields
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: inkFaint,
                marginBottom: "24px",
              }}
            >
              We auto-detected the mappings below. Adjust any that are incorrect.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 32px 1fr",
                gap: 0,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: inkFaint,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  paddingBottom: "10px",
                  borderBottom: `1px solid ${border}`,
                }}
              >
                Your column
              </div>
              <div />
              <div
                style={{
                  fontSize: "11px",
                  color: inkFaint,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  paddingBottom: "10px",
                  borderBottom: `1px solid ${border}`,
                }}
              >
                HubSpot field
              </div>
              {headers.map((header) => (
                <div key={header} style={{ display: "contents" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      color: ink,
                      padding: "10px 0",
                      borderBottom: "1px solid #f0f4f9",
                    }}
                  >
                    {header}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      color: inkFaint,
                      borderBottom: "1px solid #f0f4f9",
                    }}
                  >
                    →
                  </div>
                  <div
                    style={{
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f4f9",
                    }}
                  >
                    <select
                      value={mappings[header] || "Skip"}
                      onChange={(e) =>
                        setMappings((prev) => ({
                          ...prev,
                          [header]: e.target.value as HubspotField,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        border: `1px solid ${border}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                        color:
                          mappings[header] === "Skip" ? inkFaint : ink,
                        background: "#ffffff",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      {HUBSPOT_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: `1px solid ${border}`,
              borderRadius: "14px",
              padding: "28px",
              marginBottom: "28px",
              overflowX: "auto",
            }}
          >
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "20px",
                color: ink,
                marginBottom: "16px",
              }}
            >
              Preview
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
            >
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        color: inkFaint,
                        borderBottom: `1px solid ${border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td
                        key={h}
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid #f0f4f9",
                          color: ink,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row[h] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <button
              onClick={handleDownload}
              style={{
                backgroundColor: accent,
                color: "#ffffff",
                border: "none",
                borderRadius: "100px",
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Download HubSpot CSV
            </button>
            <span
              style={{
                fontSize: "13px",
                color: inkFaint,
              }}
            >
              {rows.length} rows will be exported
            </span>
          </div>
        </>
      )}
    </div>
  );
}

