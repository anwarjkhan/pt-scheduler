import { db } from "@/lib/db";

export type SocialPost = {
  id: string;
  caption: string;
  posterUrl: string;
  videoUrl: string | null;
  permalink: string;
};

/**
 * Clips for the "From Instagram" grid.
 *
 * Curated by Toby rather than synced: Instagram has no public feed API, and the
 * Graph API needs a Business account plus a token that expires every 60 days.
 * Self-hosting the video is also what lets the tiles play inline in our own
 * styling instead of inside Instagram's iframe.
 *
 * Returns [] when nothing is set up, and the section hides itself entirely —
 * an empty grid would look broken on the marketing page.
 */
export async function getSocialPosts(limit = 6): Promise<SocialPost[]> {
  const rows = await db.socialPost.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    caption: r.caption,
    posterUrl: r.posterUrl,
    videoUrl: r.videoUrl,
    permalink: r.permalink,
  }));
}
