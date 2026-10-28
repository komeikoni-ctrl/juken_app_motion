// アプリのバージョン。デプロイのたびにここを上げる（sw.js はこのファイルを読み込んで同じ値を使う）。
// Service Worker がこの値の変化を検知して「新しいバージョンがあります」バナーを出す。
const APP_VERSION = 'motion-1.0';
const APP_BUILT_AT = '2026-10-28';
// cron-secret-rotation: 2026-10-27
