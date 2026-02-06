"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createGameNight,
  updateGameNight,
  type ActionState,
} from "@/app/(protected)/game-nights/actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { House } from "@/lib/db/schema";

type GameNightFormProps = {
  mode: "create";
  houses: House[];
} | {
  mode: "edit";
  id: number;
  houses: House[];
  defaultValues: { date: string; rakeCollected: number; houseId: number; notes: string | null };
};

export function GameNightForm(props: GameNightFormProps) {
  const [open, setOpen] = useState(false);
  const [houseId, setHouseId] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  const action =
    props.mode === "edit"
      ? updateGameNight.bind(null, props.id)
      : createGameNight;

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {}
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      formRef.current?.reset();
      toast.success(
        props.mode === "edit"
          ? "Game night updated"
          : "Game night created"
      );
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, props.mode]);

  const defaults =
    props.mode === "edit"
      ? props.defaultValues
      : { date: "", rakeCollected: 0, houseId: 0, notes: "" };

  // Set default house ID when in edit mode
  useEffect(() => {
    if (props.mode === "edit" && open) {
      setHouseId(props.defaultValues.houseId.toString());
    } else if (!open) {
      setHouseId("");
    }
  }, [props, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.mode === "create" ? (
          <Button size="sm">
            <Plus className="size-4" />
            Add Night
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs">
            <Pencil className="size-3" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "edit" ? "Edit Game Night" : "New Game Night"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="houseId">House *</Label>
            <input type="hidden" name="houseId" value={houseId} />
            <Select value={houseId} onValueChange={setHouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a house..." />
              </SelectTrigger>
              <SelectContent>
                {props.houses.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No houses available
                  </div>
                ) : (
                  props.houses.map((house) => (
                    <SelectItem key={house.id} value={house.id.toString()}>
                      {house.owner} - {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(Number(house.nightlyRent))}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaults.date}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rakeCollected">Rake Collected ($)</Label>
            <Input
              id="rakeCollected"
              name="rakeCollected"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={defaults.rakeCollected}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={defaults.notes ?? ""}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending || props.houses.length === 0 || !houseId}>
            {pending
              ? "Saving..."
              : props.mode === "edit"
                ? "Update"
                : "Create"}
          </Button>
          {props.houses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Add a house in Globals before creating game nights
            </p>
          )}
        </form>
        </form>
      </DialogContent>
    </Dialog>
  );
}
