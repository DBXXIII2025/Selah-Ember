"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  id: string;
  minLength?: number;
  name?: string;
  required?: boolean;
};

export function PasswordField({
  autoComplete,
  id,
  minLength,
  name = "password",
  required = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="relative mt-2">
      <input
        id={id}
        required={required}
        minLength={minLength}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[#ead6c5] bg-white py-3 pl-4 pr-14 outline-none transition focus:border-[#a94720] focus:ring-4 focus:ring-[#a94720]/10"
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setVisible((value) => !value)}
        className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#67564c] transition hover:bg-[#fff4e8] hover:text-[#8a3f1e] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20"
      >
        {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
      </button>
    </div>
  );
}
