"use client";

const MAIN_URL = "https://linkoteq.com";
const MODEL_URL = "https://3dmodel.linkoteq.com/";
const W_SECTION_URL = "https://wsection.linkoteq.com/";
const SNOW_LOAD_URL = "https://snow.linkoteq.com/";

export default function SiteHeader() {
  return (
    <header className="globalHeader modelGlobalHeader">
      <div className="utilityBar">
        <a className="utilityBrand" href={MAIN_URL} aria-label="LinkoTech home">
          <img src="/linko-logo-final.svg" alt="LinkoTech Engineering Technology" />
        </a>

        <nav className="utilityNav" aria-label="Utility navigation">
          <a href={MAIN_URL}>Home</a>
          <div className="navMenu">
            <button className="navMenuButton" type="button">Contact <span>⌄</span></button>
            <div className="navDropdown">
              <a href={`${MAIN_URL}/contact`}>Contact Us</a>
              <a href={`${MAIN_URL}/contact/support`}>Support</a>
            </div>
          </div>
          <div className="navMenu">
            <button className="navMenuButton" type="button">About <span>⌄</span></button>
            <div className="navDropdown"><a href={`${MAIN_URL}/about`}>About Linko</a></div>
          </div>
          <a href={`${MAIN_URL}/pricing`}>Pricing</a>
          <div className="navMenu">
            <button className="navMenuButton" type="button">Calculators <span>⌄</span></button>
            <div className="navDropdown">
              <a className="activeToolLink" href={MODEL_URL}>3D Structural Model</a>
              <a href={W_SECTION_URL}>W-Section</a>
              <a href={SNOW_LOAD_URL}>Snow Load</a>
            </div>
          </div>
        </nav>

        <div className="navMenu signInMenu">
          <button className="navCta navMenuButton" type="button">Sign In <span>⌄</span></button>
          <div className="navDropdown signInDropdown">
            <a href={`${MAIN_URL}/blog/login`}>Employee Workspace</a>
            <a href={`${MAIN_URL}/customer-login`}>Client Workspace</a>
          </div>
        </div>
      </div>

      <nav className="primaryBar" aria-label="Primary navigation">
        <a href={MAIN_URL}>Home</a>
        <a href={`${MAIN_URL}/#platform`}>AI Platform</a>
        <a href={`${MAIN_URL}/#roadmap`}>Roadmap</a>
        <a href={`${MAIN_URL}/knowledge/documentation`}>Knowledge Center</a>
        <a href={`${MAIN_URL}/blog`}>Blog</a>
      </nav>
    </header>
  );
}
