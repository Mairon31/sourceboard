-- Persist category governance without changing the posts contract or older migrations.
CREATE TABLE post_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  is_nsfw INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  noindex INTEGER NOT NULL DEFAULT 0 CHECK (noindex IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX post_categories_visibility_idx ON post_categories (is_archived, noindex, slug);

CREATE TABLE post_category_translations (
  category_slug TEXT NOT NULL REFERENCES post_categories(slug) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es', 'pt', 'fr', 'ru', 'de')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (category_slug, locale)
);

CREATE INDEX post_category_translations_locale_idx
  ON post_category_translations (locale, category_slug);

INSERT OR IGNORE INTO post_categories
  (slug, name, description, aliases_json, created_at, updated_at)
VALUES
  ('anime', 'Anime', 'Source requests about anime series, films, studios, characters and scenes.', '["animation","japanese anime"]', unixepoch() * 1000, unixepoch() * 1000),
  ('manga-manhwa', 'Manga & Manhwa', 'Manga, manhwa, manhua, webcomics and related print or digital works.', '["manga","manhwa","manhua"]', unixepoch() * 1000, unixepoch() * 1000),
  ('social-media', 'Social Media', 'Posts, profiles, clips and content originating from social platforms.', '["social","instagram","tiktok","twitter","x"]', unixepoch() * 1000, unixepoch() * 1000),
  ('lost-media', 'Lost Media', 'Missing, deleted, obscure or hard-to-identify media.', '["lost","missing media"]', unixepoch() * 1000, unixepoch() * 1000),
  ('movies', 'Movies', 'Films, scenes, actors, posters and other movie-related sources.', '["film","films","cinema"]', unixepoch() * 1000, unixepoch() * 1000),
  ('tv-streaming', 'TV & Streaming', 'Television, streaming series, episodes and broadcast content.', '["tv","television","streaming","series"]', unixepoch() * 1000, unixepoch() * 1000),
  ('music', 'Music', 'Songs, albums, artists, performances and music-related media.', '["song","songs","album"]', unixepoch() * 1000, unixepoch() * 1000),
  ('games', 'Games', 'Video games, gameplay, characters, assets and gaming media.', '["gaming","video games"]', unixepoch() * 1000, unixepoch() * 1000),
  ('art-illustration', 'Art & Illustration', 'Drawings, illustrations, digital art and visual artwork.', '["art","illustration","drawing"]', unixepoch() * 1000, unixepoch() * 1000),
  ('photography', 'Photography', 'Photographs, photographers, photo sets and photographic sources.', '["photo","photos","photograph"]', unixepoch() * 1000, unixepoch() * 1000),
  ('memes', 'Memes', 'Memes, reaction images and recurring meme formats.', '["meme"]', unixepoch() * 1000, unixepoch() * 1000),
  ('internet-culture', 'Internet Culture', 'Web communities, online trends, sites and internet-native culture.', '["internet","web culture"]', unixepoch() * 1000, unixepoch() * 1000),
  ('people-celebrities', 'People & Celebrities', 'Public figures, creators, celebrities and identifiable people.', '["people","celebrity","celebrities","person"]', unixepoch() * 1000, unixepoch() * 1000),
  ('fashion', 'Fashion', 'Clothing, outfits, accessories, designers and fashion references.', '["clothing","style","outfit"]', unixepoch() * 1000, unixepoch() * 1000),
  ('technology', 'Technology', 'Devices, software, hardware and technology-related sources.', '["tech","computer","electronics"]', unixepoch() * 1000, unixepoch() * 1000),
  ('space', 'Space', 'Astronomy, spacecraft, planets and space-related imagery or media.', '["astronomy","nasa","cosmos"]', unixepoch() * 1000, unixepoch() * 1000),
  ('nature', 'Nature', 'Landscapes, plants, environments and natural phenomena.', '["landscape","plants","environment"]', unixepoch() * 1000, unixepoch() * 1000),
  ('animals', 'Animals', 'Pets, wildlife, species and animal-related sources.', '["animal","pets","wildlife"]', unixepoch() * 1000, unixepoch() * 1000),
  ('cars-vehicles', 'Cars & Vehicles', 'Cars, motorcycles and other vehicles or transportation media.', '["cars","car","vehicles","motorcycle","motorcycles"]', unixepoch() * 1000, unixepoch() * 1000),
  ('places-travel', 'Places & Travel', 'Locations, landmarks, destinations and travel-related sources.', '["places","travel","location","locations"]', unixepoch() * 1000, unixepoch() * 1000),
  ('history', 'History', 'Historical events, periods, artifacts and archival sources.', '["historical"]', unixepoch() * 1000, unixepoch() * 1000),
  ('books-comics', 'Books & Comics', 'Books, comics, graphic novels and related publications.', '["books","book","comics","comic"]', unixepoch() * 1000, unixepoch() * 1000),
  ('products-brands', 'Products & Brands', 'Consumer products, logos, brands and commercial items.', '["products","product","brands","brand"]', unixepoch() * 1000, unixepoch() * 1000),
  ('food-drinks', 'Food & Drinks', 'Recipes, dishes, restaurants, beverages and food-related sources.', '["food","cooking","recipes","drinks"]', unixepoch() * 1000, unixepoch() * 1000),
  ('sports', 'Sports', 'Sports, athletes, matches, teams and sporting events.', '["sport","athletics","teams"]', unixepoch() * 1000, unixepoch() * 1000),
  ('science', 'Science', 'Science, research, experiments, discoveries and educational references.', '["research","biology","physics","chemistry"]', unixepoch() * 1000, unixepoch() * 1000),
  ('architecture', 'Architecture', 'Buildings, interiors, urban design and architectural references.', '["buildings","interior design","urbanism"]', unixepoch() * 1000, unixepoch() * 1000),
  ('crafts-diy', 'Crafts & DIY', 'Crafts, making, restoration and do-it-yourself projects.', '["diy","craft","handmade","maker"]', unixepoch() * 1000, unixepoch() * 1000),
  ('education', 'Education', 'Learning resources, classrooms, tutorials and educational media.', '["learning","school","tutorials"]', unixepoch() * 1000, unixepoch() * 1000),
  ('health-wellness', 'Health & Wellness', 'Health, fitness, wellbeing and medical reference imagery.', '["health","fitness","wellness"]', unixepoch() * 1000, unixepoch() * 1000),
  ('design', 'Design', 'Graphic, product, interface and visual communication design.', '["graphic design","ui","ux"]', unixepoch() * 1000, unixepoch() * 1000),
  ('other', 'Other', 'Source requests that do not fit another category.', '["misc","miscellaneous"]', unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO post_category_translations (category_slug, locale, name, description)
SELECT slug, 'en', name, description FROM post_categories;
