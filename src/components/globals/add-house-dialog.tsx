"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHouseAction } from "@/app/(protected)/globals/actions";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function AddHouseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    const result = await createHouseAction(formData);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("House created successfully");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add House</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="owner">Owner Name *</Label>
            <Input
              id="owner"
              name="owner"
              placeholder="e.g., Kam"
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
              placeholder="330.00"
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating..." : "Create House"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
