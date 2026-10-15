// iOS Safari draws no frame for a video that has not played, so the tile shows its placeholder.
// The #t=0.1 fragment makes it load and show the frame at 0.1 s. playsInline stops a tap from opening full screen.
export function VideoThumb({ url }: { url: string }) {
  return <video src={`${url}#t=0.1`} muted playsInline preload="metadata" disablePictureInPicture />
}
