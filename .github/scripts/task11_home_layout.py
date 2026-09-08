from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "app/components/product/product.css",
    ".product-feed-intro {\n",
    '''.product-home-lead {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.75fr);
  align-items: end;
  gap: var(--space-5);
}

.product-home-lead > * {
  min-width: 0;
}

.product-home-lead .product-feed-cta {
  min-width: 0;
  align-self: stretch;
  flex-direction: column;
  align-items: stretch;
  justify-content: end;
}

.product-home-lead .product-feed-cta .product-nav__create {
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .product-home-lead {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-home-lead .product-feed-cta {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .product-home-lead .product-feed-cta .product-nav__create {
    width: auto;
  }
}

@media (max-width: 560px) {
  .product-home-lead .product-feed-cta {
    align-items: stretch;
    flex-direction: column;
  }

  .product-home-lead .product-feed-cta .product-nav__create {
    width: 100%;
  }
}

.product-feed-intro {
''',
)

interactions = Path("app/components/product/product-interactions.css")
text = interactions.read_text()
focus_block = '''
.product-nav__link:focus-visible,
.product-nav__create:focus-visible,
.product-mobile-nav__create:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

'''
if ".product-nav__link:focus-visible" in text:
    raise SystemExit("product-interactions.css: navigation focus styles already present")
interactions.write_text(focus_block + text)

replace_once(
    "app/components/product/store-responsive.css",
    '''.product-store-filter-bar {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}''',
    '''.product-store-filter-bar {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  box-sizing: border-box;
  overscroll-behavior-inline: contain;
  -webkit-overflow-scrolling: touch;
}''',
)
