"use client";

import Image from "next/image";
import { MagnifyingGlassPlus } from "@phosphor-icons/react";
import { Dialog } from "@recap/admin-ui";
import { GUIDE_IMAGE_SIZE, type GuideImage as GuideImageData } from "./guide-content";

const GUIDE_IMAGE_DIR = "/guide";

/** Screenshot with a click-to-enlarge dialog. Lazy-loaded; the red frames are baked into the PNG. */
export function GuideImage({ image }: { image: GuideImageData }) {
  const src = `${GUIDE_IMAGE_DIR}/${image.file}`;
  const { width, height } = GUIDE_IMAGE_SIZE;
  return (
    <Dialog
      title="Ảnh minh họa"
      description={image.alt}
      className="max-w-5xl"
      trigger={
        <button
          type="button"
          aria-label={`Phóng to ảnh: ${image.alt}`}
          className="group relative mt-3 block w-full cursor-zoom-in overflow-hidden rounded-xl border border-soft-line bg-soft-inset text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soft-focus"
        >
          <Image
            src={src}
            alt={image.alt}
            width={width}
            height={height}
            sizes="(min-width: 1024px) 700px, 100vw"
            loading="lazy"
            unoptimized
            className="block h-auto w-full"
          />
          <span
            aria-hidden="true"
            className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-soft-surface px-2.5 py-1 text-xs font-bold text-soft-ink shadow-soft-pop"
          >
            <MagnifyingGlassPlus size={14} />
            Phóng to
          </span>
        </button>
      }
    >
      <Image
        src={src}
        alt={image.alt}
        width={width}
        height={height}
        unoptimized
        className="mt-3 block h-auto w-full rounded-xl border border-soft-line"
      />
    </Dialog>
  );
}
