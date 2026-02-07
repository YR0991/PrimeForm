export const metadata = {
  title: 'PrimeForm',
  description: 'Decision support voor training. Inzicht in load, recovery en periodisering.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
