// PWAのインストール判定(beforeinstallpromptの発火条件)にfetchハンドラ付きの
// Service Workerが必要なための最小実装。何もキャッシュせず、常にネットワークに
// 委ねるだけ(ブラウザのデフォルトfetch動作と実質同じ)。このアプリはSupabaseの
// ライブデータに依存するため、意図的にオフラインキャッシュは行わない。
self.addEventListener('fetch', () => {})
