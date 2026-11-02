"use client";

import type { PostData } from "@/lib/package-posts/types";
import { BasicTemplate } from "./BasicTemplate";
import { VipTemplate } from "./VipTemplate";
import { CashierTemplate } from "./CashierTemplate";

/** يرسم البوست بالقالب المناسب — بالمقاس الحقيقي بالبكسل. */
export function PostRenderer({ post }: { post: PostData }) {
  switch (post.template) {
    case "basic":
      return <BasicTemplate post={post} />;
    case "vip":
    case "vipPlus":
      return <VipTemplate post={post} />;
    case "cashier":
      return <CashierTemplate post={post} />;
  }
}
