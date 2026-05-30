import {
  joinGroup,
  leaveGroup,
  type GroupMembershipStatus,
  type StudyGroup,
} from "@/app/actions/groups";

type GroupMembershipFormProps = {
  group: StudyGroup;
  status: GroupMembershipStatus;
};

export function GroupMembershipForm({ group, status }: GroupMembershipFormProps) {
  if (status.isOwner) {
    return (
      <p className="inline-flex rounded-full bg-[#fff4e8] px-4 py-2 text-sm font-semibold text-[#8a3f1e]">
        You lead this group
      </p>
    );
  }

  if (status.isMember) {
    return (
      <form action={leaveGroup}>
        <input type="hidden" name="group_id" value={group.id} />
        <button
          type="submit"
          className="rounded-full border border-[#2f2722]/20 bg-white/70 px-6 py-3 text-sm font-semibold text-[#2f2722] shadow-sm transition hover:bg-white"
        >
          Leave group
        </button>
      </form>
    );
  }

  return (
    <form action={joinGroup}>
      <input type="hidden" name="group_id" value={group.id} />
      <button
        type="submit"
        className="rounded-full bg-[#cf5f2b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
      >
        Join group
      </button>
    </form>
  );
}
