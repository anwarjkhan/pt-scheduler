import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return session.user;
}

export async function requireTrainer() {
  const user = await requireUser();
  if (user.role !== "TRAINER") redirect("/app");
  return user;
}
