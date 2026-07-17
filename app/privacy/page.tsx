import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionButton, ContentCard, PageContainer, PageHeader } from "@/components/ui/app-ui";
import { getCanonicalUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Selah Ember, operated by SeraphCore.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Selah Ember Privacy Policy",
    description: "How Selah Ember collects, uses, retains, and deletes account and community data.",
    url: getCanonicalUrl("/privacy"),
    type: "website",
  },
};

const sections = [
  {
    title: "Introduction",
    body: (
      <>
        <p>
          Selah Ember is an open faith community app operated by SeraphCore. This Privacy Policy explains what
          information Selah Ember collects, how it is used, and how users can request or complete account deletion.
        </p>
        <p>
          Developer: <span className="font-semibold text-[#3b312b]">SeraphCore</span>. Contact:{" "}
          <a href="mailto:seraphcore2025@gmail.com" className="font-semibold text-[#8a3f1e] underline">
            seraphcore2025@gmail.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "Information We Collect",
    body: (
      <>
        <p>
          Selah Ember collects information needed to operate user accounts and community features. This may include
          email address, Supabase user ID, authentication and session data, profile information, prayer requests,
          messages, community posts, comments, group activity, RSVPs, reports, notifications, and uploaded images or
          files when those features are used.
        </p>
        <p>
          The service may also record technical diagnostics such as request identifiers, route information, operation
          names, error metadata, and similar logs used to operate and troubleshoot the application.
        </p>
      </>
    ),
  },
  {
    title: "How We Use Your Information",
    body: (
      <p>
        Selah Ember uses information to provide account access, profile settings, community participation, direct
        messaging, prayer, groups, events, notifications, moderation, security, diagnostics, and support. We do not
        sell personal information.
      </p>
    ),
  },
  {
    title: "User-Generated Content",
    body: (
      <p>
        User-generated content may include community posts, comments, group discussions, discussion replies, prayer
        requests, messages, media, and reports. Some community content may be visible to other users depending on the
        feature and access rules. Private account data and private messages are handled according to the application&apos;s access
        controls.
      </p>
    ),
  },
  {
    title: "Account Information",
    body: (
      <p>
        Account information may include your email address, user ID, display name, username, bio, favorite verse, faith
        community, avatar reference, authentication state, and session data. This information is used to identify your
        account, keep you signed in, and show your profile where the app supports profile display.
      </p>
    ),
  },
  {
    title: "Data Security",
    body: (
      <p>
        Selah Ember uses HTTPS encryption in transit and relies on Supabase authentication, database, storage, and access
        controls to operate the service. No internet service can guarantee absolute security, but the app is designed to
        limit access to account and community data according to the feature being used.
      </p>
    ),
  },
  {
    title: "Data Sharing",
    body: (
      <p>
        Selah Ember does not sell personal information. Data may be shared only with infrastructure providers necessary
        to operate the service, such as hosting, authentication, database, storage, and diagnostics infrastructure. Data
        may also be disclosed when required for security, abuse prevention, legal compliance, or protection of the
        service and its users.
      </p>
    ),
  },
  {
    title: "Data Retention",
    body: (
      <p>
        Selah Ember keeps account and community data for as long as needed to provide the service, support user
        activity, maintain security, resolve disputes, comply with obligations, and preserve backup or operational
        integrity. Some content may be deleted, while other content may be anonymized when community or conversation
        context needs to remain.
      </p>
    ),
  },
  {
    title: "Account Deletion",
    body: (
      <>
        <p>
          Users can delete their account from Profile Settings by choosing Delete account and typing DELETE to confirm.
          If you cannot access your account, email{" "}
          <a href="mailto:seraphcore2025@gmail.com" className="font-semibold text-[#8a3f1e] underline">
            seraphcore2025@gmail.com
          </a>{" "}
          from the email address associated with your account and request deletion.
        </p>
        <p>
          See the account deletion instructions at{" "}
          <Link href="/delete-account" className="font-semibold text-[#8a3f1e] underline">
            https://selahember.com/delete-account
          </Link>
          .
        </p>
      </>
    ),
    prominent: true,
  },
  {
    title: "Children's Privacy",
    body: (
      <p>
        Selah Ember is not designed to knowingly collect information from children. If you believe a child has provided
        personal information through Selah Ember, contact SeraphCore so the issue can be reviewed.
      </p>
    ),
  },
  {
    title: "Changes to This Policy",
    body: (
      <p>
        SeraphCore may update this Privacy Policy as Selah Ember changes. Updates will be posted on this page, and the
        current public policy is available at https://selahember.com/privacy.
      </p>
    ),
  },
  {
    title: "Contact Us",
    body: (
      <p>
        For privacy questions or account deletion support, contact SeraphCore at{" "}
        <a href="mailto:seraphcore2025@gmail.com" className="font-semibold text-[#8a3f1e] underline">
          seraphcore2025@gmail.com
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <PageContainer size="medium">
        <ActionButton href="/" variant="quiet" size="sm" className="-ml-4">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back home
        </ActionButton>

        <PageHeader
          className="mt-8"
          eyebrow="Privacy"
          title="Privacy Policy"
          description="How Selah Ember collects, uses, protects, retains, and deletes account and community data."
          action={
            <ActionButton href="/delete-account" variant="secondary">
              Account deletion
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </ActionButton>
          }
        />

        <div className="mt-10 grid gap-5">
          {sections.map((section) => (
            <ContentCard
              key={section.title}
              as="section"
              className={section.prominent ? "border-[#d79568] bg-[#fff4e8]" : undefined}
            >
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 leading-7 text-[#67564c]">{section.body}</div>
            </ContentCard>
          ))}

          <ContentCard as="section" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Related pages</h2>
              <p className="mt-2 leading-7 text-[#67564c]">Return home or review account deletion instructions.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ActionButton href="/" variant="secondary">
                Back home
              </ActionButton>
              <ActionButton href="/delete-account" variant="primary">
                Delete account
              </ActionButton>
            </div>
          </ContentCard>
        </div>
      </PageContainer>
    </main>
  );
}
