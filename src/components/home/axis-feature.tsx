import Link from "next/link";

import { GitHubMark } from "@/components/ui/github-mark";
import { siteContent } from "@/content/site";

import { AxisLogo } from "./axis-logo";
import { AxisTeaser } from "./axis-teaser";
import { Reveal } from "./reveal";

export function AxisFeature() {
  const { axisFeaturedWork: work } = siteContent;

  return (
    <section
      id="axis"
      className="axis-featured section-band"
      aria-labelledby="axis-heading"
      data-section="axis"
    >
      <div className="page-shell axis-featured__inner">
        <Reveal className="axis-featured__topline">
          <p>{work.sectionLabel}</p>
          <Link className="axis-featured__works-link" href={work.worksAction.href}>
            <span>{work.worksAction.label}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </Reveal>

        <Reveal className="axis-featured__identity">
          <div className="axis-logo" aria-label={`${work.productName} ロゴ`}>
            <AxisLogo
              logoSrc={work.logoSrc}
              productName={work.productName}
            />
          </div>
          <h2 id="axis-heading">{work.displayLine}</h2>
        </Reveal>

        <Reveal className="axis-featured__media">
          <AxisTeaser
            durationLabel={work.durationLabel}
            posterSrc={work.posterSrc}
            videoSrc={work.videoSrc}
          />
        </Reveal>

        <Reveal className="axis-featured__information">
          <div className="axis-featured__copy">
            <p>{work.description}</p>
            <p>{work.ownership}</p>
            <p className="axis-featured__status">
              {work.environment} / {work.disclaimer}
            </p>
          </div>

          <dl className="axis-featured__facts">
            {work.facts.map((fact) => (
              <div className="axis-fact" key={fact.value}>
                <dt>{fact.lead}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="axis-featured__actions">
            <a
              className="axis-featured__app-link"
              href={work.appAction.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={work.appAction.accessibleLabel}
            >
              <span>{work.appAction.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
            <a
              className="axis-featured__repo-link"
              href={work.repositoryAction.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={work.repositoryAction.accessibleLabel}
              title={work.repositoryAction.label}
            >
              <GitHubMark className="axis-featured__repo-icon" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
