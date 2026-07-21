import { createBrowserClient } from "@supabase/ssr";
import { isDbReadOnly, readOnlyStub } from "./readonly-guard";

const MUTATING = new Set(["insert", "update", "upsert", "delete"]);

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // حارس «العرض فقط»: يعترض الكتابة (insert/update/upsert/delete) أثناء الدخول كموظف.
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          const builder = target.from(table);
          return new Proxy(builder, {
            get(bTarget, bProp, bReceiver) {
              if (typeof bProp === "string" && MUTATING.has(bProp) && isDbReadOnly()) {
                return () => readOnlyStub();
              }
              const val = Reflect.get(bTarget, bProp, bReceiver);
              return typeof val === "function" ? val.bind(bTarget) : val;
            },
          });
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    },
  }) as typeof client;
}
