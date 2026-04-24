// lib/schema.ts
// Helpers for generating JSON-LD schema markup

export interface SchemaMarkup {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

export function createPodcastEpisodeSchema(
  episode: {
    title: string;
    description: string;
    slug: string;
    dateISO: string;
    duration: string;
    audioUrl: string;
    id: string;
  },
  siteUrl: string = "https://dimepodcast.com"
): SchemaMarkup {
  return {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: episode.title,
    description: episode.description,
    url: `${siteUrl}/episodes/${episode.slug}`,
    datePublished: episode.dateISO,
    author: {
      "@type": "Person",
      name: "Bryan Fields",
    },
    audio: {
      "@type": "AudioObject",
      url: episode.audioUrl,
      duration: episode.duration,
    },
    potentialAction: {
      "@type": "ListenAction",
      target: `https://player.simplecast.com/${episode.id}`,
    },
  };
}

export function createVideoObjectSchema(
  video: {
    title: string;
    description: string;
    slug: string;
    thumbnail: string;
    publishedAt: string;
    duration: string;
    id: string;
  },
  siteUrl: string = "https://dimepodcast.com"
): SchemaMarkup {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description,
    url: `${siteUrl}/videos/${video.slug}`,
    thumbnailUrl: video.thumbnail,
    uploadDate: video.publishedAt,
    duration: video.duration,
    embedUrl: `https://www.youtube.com/embed/${video.id}`,
  };
}

export function createPodcastSchema(
  siteUrl: string = "https://dimepodcast.com"
): SchemaMarkup {
  return {
    "@context": "https://schema.org",
    "@type": "Podcast",
    name: "The Dime",
    url: siteUrl,
    description: "Cannabis business intelligence. Strategy conversations for operators, not observers.",
    author: {
      "@type": "Organization",
      name: "The Dime Podcast",
    },
    image: `${siteUrl}/logo.png`,
  };
}

export function createOrganizationSchema(
  siteUrl: string = "https://dimepodcast.com"
): SchemaMarkup {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Dime Podcast",
    url: siteUrl,
    description: "Cannabis business intelligence.",
    sameAs: ["https://twitter.com/thedime_cannabis"],
  };
}
