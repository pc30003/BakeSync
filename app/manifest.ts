import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const isDemo = process.env.NEXT_PUBLIC_APP_MODE === "demo";

  return {
    name:             isDemo ? "BakeSync Demo" : "BakeSync",
    short_name:       isDemo ? "BakeSync Demo" : "BakeSync",
    description:      "Autonomous AI-powered production planning and inventory management for commercial bakeries.",
    start_url:        "/",
    display:          "standalone",
    orientation:      "any",
    background_color: "#FFFBEB",
    theme_color:      "#D97706",
    categories:       ["productivity", "food"],
    lang:             "en-GB",
    icons: [
      { src: "/icons/icon-72x72.png",   sizes: "72x72",   type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-96x96.png",   sizes: "96x96",   type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name:        "Today's Schedule",
        short_name:  "Schedule",
        description: "View today's production schedule",
        url:         "/dashboard/schedule",
        icons:       [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name:        "Log Wastage",
        short_name:  "Wastage",
        description: "Quickly log ingredient wastage",
        url:         "/dashboard/wastage",
        icons:       [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name:        "Procurement",
        short_name:  "Orders",
        description: "Review purchasing recommendations",
        url:         "/dashboard/procurement",
        icons:       [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
    ],
  };
}
