"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { TIMELINES_LOGO_PUBLIC_PATH } from "@/src/lib/brand";
import {
  CloseIcon,
  MenuIcon,
  SocialFacebookIcon,
  SocialInstagramIcon,
  SocialTikTokIcon,
  SocialXIcon
} from "@/components/ui/Icons";

const tabs = [
  { id: "mission", label: "OUR MISSION" },
  { id: "contact", label: "CONTACT" },
  { id: "legal", label: "LEGAL" }
] as const;

const contactTabs = [
  { id: "general", label: "GENERAL" },
  { id: "propose", label: "PROPOSE" },
  { id: "suggestEdit", label: "SUGGEST EDIT" }
] as const;

type TabId = (typeof tabs)[number]["id"];
type ContactTabId = (typeof contactTabs)[number]["id"];
type SubmitState = "idle" | "submitting" | "success" | "error";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

type DrawerRequestPayload = {
  requestType: "general_contact" | "timeline_proposal" | "timeline_correction";
  query: string;
  language: "en";
  email: string;
  message: string;
  targetTimeline?: string;
  sourcesScope?: string;
  metadata: Record<string, unknown>;
};

async function submitTimelineRequest(payload: DrawerRequestPayload): Promise<void> {
  const response = await fetch("/api/timeline-requests", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responsePayload = (await response.json()) as { ok: boolean; error?: { message?: string } };
  if (!response.ok || !responsePayload.ok) {
    throw new Error(responsePayload.error?.message || "Unable to submit request.");
  }
}

export function SiteNavigationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("mission");
  const [activeContactTab, setActiveContactTab] = useState<ContactTabId>("general");
  const [openLegalSection, setOpenLegalSection] = useState<"privacy" | "terms" | null>("privacy");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setIsOpen(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setSubmitMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const message = String(formData.get("message") || "");
    const timelineTopic = String(formData.get("timelineTopic") || "");
    const sourcesScope = String(formData.get("sourcesScope") || "");
    const targetTimeline = String(formData.get("targetTimeline") || "");
    const correctedDetails = String(formData.get("correctedDetails") || "");

    const payload: DrawerRequestPayload =
      activeContactTab === "general"
        ? {
            requestType: "general_contact",
            query: "General contact",
            language: "en",
            email,
            message,
            metadata: { source: "site_navigation_drawer" }
          }
        : activeContactTab === "propose"
          ? {
              requestType: "timeline_proposal",
              query: timelineTopic,
              language: "en",
              email,
              message: timelineTopic,
              sourcesScope,
              metadata: { source: "site_navigation_drawer" }
            }
          : {
              requestType: "timeline_correction",
              query: targetTimeline,
              language: "en",
              email,
              targetTimeline,
              message: correctedDetails,
              metadata: { source: "site_navigation_drawer" }
            };

    try {
      await submitTimelineRequest(payload);
      event.currentTarget.reset();
      setSubmitState("success");
      setSubmitMessage("Request submitted for editorial review.");
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Unable to submit request.");
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusableElements = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      triggerElement?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="site-menu-trigger"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="site-navigation-menu"
        onClick={() => setIsOpen(true)}
      >
        <MenuIcon />
      </button>

      {isOpen ? (
        <div className="site-menu-backdrop" onClick={closeMenu}>
          <section
            ref={drawerRef}
            id="site-navigation-menu"
            className="site-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <button ref={closeRef} type="button" className="site-menu-close" onClick={closeMenu} aria-label="Close navigation menu">
              <CloseIcon />
            </button>

            <div className="site-menu-brand">
              <Image
                src={TIMELINES_LOGO_PUBLIC_PATH}
                alt=""
                aria-hidden="true"
                width={673}
                height={94}
                className="site-menu-logo-image"
              />
              <span className="sr-only">TiMELiNES</span>
            </div>

            <div className="site-menu-socials" aria-hidden="true">
              <span>
                <SocialXIcon />
              </span>
              <span>
                <SocialInstagramIcon />
              </span>
              <span>
                <SocialFacebookIcon />
              </span>
              <span>
                <SocialTikTokIcon />
              </span>
            </div>

            <div className="site-menu-tabs" role="tablist" aria-label="Navigation menu sections">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="site-menu-tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`site-menu-panel-${tab.id}`}
                  id={`site-menu-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              id={`site-menu-panel-${activeTab}`}
              role="tabpanel"
              tabIndex={0}
              aria-labelledby={`site-menu-tab-${activeTab}`}
              className="site-menu-panel"
            >
              {activeTab === "mission" ? <MissionPanel /> : null}
              {activeTab === "contact" ? (
                <ContactPanel
                  activeContactTab={activeContactTab}
                  setActiveContactTab={setActiveContactTab}
                  submitState={submitState}
                  submitMessage={submitMessage}
                  onSubmit={onSubmit}
                />
              ) : null}
              {activeTab === "legal" ? (
                <LegalPanel openLegalSection={openLegalSection} setOpenLegalSection={setOpenLegalSection} />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MissionPanel() {
  return (
    <div className="site-menu-mission">
      <p className="site-menu-kicker">Everything has a timeline</p>
      <p className="site-menu-body">
        TiMELiNES presents complex histories and developments as chronological timelines.
      </p>
      <article className="site-menu-core-card">
        <span>Curation Core</span>
        <strong>Chronology-first records, source-aware editorial review, and structured historical context.</strong>
      </article>
    </div>
  );
}

function ContactPanel({
  activeContactTab,
  setActiveContactTab,
  submitState,
  submitMessage,
  onSubmit
}: {
  activeContactTab: ContactTabId;
  setActiveContactTab: (tab: ContactTabId) => void;
  submitState: SubmitState;
  submitMessage: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="site-menu-contact">
      <div className="site-menu-contact-tabs" role="tablist" aria-label="Contact request type">
        {contactTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeContactTab === tab.id}
            aria-controls={`site-menu-contact-${tab.id}`}
            id={`site-menu-contact-tab-${tab.id}`}
            onClick={() => setActiveContactTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form className="site-menu-form" onSubmit={onSubmit}>
        <input className="site-menu-input" name="email" type="email" placeholder="Email" maxLength={254} required />

        {activeContactTab === "general" ? (
          <textarea className="site-menu-textarea" name="message" placeholder="Message" maxLength={5000} required />
        ) : null}

        {activeContactTab === "propose" ? (
          <>
            <input className="site-menu-input" name="timelineTopic" placeholder="Timeline topic" maxLength={240} required />
            <textarea className="site-menu-textarea" name="sourcesScope" placeholder="Sources / scope" maxLength={5000} required />
          </>
        ) : null}

        {activeContactTab === "suggestEdit" ? (
          <>
            <input className="site-menu-input" name="targetTimeline" placeholder="Target timeline" maxLength={500} required />
            <textarea className="site-menu-textarea" name="correctedDetails" placeholder="Corrected details" maxLength={5000} required />
          </>
        ) : null}

        <button className="site-menu-submit" type="submit" disabled={submitState === "submitting"}>
          {submitState === "submitting" ? "SUBMITTING" : "SUBMIT REQUEST"}
        </button>
        {submitMessage ? (
          <p className={`site-menu-submit-message site-menu-submit-message-${submitState}`} role="status" aria-live="polite">
            {submitMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function LegalPanel({
  openLegalSection,
  setOpenLegalSection
}: {
  openLegalSection: "privacy" | "terms" | null;
  setOpenLegalSection: (section: "privacy" | "terms" | null) => void;
}) {
  return (
    <div className="site-menu-legal">
      <LegalDisclosure
        id="privacy"
        title="Privacy Policy"
        openLegalSection={openLegalSection}
        setOpenLegalSection={setOpenLegalSection}
      >
        TiMELiNES limits public request collection to the information submitted through the request form and platform diagnostics required to operate the service.
      </LegalDisclosure>
      <LegalDisclosure
        id="terms"
        title="Terms of Service"
        openLegalSection={openLegalSection}
        setOpenLegalSection={setOpenLegalSection}
      >
        TiMELiNES publishes informational historical timelines for reading, discovery, and editorial review.
      </LegalDisclosure>
    </div>
  );
}

function LegalDisclosure({
  id,
  title,
  openLegalSection,
  setOpenLegalSection,
  children
}: {
  id: "privacy" | "terms";
  title: string;
  openLegalSection: "privacy" | "terms" | null;
  setOpenLegalSection: (section: "privacy" | "terms" | null) => void;
  children: string;
}) {
  const isOpen = openLegalSection === id;

  return (
    <section className="site-menu-disclosure">
      <button type="button" aria-expanded={isOpen} aria-controls={`site-menu-${id}`} onClick={() => setOpenLegalSection(isOpen ? null : id)}>
        <span>{title}</span>
        <span aria-hidden="true">{isOpen ? "-" : "+"}</span>
      </button>
      {isOpen ? <p id={`site-menu-${id}`}>{children}</p> : null}
    </section>
  );
}
