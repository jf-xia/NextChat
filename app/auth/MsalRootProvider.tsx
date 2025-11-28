"use client";

import { ReactNode } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./authConfig";

interface MsalRootProviderProps {
  children: ReactNode;
}

export const MsalRootProvider = ({ children }: MsalRootProviderProps) => {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
};
