import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";
import { pullCount } from "../api/internships";
import { getRecent } from "../services/internshipmanager";

const FAANG = new Set(["Google", "Meta", "Apple", "Amazon", "Microsoft", "Netflix"]);

type FeedJob = {
  company: string;
  role: string;
  location?: string;
  date?: string;
};

function Landing() {
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [feedJobs, setFeedJobs] = useState<FeedJob[]>([]);

  useEffect(() => {
    pullCount()
      .then((count) => {
        if (typeof count === "number") {
          setListingCount(count);
        }
      })
      .catch(() => {
        // ignore
      });
    getRecent()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const faang = res.data
            .filter((j: FeedJob) => FAANG.has(j.company))
            .sort((a: FeedJob, b: FeedJob) => {
              const ad = a.date ? new Date(a.date).getTime() : 0;
              const bd = b.date ? new Date(b.date).getTime() : 0;
              return bd - ad;
            })
            .slice(0, 5);
          setFeedJobs(faang);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const scrollToDemo = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById("demo");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-grid">
            <div className="landing-hero-content">
              <p className="landing-usage-text">
                <strong>1,000+ monthly visitors</strong>
              </p>
              <h1 className="landing-title">
                Your next opportunity shouldn't take <span className="landing-accent">47</span> tabs to find.
              </h1>
              <p className="landing-subtitle">
                Roles pulled directly from <span className="landing-accent">45+</span> company ATS systems, with no repost feeds. Free and <a href="https://github.com/KSaifStack/SearchTern" target="_blank" rel="noopener noreferrer" className="landing-link-accent">open source</a>, refreshed hourly. Browse, filter, save, and track every application in one place.
              </p>
              <div className="landing-cta-group">
                <Link to="/jobs" className="landing-cta landing-cta-primary">
                  Browse Jobs
                </Link>
                <a href="#demo" onClick={scrollToDemo} className="landing-cta landing-cta-secondary">
                  See how it works
                </a>
              </div>
            </div>
            <div className="landing-hero-visual" aria-hidden="true">
              <div className="landing-mac">
                <div className="landing-mac-header">
                  <div className="landing-mac-dots">
                    <span className="landing-mac-dot red" />
                    <span className="landing-mac-dot yellow" />
                    <span className="landing-mac-dot green" />
                  </div>
                  <div className="landing-mac-title">searchtern.net/jobs</div>
                </div>
                <div className="landing-feed-card">
                  <div className="landing-feed-header">
                    <span className="landing-feed-title">Internships</span>
                    <span className="landing-feed-count">{listingCount !== null ? `${listingCount.toLocaleString()} results` : "Live results"}</span>
                  </div>
                  <div className="landing-feed-list">
                    {(feedJobs.length > 0 ? feedJobs.slice(0, 4) : [
                      { company: "Google", role: "Software Engineering Intern", location: "Mountain View, CA" },
                      { company: "Meta", role: "Software Engineering Intern", location: "Menlo Park, CA" },
                      { company: "Microsoft", role: "New Grad SWE", location: "Redmond, WA" },
                      { company: "Amazon", role: "Software Development Engineer Intern", location: "Seattle, WA" },
                    ]).map((job: FeedJob, idx: number) => (
                      <article className="landing-feed-item" key={idx}>
                        <div className="landing-feed-item-main">
                          <div className="landing-feed-company">{job.company}</div>
                          <div className="landing-feed-role">{job.role}</div>
                          <div className="landing-feed-meta">{job.location || "Various locations"}</div>
                        </div>
                        <button className="landing-feed-apply" tabIndex={-1}>Apply</button>
                      </article>
                    ))}
                  </div>
                </div>
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

      <section id="demo" className="landing-walkthrough">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2>From discovery to offer, all in one place.</h2>
            <p>Find opportunities, organize your search, and keep track of every application all without the chaos.</p>
          </div>

          <div className="landing-walkthrough-steps">
            <article className="landing-walkthrough-step">
              <div className="landing-walkthrough-text">
                <div className="landing-walkthrough-step-num">1</div>
                <h3>Discover opportunities</h3>
                <p>Browse roles pulled directly from company ATS systems and narrow by role, location, recency, and filters that cut stale listings.</p>
              </div>
              <div className="landing-walkthrough-visual">
                <div className="landing-walkthrough-card">
                  <div className="landing-walkthrough-card-header">
                    <span>SearchTern · Jobs</span>
                  </div>
                  <div className="landing-walkthrough-card-body">
                    <div className="landing-walkthrough-job">
                      <div>
                        <div className="landing-walkthrough-job-title">Software Engineering Intern</div>
                        <div className="landing-walkthrough-job-meta">Google · Mountain View, CA</div>
                      </div>
                      <span className="landing-walkthrough-pill">View listing</span>
                    </div>
                    <div className="landing-walkthrough-job">
                      <div>
                        <div className="landing-walkthrough-job-title">Software Engineering Intern</div>
                        <div className="landing-walkthrough-job-meta">Meta · Menlo Park, CA</div>
                      </div>
                      <span className="landing-walkthrough-pill">View listing</span>
                    </div>
                    <div className="landing-walkthrough-job">
                      <div>
                        <div className="landing-walkthrough-job-title">New Grad SWE</div>
                        <div className="landing-walkthrough-job-meta">Microsoft · Redmond, WA</div>
                      </div>
                      <span className="landing-walkthrough-pill">View listing</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="landing-walkthrough-step landing-walkthrough-step-reverse">
              <div className="landing-walkthrough-text">
                <div className="landing-walkthrough-step-num">2</div>
                <h3>Save jobs you're interested in</h3>
                <p>Save promising roles so you can return to them without losing track of opportunities across browser tabs.</p>
              </div>
              <div className="landing-walkthrough-visual">
                <div className="landing-walkthrough-card">
                  <div className="landing-walkthrough-card-header">
                    <span>Saved</span>
                  </div>
                  <div className="landing-walkthrough-card-body">
                    <div className="landing-walkthrough-job">
                      <div>
                        <div className="landing-walkthrough-job-title">Software Engineering Intern</div>
                        <div className="landing-walkthrough-job-meta">Stripe · San Francisco, CA</div>
                      </div>
                      <span className="landing-walkthrough-pill landing-walkthrough-pill-muted">Saved</span>
                    </div>
                    <div className="landing-walkthrough-job">
                      <div>
                        <div className="landing-walkthrough-job-title">Software Engineering Intern</div>
                        <div className="landing-walkthrough-job-meta">Google · Mountain View, CA</div>
                      </div>
                      <span className="landing-walkthrough-pill landing-walkthrough-pill-muted">Saved</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="landing-walkthrough-step">
              <div className="landing-walkthrough-text">
                <div className="landing-walkthrough-step-num">3</div>
                <h3>Track every application</h3>
                <p>Organize opportunities through the existing stages: <strong>Saved → Applied → Interview → Offer → Rejected</strong>. Keep your pipeline clear in one tracker.</p>
              </div>
              <div className="landing-walkthrough-visual">
                <div className="landing-walkthrough-card">
                  <div className="landing-walkthrough-card-header">
                    <span>Applications Tracker</span>
                  </div>
                  <div className="landing-walkthrough-card-body landing-walkthrough-card-body-stages">
                    <div className="landing-walkthrough-stage">
                      <span>Saved</span>
                      <span className="landing-walkthrough-stage-count">2</span>
                    </div>
                    <div className="landing-walkthrough-stage">
                      <span>Applied</span>
                      <span className="landing-walkthrough-stage-count">3</span>
                    </div>
                    <div className="landing-walkthrough-stage">
                      <span>Interview</span>
                      <span className="landing-walkthrough-stage-count">1</span>
                    </div>
                    <div className="landing-walkthrough-stage">
                      <span>Offer</span>
                      <span className="landing-walkthrough-stage-count">0</span>
                    </div>
                    <div className="landing-walkthrough-stage">
                      <span>Rejected</span>
                      <span className="landing-walkthrough-stage-count">0</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="landing-walkthrough-step landing-walkthrough-step-reverse">
              <div className="landing-walkthrough-text">
                <div className="landing-walkthrough-step-num">4</div>
                <h3>Approve every change</h3>
                <p>Connect an AI agent and it can propose tracker updates, not make them. You review each proposal and approve what actually changes in your tracker.</p>
              </div>
              <div className="landing-walkthrough-visual">
                <div className="landing-walkthrough-card">
                  <div className="landing-walkthrough-card-header">
                    <span>Agent proposal</span>
                  </div>
                  <div className="landing-walkthrough-card-body">
                    <div className="landing-walkthrough-control">
                      <div className="landing-walkthrough-control-row">
                        <span>Move Google to Applied</span>
                        <span className="landing-walkthrough-pill">Pending review</span>
                      </div>
                      <p className="landing-walkthrough-control-note">Nothing changes until you approve it</p>
                    </div>
                  </div>
                </div>
              </div>
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
