"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { SocialPost } from "@/lib/social";
import { Play } from "lucide-react";

/**
 * One clip. Shows the poster until the visitor asks for the video, so nothing
 * downloads or moves on its own — kinder on mobile data, and on anyone who would
 * rather the page held still.
 */
function Tile({ post }: { post: SocialPost }) {
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const play = () => {
    setPlaying(true);
    // The element mounts in the same commit, so wait a tick before playing.
    requestAnimationFrame(() => void video.current?.play().catch(() => setPlaying(false)));
  };

  return (
    <figure className="hover-lift group overflow-hidden rounded-md border bg-white shadow-sm">
      <div className="relative aspect-[9/16] overflow-hidden bg-tjm-ink">
        {playing && post.videoUrl ? (
          <video
            ref={video}
            src={post.videoUrl}
            poster={post.posterUrl}
            controls
            playsInline
            onEnded={() => setPlaying(false)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <>
            <Image
              src={post.posterUrl}
              alt=""
              fill
              // Posters are arbitrary external URLs, so skip the optimiser rather
              // than requiring every CDN to be whitelisted in next.config.
              unoptimized
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transform-none"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
            {post.videoUrl && (
              <button
                type="button"
                onClick={play}
                aria-label={`Play: ${post.caption}`}
                className="absolute inset-0 grid place-items-center bg-black/20 transition-colors hover:bg-black/35 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tjm-yellow"
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-tjm-ink shadow-lg transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none">
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </span>
              </button>
            )}
          </>
        )}
      </div>
      <figcaption className="p-4">
        <p className="line-clamp-2 text-sm font-light leading-relaxed text-foreground/80">{post.caption}</p>
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-heading text-xs font-semibold uppercase tracking-wide text-tjm-charcoal underline-offset-4 hover:underline"
        >
          View on Instagram
        </a>
      </figcaption>
    </figure>
  );
}

export function SocialGrid({ posts }: { posts: SocialPost[] }) {
  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <Tile key={p.id} post={p} />
      ))}
    </div>
  );
}
