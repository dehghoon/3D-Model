"use client";
import { useState } from "react";
const devices = [
  { name: "Phone · 390 × 844", width: 390, height: 844 },
  { name: "Small phone · 360 × 800", width: 360, height: 800 },
  { name: "Wide phone · 430 × 932", width: 430, height: 932 },
  { name: "Landscape · 740 × 390", width: 740, height: 390 },
];
export default function MobilePreview() {
  const [index, setIndex] = useState(0);
  const device = devices[index];
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#e8eef3",
        padding: 20,
        boxSizing: "border-box",
        fontFamily: "Arial,sans-serif",
        color: "#25475d",
      }}
    >
      <header
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <strong>Mobile workspace preview</strong>
        <select
          aria-label="Preview device"
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          style={{
            padding: 10,
            border: "1px solid #becfdc",
            borderRadius: 8,
            background: "white",
          }}
        >
          {devices.map((d, i) => (
            <option value={i} key={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        <a href="/" style={{ color: "#216e68" }}>
          Open modeler
        </a>
      </header>
      <div
        style={{
          width: device.width,
          maxWidth: "100%",
          height: device.height,
          margin: "0 auto",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 10px 35px #24475a25",
          border: "7px solid #233b4b",
          boxSizing: "content-box",
        }}
      >
        <iframe
          title="Mobile modeler"
          src="/"
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
            background: "white",
          }}
        />
      </div>
    </main>
  );
}
