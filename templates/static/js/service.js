document.addEventListener("DOMContentLoaded", function () {
  var carousel = document.querySelector(".carousel"),
    list = document.querySelector(".list"),
    runningTime = document.querySelector(".carousel .timeRunning");

  let timeRunning = 3000;
  let timeAutoNext = 7000;
  let runTimeOut, runNextAuto;
  let startX = 0,
    isDragging = false,
    deltaX = 0;

  function resetTimeAnimation() {
    runningTime.style.animation = "none";
    void runningTime.offsetWidth;
    runningTime.style.animation = null;
    runningTime.style.animation = "runningTime 7s linear 1 forwards";
  }

  function showSlider(type) {
    let sliderItemsDom = list.querySelectorAll(".item");
    if (sliderItemsDom.length < 2) return;
    if (type === "next") {
      list.appendChild(sliderItemsDom[0]);
      carousel.classList.add("next");
    } else {
      list.prepend(sliderItemsDom[sliderItemsDom.length - 1]);
      carousel.classList.add("prev");
    }

    clearTimeout(runTimeOut);
    runTimeOut = setTimeout(() => {
      carousel.classList.remove("next");
      carousel.classList.remove("prev");
    }, timeRunning);

    clearTimeout(runNextAuto);
    runNextAuto = setTimeout(() => {
      showSlider("next");
    }, timeAutoNext);

    resetTimeAnimation();
  }

  // Mouse & touch drag events
  list.addEventListener("mousedown", function (e) {
    isDragging = true;
    startX = e.pageX;
    deltaX = 0;
    list.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;
    deltaX = e.pageX - startX;
    // Optionally, you could move the list visually here for feedback
  });

  document.addEventListener("mouseup", function (e) {
    if (!isDragging) return;
    isDragging = false;
    list.style.cursor = "grab";
    if (deltaX > 70) {
      showSlider("prev");
    } else if (deltaX < -70) {
      showSlider("next");
    }
    deltaX = 0;
  });

  // Touch events for mobile
  list.addEventListener("touchstart", function (e) {
    isDragging = true;
    startX = e.touches[0].pageX;
    deltaX = 0;
  });

  list.addEventListener("touchmove", function (e) {
    if (!isDragging) return;
    deltaX = e.touches[0].pageX - startX;
    // Optionally, you could move the list visually here for feedback
  });

  list.addEventListener("touchend", function (e) {
    if (!isDragging) return;
    isDragging = false;
    if (deltaX > 70) {
      showSlider("prev");
    } else if (deltaX < -70) {
      showSlider("next");
    }
    deltaX = 0;
  });

  // Start the initial animation
  resetTimeAnimation();
  runNextAuto = setTimeout(() => {
    showSlider("next");
  }, timeAutoNext);
});
