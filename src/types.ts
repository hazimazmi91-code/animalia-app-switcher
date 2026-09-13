export interface ManifestApp {
  id: string;
  name: string;
  url: string;
  icon: string;
  tint: "teal" | "pink" | "lavender" | "peach";
  group: string;
  /** Hidden from the switcher unless the viewer is an admin (see AnimaliaSwitcherProps.isAdmin). Optional; absent/false means visible to everyone. */
  adminOnly?: boolean;
}
