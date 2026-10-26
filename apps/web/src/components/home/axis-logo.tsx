import Image from "next/image";

type AxisLogoProps = {
  loading?: "eager" | "lazy";
  logoSrc: string | null;
  productName: string;
};

export function AxisLogo({
  loading = "lazy",
  logoSrc,
  productName,
}: AxisLogoProps) {
  if (!logoSrc) {
    return <span className="axis-logo__fallback">{productName}</span>;
  }

  return (
    <span className="axis-logo__image">
      <Image
        src={logoSrc}
        alt={productName}
        fill
        loading={loading}
        sizes="(max-width: 767px) 42vw, 280px"
      />
    </span>
  );
}
