import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[#fff8ed] px-6 py-10 text-[#211b17]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          Selah Ember
        </Link>
        <Link href="/" className="text-sm font-medium text-[#8a3f1e] hover:text-[#b94f22]">
          Back home
        </Link>
      </div>
      <div className="mx-auto mt-16 w-full max-w-md">{children}</div>
    </main>
  );
}
