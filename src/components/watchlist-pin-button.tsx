"use client";

import { useState, useEffect } from "react";
import { Telescope } from "lucide-react";
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";

interface WatchlistPinButtonProps {
  entityType: "deal" | "renewal" | "ticket";
  entityId: string;
  entityName: string;
  section: string; // e.g. "/sales", "/renewals", "/support"
}

export function WatchlistPinButton({ entityType, entityId, entityName, section }: WatchlistPinButtonProps) {
  const { user } = useAuth();
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  const isManager =
    user?.isSuperAdmin ||
    user?.roleName === "مدير" ||
    user?.roleName === "admin";

  useEffect(() => {
    if (!isManager) return;
    isInWatchlist(entityId).then(setPinned).catch(() => {});
  }, [entityId, isManager]);

  if (!isManager) return null;

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      if (pinned) {
        await removeFromWatchlist(entityId);
        setPinned(false);
      } else {
        await addToWatchlist({ entity_type: entityType, entity_id: entityId, entity_name: entityName, section });
        setPinned(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={pinned ? "إزالة من رادار الانضباط" : "أضف لرادار الانضباط"}
      className={`p-1.5 rounded-md transition-colors ${
        pinned
          ? "text-amber bg-amber/15 hover:bg-amber/25"
          : "text-muted-foreground hover:text-amber hover:bg-amber/10"
      }`}
    >
      <Telescope className="w-3.5 h-3.5" />
    </button>
  );
}
