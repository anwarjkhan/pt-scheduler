"use client";

import { useState } from "react";
import { NewSessionDialog, type ClientOption } from "./new-session-dialog";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

/** Toolbar entry point; the calendar's click-to-create opens the same dialog. */
export function NewSessionButton({ clients, defaultDate }: { clients: ClientOption[]; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  if (clients.length === 0) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Video className="h-4 w-4" /> New online session
      </Button>
      {open && <NewSessionDialog clients={clients} open onClose={() => setOpen(false)} initialDate={defaultDate} />}
    </>
  );
}
