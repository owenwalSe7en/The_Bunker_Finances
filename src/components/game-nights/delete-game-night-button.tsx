"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteGameNight } from "@/app/(protected)/game-nights/actions";
import { toast } from "sonner";

export function DeleteGameNightButton({ id }: { id: number }) {
  async function handleDelete() {
    if (!confirm("Delete this game night and all its expenses?")) return;
    const result = await deleteGameNight(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Game night deleted");
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
    >
      <Trash2 className="size-3" />
    </Button>
  );
}
