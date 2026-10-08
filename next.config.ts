import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server only trusts localhost by default, so reaching it on the LAN
  // address (another device, or a VM) gets its dev assets and HMR socket
  // blocked — the page still renders but never hydrates, which looks like
  // dead buttons rather than an error. Hostnames only: no scheme, no port.
  allowedDevOrigins: ["10.5.0.2"],
};

export default nextConfig;
