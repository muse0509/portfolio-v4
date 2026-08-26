import { siteContent } from "@/content/site";

export function ProofStrip() {
  return (
    <section className="proof-strip" aria-label="提供価値" data-section="proof">
      <div className="page-shell proof-strip__inner">
        {siteContent.proof.map((item) => (
          <div className="proof-strip__item" key={item.label}>
            <p className="proof-strip__label">{item.label}</p>
            <p className="proof-strip__detail">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
