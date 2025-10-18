is_editing = false;

function autoAdjustTextArea(o) {
    o.style.height = '1px';
    o.style.height = o.scrollHeight + 'px';
}

window.addEventListener("DOMContentLoaded", () => {
    const detele_btn = document.getElementById("postDelete");
    const modify_btn = document.getElementById("postModify");
    const post_caption = document.getElementById("postCaptionTextarea")
    
    autoAdjustTextArea(post_caption);
    post_caption.addEventListener("keyup", () => autoAdjustTextArea(post_caption));

    if (modify_btn) {
        modify_btn.addEventListener("click", modifyPost);
    }
  

    function modifyPost() {
        if (is_editing) {
            post_caption.setAttribute("readonly", true);
        } else {
            const { map, overlay, toggleBtn, marker } = postPage;
            is_editing = true;


            post_caption.removeAttribute("readonly");
            post_caption.focus();
            post_caption.style.backgroundColor = "#f3f0f9ff";

            overlay.style.width = '50%';
            overlay.style.height = '50%';

            toggleBtn.innerHTML = '<i data-lucide="minimize"></i>';
            toggleBtn.setAttribute('aria-label', 'Collapse map');

            modify_btn.style.backgroundColor = "#58c775"
            modify_btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-big-up-dash-icon lucide-arrow-big-up-dash"><path d="M9 13a1 1 0 0 0-1-1H5.061a1 1 0 0 1-.75-1.811l6.836-6.835a1.207 1.207 0 0 1 1.707 0l6.835 6.835a1 1 0 0 1-.75 1.811H16a1 1 0 0 0-1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M9 20h6"/></svg>`
        }
    }
});

