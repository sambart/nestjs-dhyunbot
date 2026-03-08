"use client";

import { createContext, useContext } from "react";

import type { Guild } from "../components/Header";

interface SettingsContextValue {
  guilds: Guild[];
  selectedGuildId: string;
}

const SettingsContext = createContext<SettingsContextValue>({
  guilds: [],
  selectedGuildId: "",
});

export function SettingsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SettingsContextValue;
}) {
  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
