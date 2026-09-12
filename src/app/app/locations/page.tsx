import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getCoverageSummary } from "@/lib/settings";
import { LocationForm } from "@/components/location-form";
import { deleteLocation } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { MapLink } from "@/components/map-link";

export default async function LocationsPage() {
  const user = await requireUser();
  const [locations, coverage] = await Promise.all([
    db.location.findMany({
      where: { userId: user.id },
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getCoverageSummary(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Your locations</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saved addresses</CardTitle>
            <CardDescription>Where your sessions take place. Toby covers: {coverage.text}.</CardDescription>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations yet — add one to start booking.</p>
            ) : (
              <ul className="divide-y">
                {locations.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <MapLink target={l} className="h-4 w-4" label={l.label ?? l.formatted} />
                    <div className="flex-1">
                      {l.label && <div className="text-sm font-medium">{l.label}</div>}
                      <div className="text-sm text-muted-foreground">{l.formatted}</div>
                    </div>
                    {l._count.bookings === 0 && (
                      <form
                        action={async () => {
                          "use server";
                          await deleteLocation(l.id);
                        }}
                      >
                        <Button variant="ghost" size="icon" type="submit" aria-label="Delete location">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Add a location</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
