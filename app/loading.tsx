import { Flame } from "lucide-react";
import { PageState } from "@/components/ui/page-state";

export default function Loading() {
  return (
    <PageState eyebrow="Selah Ember" title="Gathering the fellowship space">
      <div className="flex flex-col items-center gap-4">
        <Flame aria-hidden="true" className="h-8 w-8 animate-pulse text-[#cf5f2b]" />
        <p>Loading the latest community activity.</p>
      </div>
    </PageState>
  );
}
