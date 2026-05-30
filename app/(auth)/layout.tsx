import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(217,120,52,0.18),transparent_32%),linear-gradient(135deg,#f7ead7,#fff8ed)] px-6 py-10 text-[#211814]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <BrandMark />
        <Link href="/" className="text-sm font-medium text-[#8a3f1e] hover:text-[#b94f22]">
          Back home
        </Link>
      </div>
      <div className="mx-auto mt-16 w-full max-w-md">{children}</div>
    </main>
  );
}
