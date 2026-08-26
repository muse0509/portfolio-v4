import { siteContent } from "@/content/site";

import { ArrowMark } from "./arrow-mark";
import { Reveal } from "./reveal";

export function ContactCta() {
  const { contact } = siteContent;

  return (
    <section
      id="contact"
      className="contact-cta"
      aria-labelledby="contact-heading"
      data-section="contact"
    >
      <div className="page-shell contact-cta__inner">
        <Reveal>
          <p className="eyebrow">{contact.eyebrow}</p>
          <h2 id="contact-heading" className="contact-cta__heading" aria-label={contact.heading}>
            {contact.headingLines.map((line) => (
              <span aria-hidden="true" key={line}>
                {line}
              </span>
            ))}
          </h2>
          <p className="contact-cta__description">{contact.description}</p>
          <a className="primary-action contact-cta__action focus-ring" href={contact.action.href}>
            <span>{contact.action.label}</span>
            <ArrowMark />
          </a>
          <p id="contact-status" className="contact-cta__status">
            <span aria-hidden="true" className="contact-cta__status-dot" />
            {contact.status}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
