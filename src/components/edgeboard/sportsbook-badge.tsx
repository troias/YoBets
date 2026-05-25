import { Badge } from "@/components/ui/badge";

export function SportsbookBadge({ name, sharp }: { name: string; sharp?: boolean }) {
  return <Badge variant={sharp ? "success" : "default"}>{name}{sharp ? " (Sharp)" : ""}</Badge>;
}
