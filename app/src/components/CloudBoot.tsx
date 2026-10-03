"use client";
import { useEffect } from "react";
import { cloud } from "@/lib/cloud";

/** Loads the signed-in player (guest or account) once per page load; nothing is created until real play happens. */
export function CloudBoot() {
  useEffect(() => { void cloud.refresh(); }, []);
  return null;
}
