import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RingProgress, Table, Text } from "@mantine/core";
import { BookmarkSimpleIcon, FunnelSimple } from "@phosphor-icons/react";
import { pullCount } from "../api/internships";
import { CompanyFavicon } from "../components/CompanyFavicon";
import { JobCard, STATUS_COLORS } from "../components/JobCard";
import type { JobStatus, TrackedJob } from "../components/TrackerContext";
import "../styles/Table.css";
import "../styles/Tracker.css";
import "../styles/landing.css";

// Wordmark slugs from the gilbarbara/logos set, served over jsDelivr. All are
// companies flagged FAANG+ in utils/companyMeta.ts, which is what the Jobs page
// FAANG+ filter uses.
const LOGO_CDN = "https://cdn.jsdelivr.net/gh/gilbarbara/logos/logos";
const FAANG_PLUS_LOGOS = [
  { name: "Google", slug: "google" },
  { name: "Microsoft", slug: "microsoft" },
  { name: "Apple", slug: "apple" },
  { name: "Meta", slug: "meta" },
  { name: "Netflix", slug: "netflix" },
  { name: "Nvidia", slug: "nvidia" },
  { name: "AWS", slug: "aws" },
  { name: "IBM", slug: "ibm" },
  { name: "Salesforce", slug: "salesforce" },
  { name: "Spotify", slug: "spotify" },
  { name: "Stripe", slug: "stripe" },
  { name: "Airbnb", slug: "airbnb" },
  { name: "OpenAI", slug: "openai" },
];

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

// Sample rows for the preview, built with the same TrackedJob shape the real
// board renders. Dates are relative so the cards read like a live tracker.
const SAMPLE_TRACKED: Record<JobStatus, TrackedJob[]> = {
  Saved: [
    { id: "s1", company: "Google", role: "Software Engineer Intern", location: "Mountain View, CA", status: "Saved", dateAdded: isoDaysAgo(2) },
    { id: "s2", company: "Stripe", role: "Backend Engineer Intern", location: "San Francisco, CA", status: "Saved", dateAdded: isoDaysAgo(3) },
    { id: "s3", company: "IBM", role: "Data Analyst Intern", location: "Remote", status: "Saved", dateAdded: isoDaysAgo(5) },
  ],
  Applied: [
    { id: "a1", company: "Microsoft", role: "Software Engineer Intern", location: "Redmond, WA", status: "Applied", dateAdded: isoDaysAgo(9), dateApplied: isoDaysAgo(6) },
    { id: "a2", company: "Airbnb", role: "Product Design Intern", location: "San Francisco, CA", status: "Applied", dateAdded: isoDaysAgo(12), dateApplied: isoDaysAgo(8) },
  ],
  Interview: [
    { id: "i1", company: "Spotify", role: "Frontend Engineer", location: "New York, NY", status: "Interview", dateAdded: isoDaysAgo(16), dateApplied: isoDaysAgo(14) },
  ],
  Offer: [],
  Rejected: [],
};

const SAMPLE_BOARD_ORDER: JobStatus[] = ["Saved", "Applied", "Interview", "Offer", "Rejected"];

// Rows for the Jobs preview — same columns the live table renders.
const SAMPLE_LISTINGS = [
  { company: "Google", role: "Software Engineer Intern", location: "Mountain View, CA", date: "Today", saved: true },
  { company: "Microsoft", role: "Software Engineer Intern", location: "Redmond, WA", date: "Yesterday", saved: false },
  { company: "Spotify", role: "Frontend Engineer", location: "New York, NY", date: "2 days ago", saved: false },
];

