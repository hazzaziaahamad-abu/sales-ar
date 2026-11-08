import { redirect } from "next/navigation";

export default function Home() {
  // الموظف يفتح على «يومي»، والمدير يتحوّل منها لـ«المتابعة اليومية»
  redirect("/my-day?from=root");
}
