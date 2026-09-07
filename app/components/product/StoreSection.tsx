import type { ReactNode } from "react";

export function StoreSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="product-store-section">
      <header className="product-store-section__header">
        <div>
          {eyebrow ? <span className="product-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      <div className="product-store-grid">{children}</div>
    </section>
  );
}
