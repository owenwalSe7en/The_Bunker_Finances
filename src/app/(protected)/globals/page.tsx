import { getHouses } from "@/lib/db/queries";
import { HouseCard } from "@/components/globals/house-card";
import { AddHouseButton } from "@/components/globals/add-house-button";

export const metadata = {
  title: "Globals | The Bunker Black Book",
};

export default async function GlobalsPage() {
  const houses = await getHouses();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Globals</h1>
        <p className="text-muted-foreground">
          Manage houses and locations
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Houses</h2>
          <AddHouseButton />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => (
            <HouseCard key={house.id} house={house} />
          ))}
          {houses.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No houses configured. Add your first house to get started.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
