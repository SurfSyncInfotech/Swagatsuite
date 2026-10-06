; (function ($) {
    "use strict";

    $(document).ready(function () {

        /**-----------------------------
         *  Navbar fix
         * ---------------------------*/
        $(document).on('click', '.navbar-area .navbar-nav li.menu-item-has-children>a', function (e) {
            e.preventDefault();
        })
       
        /*-------------------------------------
            menu
        -------------------------------------*/
        $('.navbar-area .menu').on('click', function() {
            $(this).toggleClass('open');
            $('.navbar-area .navbar-collapse').toggleClass('sopen');
        });
    
        // mobile menu
        if ($(window).width() < 992) {
            $(".in-mobile").clone().appendTo(".sidebar-inner");
            $(".in-mobile ul li.menu-item-has-children").append('<i class="fas fa-chevron-right"></i>');
            $('<i class="fas fa-chevron-right"></i>').insertAfter("");

            $(".menu-item-has-children a").on('click', function(e) {
                // e.preventDefault();

                $(this).siblings('.sub-menu').animate({
                    height: "toggle"
                }, 300);
            });
        }

        var menutoggle = $('.menu-toggle');
        var mainmenu = $('.navbar-nav');
        
        menutoggle.on('click', function() {
            if (menutoggle.hasClass('is-active')) {
                mainmenu.removeClass('menu-open');
            } else {
                mainmenu.addClass('menu-open');
            }
        });
    
        

        /* -----------------------------------------------------
            Variables
        ----------------------------------------------------- */
        var leftArrow = '<i class="fa fa-angle-left"></i>';
        var rightArrow = '<i class="fa fa-angle-right"></i>';

        /* -------------------------------------------------------------
            fact counter
        ------------------------------------------------------------- */
        if ($('.counter').length) {
            $('.counter').counterUp({
                delay: 15,
                time: 2000,
            });
        }

        /*------------------------------------------------
            testimonial-slider
        ------------------------------------------------*/
        if ($('.testimonial-slider').length) {
            $('.testimonial-slider').owlCarousel({
                loop: true,
                margin: 10,
                nav: false,
                dots: true,
                center: true,
                smartSpeed: 1000,
                responsive: {
                    0: {
                        items: 1
                    },
                    600: {
                        items: 2
                    },
                    1000: {
                        items: 3
                    }
                }
            });
        }

        /*--------------------------------------------
            Search Popup
        ---------------------------------------------*/
        var bodyOvrelay =  $('#body-overlay');
        var searchPopup = $('#search-popup');

        $(document).on('click','#body-overlay',function(e){
            e.preventDefault();
        bodyOvrelay.removeClass('active');
            searchPopup.removeClass('active');
        });
        $(document).on('click','.search',function(e){
            e.preventDefault();
            searchPopup.addClass('active');
        bodyOvrelay.addClass('active');
        });

        /*------------------------------------------------
            Magnific JS
        ------------------------------------------------*/
        $('.play-btn').magnificPopup({
            type: 'iframe',
            removalDelay: 260,
            mainClass: 'mfp-zoom-in',
        });
        $.extend(true, $.magnificPopup.defaults, {
            iframe: {
                patterns: {
                    youtube: {
                        index: 'youtube.com/',
                        id: 'v=',
                        src: 'https://www.youtube.com/embed/Wimkqo8gDZ0'
                    }
                }
            }
        });


        /*------------------
           back to top
        ------------------*/
        $(document).on('click', '.back-to-top', function () {
            $("html,body").animate({
                scrollTop: 0
            }, 2000);
        });

    });

    $(window).on("scroll", function() {
        /*---------------------------------------
        sticky menu activation && Sticky Icon Bar
        -----------------------------------------*/
        var mainMenuTop = $(".navbar-area");
        if ($(window).scrollTop() >= 1) {
            mainMenuTop.addClass('navbar-area-fixed');
        }
        else {
            mainMenuTop.removeClass('navbar-area-fixed');
        }
        
        var ScrollTop = $('.back-to-top');
        if ($(window).scrollTop() > 1000) {
            ScrollTop.fadeIn(1000);
        } else {
            ScrollTop.fadeOut(1000);
        }
    });


    $(window).on('load', function () {

        /*-----------------
            preloader
        ------------------*/
        var preLoder = $("#preloader");
        preLoder.fadeOut(0);

        /*-----------------
            back to top
        ------------------*/
        var backtoTop = $('.back-to-top')
        backtoTop.fadeOut();

        /*---------------------
            Cancel Preloader
        ----------------------*/
        $(document).on('click', '.cancel-preloader a', function (e) {
            e.preventDefault();
            $("#preloader").fadeOut(2000);
        });

    });


    /*---------------------
        Google Map
    ----------------------*/
    if($('#map-canvas').length > 0){
      function popup_listing_map(){
         var map;        
          var myCenter=new google.maps.LatLng(53, -1.33);
          var marker=new google.maps.Marker({
              position:myCenter
          });
          function initialize() {
              var mapProp = {
                center:myCenter,
                zoom: 14,
                draggable: false,
                scrollwheel: false,
                mapTypeId:google.maps.MapTypeId.ROADMAP
              };

              map=new google.maps.Map(document.getElementById("map-canvas"),mapProp);

               //Map Marker
              var marker = new google.maps.Marker({
                  position:myCenter,
                  map: map,
              });

              google.maps.event.addListener(marker, 'click', function() {
                
              infowindow.setContent(contentString);
              infowindow.open(map, marker);

              }); 
          };

          google.maps.event.addDomListener(window, 'load', initialize);

          google.maps.event.addDomListener(window, "resize", resizingMap());

          $('#popupmodal').on('show.bs.modal', function() {
             //Must wait until the render of the modal appear, thats why we use the resizeMap and NOT resizingMap!! ;-)
             resizeMap();
          })

          function resizeMap() {
             if(typeof map =="undefined") return;
             setTimeout( function(){resizingMap();} , 400);
          }

          function resizingMap() {
             if(typeof map =="undefined") return;
             var center = map.getCenter();
             google.maps.event.trigger(map, "resize");
             map.setCenter(center); 
          } 
      }
      popup_listing_map();

    }



})(jQuery);