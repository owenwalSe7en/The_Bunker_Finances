"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateHouseAction } from "@/app/(protected)/globals/actions";
import { House } from "@/lib/db/schema";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function EditHouseDialog({
  house,
  open,
  onOpenChange
}: {
  house: House;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    const result = await updateHouseAction(house.id, formData);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("House updated successfully");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit House</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="owner">Owner Name *</Label>
            <Input
              id="owner"
              name="owner"
              defaultValue={house.owner}
              required
              maxLength={50}
            />
          </div>
          <div>
            <Label htmlFor="nightlyRent">Nightly Rent ($) *</Label>
            <Input
              id="nightlyRent"
              name="nightlyRent"
              type="number"
              step="0.01"
              min="1"
              max="10000"
              defaultValue={Number(house.nightlyRent)}
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Updating..." : "Update House"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
