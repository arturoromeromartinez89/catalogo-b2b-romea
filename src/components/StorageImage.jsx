import { useEffect, useState } from "react";
import { extractStoragePath, signOnePath } from "../services/storageImages";
import { buildPlaceholderUrl, imageUrlForSize } from "../utils/formatters";

export default function StorageImage({ src = "", width = 360, fallback = "", onError, ...props }) {
  const placeholder = fallback || buildPlaceholderUrl();
  const initialUrl = extractStoragePath(src) ? "" : imageUrlForSize(src, width);
  const [resolved, setResolved] = useState(initialUrl);

  useEffect(() => {
    let active = true;
    setResolved(extractStoragePath(src) ? "" : imageUrlForSize(src, width));
    signOnePath(src).then((url) => {
      if (active) setResolved(imageUrlForSize(url, width));
    });
    return () => { active = false; };
  }, [src, width]);

  return (
    <img
      {...props}
      src={resolved || placeholder}
      onError={(event) => {
        if (event.currentTarget.src !== placeholder) event.currentTarget.src = placeholder;
        onError?.(event);
      }}
    />
  );
}
