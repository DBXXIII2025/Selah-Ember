"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type TopicOption = { id: string; slug: string; name: string };

export function CommunityTopicPicker({ topics }: Readonly<{ topics: TopicOption[] }>) {
  const router = useRouter();

  return (
    <div className="relative w-full sm:w-[min(100%,21rem)]">
      <label htmlFor="discussion-topic-picker" className="sr-only">Choose a discussion topic</label>
      <select
        id="discussion-topic-picker"
        defaultValue=""
        disabled={topics.length === 0}
        onChange={(event) => {
          const slug = event.currentTarget.value;
          if (slug) router.push(`/community/topics/${encodeURIComponent(slug)}`);
        }}
        className="min-h-12 w-full appearance-none rounded-xl border border-[#d9b58d] bg-white px-4 pr-11 text-sm font-semibold text-[#211814] shadow-sm outline-none transition hover:border-[#a94720] focus-visible:border-[#a94720] focus-visible:ring-4 focus-visible:ring-[#a94720]/15 disabled:opacity-60"
      >
        <option value="">Select a discussion topic…</option>
        {topics.map((topic) => <option key={topic.id} value={topic.slug}>{topic.name}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a3f1e]" />
    </div>
  );
}
