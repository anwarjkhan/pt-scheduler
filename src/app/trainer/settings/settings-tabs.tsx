"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "scheduling", label: "Scheduling" },
  { value: "areas", label: "Service areas" },
  { value: "website", label: "Website" },
] as const;

const STORAGE_KEY = "trainer-settings-tab";

/** The stored value never changes underneath us, so there is nothing to subscribe to. */
const subscribeNothing = () => () => {};

function getRemembered(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && TABS.some((t) => t.value === saved) ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Tab shell for the settings page. Panels are server-rendered and passed in, so
 * only the tab state itself is client-side.
 *
 * The chosen tab is remembered per browser: editing settings usually means
 * going back and forth with the live site, and landing on the first tab every
 * time is tedious.
 */
export function SettingsTabs({ scheduling, areas, website }: { scheduling: ReactNode; areas: ReactNode; website: ReactNode }) {
  // Null until mounted, so the server and the first client render agree; the
  // remembered tab is applied on the first commit instead.
  const [chosen, setChosen] = useState<string | null>(null);
  const remembered = useSyncExternalStore(subscribeNothing, getRemembered, () => null);
  const value = chosen ?? remembered ?? TABS[0].value;

  const onChange = (next: string) => {
    setChosen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage — the tab still switches.
    }
  };

  return (
    <Tabs value={value} onValueChange={(v) => onChange(String(v))}>
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="scheduling" className="mt-6">
        {scheduling}
      </TabsContent>
      <TabsContent value="areas" className="mt-6">
        {areas}
      </TabsContent>
      <TabsContent value="website" className="mt-6">
        {website}
      </TabsContent>
    </Tabs>
  );
}
