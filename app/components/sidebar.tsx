import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useMsal } from "@azure/msal-react";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import SettingsIcon from "../icons/settings.svg";
import GithubIcon from "../icons/github.svg";
import PowerIcon from "../icons/power.svg";
import ChatGptIcon from "../icons/chatgpt.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import MaskIcon from "../icons/mask.svg";
import McpIcon from "../icons/mcp.svg";
import DragIcon from "../icons/drag.svg";
import DiscoveryIcon from "../icons/discovery.svg";

import Locale from "../locales";
import { getUsername } from "../auth/authConfig";

import { useAppConfig, useChatStore, useUpdateStore } from "../store";

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
  REPO_URL,
} from "../constant";

import { Link, useNavigate } from "react-router-dom";
import { isIOS, useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { Selector, showConfirm } from "./ui-lib";
import clsx from "clsx";
import { isMcpEnabled } from "../mcp/actions";

const DISCOVERY = [
  { name: Locale.Plugin.Name, path: Path.Plugins },
  { name: "Stable Diffusion", path: Path.Sd },
  { name: Locale.SearchChat.Page.Title, path: Path.SearchChat },
];

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

export function useHotKey() {
  const chatStore = useChatStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey) {
        if (e.key === "ArrowUp") {
          chatStore.nextSession(-1);
        } else if (e.key === "ArrowDown") {
          chatStore.nextSession(1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}

export function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
  const lastUpdateTime = useRef(Date.now());

  const toggleSideBar = () => {
    config.update((config) => {
      if (config.sidebarWidth < MIN_SIDEBAR_WIDTH) {
        config.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      } else {
        config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
      }
    });
  };

  const onDragStart = (e: MouseEvent) => {
    // Remembers the initial width each time the mouse is pressed
    startX.current = e.clientX;
    startDragWidth.current = config.sidebarWidth;
    const dragStartTime = Date.now();

    const handleDragMove = (e: MouseEvent) => {
      if (Date.now() < lastUpdateTime.current + 20) {
        return;
      }
      lastUpdateTime.current = Date.now();
      const d = e.clientX - startX.current;
      const nextWidth = limit(startDragWidth.current + d);
      config.update((config) => {
        if (nextWidth < MIN_SIDEBAR_WIDTH) {
          config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
        } else {
          config.sidebarWidth = nextWidth;
        }
      });
    };

    const handleDragEnd = () => {
      // In useRef the data is non-responsive, so `config.sidebarWidth` can't get the dynamic sidebarWidth
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);

      // if user click the drag icon, should toggle the sidebar
      const shouldFireClick = Date.now() - dragStartTime < 300;
      if (shouldFireClick) {
        toggleSideBar();
      }
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
  };

  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragStart,
    shouldNarrow,
  };
}

export function SideBarContainer(props: {
  children: React.ReactNode;
  onDragStart: (e: MouseEvent) => void;
  shouldNarrow: boolean;
  className?: string;
}) {
  const isMobileScreen = useMobileScreen();
  const isIOSMobile = useMemo(
    () => isIOS() && isMobileScreen,
    [isMobileScreen],
  );
  const { children, className, onDragStart, shouldNarrow } = props;
  return (
    <div
      className={clsx(styles.sidebar, className, {
        [styles["narrow-sidebar"]]: shouldNarrow,
      })}
      style={{
        // #3016 disable transition on ios mobile screen
        transition: isMobileScreen && isIOSMobile ? "none" : undefined,
      }}
    >
      {children}
      <div
        className={styles["sidebar-drag"]}
        onPointerDown={(e) => onDragStart(e as any)}
      >
        <DragIcon />
      </div>
    </div>
  );
}

export function SideBarHeader(props: {
  title?: string | React.ReactNode;
  subTitle?: string | React.ReactNode;
  logo?: React.ReactNode;
  children?: React.ReactNode;
  shouldNarrow?: boolean;
}) {
  const { title, subTitle, logo, children, shouldNarrow } = props;
  return (
    <div
      className={clsx(styles["sidebar-header"], {
        [styles["sidebar-header-narrow"]]: shouldNarrow,
      })}
      data-tauri-drag-region
    >
      {logo}
      <div className={styles["sidebar-title-container"]}>
        <div className={styles["sidebar-title"]} data-tauri-drag-region>
          {title}
        </div>
        <div className={styles["sidebar-sub-title"]}>{subTitle}</div>
      </div>
      {children}
    </div>
  );
}

export function SideBarBody(props: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}) {
  const { onClick, children } = props;
  return (
    <div className={styles["sidebar-body"]} onClick={onClick}>
      {children}
    </div>
  );
}

