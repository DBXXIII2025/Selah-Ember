import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionButton, ContentCard, PageContainer, PageHeader } from "@/components/ui/app-ui";
import { getCanonicalUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Delete Your Account",
  description: "How Selah Ember users can delete their accounts and associated account data.",
  alternates: {
    canonical: "/delete-account",
  },
  openGraph: {
    title: "Delete Your Selah Ember Account",
    description: "Instructions for deleting a Selah Ember account and requesting deletion when account access is unavailable.",
    url: getCanonicalUrl("/delete-account"),
    type: "website",
  },
};

const deletedData = [
  "Your Selah Ember account identity and sign-in access.",
  "Profile information, avatar references, memberships, notifications, saved read state, blocks, and private account data.",
  "Private prayer requests, direct-message attachments, message reactions, reports you submitted, giving drafts, and uploaded files owned by your account.",
  "Posts, comments, group discussions, replies, community reactions, RSVPs, and other associated user-generated data where applicable.",
];

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <PageContainer size="medium">
        <ActionButton href="/" variant="quiet" size="sm" className="-ml-4">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back home
        </ActionButton>

        <PageHeader
          className="mt-8"
          eyebrow="Account deletion"
          title="Delete your Selah Ember account"
          description="Selah Ember is operated by SeraphCore. This page explains how users can delete their Selah Ember account and what account data is removed."
        />

        <div className="mt-10 grid gap-5">
          <ContentCard as="section">
            <h2 className="text-xl font-semibold">Delete your account from Profile Settings</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-[#67564c]">
              <li>Sign in to Selah Ember with the account you want to delete.</li>
              <li>Open <Link href="/profile" className="font-semibold text-[#8a3f1e] underline">Profile Settings</Link>.</li>
              <li>Go to the Danger Zone section and choose <span className="font-semibold text-[#3b312b]">Delete account</span>.</li>
              <li>Read the confirmation dialog, type <span className="font-semibold text-[#3b312b]">DELETE</span> exactly, and submit the form.</li>
              <li>After deletion, Selah Ember signs you out and returns you to the public home page.</li>
            </ol>
          </ContentCard>

          <ContentCard as="section">
            <h2 className="text-xl font-semibold">If you cannot access your account</h2>
            <p className="mt-3 leading-7 text-[#67564c]">
              Email <a href="mailto:seraphcore2025@gmail.com" className="font-semibold text-[#8a3f1e] underline">seraphcore2025@gmail.com</a> from the email address associated with your Selah Ember account and request account deletion. SeraphCore may need to verify that the request comes from the account owner before completing deletion.
            </p>
          </ContentCard>

          <ContentCard as="section">
            <h2 className="text-xl font-semibold">Information deleted</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-[#67564c]">
              {deletedData.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ContentCard>

          <ContentCard as="section">
            <h2 className="text-xl font-semibold">Information that may be retained</h2>
            <p className="mt-3 leading-7 text-[#67564c]">
              Selah Ember may retain limited records only when legally or operationally necessary, including for security, fraud prevention, abuse prevention, legal compliance, dispute handling, regulatory obligations, or backup integrity. The project does not currently define a fixed public retention period for those limited records, so SeraphCore retains only what is necessary for those purposes.
            </p>
            <p className="mt-3 leading-7 text-[#67564c]">
              Content that belongs to other users is not deleted simply because it interacted with your account. Where conversation or community context needs to remain, Selah Ember removes your account identity and private content from the affected records.
            </p>
          </ContentCard>

          <ContentCard as="section" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Need help?</h2>
              <p className="mt-2 leading-7 text-[#67564c]">Contact SeraphCore for account-deletion support.</p>
            </div>
            <ActionButton href="mailto:seraphcore2025@gmail.com" variant="secondary">
              Email support
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </ActionButton>
          </ContentCard>
        </div>
      </PageContainer>
    </main>
  );
}
