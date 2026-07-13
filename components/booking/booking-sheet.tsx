"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle, CircleNotch } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

import type { ScheduleClass } from "@/components/booking/booking-home";

export type SheetAction = "book" | "waitlist" | "cancel" | "leave-waitlist";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

// Tailwind's `sm` breakpoint — mirrors app/page.tsx's useSyncExternalStore
// pattern so we react to viewport changes without a set-state-in-effect.
const DESKTOP_QUERY = "(min-width: 640px)";

function subscribeToViewport(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm"
    >
      {children}
    </div>
  );
}

function post(url: string, body: unknown, method: string) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => ({ res, data: await res.json().catch(() => ({})) }));
}

/**
 * The showpiece confirmation sheet — glass surface over a scrim, drag-to-
 * dismiss on mobile, spring enter/exit along the same path (apple-design
 * §7), green Confirm / red destructive-confirm per the studio owner's
 * explicit color convention. One `busy` string state (login page pattern).
 */
export function BookingSheet({
  classItem,
  dayLabel,
  action,
  trigger,
  onClose,
  onSuccess,
}: {
  classItem: ScheduleClass;
  dayLabel: string;
  action: SheetAction;
  trigger: HTMLElement | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isDestructive = action === "cancel" || action === "leave-waitlist";

  // Focus the sheet on open; return focus to the trigger on close (a11y —
  // apple-design §14 / dashboard spec).
  useEffect(() => {
    closeButtonRef.current?.focus();
    return () => {
      trigger?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function confirm() {
    if (busy) return;
    setBusy("confirm");
    setError(null);
    try {
      if (action === "book" || action === "waitlist") {
        const { data } = await post("/api/bookings", { classId: classItem.id }, "POST");
        if (!data.ok) {
          setError(data.error ?? "Something went wrong. Please try again.");
          return;
        }
        setSucceeded(data.status === "waitlisted" ? "You're on the waitlist" : "You're booked");
      } else {
        const { data } = await post("/api/bookings", { classId: classItem.id }, "DELETE");
        if (!data.ok) {
          setError(data.error ?? "Something went wrong. Please try again.");
          return;
        }
        setSucceeded(action === "cancel" ? "Booking cancelled" : "You've left the waitlist");
      }
      onSuccess();
      setTimeout(onClose, 900);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const prefersReduced = useReducedMotion();
  const isDesktop = useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  const scrimVariants = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const sheetVariants = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isDesktop
      ? {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
        }
      : {
          initial: { opacity: 0, y: "100%" },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: "100%" },
        };
  const transition = prefersReduced
    ? { duration: 0.15 }
    : ({ type: "spring", bounce: 0, duration: 0.32 } as const);

  const time = timeFormatter.format(classItem.startsAt);

  const title =
    action === "book"
      ? "Confirm booking"
      : action === "waitlist"
        ? "Join waitlist"
        : action === "cancel"
          ? "Cancel booking"
          : "Leave waitlist";

  const confirmLabel =
    action === "book"
      ? "Confirm"
      : action === "waitlist"
        ? "Join waitlist"
        : action === "cancel"
          ? "Cancel booking"
          : "Leave waitlist";

  const dismissLabel = isDestructive ? "Keep my booking" : "Not now";

  return (
    <>
      <motion.div
        key="scrim"
        className="fixed inset-0 z-50 bg-black/40"
        variants={scrimVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        onClick={() => !busy && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <motion.div
          key="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-sheet-title"
          ref={sheetRef}
          className="glass w-full rounded-t-3xl p-6 sm:max-w-md sm:rounded-3xl"
          variants={sheetVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          drag={!prefersReduced && !isDesktop ? "y" : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_, info) => {
            if (!busy && (info.offset.y > 120 || info.velocity.y > 500)) onClose();
          }}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-current opacity-20 sm:hidden" />

          {succeeded ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="text-success size-10" weight="fill" />
              <p className="font-semibold tracking-tight">{succeeded}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 id="booking-sheet-title" className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                <p className="text-foreground font-medium">{classItem.title}</p>
                <p className="text-muted-foreground text-sm capitalize">
                  {classItem.type} · {classItem.instructor}
                </p>
                <p className="text-muted-foreground text-sm">
                  {dayLabel} · <span className="tabular-nums">{time}</span> ·{" "}
                  {classItem.durationMin} min
                </p>
              </div>

              {action === "waitlist" && (
                <p className="text-muted-foreground text-sm">
                  This class is full. You&apos;ll be first in line if a spot opens.
                </p>
              )}
              {action === "cancel" && !classItem.cancellable && (
                <p className="text-warning text-sm">
                  Bookings can&apos;t be cancelled within 6 hours of class start — call the
                  studio if something came up.
                </p>
              )}
              {action === "book" && (
                <p className="text-muted-foreground text-sm">
                  {classItem.spotsLeft} spot{classItem.spotsLeft === 1 ? "" : "s"} left.
                </p>
              )}

              <FormError>{error}</FormError>

              <div className="flex flex-col gap-2.5">
                <Button
                  className={
                    isDestructive
                      ? "bg-danger hover:bg-danger/90 w-full gap-2 text-white"
                      : "bg-success hover:bg-success/90 w-full gap-2 text-white"
                  }
                  onClick={confirm}
                  disabled={busy !== null || (action === "cancel" && !classItem.cancellable)}
                >
                  {busy === "confirm" && (
                    <CircleNotch className="size-4 animate-spin" weight="bold" />
                  )}
                  {confirmLabel}
                </Button>
                <Button
                  ref={closeButtonRef}
                  variant="secondary"
                  className="w-full"
                  onClick={onClose}
                  disabled={busy !== null}
                >
                  {dismissLabel}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
