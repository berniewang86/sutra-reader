(function () {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./service-worker.js").catch(function () {
      // 离线缓存注册失败时不影响正常阅读。
    });
  });
})();
