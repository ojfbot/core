declare const __FLEET_RELEASE__: {
  name: string;
  version: string;
  commit: string;
  node_floor: string;
  bundled: boolean;
};

export const releaseInfo =
  typeof __FLEET_RELEASE__ === "undefined"
    ? {
        name: "fleet-runner",
        version: "0.1.0",
        commit: "source",
        node_floor: "24.22.2",
        bundled: false,
      }
    : __FLEET_RELEASE__;
