"use client";
import { Link } from "react-router-dom";
import { CandlestickChart, UserCircle, Sun, Moon, KeyRound, Settings, LogOut, DollarSign, Menu, Bitcoin, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator"; // Import general Separator
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { MOCK_BALANCES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function Header() {
  const { theme, toggleTheme, isLoading } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    console.log("Logout action triggered");
    alert("Logout action triggered. Implement actual logout logic.");
    // Potentially close mobile nav if open
    if (mobileNavOpen) {
      setMobileNavOpen(false);
    }
  };

  const navLinks = [
    { href: "/profile", label: "Profile", icon: UserCircle },
    { href: "/funding", label: "Funding", icon: DollarSign },
    { href: "/api-keys", label: "API Keys", icon: KeyRound },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const getAssetIcon = (asset: string, className?: string) => {
    if (asset === "BTC") return <Bitcoin className={cn("h-4 w-4 text-orange-500", className)} />;
    if (asset === "ETH") return <span className={cn("font-bold text-primary text-sm", className)}>Ξ</span>;
    if (asset === "USD") return <DollarSign className={cn("h-4 w-4 text-green-500", className)} />;
    return <Coins className={cn("h-4 w-4 text-muted-foreground", className)} />;
  };

  const renderNavItems = (isSheet = false) => {
    if (isSheet) {
      return (
        <>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-3 text-base text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <link.icon className="mr-2 h-5 w-5 shrink-0" />
              <span>{link.label}</span>
            </Link>
          ))}
          <Separator className="my-2 bg-border" />
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="flex w-full justify-start items-center gap-2 rounded-md px-2 py-3 text-base text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <LogOut className="mr-2 h-5 w-5 shrink-0" />
            <span>Logout</span>
          </Button>
        </>
      );
    } else {
      // Desktop DropdownMenu version
      return (
        <>
          {navLinks.map((link) => (
            <DropdownMenuItem key={link.href} asChild>
              <Link to={link.href}>
                <link.icon className="mr-2 h-4 w-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            <span>Logout</span>
          </DropdownMenuItem>
        </>
      );
    }
  };

  if (!mounted || isLoading) {
    return (
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <CandlestickChart className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-headline font-bold text-foreground">SwiftTrade</h1>
          </Link>
          <nav className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <CandlestickChart className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-headline font-bold text-foreground">SwiftTrade</h1>
        </Link>

        <nav className="flex items-center gap-2">
          {/* Wallet Balances - Desktop */}
          {!isMobile && (
            <div className="flex items-center gap-4 mr-3">
              {MOCK_BALANCES.map((balance) => (
                <div key={balance.asset} className="flex items-center gap-1.5 text-xs" title={`${balance.available.toFixed(balance.asset === "USD" ? 2 : 8)} ${balance.asset} available`}>
                  {getAssetIcon(balance.asset)}
                  <span className="text-foreground font-medium">{balance.available.toFixed(balance.asset === "USD" ? 2 : balance.asset === "ETH" ? 3 : 4)}</span>
                  <span className="text-muted-foreground">{balance.asset}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          {isMobile ? (
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-card p-4 flex flex-col">
                <div className="flex flex-col space-y-1 mt-4">{renderNavItems(true)}</div>

                <Separator className="my-3 bg-border" />
                <div className="px-1 py-1.5 text-sm font-semibold text-muted-foreground">Wallet Balances</div>
                <div className="flex flex-col space-y-3 p-1 overflow-y-auto">
                  {MOCK_BALANCES.map((balance) => (
                    <div key={`mobile-${balance.asset}`} className="flex items-center gap-2 text-sm">
                      {getAssetIcon(balance.asset, "h-5 w-5")}
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">{balance.available.toFixed(balance.asset === "USD" ? 2 : 8)}</span>
                        <span className="text-muted-foreground text-xs -mt-0.5">{balance.asset}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto p-2 text-center text-xs text-muted-foreground">SwiftTrade v1.0.0</div>
              </SheetContent>
            </Sheet>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <UserCircle className="h-5 w-5" />
                  <span className="sr-only">User Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-xl">
                <DropdownMenuLabel className="text-muted-foreground">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {renderNavItems(false)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </header>
  );
}
