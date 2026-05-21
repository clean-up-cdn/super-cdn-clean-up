jQuery.noConflict();

jQuery(document).ready(function($){
    "use strict";


    // On window resize
    $(window).on('resize', function() {

        // Title Element Group Highlighter
        $('.product-style-title-eg-highlighter li').each(function() {

            var first_item = $(this).find('.product-element-group-wrapper .product-element-group-items:first').height();
            var second_item = $(this).find('.product-element-group-wrapper .product-element-group-items:nth-child(2)').height();

            var max_height = Math.max(first_item, second_item);

            jQuery(this).find('.product-element-group-wrapper').css('height', max_height);

        });

    });

    // Title Element Group Highlighter
    $('.product-style-title-eg-highlighter li').each(function() {

        var first_item = $(this).find('.product-element-group-wrapper .product-element-group-items:first').height();
        var second_item = $(this).find('.product-element-group-wrapper .product-element-group-items:nth-child(2)').height();

        var max_height = Math.max(first_item, second_item);

        jQuery(this).find('.product-element-group-wrapper').css('height', max_height);

    });

});