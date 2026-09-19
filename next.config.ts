import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  reactStrictMode: false, // Disables double-mounting bugs in dev mode
};

export default function(phase: string, { defaultConfig }: { defaultConfig: NextConfig }) {
  return nextConfig;
}