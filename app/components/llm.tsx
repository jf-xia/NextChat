"use client";

import styles from "./auth.module.scss";
import { useState, useEffect, ChangeEvent } from "react";
import Image from "next/image";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { getClientConfig } from "../config/client";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../auth/authConfig";
import { useSyncStore } from "../store/sync";
import { safeLocalStorage } from "../utils";
import { log } from "console";

const proxyBaseUrl = process.env.BASE_URL ?? "https://ai-2.hsu.edu.hk/llm";

export const loginCall = async (username: string, password: string): Promise<any> => {
  const loginUrl = `${proxyBaseUrl}/v2/login`;

  const body = JSON.stringify({
    username,
    password,
  });

  const response = await fetch(loginUrl, {
    method: "POST",
    body,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Login failed:", errorData);
    throw new Error(errorData.message);
  }

  const data = await response.json();
  return data;
};

type LlmAuthPageProps = {
  isAuthenticated?: boolean;
  onAgreementChange?: (hasAgreed: boolean) => void;
};

export function LlmAuthPage(props: LlmAuthPageProps) {
  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();
  // const email = instance.getActiveAccount()?.username || "";

  // for test only, will be removed later
  const username = "manager";
  const password = "hsuhkitsc202601300119";

  loginCall(username, password).then((data) => {
    console.log("Login successful:", data);
    window.location.href = proxyBaseUrl + "/ui/?login=success";
  }).catch((error) => {
    console.error("Login error:", error);
  });

  return (
    <div>
    </div>
  );
}
