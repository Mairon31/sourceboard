export function meta() {
  return [
    { title: "SourceBoard" },
    {
      name: "description",
      content: "SourceBoard helps communities find the public source or origin of images.",
    },
  ];
}

export default function IndexRoute() {
  return (
    <main className="baseline-shell">
      <section className="baseline-card" aria-labelledby="sourceboard-title">
        <p className="baseline-kicker">Cloudflare-native forum</p>
        <h1 id="sourceboard-title">SourceBoard</h1>
        <p>
          Phase 0 baseline is running with server-side rendering. Product UI begins in the dedicated
          design-system phases.
        </p>
      </section>
    </main>
  );
}
