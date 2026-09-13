"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { addSocialPost, deleteSocialPost, moveSocialPost, updateSocialPost, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

export type SocialPostRow = {
  id: string;
  caption: string;
  posterUrl: string;
  videoUrl: string | null;
  permalink: string;
};

/** Shared by the add and edit forms — the same four fields either way. */
function Fields({ post }: { post?: SocialPostRow }) {
  const key = post?.id ?? "new";
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`caption-${key}`}>Caption</Label>
        <Input
          id={`caption-${key}`}
          name="caption"
          required
          maxLength={300}
          defaultValue={post?.caption}
          placeholder="What's happening in the clip"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`poster-${key}`}>Thumbnail image URL</Label>
        <Input id={`poster-${key}`} name="posterUrl" required type="url" defaultValue={post?.posterUrl} placeholder="https://…/clip.jpg" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`video-${key}`}>Video URL (optional)</Label>
        <Input id={`video-${key}`} name="videoUrl" type="url" defaultValue={post?.videoUrl ?? ""} placeholder="https://…/clip.mp4" />
        <p className="text-xs text-muted-foreground">An MP4. Leave blank to show a still that links to Instagram.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`link-${key}`}>Instagram post link</Label>
        <Input
          id={`link-${key}`}
          name="permalink"
          required
          type="url"
          defaultValue={post?.permalink}
          placeholder="https://www.instagram.com/p/…"
        />
      </div>
    </>
  );
}

function EditForm({ post, onDone }: { post: SocialPostRow; onDone: () => void }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(async (prev, fd) => {
    const r = await updateSocialPost(post.id, prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      <Fields post={post} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The "From Instagram" grid on the home page. Curated by hand: Instagram has no
 * public feed API worth depending on, so Toby adds the clips worth showing.
 */
export function SocialPosts({ posts }: { posts: SocialPostRow[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addSocialPost, {});
  const [editing, setEditing] = useState<string | null>(null);
  const formKey = state.ok ? posts.length : -1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instagram clips</CardTitle>
        <CardDescription>
          Shown in the “From Instagram” grid on the home page. Visitors see the thumbnail and press play to watch the clip
          without leaving the site. The section is hidden while this list is empty.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          {posts.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Nothing added yet — the section won&apos;t appear on the home page.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {posts.map((p, i) => (
                <li key={p.id}>
                  {editing === p.id ? (
                    <div className="p-3">
                      <EditForm post={p} onDone={() => setEditing(null)} />
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 px-3 py-2 text-sm">
                      <Image src={p.posterUrl} alt="" width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-sm object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2">{p.caption}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.videoUrl ? "Video" : <span className="italic">Still image only</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => moveSocialPost(p.id, "up")}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={i === posts.length - 1}
                          onClick={() => moveSocialPost(p.id, "down")}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Edit"
                          onClick={() => setEditing(p.id)}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <form action={() => deleteSocialPost(p.id)}>
                          <button
                            type="submit"
                            aria-label="Delete"
                            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form key={formKey} action={action} className="space-y-3">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">Add a clip</h3>
          <Fields />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add clip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
