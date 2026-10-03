import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hanif Play", short_name: "Hanif Play", start_url: "/", display: "fullscreen",
    background_color: "#05060a", theme_color: "#05060a", orientation: "any",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
