import { useMemo, useState } from "react";

function getPhotoUrl(user) {
  if (!user) return "";
  return (
    user.photoURL ||
    user.providerData?.[0]?.photoURL ||
    user.reloadUserInfo?.photoUrl ||
    ""
  );
}

function getInitials(user) {
  const name = user?.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("");
  }
  const email = user?.email?.trim();
  if (email) return email[0].toUpperCase();
  return "U";
}

export default function UserAvatar({
  user,
  size = 32,
  className = "",
  borderColor = "var(--color-saffron)",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoUrl = getPhotoUrl(user);
  const initials = useMemo(() => getInitials(user), [user]);
  const shouldShowImage = Boolean(photoUrl) && !imageFailed;

  if (shouldShowImage) {
    return (
      <img
        src={photoUrl}
        alt={user?.displayName || "User avatar"}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "999px",
          objectFit: "cover",
          border: `2px solid ${borderColor}`,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      aria-label={user?.displayName || "User avatar"}
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        border: `2px solid ${borderColor}`,
        backgroundColor: "var(--color-surface-soft)",
        color: "var(--color-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size >= 40 ? "14px" : "11px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
