/**
 * Horizontal marquee for "LEARN LEAD IMPACT" (used on /academy/ and anywhere
 * with [data-marquee="learn-lead-impact"]).
 */
(function () {
  function initMarquee(container) {
    if (!container || container.dataset.marqueeReady === "1") {
      return;
    }
    var bar = container.querySelector(".scrolling-bar");
    var first = bar && bar.querySelector(".scrolling-text");
    if (!bar || !first) {
      return;
    }

    container.dataset.marqueeReady = "1";
    bar.style.animation = "none";

    if (bar.querySelectorAll(".scrolling-text").length === 1) {
      var clone = first.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      bar.appendChild(clone);
    }

    var speed = window.innerWidth <= 900 ? 4 : 2;
    var offset = 0;

    function tick() {
      var loopWidth = first.offsetWidth;
      if (loopWidth <= 0) {
        requestAnimationFrame(tick);
        return;
      }
      offset -= speed;
      bar.style.transform = "translateX(" + offset + "px)";
      if (Math.abs(offset) >= loopWidth) {
        offset = 0;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function boot() {
    document
      .querySelectorAll('[data-marquee="learn-lead-impact"]')
      .forEach(initMarquee);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
