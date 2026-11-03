import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { getConversations } from "@/app/actions/messages";
import { MessageWorkspaceSidebar } from "@/components/messages/message-workspace-sidebar";
import { FormNotice } from "@/components/ui/app-ui";

type MessagesPageProps = {
  searchParams: Promise<{ message?: string; q?: string; view?: string }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const params = await searchParams;
  const view = params.view === "archived" ? "archived" : "active";
  const conversations = await getConversations({ search: params.q || "", view });

  return (
    <section aria-label="Private messages" className="px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-[90rem] overflow-hidden rounded-2xl border border-[#e6cbb6] bg-[#fffdf9] shadow-[0_18px_55px_rgba(33,24,20,0.07)] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <MessageWorkspaceSidebar conversations={conversations} view={view} query={params.q || ""} />
        <div className="hidden min-h-[35rem] flex-col lg:flex">
          {params.message ? <div className="p-5"><FormNotice>{params.message}</FormNotice></div> : null}
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5e5d5] text-[#a94720]">
              <MessageCircle aria-hidden="true" className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-[#211814]">Your conversations, in one place</h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-[#67564c]">
              Choose a conversation from the sidebar or start a new message. A quieter space for meaningful connection.
            </p>
            <Link href="/messages/new" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#a94720] px-5 text-sm font-semibold text-white transition hover:bg-[#8d3818]">
              <Plus aria-hidden="true" className="h-4 w-4" /> New message
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
