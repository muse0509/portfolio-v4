import type { Metadata } from "next";
import Link from "next/link";

import { AxisLogo } from "@/components/home/axis-logo";
import { GitHubMark } from "@/components/ui/github-mark";
import { siteContent } from "@/content/site";

export const metadata: Metadata = {
  title: `実績 | ${siteContent.identity.name}`,
  description:
    "要件定義から設計・実装・公開、公開後の改善まで一貫して担当した実績を紹介します。",
};

export default function WorksPage() {
  const { axisFeaturedWork: axis, worksPage } = siteContent;

  return (
    <main id="works-content" className="works-page">
      <a className="skip-link" href="#works-introduction">
        実績本文へ移動
      </a>

      <div className="page-shell works-page__inner">
        <header className="works-page__topline">
          <Link href="/">トップへ戻る</Link>
        </header>

        <section
          id="works-introduction"
          className="works-introduction"
          aria-labelledby="works-heading"
        >
          <h1 id="works-heading">実績</h1>
          <div className="works-introduction__copy">
            <h2>
              <span className="works-introduction__heading-line">
                {worksPage.introduction.heading.lead}
                <span className="works-introduction__heading-scope">
                  {worksPage.introduction.heading.scope}
                </span>
                、
              </span>
              <span className="works-introduction__heading-line">
                {worksPage.introduction.heading.continuation}
              </span>
            </h2>
            <p>{worksPage.introduction.description}</p>
            <p className="works-introduction__fields">
              <span>{worksPage.introduction.period}</span>
              <span
                aria-label={` / ${worksPage.introduction.fields.join("、")}`}
                className="works-introduction__field-list"
              >
                {worksPage.introduction.fields.map((field, index) => (
                  <span
                    aria-hidden="true"
                    className="works-introduction__field"
                    key={field}
                  >
                    <span className="works-introduction__field-separator">
                      {index === 0 ? "/" : "・"}
                    </span>
                    {field}
                  </span>
                ))}
              </span>
            </p>
            <p className="works-introduction__note">
              {worksPage.introduction.note}
            </p>
          </div>
        </section>

        <section
          className="works-axis"
          aria-labelledby="works-axis-heading"
        >
          <div className="works-axis__meta">
            <time dateTime="2025-04">{worksPage.axis.period}</time>
            <span>{worksPage.axis.number}</span>
          </div>

          <article className="works-entry works-axis__entry">
            <div className="works-axis__main">
              <div className="axis-logo works-axis__logo">
                <AxisLogo
                  loading="eager"
                  logoSrc={axis.logoSrc}
                  productName={axis.productName}
                />
              </div>

              <div className="works-axis__summary">
                <h2 id="works-axis-heading">
                  <span className="sr-only">{axis.productName} — </span>
                  {worksPage.axis.category}
                </h2>
                <p className="works-axis__role">{worksPage.axis.role}</p>
                <p>{axis.description}</p>
                <p>{axis.ownership}</p>
                <p className="works-axis__status">
                  {axis.environment} / {axis.disclaimer}
                </p>

                <div className="works-axis__external-actions">
                  <a
                    className="works-axis__app-link"
                    href={axis.appAction.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={axis.appAction.accessibleLabel}
                  >
                    {axis.appAction.label}
                  </a>
                  <a
                    className="works-axis__repo-link"
                    href={axis.repositoryAction.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={axis.repositoryAction.accessibleLabel}
                    title={axis.repositoryAction.label}
                  >
                    <GitHubMark className="works-axis__repo-icon" />
                  </a>
                </div>
              </div>
            </div>

            <dl className="works-axis__facts">
              {axis.facts.map((fact) => (
                <div key={fact.value}>
                  <dt>{fact.lead}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
              <div className="works-axis__scope">
                <dt>担当範囲</dt>
                <dd>
                  <ul>
                    {worksPage.axis.scope.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="works-projects" aria-labelledby="works-projects-heading">
          <h2 id="works-projects-heading" className="sr-only">
            その他の実績
          </h2>

          {worksPage.projects.map((project) => (
            <article className="works-project" key={project.number}>
              <div className="works-project__meta">
                <p>
                  <time dateTime={project.period[0].replace(".", "-")}>
                    {project.period[0]}
                  </time>
                  <span aria-hidden="true">–</span>
                  <time dateTime={project.period[1].replace(".", "-")}>
                    {project.period[1]}
                  </time>
                </p>
                <span>{project.number}</span>
              </div>

              <div className="works-project__description">
                <h3>{project.title}</h3>
                <p>{project.description}</p>
              </div>

              <div className="works-project__outcome">
                <p className="works-project__label">成果</p>
                <p aria-label={project.outcome.join(" / ")}>
                  {project.outcome.map((item, index) => (
                    <span aria-hidden="true" key={item}>
                      {index > 0 ? "/ " : ""}
                      {item}
                    </span>
                  ))}
                </p>
              </div>

              <div className="works-project__scope">
                <p className="works-project__label">担当領域</p>
                <ul>
                  {project.scope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>

        <section
          className="works-recognition"
          aria-labelledby="works-recognition-heading"
        >
          <h2 id="works-recognition-heading">
            {worksPage.recognition.heading}
          </h2>

          <div className="works-recognition__grid">
            <div className="works-recognition__column">
              <h3>{worksPage.recognition.awards.heading}</h3>
              <ul>
                {worksPage.recognition.awards.items.map((award) => (
                  <li key={award.title}>
                    <p>{award.title}</p>
                    <p>{award.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="works-recognition__column">
              <h3>{worksPage.recognition.speaking.heading}</h3>
              <ul>
                {worksPage.recognition.speaking.items.map((event) => (
                  <li
                    className="works-speaking"
                    key={`${event.organizer}-${event.eventName}`}
                  >
                    <time dateTime={event.date.replace(".", "-")}>
                      {event.date}
                    </time>
                    <div>
                      <p
                        aria-label={`${event.organizer} ${event.eventName} / ${event.location}`}
                      >
                        <span aria-hidden="true">{event.organizer} </span>
                        <span
                          aria-hidden="true"
                          className="works-speaking__event-name"
                        >
                          {event.eventName}
                        </span>
                        <span
                          aria-hidden="true"
                          className="works-speaking__location"
                        >
                          <span aria-hidden="true"> / </span>
                          {event.location}
                        </span>
                      </p>
                      <p>{event.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
