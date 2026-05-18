import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    //'192.168.10.174',   // Your machine
    //'192.168.10.50',    // Colleague 1
    //'192.168.10.88',    // Colleague 2
  ],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fiygczkednarfvlspkpg.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;