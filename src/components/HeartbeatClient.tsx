"use client";

import { useEffect } from "react";

// Heartbeat client: runs globally to update last seen every 30 minutes
export default function HeartbeatClient() {
  useEffect(() => {

    const send = () => {
      try {
        const username = localStorage.getItem("userUsername");
        if (!username) return;
        fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    // immediate try (in case user already logged in)
    send();
    // 2 minutes interval
    const timer = setInterval(send, 2 * 60 * 1000);

    const sendBeacon = () => {
      try {
        const username = localStorage.getItem("userUsername");
        if (!username) return;
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([JSON.stringify({ username })], { type: "application/json" });
          navigator.sendBeacon("/api/heartbeat", blob);
        } else {
          fetch("/api/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") sendBeacon();
    };
    const onPageHide = () => sendBeacon();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
