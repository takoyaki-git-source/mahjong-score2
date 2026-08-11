import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "麻雀成績",
    short_name: "麻雀成績",
    description: "半荘ごとの成績を記録・分析する成績帳",
    start_url: "/",
    display: "standalone",
    background_color: "#f1e9d8",
    theme_color: "#f1e9d8",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
