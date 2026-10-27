import { AuthForm } from "@/components/platform/auth-form";
import "@/components/platform/platform.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; returnTo?: string }>;
}) {
  const { token, returnTo } = await searchParams;
  return (
    <main className="platform-shell">
      <AuthForm token={token} returnTo={returnTo} />
    </main>
  );
}
