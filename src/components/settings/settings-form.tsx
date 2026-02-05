"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateNightlyRent,
  type ActionState,
} from "@/app/(protected)/settings/actions";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

export function SettingsForm({ currentRent }: { currentRent: number }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateNightlyRent,
    {}
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      formRef.current?.reset();
      toast.success("Nightly rent updated. Future game nights will use the new amount.");
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 size-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Nightly Rent</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nightlyRent">Amount ($)</Label>
            <Input
              id="nightlyRent"
              name="nightlyRent"
              type="number"
              step="0.01"
              min="0"
              defaultValue={currentRent}
              required
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
