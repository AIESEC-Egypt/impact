document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".session-video--youtube").forEach((wrap) => {
    const poster = wrap.querySelector(".session-video__poster");
    if (!poster) return;

    poster.addEventListener("click", () => {
      const videoId = wrap.dataset.videoId;
      if (!videoId) return;

      const title = wrap.dataset.videoTitle || "Session video";
      const origin = encodeURIComponent(window.location.origin);
      const iframe = document.createElement("iframe");
      iframe.src =
        `https://www.youtube.com/embed/${videoId}` +
        `?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${origin}`;
      iframe.title = title;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";

      wrap.innerHTML = "";
      wrap.appendChild(iframe);
    });
  });
});
