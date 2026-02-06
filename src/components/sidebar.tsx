"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  BookOpen,
  DollarSign,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/game-nights", label: "Game Nights", icon: CalendarDays },
  { href: "/ledger", label: "The Books", icon: BookOpen },
  { href: "/payroll", label: "Payroll", icon: DollarSign },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/globals", label: "Globals", icon: Settings },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-background">
      <div className="flex h-14 items-center px-4 font-semibold tracking-tight">
        The Bunker Black Book
      </div>
      <Separator />
      <div className="flex flex-1 flex-col justify-between p-3">
        <NavLinks pathname={pathname} />
        <div>
          <Separator className="mb-3" />
          <p className="truncate px-3 text-xs text-muted-foreground mb-2">
            {userEmail}
          </p>
          <form action="/auth/signout" method="POST">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-muted-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center border-b px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="text-left text-sm font-semibold tracking-tight">
              The Bunker Black Book
            </SheetTitle>
          </SheetHeader>
          <Separator />
          <div className="flex flex-1 flex-col justify-between p-3">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <div>
              <Separator className="mb-3" />
              <p className="truncate px-3 text-xs text-muted-foreground mb-2">
                {userEmail}
              </p>
              <form action="/auth/signout" method="POST">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-3 text-muted-foreground"
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <span className="ml-3 font-semibold tracking-tight">
        The Bunker Black Book
      </span>
    </header>
  );
}
