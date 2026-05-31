import { SafeLink } from "@/components/media/safe-link";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

export function DiscussionBody({ body }: Readonly<{ body: string }>) {
  const parts = body.split(URL_PATTERN);

  return (
    <p className="whitespace-pre-line leading-7 text-[#3b312b]">
      {parts.map((part, index) => {
        if (part.startsWith("http://") || part.startsWith("https://")) {
          return (
            <SafeLink key={`${part}-${index}`} href={part} className="font-semibold text-[#8a3f1e] underline">
              {part}
            </SafeLink>
          );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </p>
  );
}
