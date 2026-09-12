import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { searchAddresses } from "@/lib/geocode";

/** Address / postcode suggestions for the AddressPicker. Signed-in users only (keeps the providers from being abused). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ hits: await searchAddresses(q) });
}
