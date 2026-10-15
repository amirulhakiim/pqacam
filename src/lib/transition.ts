export async function withTransition(update: () => unknown) {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return void (await update())
  await document.startViewTransition(async () => {
    await update()
    await new Promise((resolve) => setTimeout(resolve))
  }).updateCallbackDone
}
