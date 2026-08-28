import { siteContent } from "@/content/site";

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
          <h2 id="contact-heading" className="contact-cta__heading">
            {contact.heading}
          </h2>
          <p className="contact-cta__description">{contact.description}</p>
          <p className="contact-cta__status">
            <span aria-hidden="true" className="contact-cta__status-dot" />
            {contact.availability}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
