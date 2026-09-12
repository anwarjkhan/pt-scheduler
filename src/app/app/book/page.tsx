import { redirect } from "next/navigation";

/** Booking now lives at the top of the home page for signed-in users. */
export default function BookPage() {
  redirect("/?cal=1");
}
