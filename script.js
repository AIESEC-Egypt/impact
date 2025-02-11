document.addEventListener('DOMContentLoaded', function () {
    const letters = document.querySelectorAll('.letter');
    let ticking = false;

    // Parallax Effect with requestAnimationFrame
  //  function handleScroll() {
     //   if (!ticking) {
       //     requestAnimationFrame(() => {
         //       const scrolled = window.scrollY;
           //     letters.forEach(letter => {
             //       letter.style.transform = `translateY(${scrolled * 0.15}px)`;
               // });
                //ticking = false;
            //});
        //}
        //ticking = true;
    //}

    //window.addEventListener('scroll', handleScroll);

    // Animate Impact Letters on Load
    letters.forEach((letter, index) => {
        letter.style.opacity = '0';
        letter.style.transform = 'translateY(200px)';
        setTimeout(() => {
            letter.style.transition = 'all 1s ease';
            letter.style.opacity = '1';
            letter.style.transform = 'translateY(0)';
        }, 100 * index);
    });

    // GSAP Scroll Animations for AIESEC Hub
    gsap.registerPlugin(ScrollTrigger);

    gsap.from(".hey-text", {
        y: 100,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
            trigger: ".aiesec-hub",
            start: "top 80%",
            toggleActions: "play none none none"
        }
    });



    // Intersection Observer for Lazy Loading Sections
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, { threshold: 0.2 });

    const aiesecHubSection = document.querySelector('.aiesec-hub');
    if (aiesecHubSection) observer.observe(aiesecHubSection);
});

function scrollLeft() {
    document.querySelector(".scroll-content").scrollBy({
        left: -300,
        behavior: "smooth"
    });
}

function scrollRight() {
    document.querySelector(".scroll-content").scrollBy({
        left: 300,
        behavior: "smooth"
    });
}
document.addEventListener("DOMContentLoaded", function () {
    const slider = document.querySelector(".slider");
    let activeIndex = 0;
    const totalSlides = document.querySelectorAll(".card").length;

    function updateSliderPosition() {
        const offset = -activeIndex * 100; // Move slider left by percentage
        slider.style.transform = `translateX(${offset}%)`;
    }

    function autoSlide() {
        setInterval(() => {
            activeIndex = (activeIndex + 1) % totalSlides;
            updateSliderPosition();
        }, 3000); // Slide every 3 seconds
    }

    updateSliderPosition();
    autoSlide();
});


document.addEventListener("scroll", () => {
    const letters = document.querySelectorAll(".letter");
    let scrollTop = window.scrollY;
    let maxScroll = 800; // Adjust this to control how much the image scrolls before stopping

    letters.forEach((letter, index) => {
        let percentage = Math.min(scrollTop / maxScroll, 1); // Ensures smooth transition
        let bgY = percentage * 100; // Moves the background image upward
        
        // Get the initial X position for each letter
        let initialX = [10, 20, 40, 60, 80, 90][index]; // Matches CSS values

        // Apply the background movement to each letter while keeping its initial X position
        letter.style.backgroundPosition = `${initialX}% ${bgY}%`;
    });
});

document.addEventListener("DOMContentLoaded", function () {
    // Carousel functionality
    const carousel = document.querySelector(".carousel");
    const cards = document.querySelectorAll(".cards, .cards1, .cards2, .cards3, .cards4");
    const leftArrow = document.getElementById("leftArrow");
    const rightArrow = document.getElementById("rightArrow");

    let currentIndex = 0;

    function updateCarousel() {
        // Reset visibility and styling for all cards
        cards.forEach((card, index) => {
            // Calculate the position relative to the currentIndex
            const relativeIndex = (index - currentIndex + cards.length) % cards.length;

            if (relativeIndex === 0) {
                // Center card: full opacity, full scale
                card.style.visibility = "visible";
                card.style.opacity = 1;
                card.style.transform = "translateX(0) scale(1)"; // Full size at center
            } else if (relativeIndex === 1 || relativeIndex === cards.length - 1) {
                // Cards on the immediate left/right: slightly reduced opacity and scale
                card.style.visibility = "visible";
                card.style.opacity = 0.5; // Reduced opacity for cards near center
                card.style.transform = `translateX(${relativeIndex === 1 ? '100%' : '-100%'}) scale(0.9)`; // Move right or left
            } else if (relativeIndex === 2 || relativeIndex === cards.length - 2) {
                // Cards that are further left/right: even more reduced opacity and scale
                card.style.visibility = "visible";
                card.style.opacity = 0.3; // Even more reduced opacity
                card.style.transform = `translateX(${relativeIndex === 2 ? '200%' : '-200%'}) scale(0.8)`; // Move further right or left
            }
        });
    }

    // Move carousel to the left
    leftArrow.addEventListener("click", () => {
        if (currentIndex > 0) {
            currentIndex--;
        } else {
            currentIndex = cards.length - 1; // Wrap around to the last card
        }
        updateCarousel();
    });

    // Move carousel to the right
    rightArrow.addEventListener("click", () => {
        if (currentIndex < cards.length - 1) {
            currentIndex++;
        } else {
            currentIndex = 0; // Wrap around to the first card
        }
        updateCarousel();
    });

    updateCarousel();  // Initialize carousel position
});

document.addEventListener("DOMContentLoaded", function () {
    new Swiper(".newsSwiper", {
        effect:"coverflow",
        centeredSlides: true,
        slidesPerView: "auto", // Allow dynamic width
        spaceBetween: 30, // Keep spacing between slides
        slideToClickedSlide: true,
        speed: 800, // Smooth transition speed
        allowTouchMove: true,
        preventClicks: false,
        preventClicksPropagation: false,
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        breakpoints: {
            1024: { slidesPerView: 3, spaceBetween: 30 }, // Large screens: 3 cards
            768: { slidesPerView: 2, spaceBetween: 20 }, // Tablets: 2 cards
            480: { slidesPerView: 1, spaceBetween: 10, centeredSlides: true }, // Mobile: 1 centered card
        },
    });
});




