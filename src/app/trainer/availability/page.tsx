import { getAvailability } from "@/lib/settings";
import { AvailabilityEditor } from "./availability-editor";

export default async function AvailabilityPage() {
  const { rules, exceptions, recurring } = await getAvailability();
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Availability</h1>
      <AvailabilityEditor rules={rules} exceptions={exceptions} recurring={recurring} />
    </div>
  );
}
