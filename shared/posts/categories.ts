export const POST_CATEGORIES = [
  {
    slug: "anime",
    label: "Anime",
    description: "Source requests about anime series, films, studios, characters and scenes.",
    aliases: ["animation", "japanese anime"],
  },
  {
    slug: "manga-manhwa",
    label: "Manga & Manhwa",
    description: "Manga, manhwa, manhua, webcomics and related print or digital works.",
    aliases: ["manga", "manhwa", "manhua"],
  },
  {
    slug: "social-media",
    label: "Social Media",
    description: "Posts, profiles, clips and content originating from social platforms.",
    aliases: ["social", "instagram", "tiktok", "twitter", "x"],
  },
  {
    slug: "lost-media",
    label: "Lost Media",
    description: "Missing, deleted, obscure or hard-to-identify media.",
    aliases: ["lost", "missing media"],
  },
  {
    slug: "movies",
    label: "Movies",
    description: "Films, scenes, actors, posters and other movie-related sources.",
    aliases: ["film", "films", "cinema"],
  },
  {
    slug: "tv-streaming",
    label: "TV & Streaming",
    description: "Television, streaming series, episodes and broadcast content.",
    aliases: ["tv", "television", "streaming", "series"],
  },
  {
    slug: "music",
    label: "Music",
    description: "Songs, albums, artists, performances and music-related media.",
    aliases: ["song", "songs", "album"],
  },
  {
    slug: "games",
    label: "Games",
    description: "Video games, gameplay, characters, assets and gaming media.",
    aliases: ["gaming", "video games"],
  },
  {
    slug: "art-illustration",
    label: "Art & Illustration",
    description: "Drawings, illustrations, digital art and visual artwork.",
    aliases: ["art", "illustration", "drawing"],
  },
  {
    slug: "photography",
    label: "Photography",
    description: "Photographs, photographers, photo sets and photographic sources.",
    aliases: ["photo", "photos", "photograph"],
  },
  {
    slug: "memes",
    label: "Memes",
    description: "Memes, reaction images and recurring meme formats.",
    aliases: ["meme"],
  },
  {
    slug: "internet-culture",
    label: "Internet Culture",
    description: "Web communities, online trends, sites and internet-native culture.",
    aliases: ["internet", "web culture"],
  },
  {
    slug: "people-celebrities",
    label: "People & Celebrities",
    description: "Public figures, creators, celebrities and identifiable people.",
    aliases: ["people", "celebrity", "celebrities", "person"],
  },
  {
    slug: "fashion",
    label: "Fashion",
    description: "Clothing, outfits, accessories, designers and fashion references.",
    aliases: ["clothing", "style", "outfit"],
  },
  {
    slug: "technology",
    label: "Technology",
    description: "Devices, software, hardware and technology-related sources.",
    aliases: ["tech", "computer", "electronics"],
  },
  {
    slug: "space",
    label: "Space",
    description: "Astronomy, spacecraft, planets and space-related imagery or media.",
    aliases: ["astronomy", "nasa", "cosmos"],
  },
  {
    slug: "nature",
    label: "Nature",
    description: "Landscapes, plants, environments and natural phenomena.",
    aliases: ["landscape", "plants", "environment"],
  },
  {
    slug: "animals",
    label: "Animals",
    description: "Pets, wildlife, species and animal-related sources.",
    aliases: ["animal", "pets", "wildlife"],
  },
  {
    slug: "cars-vehicles",
    label: "Cars & Vehicles",
    description: "Cars, motorcycles and other vehicles or transportation media.",
    aliases: ["cars", "car", "vehicles", "motorcycle", "motorcycles"],
  },
  {
    slug: "places-travel",
    label: "Places & Travel",
    description: "Locations, landmarks, destinations and travel-related sources.",
    aliases: ["places", "travel", "location", "locations"],
  },
  {
    slug: "history",
    label: "History",
    description: "Historical events, periods, artifacts and archival sources.",
    aliases: ["historical"],
  },
  {
    slug: "books-comics",
    label: "Books & Comics",
    description: "Books, comics, graphic novels and related publications.",
    aliases: ["books", "book", "comics", "comic"],
  },
  {
    slug: "products-brands",
    label: "Products & Brands",
    description: "Consumer products, logos, brands and commercial items.",
    aliases: ["products", "product", "brands", "brand"],
  },
  {
    slug: "other",
    label: "Other",
    description: "Source requests that do not fit another category.",
    aliases: ["misc", "miscellaneous"],
  },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];
export type PostCategorySlug = PostCategory["slug"];

function normalizeCategoryValue(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function parsePostCategorySlug(value: unknown): PostCategorySlug | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeCategoryValue(value);
  return POST_CATEGORIES.find((category) => category.slug === normalized)?.slug ?? null;
}

export function findPostCategory(value: unknown): PostCategory | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeCategoryValue(value);
  if (!normalized) return null;
  return (
    POST_CATEGORIES.find(
      (category) =>
        normalizeCategoryValue(category.slug) === normalized ||
        normalizeCategoryValue(category.label) === normalized ||
        category.aliases.some((alias) => normalizeCategoryValue(alias) === normalized),
    ) ?? null
  );
}

export function getPostCategory(slug: PostCategorySlug): PostCategory {
  return POST_CATEGORIES.find((category) => category.slug === slug)!;
}