export function SideBarTail(props: {
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  const { primaryAction, secondaryAction } = props;

  return (
    <div className={styles["sidebar-tail"]}>
      <div className={styles["sidebar-actions"]}>{primaryAction}</div>
      <div className={styles["sidebar-actions"]}>{secondaryAction}</div>
    </div>
  );
}

export function SideBar(props: { className?: string }) {
  useHotKey();
  const { onDragStart, shouldNarrow } = useDragSideBar();
  const [showDiscoverySelector, setshowDiscoverySelector] = useState(false);
  const navigate = useNavigate();
  const config = useAppConfig();
  const chatStore = useChatStore();
  const updateStore = useUpdateStore();
  const usedAmount = Math.round(updateStore.used * 1000);
  const subscriptionAmount = Math.round(updateStore.subscription * 1000);
  const hasUsage = usedAmount > 0 || subscriptionAmount > 0;
  const percentUsed =
    updateStore.subscription && updateStore.subscription > 0
      ? Math.min(
        100,
        Math.round((updateStore.used / updateStore.subscription) * 100 || 0),
      )
      : 0;

  const [mcpEnabled, setMcpEnabled] = useState(false);
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "AI Chat";
  const logoUrl = process.env.NEXT_PUBLIC_APP_LOGO_URL ?? "";
  const { instance, accounts } = useMsal();
  const resolvedUsername = useMemo(() => {
    const primaryAccount = accounts[0];
    if (primaryAccount) {
      const preferred = primaryAccount.name || primaryAccount.username;
      if (preferred) {
        return preferred.trim();
      }
    }
    return getUsername(instance) ?? "";
  }, [accounts, instance]);
  const welcomeUsername = resolvedUsername || "";

  useEffect(() => {
    // 检查 MCP 是否启用
    const checkMcpStatus = async () => {
      const enabled = await isMcpEnabled();
      setMcpEnabled(enabled);
      console.log("[SideBar] MCP enabled:", enabled);
    };
    checkMcpStatus();
  }, []);

  return (
    <SideBarContainer
      onDragStart={onDragStart}
      shouldNarrow={shouldNarrow}
      {...props}
    >
      <SideBarHeader
        title={appName}
        subTitle={
          <>
            <div style={{ color: "var(--text-secondary)" }}>
              <small>
                <div
                  className={styles["quota-usage"]}
                  title={Locale.Settings.Usage.SubTitle(
                    usedAmount,
                    subscriptionAmount,
                  )}
                  aria-label={Locale.Settings.Usage.Title}
                >
                  {!shouldNarrow ? (
                    <>
                      <div className={styles["quota-usage-text"]}>
                        <small>{Locale.Settings.Usage.Title}</small>
                        <div className={styles["quota-usage-values"]}>
                          <b>{hasUsage ? usedAmount : "0"}</b>
                          <span className={styles["quota-usage-sep"]}>/</span>
                          <small>{hasUsage ? subscriptionAmount : "1000"}</small>
                        </div>
                      </div>
                      <div className={styles["quota-usage-bar"]}>
                        <div
                          className={styles["quota-usage-fill"]}
                          style={{
                            width: `${percentUsed}%`,
                            backgroundColor:
                              updateStore.subscription > 0 &&
                                updateStore.used / updateStore.subscription >= 1
                                ? "#e74c3c" /* danger */
                                : updateStore.subscription > 0 &&
                                  updateStore.used / updateStore.subscription >=
                                  0.8
                                  ? "#f39c12" /* warning */
                                  : "var(--primary)",
                          }}
                        />
                        <div className={styles["quota-usage-percent"]}>
                          {updateStore.subscription > 0
                            ? `${percentUsed}%`
                            : "—"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={styles["quota-usage-values"]}>
                      <b>
                        {updateStore.subscription > 0 ? `${percentUsed}%` : "—"}
                      </b>
                    </div>
                  )}
                </div>
                {/* <b
                  style={{
                    position: "relative",
                    float: "right",
                    padding: "20px 5px 0px 5px",
                  }}
                >
                </b> */}
                <br />
                <br />
                <div style={{ paddingTop: "10px" }}>
                  <b style={{ paddingLeft: "5px" }}>
                    Welcome, {welcomeUsername} ! Let&apos;s start with safety:</b>
                  <br />
                  <ul style={{ paddingInlineStart: "20px", margin: "1px" }}>
                    <li>Never input private or sensitive data.</li>
                    <li>Never use AI for unlawful or harmful acts.</li>
                    <li>Remember that its knowledge may be biased.</li>
                    <li>Always verify its answers with reliable sources.</li>
                  </ul>
                </div>
              </small>
            </div>
          </>
        }
        logo={
          logoUrl ? (
            <Image
              src={logoUrl}
              alt={appName}
              width={60}
              height={60}
              className={styles["sidebar-logo-image"]}
            />
          ) : (
            <ChatGptIcon />
          )
        }
        shouldNarrow={shouldNarrow}
      >
        <div className={styles["sidebar-header-bar"]}>
          {/* <IconButton 
            icon={<MaskIcon />}
            text={shouldNarrow ? undefined : Locale.Mask.Name}
            className={styles["sidebar-bar-button"]}
            onClick={() => {
              if (config.dontShowMaskSplashScreen !== true) {
                navigate(Path.NewChat, { state: { fromHome: true } });
              } else {
                navigate(Path.Masks, { state: { fromHome: true } });
              }
            }}
            shadow
          />
          {mcpEnabled && (
            <IconButton
              icon={<McpIcon />}
              text={shouldNarrow ? undefined : Locale.Mcp.Name}
              className={styles["sidebar-bar-button"]}
              onClick={() => {
                navigate(Path.McpMarket, { state: { fromHome: true } });
              }}
              shadow
            />
          )}
          <IconButton
            icon={<DiscoveryIcon />}
            text={shouldNarrow ? undefined : Locale.Discovery.Name}
            className={styles["sidebar-bar-button"]}
            onClick={() => setshowDiscoverySelector(true)}
            shadow
          /> */}
        </div>
        {/* {showDiscoverySelector && (
          <Selector
            items={[
              ...DISCOVERY.map((item) => {
                return {
                  title: item.name,
                  value: item.path,
                };
              }),
            ]}
            onClose={() => setshowDiscoverySelector(false)}
            onSelection={(s) => {
              navigate(s[0], { state: { fromHome: true } });
            }}
          />
        )} */}
      </SideBarHeader>
      <SideBarBody
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate(Path.Home);
          }
        }}
      >
        <ChatList narrow={shouldNarrow} />
      </SideBarBody>

      <SideBarTail
        primaryAction={
          <>
            <div className={clsx(styles["sidebar-action"], styles.mobile)}>
              <IconButton
                icon={<DeleteIcon />}
                onClick={async () => {
                  if (await showConfirm(Locale.Home.DeleteChat)) {
                    chatStore.deleteSession(chatStore.currentSessionIndex);
                  }
                }}
              />
            </div>
            <div className={styles["sidebar-action"]}>
              <IconButton
                aria={"Logout"}
                icon={<PowerIcon />}
                // text={shouldNarrow ? undefined : "Logout"}
                onClick={() => instance.logoutRedirect()}
                shadow
              />
            </div>
            {/* <div className={styles["sidebar-action"]}>
              <Link to={Path.Settings}>
                <IconButton
                  aria={Locale.Settings.Title}
                  icon={<SettingsIcon />}
                  shadow
                />
              </Link>
            </div> */}
          </>
        }
        secondaryAction={
          <IconButton
            icon={<AddIcon />}
            text={shouldNarrow ? undefined : Locale.Home.NewChat}
            onClick={() => {
              if (config.dontShowMaskSplashScreen) {
                chatStore.newSession();
                navigate(Path.Chat);
              } else {
                navigate(Path.NewChat);
              }
            }}
            shadow
          />
        }
      />
    </SideBarContainer>
  );
}
