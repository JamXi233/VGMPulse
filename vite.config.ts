import vinext from "vinext";
import { defineConfig } from "vite";

// 文件事件受限时使用轮询；可通过 VGM_WATCH_POLLING=0 关闭。
const usePolling = process.env.VGM_WATCH_POLLING === "1" ||
  (process.platform === "darwin" && process.env.VGM_WATCH_POLLING !== "0");

export default defineConfig({
  plugins: [vinext()],
  server: usePolling
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
});