document.addEventListener("DOMContentLoaded", function () {
    new Swiper(".academySwiper", {
        effect: "coverflow",
        centeredSlides: true,
        slidesPerView: "auto", // Allow dynamic width on all screen sizes
        slideToClickedSlide: true,
        speed: 800,
        allowTouchMove: true,
        preventClicks: false,
        preventClicksPropagation: false,
        coverflowEffect: {
            rotate: 0,
            stretch: 20,  // Keep spacing tight between slides
            depth: 200,
            modifier: 1.2,
            slideShadows: false,
        },
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        breakpoints: {
            1024: { slidesPerView: 2 }, // Large screens: show 3 slides
            768: { slidesPerView: 2 }, // Tablets: show 2 slides
            480: { slidesPerView: "auto", centeredSlides: true }, // Mobile: 1 full-size card
        },
    });
});


document.addEventListener("DOMContentLoaded", function () {
    const scrollingContainer = document.querySelector(".scrolling-content");

    function duplicateImages() {
        const images = scrollingContainer.children;
        const totalImages = images.length;

        // Duplicate images for smooth infinite scrolling
        for (let i = 0; i < totalImages; i++) {
            let clone = images[i].cloneNode(true);
            scrollingContainer.appendChild(clone);
        }
    }

    function startScrolling() {
        let scrollSpeed = window.innerWidth <= 900 ? 2 : 1; // Double speed for mobile
        let scrollAmount = 0;

        function scroll() {
            scrollAmount -= scrollSpeed;
            scrollingContainer.style.transform = `translateX(${scrollAmount}px)`;

            // Reset position when first set of images moves completely
            if (Math.abs(scrollAmount) >= scrollingContainer.scrollWidth / 2) {
                scrollAmount = 0;
            }

            requestAnimationFrame(scroll);
        }

        scroll();
    }

    duplicateImages(); // Call function to duplicate images
    startScrolling(); // Start the infinite loop
});

document.addEventListener("DOMContentLoaded", function () {
    const scrollingBar = document.querySelector(".scrolling-bar");
    const scrollingText = document.querySelector(".scrolling-text");

    // Duplicate content for seamless looping
    const duplicateText = scrollingText.cloneNode(true);
    scrollingBar.appendChild(duplicateText);

    let scrollSpeed = window.innerWidth <= 900 ? 4 : 2; // Double speed for mobile
    let scrollAmount = 0;

    function scroll() {
        scrollAmount -= scrollSpeed;
        scrollingBar.style.transform = `translateX(${scrollAmount}px)`;

        // Reset when the first set moves completely
        if (Math.abs(scrollAmount) >= scrollingText.offsetWidth) {
            scrollAmount = 0;
        }

        requestAnimationFrame(scroll);
    }

    scroll(); // Start scrolling
});

window.onload = function () {

    //hide the preloader
    document.querySelector(".pre-loader").style.display = "none";
  };
  document.addEventListener("DOMContentLoaded", function () {
    const navbar = document.querySelector(".navbar");
    let lastScrollY = window.scrollY;
    let isMobile = window.innerWidth > 768; // Detect mobile device

    window.addEventListener("scroll", function () {
        let currentScrollY = window.scrollY;
if(isMobile){

            if (window.scrollY > 900) {  // Adjust trigger point as needed
                navbar.classList.add("fixed-nav");
                document.body.classList.add("fixed-body"); // Prevent content from jumping
            } else {
                navbar.classList.remove("fixed-nav");
                document.body.classList.remove("fixed-body");
            }
        }
        lastScrollY = currentScrollY; // Update last scroll position
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");

    window.addEventListener("scroll", function () {
        if (window.scrollY > 300) { 
            // Show button when scrolling down
            scrollToTopBtn.classList.add("show");
        } else {
            // Hide button when at the top
            scrollToTopBtn.classList.remove("show");
        }
    });

    // Smooth Scroll to Top
    scrollToTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});


    console.log("Checking session...");

//    setTimeout(() => {
  //      const token = sessionStorage.getItem("accessToken");
    //    if (!token) {
      //      console.log("No token found, redirecting to login...");
        //    window.location.href = "login.html";
        //} else {
          //  console.log("User is logged in.");
       // }
    //}, 500); // Wait 500ms before checking sessionStorage


    document.addEventListener("DOMContentLoaded", function () {
        const menuToggle = document.querySelector(".menu-toggle");
        const navLinks = document.querySelector(".nav-links");
        const dropdowns = document.querySelectorAll(".dropdown");
    
        // Toggle mobile menu
        menuToggle.addEventListener("click", function () {
            navLinks.classList.toggle("active");
        });
    
        // Toggle dropdowns for mobile
        dropdowns.forEach(dropdown => {
            dropdown.addEventListener("click", function (event) {
                event.stopPropagation(); // Prevents closing immediately
                this.classList.toggle("open");
            });
        });
    
        // Close dropdowns when clicking outside
        document.addEventListener("click", function (event) {
            dropdowns.forEach(dropdown => {
                if (!dropdown.contains(event.target)) {
                    dropdown.classList.remove("open");
                }
            });
        });
    });
    
    document.addEventListener("DOMContentLoaded", function () {
        const dropdownToggle = document.getElementById("functionalAcademies");
        const dropdownMenu = document.getElementById("dropdownMenu");

        dropdownToggle.addEventListener("click", function (event) {
            event.preventDefault();
            dropdownMenu.classList.toggle("show");
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", function (event) {
            if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
                dropdownMenu.classList.remove("show");
            }
        });
    });