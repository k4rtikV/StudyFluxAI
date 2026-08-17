import { useEffect, useMemo, useState } from "react";

const getInitials = (name) => {
  const parts = String(name || "Student")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "S";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts.at(-1).slice(0, 1)}`.toUpperCase();
};

function UserAvatar({
  user,
  src,
  name,
  alt,
  className = "h-10 w-10 rounded-xl",
  imageClassName = "",
  fallbackClassName = "",
  initialsClassName = "",
}) {
  const avatarSrc = src ?? user?.avatar ?? "";
  const displayName = name ?? user?.fullName ?? "Student";
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarSrc]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const showImage = Boolean(avatarSrc) && !imageFailed;

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-cyan-100 via-indigo-100 to-violet-100 text-slate-700 ${className} ${fallbackClassName}`}
      aria-label={!showImage ? `${displayName} avatar` : undefined}
    >
      {showImage ? (
        <img
          src={avatarSrc}
          alt={alt ?? `${displayName} profile`}
          referrerPolicy="no-referrer"
          className={`h-full w-full object-cover ${imageClassName}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={`font-black leading-none ${initialsClassName}`}>{initials}</span>
      )}
    </div>
  );
}

export default UserAvatar;
