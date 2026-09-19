"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { isNavLinkActive } from "@/lib/app-nav-links";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/lesson-plan", label: "Lesson plans" },
  { href: "/differentiated-worksheets", label: "Worksheets" },
  { href: "/question-paper", label: "Question papers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) setSignedIn(Boolean(data.session)); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => { active = false; subscription.unsubscribe(); desktop.removeEventListener("change", closeOnDesktop); };
  }, []);
  const links = (mobile = false) => NAV_LINKS.map((link) => (
    <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
      aria-current={isNavLinkActive(pathname, link.href) ? "page" : undefined}
      className={cn("rounded-md font-medium transition-colors duration-[140ms]", mobile ? "px-4 py-3.5 text-base" : "px-3 py-2.5 text-sm", isNavLinkActive(pathname, link.href) ? "bg-brand-subtle text-brand-text" : "text-muted hover:bg-hover hover:text-ink")}>
      {link.label}
    </Link>
  ));
  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <header className="sticky top-0 z-40 border-b border-line-subtle bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Layah home" className="flex shrink-0 items-center gap-2.5">
            <img src="/logo-mark.png" alt="" aria-hidden className="size-9 rounded-md object-cover" />
            <span className="text-[23px] font-semibold tracking-[-0.04em] text-ink">Layah</span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-0.5 lg:flex">{links()}</nav>
          <div className="hidden items-center gap-2 lg:flex">
            {signedIn ? <Button render={<Link href="/overview" />}>Go to workspace<ArrowRight aria-hidden /></Button> : <>
              <Button variant="ghost" render={<Link href="/login" />}>Sign in</Button>
              <Button render={<Link href="/signup" />}>Get started<ArrowRight aria-hidden /></Button>
            </>}
          </div>
          <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation" className="lg:hidden" />}><Menu aria-hidden /></SheetTrigger>
        </div>
      </header>
      <SheetContent side="right" className="w-[340px] max-w-[90vw] gap-0 p-5" aria-describedby={undefined}>
        <SheetTitle className="mb-7 mt-1 text-xl">Explore Layah</SheetTitle>
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1">{links(true)}</nav>
        <div className="mt-auto space-y-3 border-t border-line-subtle pt-5">
          {signedIn ? <Button block size="lg" render={<Link href="/overview" />}>Go to workspace<ArrowRight aria-hidden /></Button> : <>
            <Button block size="lg" render={<Link href="/signup" />}>Get started<ArrowRight aria-hidden /></Button>
            <Button block variant="outline" size="lg" render={<Link href="/login" />}>Sign in</Button>
          </>}
          <Link href="/contact" className="block py-3 text-center text-sm text-muted hover:text-brand-text">Contact our team</Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
