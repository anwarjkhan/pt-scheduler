"use client";

import { useState } from "react";
import { SITE } from "@/content/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Mirrors the site's contact form. There's no mail service wired up yet, so it composes an
 * email in the visitor's mail client — swap `onSubmit` for a server action when one exists.
 */
export function ContactForm() {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = [
      `Name: ${fd.get("first")} ${fd.get("last")}`,
      `Phone: ${fd.get("phone")}`,
      `Email: ${fd.get("email")}`,
      "",
      String(fd.get("message") ?? ""),
    ].join("\n");
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent("Enquiry from TJM website")}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  const field = "border-white/20 bg-black/30 text-white placeholder:text-white/40";
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="first" className="text-white/80">
          First Name
        </Label>
        <Input id="first" name="first" required className={field} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="last" className="text-white/80">
          Last Name
        </Label>
        <Input id="last" name="last" className={field} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone" className="text-white/80">
          Phone Number
        </Label>
        <Input id="phone" name="phone" type="tel" className={field} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="c-email" className="text-white/80">
          Email
        </Label>
        <Input id="c-email" name="email" type="email" required className={field} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="message" className="text-white/80">
          Message
        </Label>
        <Textarea id="message" name="message" placeholder="Leave us a message..." rows={4} className={field} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" className="font-heading font-semibold">
          Submit
        </Button>
        {sent && <p className="mt-2 text-sm text-tjm-lime">Thanks — your email app should have opened with the message ready to send.</p>}
      </div>
    </form>
  );
}
