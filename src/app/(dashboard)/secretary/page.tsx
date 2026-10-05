"use client";

import { SecretaryView, SECRETARY_MOVED_SECTIONS } from "@/components/secretary/secretary-view";

export default function SecretaryPage() {
  return <SecretaryView exclude={SECRETARY_MOVED_SECTIONS} />;
}
