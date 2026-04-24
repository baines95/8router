export type SettingStatus = {
  type: "" | "success" | "error";
  message: string;
};

type JsonResponse = {
  ok: boolean;
  json: () => Promise<any>;
};

export function createSettingMutation(request: (payload: unknown) => Promise<JsonResponse>) {
  return async (payload: unknown): Promise<SettingStatus> => {
    try {
      const res = await request(payload);
      const data = await res.json();

      if (res.ok) {
        return { type: "success", message: data?.message || "ok" };
      }

      return { type: "error", message: data?.error || "error" };
    } catch {
      return { type: "error", message: "error" };
    }
  };
}
