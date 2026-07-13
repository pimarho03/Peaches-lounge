import { getSession } from "@/lib/auth/session";
import { bookClass, cancelBooking } from "@/lib/booking/booking";

// A Response body can only be sent once, so this must be a factory —
// a shared module-level Response would come back empty after its first use.
function unauthorized(): Response {
  return Response.json(
    { ok: false, error: "You need to be signed in." },
    { status: 401 },
  );
}

export async function POST(req: Request) {
  const auth = await getSession();
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const classId = String(body.classId ?? "");
  if (!classId) {
    return Response.json(
      { ok: false, error: "Missing classId." },
      { status: 400 },
    );
  }

  const result = bookClass(auth.user.id, classId, Date.now());
  if (!result.ok) {
    switch (result.error) {
      case "not-found":
        return Response.json(
          { ok: false, error: "That class doesn't exist anymore." },
          { status: 404 },
        );
      case "already-booked":
        return Response.json(
          {
            ok: false,
            error: "You're already booked (or on the waitlist) for this class.",
          },
          { status: 409 },
        );
      case "started":
        return Response.json(
          { ok: false, error: "This class has already started." },
          { status: 410 },
        );
    }
  }

  return Response.json({
    ok: true,
    status: result.status,
    waitlistPosition: result.waitlistPosition,
  });
}

export async function DELETE(req: Request) {
  const auth = await getSession();
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const classId = String(body.classId ?? "");
  if (!classId) {
    return Response.json(
      { ok: false, error: "Missing classId." },
      { status: 400 },
    );
  }

  const result = cancelBooking(auth.user.id, classId, Date.now());
  if (!result.ok) {
    switch (result.error) {
      case "not-found":
        return Response.json(
          { ok: false, error: "You don't have a booking for this class." },
          { status: 404 },
        );
      case "cutoff":
        return Response.json(
          {
            ok: false,
            error:
              "Bookings can't be cancelled within 6 hours of class start — call the studio if something came up.",
          },
          { status: 409 },
        );
    }
  }

  return Response.json({ ok: true });
}
