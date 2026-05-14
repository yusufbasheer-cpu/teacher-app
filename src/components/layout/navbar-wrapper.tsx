"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";

export function NavbarWrapper() {
  const pathname = usePathname();
  if (pathname === "/landing") return null;
  return <Navbar />;
}
