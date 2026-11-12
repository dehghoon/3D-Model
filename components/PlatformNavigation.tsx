"use client";
import { useState } from "react";

const tools = [
  { name: "3D Model", href: "https://3dmodel.linkoteq.com/", status: "Beta" },
  { name: "W-Section", href: "https://wsection.linkoteq.com/", status: "Trial" },
  { name: "Snow Load", href: "https://snow.linkoteq.com/", status: "Trial" },
] as const;

export default function PlatformNavigation() {
  const [open, setOpen] = useState(false);
  return <header className="platformNav">
    <a className="platformBrand" href="https://linkoteq.com/" aria-label="Linkoteq home">LINKOTEQ<span> / 3D MODEL</span></a>
    <nav className="platformDesktopLinks" aria-label="Linkoteq platform navigation">
      <a href="https://linkoteq.com/">Home</a>
      {tools.map(tool => <a key={tool.name} href={tool.href} aria-current={tool.name === "3D Model" ? "page" : undefined}>{tool.name}</a>)}
      <a href="https://linkoteq.com/blog">Resources</a>
    </nav>
    <a className="platformAccount" href="https://linkoteq.com/customer-login">Account</a>
    <button type="button" className="platformMobileToggle" aria-controls="platform-mobile-links" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
    <nav id="platform-mobile-links" className={open ? "platformMobileLinks isOpen" : "platformMobileLinks"} aria-label="Mobile platform navigation">
      <a href="https://linkoteq.com/">Home</a>
      {tools.map(tool => <a key={tool.name} href={tool.href}>{tool.name} <small>{tool.status}</small></a>)}
      <a href="https://linkoteq.com/blog">Resources</a>
      <a href="https://linkoteq.com/customer-login">Account</a>
    </nav>
  </header>;
}
