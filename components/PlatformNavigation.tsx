"use client";
import { useState } from "react";

const tools = [
 {name:"3D Model",href:"https://3dmodel.linkoteq.com/",status:"Beta"},
 {name:"W-Section",href:"https://wsection.linkoteq.com/",status:"Trial"},
 {name:"Snow Load",href:"https://snow.linkoteq.com/",status:"Trial"},
] as const;
const home="https://linkoteq.com";
export default function PlatformNavigation(){
 const [open,setOpen]=useState(false);
 return <header className="platformNav">
  <div className="utilityBar">
   <a className="utilityBrand" href={home+"/"} aria-label="Linkoteq home"><img src={home+"/linko-logo-final.svg"} alt="LinkoTech Engineering Technology" width={220} height={55} /></a>
   <nav className="utilityNav" aria-label="Linkoteq utility navigation">
    <a href={home+"/"}>Home</a>
    <div className="navMenu"><button className="navMenuButton" type="button" aria-haspopup="true">Contact ▾</button><div className="navDropdown"><a href={home+"/contact"}>Contact Us</a><a href="https://discovery.linkoteq.com/">Customer Discovery</a><a href={home+"/contact/support"}>Support</a></div></div>
    <div className="navMenu"><button className="navMenuButton" type="button" aria-haspopup="true">About ▾</button><div className="navDropdown"><a href={home+"/about"}>About Linkoteq</a></div></div>
    <a href={home+"/pricing"}>Pricing</a>
    <div className="navMenu"><button className="navMenuButton" type="button" aria-haspopup="true">Calculators ▾</button><div className="navDropdown">{tools.map(t=><a key={t.name} href={t.href}>{t.name}<span className="toolStatus">{t.status}</span></a>)}</div></div>
   </nav>
   <a className="navCta" href={home+"/customer-login"}>Sign In</a>
   <button className="mobileMenuToggle" type="button" aria-expanded={open} aria-controls="linkoteq-mobile-menu" onClick={()=>setOpen(!open)}>{open?"Close ×":"Menu ☰"}</button>
  </div>
  <nav id="linkoteq-mobile-menu" className={open?"mobileMenuPanel isOpen":"mobileMenuPanel"} aria-label="Mobile navigation">
   <a href={home+"/"}>Home</a><span className="mobileGroupLabel">Engineering software</span>
   {tools.map(t=><a key={t.name} href={t.href}>{t.name}<span className="toolStatus">{t.status}</span></a>)}
   <span className="mobileGroupLabel">Explore</span>
   <a href={home+"/blog"}>Blog</a><a href={home+"/knowledge/documentation"}>Documentation</a><a href={home+"/pricing"}>Pricing</a><a href={home+"/about"}>About</a><a href={home+"/contact"}>Contact</a><a href={home+"/customer-login"}>Client Sign In</a>
  </nav>
  <nav className="primaryBar" aria-label="Primary navigation"><a href={home+"/"}>Home</a><a href={home+"/#platform"}>AI Platform</a><a href={home+"/#roadmap"}>Roadmap</a><a href={home+"/knowledge/documentation"}>Knowledge Center</a><a href={home+"/blog"}>Blog</a></nav>
 </header>
}
