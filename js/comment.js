jQuery(document).ready(function ($) {
$(document).delegate('.wpd-reply-button', 'click', function () {
var $this = $(this);
setTimeout(function () {
var parent = $this.parents('.wpd-comment');
var id = parent.attr('id').substring(parent.attr('id').lastIndexOf('-') + 1);
if (parent.children('#comtitle-' + id).length) {
$('#wpd-secondary-form-wrapper-' + id).find('#title-' + id).val($this.parents('.wpd-comment').children('#comtitle-' + id).text());
}
}, 200);
});
});