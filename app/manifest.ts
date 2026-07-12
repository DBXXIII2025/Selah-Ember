import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Selah Ember",
    short_name: "Selah Ember",
    description: "An open faith community for encouragement, prayer, Bible study groups, and fellowship.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7ead7",
    theme_color: "#151210",
    orientation: "any",
    categories: ["social", "education", "lifestyle"],
    icons: [
      {
        src: "/icons/selah-ember-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/selah-ember-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/selah-ember-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/selah-ember-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
