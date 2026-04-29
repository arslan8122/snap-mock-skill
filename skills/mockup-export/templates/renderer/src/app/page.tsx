"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import EditorToolbar from "@/components/mockup/EditorToolbar";
import BriefsBootstrapper from "@/components/mockup/BriefsBootstrapper";

// Konva uses window/document — must be loaded client-side only
const MockupCanvas = dynamic(() => import("@/components/mockup/MockupCanvas"), { ssr: false });

function HeadlessRenderer() {
  return (
    <div className="flex flex-col min-w-0 h-screen overflow-hidden">
      <BriefsBootstrapper />
      <EditorToolbar />
      <div className="flex flex-1 overflow-hidden border-t border-border relative">
        <MockupCanvas />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HeadlessRenderer />
    </Suspense>
  );
}
