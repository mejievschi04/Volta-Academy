/* ============================================
   FORMELY LANDING PAGE
   JavaScript for animations and interactions
   ============================================ */

(function() {
    'use strict';

    // ============================================
    // NAVBAR SCROLL EFFECT
    // ============================================
    const nav = document.getElementById('nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });

    // ============================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ============================================
    // 3D TILT EFFECT FOR CARDS
    // ============================================
    class Tilt3D {
        constructor(element) {
            this.element = element;
            this.settings = {
                max: 15,
                perspective: 1000,
                scale: 1.05,
                speed: 1000,
                easing: 'cubic-bezier(.03,.98,.52,.99)'
            };
            this.init();
        }

        init() {
            this.element.style.transition = `transform ${this.settings.speed}ms ${this.settings.easing}`;
            this.element.addEventListener('mouseenter', this.onMouseEnter.bind(this));
            this.element.addEventListener('mousemove', this.onMouseMove.bind(this));
            this.element.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        }

        onMouseEnter() {
            this.element.style.transition = '';
        }

        onMouseMove(e) {
            const rect = this.element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -this.settings.max;
            const rotateY = ((x - centerX) / centerX) * this.settings.max;
            
            this.element.style.transform = `
                perspective(${this.settings.perspective}px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
                scale3d(${this.settings.scale}, ${this.settings.scale}, ${this.settings.scale})
            `;
        }

        onMouseLeave() {
            this.element.style.transition = `transform ${this.settings.speed}ms ${this.settings.easing}`;
            this.element.style.transform = '';
        }
    }

    // Initialize 3D tilt on all elements with data-tilt attribute
    document.querySelectorAll('[data-tilt]').forEach(element => {
        new Tilt3D(element);
    });

    // ============================================
    // SCROLL REVEAL ANIMATION
    // ============================================
    class ScrollReveal {
        constructor() {
            this.elements = document.querySelectorAll('.benefit-card, .pricing-card, .step-item, .screenshot-card, .ai-feature-item');
            this.init();
        }

        init() {
            // Set initial state
            this.elements.forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(50px)';
                el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            });

            // Create intersection observer
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry, index) => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        }, index * 100);
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -100px 0px'
            });

            // Observe all elements
            this.elements.forEach(el => observer.observe(el));
        }
    }

    // Initialize scroll reveal
    new ScrollReveal();

    // ============================================
    // PARALLAX EFFECT FOR HERO
    // ============================================
    const heroGradient = document.querySelector('.hero-gradient');
    if (heroGradient) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * 0.5;
            heroGradient.style.transform = `translateY(${rate}px)`;
        });
    }

    // ============================================
    // ANIMATE NUMBERS IN AI STATS
    // ============================================
    class AnimateNumbers {
        constructor() {
            this.stats = document.querySelectorAll('.ai-stat-value');
            this.init();
        }

        init() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateValue(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            this.stats.forEach(stat => observer.observe(stat));
        }

        animateValue(element) {
            const text = element.textContent.trim();
            
            // Handle percentage
            if (text.includes('%')) {
                const value = parseInt(text);
                this.countUp(element, 0, value, 2000, '%');
            }
            // Handle multiplier
            else if (text.includes('x')) {
                const value = parseFloat(text);
                this.countUp(element, 0, value, 2000, 'x');
            }
            // Handle time
            else if (text.includes('/')) {
                element.textContent = text; // Keep as is
            }
        }

        countUp(element, start, end, duration, suffix = '') {
            const range = end - start;
            const increment = end > start ? 1 : -1;
            const stepTime = Math.abs(Math.floor(duration / range));
            let current = start;

            const timer = setInterval(() => {
                current += increment;
                if (suffix === '%') {
                    element.textContent = current + suffix;
                } else if (suffix === 'x') {
                    element.textContent = current.toFixed(1) + suffix;
                }
                
                if (current === end) {
                    clearInterval(timer);
                }
            }, stepTime);
        }
    }

    // Initialize number animation
    new AnimateNumbers();

    // ============================================
    // MICRO-INTERACTIONS FOR BUTTONS
    // ============================================
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add ripple CSS dynamically
    const style = document.createElement('style');
    style.textContent = `
        .btn {
            position: relative;
            overflow: hidden;
        }
        .btn .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        }
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // ============================================
    // HOVER EFFECT FOR PRICING CARDS
    // ============================================
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.zIndex = '10';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.zIndex = '';
        });
    });

    // ============================================
    // LAZY LOADING FOR SCREENSHOTS
    // ============================================
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    // Add loaded class for animation
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('.screenshot-image').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // ============================================
    // SMOOTH PAGE LOAD
    // ============================================
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
    });

    // ============================================
    // MOBILE MENU (if needed in future)
    // ============================================
    // Can be extended for mobile navigation

    // ============================================
    // SCREENSHOTS CAROUSEL/SLIDESHOW
    // ============================================
    class ScreenshotsCarousel {
        constructor() {
            this.track = document.getElementById('carouselTrack');
            this.slides = document.querySelectorAll('.screenshot-slide');
            this.dots = document.querySelectorAll('.carousel-dot');
            this.prevBtn = document.getElementById('prevBtn');
            this.nextBtn = document.getElementById('nextBtn');
            this.currentSlide = 0;
            this.totalSlides = this.slides.length;
            this.autoPlayInterval = null;
            this.autoPlayDelay = 5000; // 5 seconds

            if (this.slides.length === 0) return;

            this.init();
        }

        init() {
            // Set initial slide
            this.showSlide(this.currentSlide);

            // Event listeners
            if (this.prevBtn) {
                this.prevBtn.addEventListener('click', () => this.prevSlide());
            }

            if (this.nextBtn) {
                this.nextBtn.addEventListener('click', () => this.nextSlide());
            }

            // Dot navigation
            this.dots.forEach((dot, index) => {
                dot.addEventListener('click', () => this.goToSlide(index));
            });

            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') this.prevSlide();
                if (e.key === 'ArrowRight') this.nextSlide();
            });

            // Auto-play
            this.startAutoPlay();

            // Pause on hover
            if (this.track) {
                this.track.addEventListener('mouseenter', () => this.stopAutoPlay());
                this.track.addEventListener('mouseleave', () => this.startAutoPlay());
            }
        }

        showSlide(index) {
            // Remove active class from all slides and dots
            this.slides.forEach(slide => slide.classList.remove('active'));
            this.dots.forEach(dot => dot.classList.remove('active'));

            // Add active class to current slide and dot
            if (this.slides[index]) {
                this.slides[index].classList.add('active');
            }
            if (this.dots[index]) {
                this.dots[index].classList.add('active');
            }

            // Update track position
            if (this.track) {
                this.track.style.transform = `translateX(-${index * 100}%)`;
            }

            // Update button states
            if (this.prevBtn) {
                this.prevBtn.disabled = index === 0;
            }
            if (this.nextBtn) {
                this.nextBtn.disabled = index === this.totalSlides - 1;
            }
        }

        nextSlide() {
            this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
            this.showSlide(this.currentSlide);
            this.resetAutoPlay();
        }

        prevSlide() {
            this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
            this.showSlide(this.currentSlide);
            this.resetAutoPlay();
        }

        goToSlide(index) {
            this.currentSlide = index;
            this.showSlide(this.currentSlide);
            this.resetAutoPlay();
        }

        startAutoPlay() {
            this.stopAutoPlay();
            this.autoPlayInterval = setInterval(() => {
                this.nextSlide();
            }, this.autoPlayDelay);
        }

        stopAutoPlay() {
            if (this.autoPlayInterval) {
                clearInterval(this.autoPlayInterval);
                this.autoPlayInterval = null;
            }
        }

        resetAutoPlay() {
            this.stopAutoPlay();
            this.startAutoPlay();
        }
    }

    // Initialize carousel when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new ScreenshotsCarousel();
        });
    } else {
        new ScreenshotsCarousel();
    }

    // ============================================
    // CONSOLE MESSAGE
    // ============================================
    console.log('%cFormely', 'font-size: 20px; font-weight: bold; color: #004643;');
    console.log('%cPlatformă LMS inteligentă pentru educație modernă', 'font-size: 12px; color: #004643;');

})();

