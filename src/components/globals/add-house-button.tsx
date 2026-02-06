"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddHouseDialog } from "./add-house-dialog";
import { useState } from "react";

export function AddHouseButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add House
      </Button>
      <AddHouseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
