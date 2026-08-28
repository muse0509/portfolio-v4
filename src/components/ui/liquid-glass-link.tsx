import { ArrowMark } from "@/components/home/arrow-mark";

type LiquidGlassLinkProps = {
  className?: string;
  href: string;
  label: string;
  showArrow?: boolean;
  variant: "header" | "hero" | "contact";
};

export function LiquidGlassLink({
  className = "",
  href,
  label,
  showArrow = true,
  variant,
}: LiquidGlassLinkProps) {
  return (
    <a
      className={`liquid-glass liquid-glass--${variant} focus-ring ${className}`.trim()}
      href={href}
    >
      <span aria-hidden="true" className="liquid-glass__filter" />
      <span aria-hidden="true" className="liquid-glass__tint" />
      <span aria-hidden="true" className="liquid-glass__specular" />
      <span className="liquid-glass__content">
        <span>{label}</span>
        {showArrow ? <ArrowMark /> : null}
      </span>
    </a>
  );
}
