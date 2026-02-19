"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash } from "lucide-react";
import { House } from "@/lib/db/schema";
import { EditHouseDialog } from "./edit-house-dialog";
import { DeleteHouseDialog } from "./delete-house-dialog";
import { useState } from "react";

export function HouseCard({ house }: { house: House }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{house.owner}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Nightly Rent</p>
            <p className="font-medium text-xl">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(Number(house.nightlyRent))}
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowEdit(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowDelete(true)}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditHouseDialog
        house={house}
        open={showEdit}
        onOpenChange={setShowEdit}
      />

      <DeleteHouseDialog
        house={house}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </>
  );
}
