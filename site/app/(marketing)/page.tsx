import { HeroSection } from '@/components/sections/HeroSection';

// Hardcoded content from /content/pages/home (copy_blocks + sitemap). No markdown parser in v1.

const hero = {
  title: 'Beslissen op data, niet op gevoel.',
  subtitle:
    'PrimeForm geeft je inzicht in load, recovery en periodisering. Decision support voor je atleten — jij blijft de coach.',
  items: [
    'Data-gedreven advies per atleet, zonder handmatig rekenwerk.',
    'Minder giswerk, meer overzicht over je groep.',
    'Eén tool voor check-in, trends en aanbevelingen.',
  ],
  cta: { label: 'Plan een demo', href: '/demo' },
};

const steps = {
  title: 'Hoe het werkt',
  items: [
    'Check-in — Jij (of je atleet) vult kort in hoe het gaat: slaap, stress, eventueel HRV of trainingsdata.',
    'Data — PrimeForm verwerkt de input en koppelt waar mogelijk aan bestaande data (bijv. Strava).',
    'Advies — Je krijgt een overzicht en aanbevelingen voor load of recovery. Jij beslist; PrimeForm ondersteunt.',
  ],
  cta: { label: 'Vraag toegang aan', href: '/demo' },
};

const kpis = {
  title: 'Wat gyms merken',
  items: [
    { label: 'Minder tijd per atleet', text: 'Check-in en advies gestandaardiseerd; minder handmatig uitzoeken.' },
    { label: 'Betere compliance', text: 'Atleten doen vaker check-in door korte, duidelijke flow.' },
    { label: 'Scherpere keuzes', text: 'Load/recovery-advies op data; minder "gevoel" alleen.' },
    { label: 'Overzicht per groep', text: 'Zie in één oogopslag wie aandacht nodig heeft.' },
  ],
  note: 'Deze punten zijn gebaseerd op wat gebruikers rapporteren; resultaten verschillen per gym en gebruik.',
};

const reassurance = {
  title: 'PrimeForm is geen coach',
  body: 'PrimeForm vervangt je niet. Het is decision support: data en aanbevelingen om keuzes te onderbouwen. Jij (of je coach) blijft bepalen wat er gebeurt. Geen black box, geen AI die het overneemt — wel inzicht en minder giswerk.',
};

const whatsIncluded = {
  title: 'Wat is PrimeForm',
  body: 'Decision support voor training op basis van check-in en data. Geen medisch hulpmiddel.',
  subtitle: 'Voor wie',
  forWho: 'Gyms en coaches (primair). Atleten via gym of coach.',
};

const pricingTeaser = {
  title: 'Tarieven',
  subtitle: 'Pakketten per aantal seats. Geen verrassingen.',
  cta: { label: 'Vraag tarieven aan', href: '/pricing' },
};

const faqTeaser = {
  title: 'Veelgestelde vragen',
  subtitle: 'Medisch, coach, data, privacy, pilot, opzeggen.',
  cta: { label: 'Bekijk FAQ', href: '/faq' },
};

const evidenceTeaser = {
  title: 'Evidence Library',
  subtitle: 'Hoe PrimeForm werkt: onderbouwing, modelaannames, veiligheid, architectuur, privacy.',
  cta: { label: 'Bekijk evidence', href: '/evidence' },
};

const footerCta = {
  title: 'Start met PrimeForm',
  cta: { label: 'Plan een demo', href: '/demo' },
};

const disclaimer =
  'PrimeForm is decision support voor training. Geen medisch hulpmiddel, geen medische adviezen.';

export default function HomePage() {
  return (
    <main>
      <HeroSection
        title={hero.title}
        subtitle={hero.subtitle}
        items={hero.items}
        cta={hero.cta}
      />

      <section>
        <h2>{whatsIncluded.title}</h2>
        <p>{whatsIncluded.body}</p>
        <h3>{whatsIncluded.subtitle}</h3>
        <p>{whatsIncluded.forWho}</p>
      </section>

      <section>
        <h2>{steps.title}</h2>
        <ul>
          {steps.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <a href={steps.cta.href}>{steps.cta.label}</a>
      </section>

      <section>
        <h2>{kpis.title}</h2>
        <ul>
          {kpis.items.map((item, i) => (
            <li key={i}>
              <strong>{item.label}</strong> — {item.text}
            </li>
          ))}
        </ul>
        <p>{kpis.note}</p>
      </section>

      <section>
        <h2>{reassurance.title}</h2>
        <p>{reassurance.body}</p>
      </section>

      <section>
        <h2>{pricingTeaser.title}</h2>
        <p>{pricingTeaser.subtitle}</p>
        <a href={pricingTeaser.cta.href}>{pricingTeaser.cta.label}</a>
      </section>

      <section>
        <h2>{faqTeaser.title}</h2>
        <p>{faqTeaser.subtitle}</p>
        <a href={faqTeaser.cta.href}>{faqTeaser.cta.label}</a>
      </section>

      <section>
        <h2>{evidenceTeaser.title}</h2>
        <p>{evidenceTeaser.subtitle}</p>
        <a href={evidenceTeaser.cta.href}>{evidenceTeaser.cta.label}</a>
      </section>

      <section>
        <h2>{footerCta.title}</h2>
        <a href={footerCta.cta.href}>{footerCta.cta.label}</a>
      </section>

      <footer>
        <p>{disclaimer}</p>
      </footer>
    </main>
  );
}
