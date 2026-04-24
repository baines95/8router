import { Suspense } from "react";
import UsagePageClient from "./UsagePageClient";

export default function UsagePage() {
  return (
    <Suspense fallback={null}>
      <UsagePageClient />
    </Suspense>
  );
}