const DEMO_PRODUCTS = [
  {
    id: "jobs",
    label: "Job Search",
    features: [
      { title: "Browse roles", body: "Explore internship and new-grad listings in one searchable board.", kind: "browse" },
      { title: "Filter your search", body: "Narrow roles by location, category, company, and more.", kind: "filters" },
      { title: "Save a role", body: "Keep interesting listings in your application tracker.", kind: "save" },
      { title: "Fresh listings", body: "Listings refresh hourly from company career systems.", kind: "fresh" },
    ],
  },
  {
    id: "tracker",
    label: "Application Tracker",
    features: [
      { title: "Kanban board", body: "Move applications through Saved, Applied, Interview, Offer, and Rejected.", kind: "board" },
      { title: "Keep details together", body: "Store each role's link, location, dates, and notes in one place.", kind: "details" },
      { title: "See your progress", body: "Review application totals, offers, and reply rate at a glance.", kind: "progress" },
      { title: "Counts per stage", body: "Each column shows how many applications sit in that stage.", kind: "counts" },
    ],
  },
] as const;

type DemoProductId = (typeof DEMO_PRODUCTS)[number]["id"];

function Landing() {
  const [activeProductId, setActiveProductId] = useState<DemoProductId>("jobs");
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [listingCount, setListingCount] = useState<number | null>(null);
  const activeProduct = DEMO_PRODUCTS.find((product) => product.id === activeProductId)!;
  const activeFeature = activeProduct.features[activeFeatureIndex];

  useEffect(() => {
    let cancelled = false;
    pullCount().then((count) => {
      if (!cancelled) setListingCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalTracked = SAMPLE_BOARD_ORDER.reduce((sum, status) => sum + SAMPLE_TRACKED[status].length, 0);
  const totalApplied = totalTracked - SAMPLE_TRACKED.Saved.length;
  const responses = SAMPLE_TRACKED.Interview.length + SAMPLE_TRACKED.Offer.length + SAMPLE_TRACKED.Rejected.length;
  const replyRate = totalApplied > 0 ? Math.round((responses / totalApplied) * 100) : 0;

  const ringData = totalTracked > 0
    ? SAMPLE_BOARD_ORDER.map((status) => ({
        value: (SAMPLE_TRACKED[status].length / totalTracked) * 100,
        color: STATUS_COLORS[status],
        tooltip: `${status}: ${SAMPLE_TRACKED[status].length}`,
      })).filter((segment) => segment.value > 0)
    : [{ value: 100, color: "#f1f3f5", tooltip: "No data yet" }];

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-grid">
            <div className="landing-hero-content">
              <h1 className="landing-title">
                Find internships. <span className="landing-accent">Track every application.</span>
              </h1>
              <p className="landing-subtitle">
                Search and filter internships and new-grad roles from <span className="landing-accent">45+</span> company ATS systems. Save roles and track applications in one free, open-source workspace, refreshed hourly.
              </p>
              <div className="landing-cta-group">
                <Link to="/jobs" className="landing-cta landing-cta-primary">
                  Browse Jobs
                </Link>
              </div>
            </div>
            <div className="landing-video-placeholder" role="img" aria-label="Placeholder for the SearchTern product walkthrough video">
              <span>Product walkthrough video</span>
              <small>Video coming soon</small>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-showcase" aria-label="Explore SearchTern features">
        <div className="landing-container">
          <div className="landing-demo-tabs" role="tablist" aria-label="SearchTern products">
            {DEMO_PRODUCTS.map((product) => (
              <button
                key={product.id}
                type="button"
                role="tab"
                aria-selected={activeProductId === product.id}
                className={`landing-demo-tab${activeProductId === product.id ? " is-active" : ""}`}
                onClick={() => {
                  setActiveProductId(product.id);
                  setActiveFeatureIndex(0);
                }}
              >
                <span className={`landing-demo-tab-icon landing-demo-tab-icon-${product.id}`} aria-hidden="true">
                  {product.id === "jobs" ? "⌕" : "▦"}
                </span>
                {product.label}
              </button>
            ))}
          </div>

          <div className={`landing-showcase-frame landing-showcase-frame-${activeProductId}`}>
            <div
              className={`landing-preview landing-preview-${activeProductId} landing-preview-focus-${activeFeature.kind}`}
              aria-label={activeProductId === "jobs" ? "Sample of the SearchTern job board" : "Sample of the SearchTern application tracker"}
              aria-hidden="true"
            >
              {activeProductId === "jobs" ? (
                <section className="feature landing-preview-jobs" inert>
                  <input
                    className="search-input"
                    placeholder="Search by company, role, or location..."
                    readOnly
                    tabIndex={-1}
                  />

                  <div className="results-header">
                    {listingCount !== null && (
                      <p className="result-count desktop-result-count">
                        {listingCount.toLocaleString()} listings found
                      </p>
                    )}
                    <div className="results-controls">
                      <button className="sort_btn" type="button" tabIndex={-1}>
                        <span aria-hidden="true">⇅</span> Newest
                      </button>
                      <button className="sort_btn" type="button" tabIndex={-1}>
                        Roles <span aria-hidden="true">▾</span>
                      </button>
                      <button className="sort_btn" type="button" tabIndex={-1}>
                        <FunnelSimple size={16} weight="bold" /> Filters
                      </button>
                    </div>
                  </div>

                  <Table striped highlightOnHover mt="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Company</Table.Th>
                        <Table.Th>Role</Table.Th>
                        <Table.Th>Location</Table.Th>
                        <Table.Th>Date</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {SAMPLE_LISTINGS.map((listing) => (
                        <Table.Tr className="job-row" key={`${listing.company}-${listing.role}`}>
                          <Table.Td className="company-cell" data-label="Company">
                            <BookmarkSimpleIcon
                              size={25}
                              className="bookmark-icon"
                              weight={listing.saved ? "fill" : "regular"}
                              color={listing.saved ? "var(--accent-color)" : "currentColor"}
                            />
                            <div>
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <CompanyFavicon company={listing.company} />
                                {listing.company}
                              </span>
                            </div>
                          </Table.Td>
                          <Table.Td data-label="Role">
                            <span className="apply-link">{listing.role}</span>
                          </Table.Td>
                          <Table.Td data-label="Location">{listing.location}</Table.Td>
                          <Table.Td data-label="Date">
                            <span className="job-row-date">{listing.date}</span>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </section>
              ) : (
                <section className="feature landing-preview-tracker" inert>
                  <div className="tracker-stats landing-preview-tracker-stats">
                    <div className="tracker-stats-numbers">
                      <div>
                        <Text c="dimmed" size="xs" fw={700}>Applied</Text>
                        <Text fw={700} size="xl">{totalApplied}</Text>
                      </div>
                      <div>
                        <Text c="dimmed" size="xs" fw={700}>Reply Rate</Text>
                        <Text fw={700} size="xl">{replyRate}%</Text>
                      </div>
                      <div>
                        <Text c="dimmed" size="xs" fw={700}>Offers</Text>
                        <Text fw={700} size="xl" c="green">{SAMPLE_TRACKED.Offer.length}</Text>
                      </div>
                      <div>
                        <Text c="dimmed" size="xs" fw={700}>Rejected</Text>
                        <Text fw={700} size="xl" c="red">{SAMPLE_TRACKED.Rejected.length}</Text>
                      </div>
                    </div>

                    <div className="tracker-ring">
                      <RingProgress
                        size={110}
                        thickness={12}
                        roundCaps
                        rootColor="#f1f3f5"
                        sections={ringData}
                        label={
                          <div style={{ textAlign: "center", marginTop: "-4px" }}>
                            <Text fw={800} size="xl" lh={1}>{totalTracked}</Text>
                            <Text c="dimmed" size="xs" fw={700} mt={2}>Total</Text>
                          </div>
                        }
                      />
                      <div className="landing-preview-ring-legend">
                        {ringData.filter((segment) => segment.tooltip !== "No data yet").map((segment) => (
                          <div key={segment.tooltip} className="landing-preview-ring-legend-item">
                            <span style={{ backgroundColor: segment.color }} />
                            <Text size="xs" c="dimmed" fw={600}>{segment.tooltip}</Text>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="tracker-board-scroll">
                    <div className="tracker-board">
                      {SAMPLE_BOARD_ORDER.map((status) => (
                        <div key={status} className={`tracker-column-wrapper${status === "Saved" ? " active" : ""}`}>
                          <div className="tracker-column">
                            <div className="column-header">
                              <span style={{ color: STATUS_COLORS[status] }}>{status}</span>
                              <span
                                className="column-count"
                                style={{ backgroundColor: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}
                              >
                                {SAMPLE_TRACKED[status].length}
                              </span>
                            </div>

                            {SAMPLE_TRACKED[status].map((job) => (
                              <JobCard key={job.id} job={job} />
                            ))}

                            {SAMPLE_TRACKED[status].length === 0 && (
                              <div className="landing-preview-tracker-empty">
                                {status === "Saved" ? "Drop jobs here to track later" : "No applications here"}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="landing-demo-features" role="tabpanel" aria-label={`${activeProduct.label} features`}>
            {activeProduct.features.map((feature, index) => (
              <button
                type="button"
                className={`landing-demo-feature${activeFeatureIndex === index ? " is-active" : ""}`}
                key={feature.title}
                aria-pressed={activeFeatureIndex === index}
                onClick={() => setActiveFeatureIndex(index)}
              >
                <span className="landing-demo-feature-title">{feature.title}</span>
                <span className="landing-demo-feature-body">{feature.body}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-trust-band" aria-label="SearchTern facts">
        <div className="landing-container">
          <h2 className="landing-trust-title">
            Join <strong>20,000+</strong> students who've used SearchTern to manage their job search and land jobs at <strong>1000s</strong> of companies
          </h2>
          <div className="landing-company-sources">
            <div className="landing-company-marquee" aria-label="FAANG+ companies">
              <div className="landing-company-track">
                {[0, 1].map((copy) => (
                  <ul className="landing-company-group" key={copy} aria-hidden={copy === 1}>
                    {FAANG_PLUS_LOGOS.map(({ name, slug }) => (
                      <li key={slug}>
                        <img
                          src={`${LOGO_CDN}/${slug}.svg`}
                          alt={copy === 0 ? name : ""}
                          loading="lazy"
                        />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-differentiators">
        <div className="landing-container">
          <div className="landing-differentiators-header">
            <h2 className="landing-differentiators-title">More opportunities. Less chaos.</h2>
          </div>
          <div className="landing-differentiators-grid">
            <article className="landing-differentiator">
              <h3>Direct from company ATSs</h3>
              <p>Find roles sourced from employer career systems.</p>
            </article>
            <article className="landing-differentiator">
              <h3>Free, without the paywall</h3>
              <p>Browse opportunities and organize your search.</p>
            </article>
            <article className="landing-differentiator">
              <h3>Open source</h3>
              <p>
                Explore the code and contribute on{" "}
                <a href="https://github.com/KSaifStack/SearchTern" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                .
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-cta-banner">
        <div className="landing-container landing-cta-banner-inner">
          <div>
            <h2>Start tracking your next opportunity</h2>
            <p>Get organized today with SearchTern's job tracker.</p>
          </div>
          <div className="landing-cta-group">
            <Link to="/jobs" className="landing-cta landing-cta-primary">
              Browse Jobs
            </Link>
            <Link to="/auth?tab=signup" className="landing-cta landing-cta-secondary">
              Get Started
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <span>© 2026 SearchTern</span>
          <nav className="landing-footer-nav">
            <a href="https://github.com/KSaifStack/SearchTern" target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link to="/privacy">Privacy Policy</Link>
          </nav>
        </div>
      </footer>

    </main>
  );
}

export default Landing;
