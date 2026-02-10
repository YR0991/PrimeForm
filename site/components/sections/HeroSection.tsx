'use client';

export interface HeroCTA {
  label: string;
  href?: string;
}

export interface HeroSectionProps {
  title: string;
  subtitle?: string;
  items?: string[];
  cta?: HeroCTA;
}

export function HeroSection({ title, subtitle, items, cta }: HeroSectionProps) {
  return (
    <section>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {items && items.length > 0 && (
        <ul>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {cta && (
        cta.href ? (
          <a href={cta.href}>{cta.label}</a>
        ) : (
          <button type="button">{cta.label}</button>
        )
      )}
    </section>
  );
}
